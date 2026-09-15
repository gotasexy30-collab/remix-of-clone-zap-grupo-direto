// NexusPag webhook — registra PIX aprovado server-side
import { createClient } from "@supabase/supabase-js";

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
const NEXUS_API = "https://api.nexuspag.com/v1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const settingCache = new Map<string, { value: string | null; exp: number }>();
const SETTING_TTL_MS = 5 * 60 * 1000;

async function getSetting(key: string): Promise<string | null> {
  const cached = settingCache.get(key);
  if (cached && cached.exp > Date.now()) return cached.value;
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  const value = data?.value ?? null;
  settingCache.set(key, { value, exp: Date.now() + SETTING_TTL_MS });
  return value;
}

async function sendCapiPurchase(paymentId: string, amount: number, metadata: Record<string, string> = {}) {
  try {
    const pixelId = await getSetting("meta_pixel_id");
    const accessToken = Deno.env.get("META_CAPI_TOKEN") || "";
    if (!pixelId || !accessToken) return;
    // Cap value to prevent ROAS poisoning from upstream bugs
    const safeAmount = Math.max(0, Math.min(Number(amount) || 0, 10000));


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
        custom_data: { value: safeAmount, currency: "BRL" },
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
  // ALWAYS re-fetch the transaction from NexusPag API to prevent
  // webhook spoofing (attackers crafting payloads with fake amounts).
  const initial = idOrPayload;
  const id = typeof initial === "string"
    ? initial
    : (initial?.id || initial?.uuid || initial?.transaction_id || initial?.txid || initial?.external_id);
  if (!id) {
    console.log("webhook sem id, payload:", idOrPayload);
    return;
  }

  // Final check for the project tag if needed, but let's rely on metadata/id.
  
  const res = await fetch(`${NEXUS_API}/transactions/${id}`, {
    headers: { "Authorization": `Bearer ${NEXUS_KEY}` },
  });

  let data;
  try {
    data = await res.json();
  } catch(e) {
    console.error("Error parsing JSON from nexuspag:", e);
    return;
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

    // O webhook pode vir com o objeto da transação direto, ou aninhado
    const payload = body?.transaction || body?.data?.transaction || body?.data || body?.pix || body;
    await processPayment(payload);

    return json({ ok: true });
  } catch (e) {
    console.error("webhook err", e);
    return json({ ok: true, error: String(e) }, 200);
  }
});
