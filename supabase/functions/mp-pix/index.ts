// NexusPag PIX integration (mantém o nome mp-pix p/ não quebrar o frontend)
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

const NEXUS_KEY = Deno.env.get("NEXUSPAG_API_KEY")!;
const NEXUS_API = "https://nexuspag.com";
const PROJECT_TAG = "projeto2"; // tag única deste projeto p/ isolar webhooks compartilhados

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
    const fbRes = await fetch(
      `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    if (!fbRes.ok) console.error("Meta CAPI purchase error", await fbRes.text());
  } catch (e) {
    console.error("capi purchase err", e);
  }
}

// Helpers tolerantes a variações de nomenclatura de campos
function pickId(d: any): string {
  return String(d?.id ?? d?.uuid ?? d?.transaction_id ?? d?.txid ?? d?.external_id ?? "");
}
function pickQrCode(d: any): string {
  return d?.qr_code ?? d?.pix_copia_cola ?? d?.copia_cola ?? d?.brcode ?? d?.payload ?? d?.emv ?? d?.pix?.qr_code ?? d?.pix?.payload ?? "";
}
function pickQrBase64(d: any): string {
  const v = d?.qr_code_base64 ?? d?.qr_code_image ?? d?.qrcode_image ?? d?.qr_image ?? d?.pix?.qr_code_base64 ?? "";
  if (!v) return "";
  return String(v).startsWith("data:") ? String(v).split(",").pop() || "" : String(v);
}
function normalizeStatus(s: any): string {
  const v = String(s || "").toLowerCase();
  if (["paid", "approved", "completed", "confirmed", "success"].includes(v)) return "approved";
  if (["pending", "waiting", "created", "processing"].includes(v)) return "pending";
  if (["expired", "canceled", "cancelled", "failed", "refused"].includes(v)) return "rejected";
  return v || "pending";
}

async function createPix(body: any) {
  const amount = Number(body.amount) || 19.9;
  const description = body.description || "Acesso Clube Secreto VIP";
  const externalId = body.external_id || `cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const webhookUrl = `${projectUrl}/functions/v1/nexuspag-webhook`;

  const payload = {
    amount,
    description,
    external_id: externalId,
    webhook_url: webhookUrl,
    metadata: {
      session_id: body.session_id || "",
      fbp: body.meta?.fbp || "",
      fbc: body.meta?.fbc || "",
      event_source_url: body.meta?.event_source_url || "",
      user_agent: body.meta?.user_agent || "",
    },
  };

  const res = await fetch(`${NEXUS_API}/api/pix/create`, {
    method: "POST",
    headers: {
      "x-api-key": NEXUS_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("NexusPag create error", res.status, raw);
    return { error: raw?.message || raw?.error || "Erro ao criar PIX", details: raw };
  }
  const data = raw?.transaction || raw?.data || raw;

  const qrCode = pickQrCode(data);
  let qrBase64 = pickQrBase64(data);
  if (!qrBase64 && qrCode) {
    try {
      const qrRes = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrCode)}`);
      if (qrRes.ok) {
        const buf = new Uint8Array(await qrRes.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        qrBase64 = btoa(bin);
      }
    } catch (e) { console.error("qr gen err", e); }
  }

  return {
    id: pickId(data),
    status: normalizeStatus(data?.status),
    qr_code: qrCode,
    qr_code_base64: qrBase64,
    ticket_url: data?.ticket_url || data?.payment_url || "",
  };
}

async function checkStatus(body: any) {
  const id = body.id;
  if (!id) return { error: "id required" };
  const sessionId = body.session_id || "";

  const res = await fetch(`${NEXUS_API}/api/pix/${id}`, {
    headers: { "x-api-key": NEXUS_KEY },
  });
  const raw = await res.json().catch(() => ({}));
  if (!res.ok) return { error: raw?.message || raw?.error || "Erro ao consultar" };
  const data = raw?.transaction || raw?.data || raw;

  const status = normalizeStatus(data?.status);

  if (status === "approved") {
    const md = data?.metadata || {};
    const paymentSessionId = md?.session_id || sessionId;
    const amount = Number(data?.amount ?? data?.transaction_amount) || 0;
    const paymentId = pickId(data) || String(id);

    const { data: inserted } = await supabase
      .from("purchases")
      .insert({
        mp_payment_id: paymentId,
        amount,
        session_id: paymentSessionId,
        status: "approved",
        approved_at: data?.paid_at || data?.date_approved || new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (inserted) {
      await supabase.from("tracked_events").insert({
        event_name: "Purchase",
        session_id: paymentSessionId,
        slug: "webhook",
      });
    }
    await sendCapiPurchase(paymentId, amount, md);
  }

  return {
    id: pickId(data) || String(id),
    status,
    status_detail: data?.status_detail || "",
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
