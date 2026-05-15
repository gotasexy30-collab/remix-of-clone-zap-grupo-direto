// NexusPag webhook — registra PIX aprovado server-side
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const NEXUS_KEY = Deno.env.get("NEXUSPAG_API_KEY")!;
const NEXUS_API = "https://nexuspag.com";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
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
      data: [{
        event_name: "Purchase",
        event_id: `np_${paymentId}`,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: metadata.event_source_url || "",
        user_data: userData,
        custom_data: { value: amount, currency: "BRL" },
      }],
    };
    await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
  } catch (e) {
    console.error("capi err", e);
  }
}

function normalizeStatus(s: any): string {
  const v = String(s || "").toLowerCase();
  if (["paid", "approved", "completed", "confirmed", "success"].includes(v)) return "approved";
  return v;
}

async function processPayment(idOrPayload: any) {
  let data = idOrPayload;
  // Se só recebemos id, busca os detalhes
  if (typeof data === "string" || (data && !data.amount && !data.transaction_amount)) {
    const id = typeof data === "string" ? data : (data.id || data.uuid || data.transaction_id || data.txid || data.external_id);
    if (!id) {
      console.log("webhook sem id, payload:", idOrPayload);
      return;
    }
    const res = await fetch(`${NEXUS_API}/api/pix/${id}`, {
      headers: { "x-api-key": NEXUS_KEY },
    });
    if (!res.ok) {
      console.error("NexusPag fetch failed", id, await res.text());
      return;
    }
    data = await res.json();
  }

  const status = normalizeStatus(data?.status);
  if (status !== "approved") {
    console.log(`webhook status=${data?.status}, skipping`);
    return;
  }

  const paymentId = String(data?.id ?? data?.uuid ?? data?.transaction_id ?? data?.txid ?? data?.external_id ?? "");
  const amount = Number(data?.amount ?? data?.transaction_amount) || 0;
  const md = data?.metadata || {};
  const sessionId = md?.session_id || "";

  const { data: inserted, error } = await supabase
    .from("purchases")
    .insert({
      mp_payment_id: paymentId,
      amount,
      session_id: sessionId,
      status: "approved",
      approved_at: data?.paid_at || data?.date_approved || new Date().toISOString(),
    })
    .select()
    .maybeSingle();

  if (error) {
    console.log("purchase insert skipped:", error.message);
    await sendCapiPurchase(paymentId, amount, md);
    return;
  }

  if (inserted) {
    await supabase.from("tracked_events").insert({
      event_name: "Purchase",
      session_id: sessionId,
      slug: "webhook",
    });
    await sendCapiPurchase(paymentId, amount, md);
    console.log(`purchase ${paymentId} recorded`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    let body: any = {};
    try { body = await req.json(); } catch { /* noop */ }

    // O webhook pode vir com o objeto da transação direto, ou aninhado em data/transaction
    const payload = body?.data || body?.transaction || body?.pix || body;
    await processPayment(payload);

    return json({ ok: true });
  } catch (e) {
    console.error("webhook err", e);
    return json({ ok: true, error: String(e) }, 200);
  }
});
