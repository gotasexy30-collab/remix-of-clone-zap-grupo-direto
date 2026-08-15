import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const NEXUSPAG_API_KEY = process.env.NEXUSPAG_API_KEY;
    const NEXUS_API_URL = "https://api.nexuspag.com/v1";

    if (!NEXUSPAG_API_KEY) {
      return NextResponse.json({ error: "NEXUSPAG_API_KEY is not set in environment variables" }, { status: 500 });
    }

    const body = await req.json();
    const action = body.action || "create";

    if (action === "check_status") {
      const id = body.id;
      if (!id) {
        return NextResponse.json({ error: "id required" }, { status: 400 });
      }

      const res = await fetch(`${NEXUS_API_URL}/transactions/${id}`, {
        headers: { "Authorization": `Bearer ${NEXUSPAG_API_KEY}` },
      });
      const data = await res.json();
      
      const status = data.status; // NexusPag status: pending, approved, refused, etc.
      const normalizedStatus = (status === "approved" || status === "paid") ? "approved" : status;

      return NextResponse.json({ id, status: normalizedStatus });
    }

    const { amount, name, cpf, email, description, metadata } = body;

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
      return NextResponse.json({ error: data.message || "NexusPag error" }, { status: response.status });
    }

    const pixData = data.payment_method_details?.pix || data.pix || {};
    
    return NextResponse.json({
      id: data.id,
      qr_code: pixData.qr_code || pixData.code || "",
      qr_code_base64: pixData.qr_code_base64 || "",
      status: data.status,
    });

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
