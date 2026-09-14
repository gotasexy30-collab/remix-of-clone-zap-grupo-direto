const META_GRAPH_VERSION = 'v19.0';

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publicKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, publicKey, serviceKey };
}

async function getMetaPixelId(): Promise<string> {
  const { url, publicKey } = getSupabaseConfig();
  if (!url || !publicKey) return '';

  const response = await fetch(
    `${url}/rest/v1/app_settings?key=eq.meta_pixel_id&select=value&limit=1`,
    {
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${publicKey}`,
      },
    },
  );
  if (!response.ok) {
    console.error('[Meta CAPI Purchase] Não foi possível ler o Pixel ID:', response.status);
    return '';
  }

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? String(rows[0]?.value || '') : '';
}

async function recordApprovedPurchase({
  paymentId,
  amount,
  sessionId,
}: {
  paymentId: string;
  amount: number;
  sessionId: string;
}): Promise<boolean> {
  const { url, serviceKey } = getSupabaseConfig();
  if (!url || !serviceKey) {
    console.error('[Purchase] SUPABASE_SERVICE_ROLE_KEY não configurada na Vercel.');
    return false;
  }

  const response = await fetch(`${url}/rest/v1/purchases?on_conflict=mp_payment_id`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify({
      mp_payment_id: paymentId,
      amount: Math.max(0, Math.min(Number(amount) || 0, 10000)),
      session_id: sessionId.slice(0, 200),
      status: 'approved',
      approved_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    console.error('[Purchase] Falha ao registrar venda:', response.status, await response.text());
    return false;
  }

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function sendCapiPurchase({
  paymentId,
  amount,
  req,
}: {
  paymentId: string;
  amount: number;
  req: any;
}): Promise<void> {
  const accessToken = process.env.META_CAPI_TOKEN || '';
  if (!accessToken) {
    console.error('[Meta CAPI Purchase] META_CAPI_TOKEN não configurado.');
    return;
  }

  const pixelId = await getMetaPixelId();
  if (!pixelId) {
    console.error('[Meta CAPI Purchase] Pixel ID não configurado.');
    return;
  }

  const safeAmount = Math.max(0, Math.min(Number(amount) || 0, 10000));
  const forwardedFor = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const userAgent = String(req.headers?.['user-agent'] || '');
  const userData: Record<string, string> = {};
  if (forwardedFor) userData.client_ip_address = forwardedFor;
  if (userAgent) userData.client_user_agent = userAgent;

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: `np_${paymentId}`,
        action_source: 'website',
        event_source_url: String(req.headers?.referer || req.headers?.origin || ''),
        user_data: userData,
        custom_data: {
          value: safeAmount,
          currency: 'BRL',
        },
      },
    ],
  };

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, access_token: accessToken }),
    },
  );

  if (!response.ok) {
    console.error('[Meta CAPI Purchase] Envio recusado pela Meta:', response.status, await response.text());
    return;
  }
  console.log('[Meta CAPI Purchase] Evento enviado:', `np_${paymentId}`);
}

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
          if (approved) {
            const transaction = d?.transaction ?? d?.data ?? d;
            const paymentId = String(
              transaction?.id ?? transaction?.uuid ?? transaction?.transaction_id ?? transaction?.txid ?? id,
            );
            const paidAmount = Number(
              transaction?.amount ?? transaction?.transaction_amount ?? transaction?.value ?? body?.amount ?? 19.90,
            );
            const inserted = await recordApprovedPurchase({
              paymentId,
              amount: paidAmount,
              sessionId: String(body?.session_id || ''),
            });
            if (inserted) await sendCapiPurchase({ paymentId, amount: paidAmount, req });
          }
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
