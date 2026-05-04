// Mercado Pago PIX integration
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

  const res = await fetch(`${MP_API}/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  const data = await res.json();
  if (!res.ok) return { error: data?.message || "Erro ao consultar" };

  return {
    id: data.id,
    status: data.status, // pending, approved, rejected, cancelled
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
