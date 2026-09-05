export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-api-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const NEXUSPAG_API_KEY = process.env.NEXUSPAG_API_KEY;

    if (!NEXUSPAG_API_KEY) {
      return res.status(500).json({ error: 'Erro no Servidor: NEXUSPAG_API_KEY não encontrada.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const amount = body?.amount || 19.90;

    // ---- Consulta de status (NÃO gera um novo PIX) ----
    if (body?.action === 'check_status') {
      const id = String(body?.id || '');
      if (!id) return res.status(400).json({ error: 'id obrigatório' });

      const endpoints = [
        `https://nexuspag.com/api/pix/status/${encodeURIComponent(id)}`,
        `https://nexuspag.com/api/transactions/${encodeURIComponent(id)}`,
      ];

      for (const url of endpoints) {
        try {
          const r = await fetch(url, { headers: { 'x-api-key': NEXUSPAG_API_KEY } });
          const t = await r.text();
          let d;
          try { d = JSON.parse(t); } catch { continue; }
          if (!r.ok) continue;
          const raw = String(
            d?.transaction?.status ?? d?.data?.status ?? d?.status ?? ''
          ).toLowerCase();
          const approved = ['paid', 'approved', 'completed', 'confirmed', 'success'].includes(raw);
          return res.status(200).json({ status: approved ? 'approved' : (raw || 'pending') });
        } catch { /* tenta o próximo endpoint */ }
      }
      return res.status(200).json({ status: 'pending' });
    }

    // Novo payload no formato exato exigido pela documentação da NexusPag
    const payload = {
      amount: Number(amount), // Valor em reais, não em centavos
      description: body?.description || "Acesso Clube Secreto",
      external_id: "pedido-" + Date.now() // Usado como chave de idempotência
    };

    // Nova URL e Headers corretos
    const response = await fetch('https://nexuspag.com/api/pix/create', {
      method: 'POST',
      headers: {
        'x-api-key': NEXUSPAG_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return res.status(502).json({ 
        error: "Formato inválido retornado. URL Incorreta.", 
        details: responseText.substring(0, 300) 
      });
    }

    // A NexusPag retorna success: true ou false
    if (!response.ok || !data.success) {
      return res.status(response.status || 400).json({ 
        error: data.message || 'Erro recusado pela NexusPag', 
        details: data 
      });
    }

    // O retorno da NexusPag fica encapsulado dentro de "transaction"
    const tx = data.transaction;
    
    return res.status(200).json({
      id: tx.id,
      qr_code: tx.pix_copia_cola || "",
      qr_code_base64: tx.qr_code_base64 || "",
      status: tx.status
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno.' });
  }
}
