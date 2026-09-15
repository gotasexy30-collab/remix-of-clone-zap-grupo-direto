const META_GRAPH_VERSION = 'v19.0';
const APPROVED_STATUSES = new Set(['paid', 'approved', 'completed', 'confirmed', 'success', 'pago', 'confirmado', 'concluido']);

function normalizeStatus(value: unknown): string {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publicKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, publicKey, serviceKey };
}

function databaseHeaders(key: string): Record<string, string> {
  return key.startsWith('sb_publishable_')
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };
}

async function getMetaPixelId(): Promise<string> {
  const { url, publicKey, serviceKey } = getSupabaseConfig();
  const key = serviceKey || publicKey;
  if (!url || !key) return '';

  const response = await fetch(
    `${url}/rest/v1/app_settings?key=eq.meta_pixel_id&select=value&limit=1`,
    {
      headers: databaseHeaders(key),
    },
  );
  if (!response.ok) {
    console.error('[Meta CAPI Purchase] Não foi possível ler o Pixel ID:', response.status);
    return '';
  }

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? String(rows[0]?.value || '') : '';
}

async function getMetaCapiToken(): Promise<string> {
  const environmentToken = process.env.META_CAPI_TOKEN || '';
  if (environmentToken) return environmentToken;

  const { url, serviceKey } = getSupabaseConfig();
  if (!url || !serviceKey) return '';

  const response = await fetch(
    `${url}/rest/v1/app_settings?key=eq.meta_capi_token&select=value&limit=1`,
    {
      headers: databaseHeaders(serviceKey),
    },
  );
  if (!response.ok) {
    console.error('[Meta CAPI Purchase] Não foi possível ler o token CAPI:', response.status);
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
  const { url, publicKey, serviceKey } = getSupabaseConfig();
  const databaseKey = serviceKey || publicKey;
  if (!url || !databaseKey) {
    console.error('[Purchase] Banco não configurado na Vercel.');
    return false;
  }

  const lookup = await fetch(
    `${url}/rest/v1/purchases?mp_payment_id=eq.${encodeURIComponent(paymentId)}&select=id&limit=1`,
    {
      headers: databaseHeaders(databaseKey),
    },
  );
  if (!lookup.ok) {
    console.error('[Purchase] Falha ao verificar venda:', lookup.status, await lookup.text());
    return false;
  }
  const existing = await lookup.json().catch(() => []);
  if (Array.isArray(existing) && existing.length > 0) return false;

  const response = await fetch(`${url}/rest/v1/purchases`, {
    method: 'POST',
    headers: {
      ...databaseHeaders(databaseKey),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
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
  const accessToken = await getMetaCapiToken();
  if (!accessToken) {
    console.error('[Meta CAPI Purchase] Token não configurado na Vercel nem no painel.');
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
          const raw = normalizeStatus(
            d?.transaction?.status ?? d?.data?.status ?? d?.status ?? ''
          );
          const approved = APPROVED_STATUSES.has(raw);
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

    const forwardedHost = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
    const forwardedProto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const webhookUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}/api/nexuspag-webhook` : undefined;
    const clientMetadata = body?.metadata && typeof body.metadata === 'object' ? body.metadata : {};
    const payload = {
      amount: Number(amount),
      description: body?.description || "Acesso Clube Secreto",
      external_id: "pedido-" + Date.now(),
      metadata: clientMetadata,
      ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
    };

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

    if (!response.ok || !data.success) {
      return res.status(response.status || 400).json({
        error: data.message || 'Erro recusado pela NexusPag',
        details: data
      });
    }

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
