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

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
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

    if (!event_name || !event_id) {
      return json({ error: "event_name and event_id required" }, 400);
    }

    const [pixelId, accessToken] = await Promise.all([
      getSetting("meta_pixel_id"),
      getSetting("meta_capi_token"),
    ]);

    if (!pixelId || !accessToken) {
      return json({ skipped: true, reason: "pixel_or_token_not_configured" });
    }

    // Get client IP — prefer IPv6 over IPv4 (Meta recommends IPv6 for better match quality)
    const fwd = req.headers.get("x-forwarded-for") || "";
    const cfIp = req.headers.get("cf-connecting-ip") || "";
    const realIp = req.headers.get("x-real-ip") || "";
    const candidates = [
      ...fwd.split(",").map((s) => s.trim()),
      cfIp,
      realIp,
    ].filter(Boolean);
    // IPv6 contains ":", IPv4 doesn't. Prefer IPv6 if available.
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

    if (typeof value === "number") {
      eventPayload.custom_data = { value, currency };
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
