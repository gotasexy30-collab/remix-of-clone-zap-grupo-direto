import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NEXUSPAG_API_KEY = Deno.env.get("NEXUSPAG_API_KEY");
const NEXUS_API_URL = "https://api.nexuspag.com/v1"; 

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || "create";

    if (!NEXUSPAG_API_KEY) {
      throw new Error("NEXUSPAG_API_KEY is not set");
    }

    if (action === "check_status") {
      const id = body.id;
      if (!id) return new Response(JSON.stringify({ error: "id required" }), { status: 400, headers: corsHeaders });

      const res = await fetch(`${NEXUS_API_URL}/transactions/${id}`, {
        headers: { "Authorization": `Bearer ${NEXUSPAG_API_KEY}` },
      });
      const data = await res.json();
      
      const status = data.status; // NexusPag status: pending, approved, refused, etc.
      const normalizedStatus = (status === "approved" || status === "paid") ? "approved" : status;

      return new Response(JSON.stringify({ id, status: normalizedStatus }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { amount, name, cpf, email, description, metadata } = body;

    // Default values if not provided for simplicity in the chat app
    const finalAmount = amount || 19.90;
    const finalName = name || 'Cliente VIP';
    const finalCpf = cpf || '00000000000';
    const finalEmail = email || 'cliente@exemplo.com';

    const payload = {
      amount: Math.round(finalAmount * 100),
      payment_method: "pix",
      customer: {
        name: finalName,
        cpf: finalCpf,
        email: finalEmail,
      },
      items: [
        {
          title: description || "Acesso Clube Secreto",
          unit_price: Math.round(finalAmount * 100),
          quantity: 1,
        }
      ],
      metadata: metadata || {},
      webhook_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/nexuspag-webhook`,
    };

    const response = await fetch(`${NEXUS_API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NEXUSPAG_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({ error: data.message || "NexusPag error" }), { status: response.status, headers: corsHeaders });
    }

    // Adapt NexusPag response to what frontend expects
    const pixData = data.payment_method_details?.pix || data.pix || {};
    
    return new Response(
      JSON.stringify({
        id: data.id,
        qr_code: pixData.qr_code || pixData.code || "",
        qr_code_base64: pixData.qr_code_base64 || "",
        status: data.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
