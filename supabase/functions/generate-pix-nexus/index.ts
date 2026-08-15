import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NEXUSPAG_API_KEY = Deno.env.get("NEXUSPAG_API_KEY");
const NEXUS_API_URL = "https://api.nexuspag.com/v1"; // Official v1 endpoint based on typical patterns

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!NEXUSPAG_API_KEY) {
      throw new Error("NEXUSPAG_API_KEY is not set");
    }

    const { amount, name, cpf, email, description, metadata } = await req.json();

    if (!amount || !name || !cpf || !email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields (amount, name, cpf, email)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare NexusPag payload
    // Based on standard NexusPag documentation for PIX generation
    const payload = {
      amount: Math.round(amount * 100), // NexusPag usually expects amount in cents
      payment_method: "pix",
      customer: {
        name,
        cpf,
        email,
      },
      items: [
        {
          title: description || "Acesso Clube Secreto",
          unit_price: Math.round(amount * 100),
          quantity: 1,
        }
      ],
      metadata: metadata || {},
    };

    console.log("Creating NexusPag transaction for:", email);

    const response = await fetch(`${NEXUS_API_URL}/transactions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NEXUSPAG_API_KEY}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("NexusPag API error:", data);
      return new Response(
        JSON.stringify({ error: data.message || "Failed to generate PIX with NexusPag" }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract QR Code and Copy/Paste code from NexusPag response
    // NexusPag typically returns these in the payment_method_details or similar
    const qrCodeBase64 = data.payment_method_details?.qr_code_base64 || data.pix?.qr_code_base64;
    const qrCodeText = data.payment_method_details?.qr_code || data.pix?.qr_code;
    const transactionId = data.id;

    return new Response(
      JSON.stringify({
        id: transactionId,
        qr_code: qrCodeText,
        qr_code_base64: qrCodeBase64,
        status: data.status,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating PIX:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
