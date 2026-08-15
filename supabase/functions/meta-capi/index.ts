import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const settingCache = new Map<string, { value: string | null; exp: number }>();
const SETTING_TTL_MS = 5 * 60 * 1000; // 5 min em memória p/ reduzir leituras ao banco

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      event_name,
      event_id,
      event_source_url,
      value,
      currency = "BRL",
      fbp,
      fbc,
      user_agent,
      test_event_code,
    } = body;

    // Whitelist event names the client app is allowed to send.
    // Server-only events (e.g. Purchase) come from mp-pix/webhooks, not this endpoint.
    const ALLOWED_EVENTS = new Set([
      "PageView", "ViewContent", "Lead", "Contact",
      "ChatStarted", "InitiateCheckout", "PixGenerated", "PixCopied",
      "TutorialOpened", "AlreadyPaid", "PresselPassed", "RedirectDesktop",
    ]);

    if (!event_name || !event_id || typeof event_name !== "string" || typeof event_id !== "string") {
      return json({ error: "event_name and event_id required" }, 400);
    }
    if (event_name.length > 64 || event_id.length > 128) {
      return json({ error: "invalid field length" }, 400);
    }
    if (!ALLOWED_EVENTS.has(event_name)) {
      return json({ skipped: true, reason: "event_not_allowed" });
    }
    // Cap value to a sane range to prevent ROAS poisoning
    const safeValue = typeof value === "number" && isFinite(value) && value >= 0 && value <= 10000
      ? value
      : undefined;

    const pixelId = await getSetting("meta_pixel_id");
    // Primeiro tenta ler do banco (prioridade para configuração do painel)
    // Se não houver no banco, usa a variável de ambiente (secret) como fallback
    let accessToken = await getSetting("meta_capi_token");
    if (!accessToken) {
      accessToken = Deno.env.get("META_CAPI_TOKEN") || "";
    }

    if (!pixelId || !accessToken) {
      return json({ skipped: true, reason: "pixel_or_token_not_configured" });
    }

    const fwd = req.headers.get("x-forwarded-for") || "";
    const cfIp = req.headers.get("cf-connecting-ip") || "";
    const realIp = req.headers.get("x-real-ip") || "";
    const candidates = [
      ...fwd.split(",").map((s) => s.trim()),
      cfIp,
      realIp,
    ].filter(Boolean);
    const ipv6 = candidates.find((ip) => ip.includes(":"));
    const ipv4 = candidates.find((ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip));
    const clientIp = ipv6 || ipv4 || "";

    const userData: Record<string, unknown> = {
      client_user_agent: user_agent || req.headers.get("user-agent") || "",
    };
    if (clientIp) userData.client_ip_address = clientIp;
    if (fbp) userData.fbp = fbp;
    if (fbc) userData.fbc = fbc;

    const eventPayload: Record<string, unknown> = {
      event_name,
      event_id,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      event_source_url: event_source_url || "",
      user_data: userData,
    };

    if (typeof safeValue === "number") {
      eventPayload.custom_data = { value: safeValue, currency };
    }

    const fbPayload: Record<string, unknown> = { data: [eventPayload] };
    if (test_event_code) fbPayload.test_event_code = test_event_code;

    const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${accessToken}`;
    const fbRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fbPayload),
    });
    const fbData = await fbRes.json();

    if (!fbRes.ok) {
      console.error("Meta CAPI error:", fbData);
      return json({ success: false, error: fbData }, 200);
    }

    return json({ success: true, fb: fbData });
  } catch (e) {
    console.error("CAPI fn error:", e);
    return json({ error: String(e) }, 500);
  }
});