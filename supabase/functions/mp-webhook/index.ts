// Mercado Pago Webhook — registers approved PIX server-side
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const supabase = createClient(
  SUPABASE_URL,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

async function sendCapiPurchase(paymentId: string, amount: number, metadata: Record<string, string> = {}) {
  try {
    const [pixelId, accessToken] = await Promise.all([
      getSetting("meta_pixel_id"),
      getSetting("meta_capi_token"),
    ]);
    if (!pixelId || !accessToken) return;

    const userData: Record<string, string> = {};
    if (metadata.user_agent) userData.client_user_agent = metadata.user_agent;
    if (metadata.fbp) userData.fbp = metadata.fbp;
    if (metadata.fbc) userData.fbc = metadata.fbc;

    const payload = {
      data: [
        {
          event_name: "Purchase",
          event_id: `mp_${paymentId}`,
          event_time: Math.floor(Date.now() / 1000),
          action_source: "website",
          event_source_url: metadata.event_source_url || "",
          user_data: userData,
          custom_data: { value: amount, currency: "BRL" },
        },
      ],
    };
    await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    ).then(async (res) => {
      if (!res.ok) console.error("Meta CAPI purchase error", await res.text());
      else console.log("Meta CAPI purchase sent", paymentId, await res.text());
    });
  } catch (e) {
    console.error("capi err", e);
  }
}

async function processPayment(paymentId: string) {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!res.ok) {
    console.error("MP fetch failed", paymentId, await res.text());
    return;
  }
  const data = await res.json();
  if (data.status !== "approved") {
    console.log(`payment ${paymentId} status=${data.status}, skipping`);
    return;
  }

  const amount = Number(data.transaction_amount) || 0;
  const sessionId = data?.metadata?.session_id || "";

  // Idempotent insert (UNIQUE on mp_payment_id)
  const { data: inserted, error } = await supabase
    .from("purchases")
    .insert({
      mp_payment_id: String(data.id),
      amount,
      session_id: sessionId,
      status: "approved",
      approved_at: data.date_approved || new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (error) {
    // duplicate = already processed, but still retry Meta so no approved sale is left unreported
    console.log("purchase insert skipped:", error.message);
    await sendCapiPurchase(String(data.id), amount, data?.metadata || {});
    return;
  }

  if (inserted) {
    // Log Purchase event for dashboard (only once)
    await supabase.from("tracked_events").insert({
      event_name: "Purchase",
      session_id: sessionId,
      slug: "webhook",
    });
    await sendCapiPurchase(String(data.id), amount, data?.metadata || {});
    console.log(`purchase ${paymentId} recorded`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    // MP envia paymentId via query (?id=123&topic=payment) ou body
    const url = new URL(req.url);
    const qId = url.searchParams.get("id") || url.searchParams.get("data.id");
    const qTopic = url.searchParams.get("topic") || url.searchParams.get("type");

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      /* MP às vezes manda sem body */
    }

    const paymentId =
      qId ||
      body?.data?.id ||
      body?.resource?.toString().split("/").pop() ||
      body?.id;
    const topic = qTopic || body?.type || body?.topic;

    if (!paymentId) return json({ ok: true, skipped: "no_id" });
    if (topic && !String(topic).includes("payment"))
      return json({ ok: true, skipped: `topic_${topic}` });

    await processPayment(String(paymentId));
    return json({ ok: true });
  } catch (e) {
    console.error("webhook err", e);
    return json({ ok: true, error: String(e) }, 200); // Sempre 200 pra MP não reenviar infinito
  }
});
