export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const NEXUSPAG_API_KEY = process.env.NEXUSPAG_API_KEY;
    if (!NEXUSPAG_API_KEY) return res.status(400).json({ error: 'NEXUSPAG_API_KEY não configurada.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
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
        title: body?.description || "Acesso",
        unit_price: Math.round(amount * 100),
        quantity: 1
      }]
    };

    const response = await fetch('https://api.nexuspag.com/v1/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NEXUSPAG_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // O SEGREDO: Ler como texto primeiro para não quebrar!
    const responseText = await response.text();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      // Se não for JSON (for HTML), devolvemos o HTML para debug no frontend
      return res.status(502).json({ 
        error: "A NexusPag retornou um formato inválido (HTML). URL ou Endpoint incorreto.", 
        details: responseText.substring(0, 300) 
      });
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Erro recusado pela NexusPag', details: data });
    }

    const pixData = data.payment_method_details?.pix || data.pix || {};
    return res.status(200).json({
      id: data.id,
      qr_code: pixData.qr_code || pixData.code || "",
      qr_code_base64: pixData.qr_code_base64 || "",
      status: data.status
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
