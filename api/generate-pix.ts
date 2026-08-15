export default async function handler(req, res) {
  // Configuração de CORS obrigatória
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const NEXUSPAG_API_KEY = process.env.NEXUSPAG_API_KEY;
    if (!NEXUSPAG_API_KEY) {
      return res.status(500).json({ error: 'Erro no Servidor: NEXUSPAG_API_KEY não encontrada nas variáveis de ambiente da Vercel.' });
    }

    // Previne crash ao ler o body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Support check_status action if needed by the frontend
    if (body?.action === "check_status") {
      const id = body.id;
      if (!id) {
        return res.status(400).json({ error: "id required" });
      }

      const response = await fetch(`https://api.nexuspag.com/v1/transactions/${id}`, {
        headers: { "Authorization": `Bearer ${NEXUSPAG_API_KEY}` },
      });
      const data = await response.json();
      
      const status = data.status;
      const normalizedStatus = (status === "approved" || status === "paid") ? "approved" : status;

      return res.status(200).json({ id, status: normalizedStatus });
    }

    const amount = body?.amount || 19.90;
    const payload = {
      amount: Math.round(amount * 100),
      payment_method: "pix",
      customer: {
        name: body?.name || "Cliente Teste",
        cpf: body?.cpf || "00000000000",
        email: body?.email || "cliente@teste.com"
      },
      items: [{
        title: body?.description || "Acesso Clube Secreto",
        unit_price: Math.round(amount * 100),
        quantity: 1
      }],
      metadata: body?.metadata || {}
    };

    const response = await fetch('https://api.nexuspag.com/v1/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NEXUSPAG_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Falha ao processar na NexusPag' });
    }

    const pixData = data.payment_method_details?.pix || data.pix || {};
    
    return res.status(200).json({
      id: data.id,
      qr_code: pixData.qr_code || pixData.code || "",
      qr_code_base64: pixData.qr_code_base64 || "",
      status: data.status
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno inesperado no servidor' });
  }
}
