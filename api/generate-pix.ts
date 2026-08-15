export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const NEXUSPAG_API_KEY = process.env.NEXUSPAG_API_KEY;
    const NEXUS_API_URL = "https://api.nexuspag.com/v1";

    if (!NEXUSPAG_API_KEY) {
      return res.status(500).json({ error: "NEXUSPAG_API_KEY is not set in environment variables" });
    }

    const body = req.body;
    const action = body.action || "create";

    if (action === "check_status") {
      const id = body.id;
      if (!id) {
        return res.status(400).json({ error: "id required" });
      }

      const response = await fetch(`${NEXUS_API_URL}/transactions/${id}`, {
        headers: { "Authorization": `Bearer ${NEXUSPAG_API_KEY}` },
      });
      const data = await response.json();
      
      const status = data.status;
      const normalizedStatus = (status === "approved" || status === "paid") ? "approved" : status;

      return res.status(200).json({ id, status: normalizedStatus });
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
      return res.status(response.status).json({ error: data.message || "NexusPag error" });
    }

    const pixData = data.payment_method_details?.pix || data.pix || {};
    
    return res.status(200).json({
      id: data.id,
      qr_code: pixData.qr_code || pixData.code || "",
      qr_code_base64: pixData.qr_code_base64 || "",
      status: data.status,
    });

  } catch (error) {
    console.error("API Route Error:", error);
    return res.status(500).json({ error: error.message });
  }
}