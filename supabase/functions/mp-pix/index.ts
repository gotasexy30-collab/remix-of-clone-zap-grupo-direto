// Mercado Pago PIX integration
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;
const MP_API = "https://api.mercadopago.com";

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
        event_id: `mp_${paymentId}`,
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: metadata.event_source_url || "",
        user_data: userData,
        custom_data: { value: amount, currency: "BRL" },
      }],
    };
    const fbRes = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    if (!fbRes.ok) console.error("Meta CAPI purchase error", await fbRes.text());
  } catch (e) {
    console.error("capi purchase err", e);
  }
}

async function createPix(body: any) {
  const amount = Number(body.amount) || 19.9;
  const description = body.description || "Acesso Clube Secreto VIP";
  const payer_email =
    body.payer_email || `cliente_${Date.now()}@clubesecreto.com`;

  const idempotencyKey = crypto.randomUUID();

  const res = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MP_TOKEN}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description,
      payment_method_id: "pix",
      payer: { email: payer_email },
      metadata: {
        session_id: body.session_id || "",
        fbp: body.meta?.fbp || "",
        fbc: body.meta?.fbc || "",
        event_source_url: body.meta?.event_source_url || "",
        user_agent: body.meta?.user_agent || "",
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return { error: data?.message || "Erro ao criar PIX", details: data };
  }

  const tx = data?.point_of_interaction?.transaction_data;
  return {
    id: data.id,
    status: data.status,
    qr_code: tx?.qr_code || "",
    qr_code_base64: tx?.qr_code_base64 || "",
    ticket_url: tx?.ticket_url || "",
  };
}

async function checkStatus(body: any) {
  const id = body.id;
  if (!id) return { error: "id required" };
  const sessionId = body.session_id || "";

  const res = await fetch(`${MP_API}/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  const data = await res.json();
  if (!res.ok) return { error: data?.message || "Erro ao consultar" };

  // Quando aprovado, registra na tabela purchases (idempotente via UNIQUE)
  if (data.status === "approved") {
    const paymentSessionId = data?.metadata?.session_id || sessionId;
    const amount = Number(data.transaction_amount) || 0;
    const { data: inserted } = await supabase
      .from("purchases")
      .insert({
        mp_payment_id: String(data.id),
        amount,
        session_id: paymentSessionId,
        status: "approved",
        approved_at: data.date_approved || new Date().toISOString(),
      })
      .select()
      .maybeSingle();
    // Só loga tracked_event se foi insert novo (evita duplicar com webhook)
    if (inserted) {
      await supabase.from("tracked_events").insert({
        event_name: "Purchase",
        session_id: paymentSessionId,
        slug: "webhook",
      });
      await sendCapiPurchase(String(data.id), amount, data?.metadata || {});
    }
  }

  return {
    id: data.id,
    status: data.status,
    status_detail: data.status_detail,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case "create_pix":
        return json(await createPix(body));
      case "check_status":
        return json(await checkStatus(body));
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
