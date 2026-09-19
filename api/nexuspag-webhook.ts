const META_GRAPH_VERSION = 'v19.0';
const APPROVED_STATUSES = new Set(['paid', 'approved', 'completed', 'confirmed', 'success', 'pago', 'confirmado', 'concluido']);

function normalizeStatus(value: unknown): string {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function getClientIpFromMetadata(metadata: Record<string, any>): string {
  return String(metadata?.client_ip_address || metadata?.ip_address || '').trim();
}

function getBackendConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    publicKey:
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function databaseHeaders(key: string): Record<string, string> {
  return key.startsWith('sb_publishable_')
    ? { apikey: key }
    : { apikey: key, Authorization: `Bearer ${key}` };
}

async function getSetting(settingKey: string): Promise<string> {
  const { url, publicKey, serviceKey } = getBackendConfig();
  const databaseKey = serviceKey || publicKey;
  if (!url || !databaseKey) return '';
  const response = await fetch(
    `${url}/rest/v1/app_settings?key=eq.${encodeURIComponent(settingKey)}&select=value&limit=1`,
    { headers: databaseHeaders(databaseKey) },
  );
  if (!response.ok) return '';
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? String(rows[0]?.value || '') : '';
}

async function fetchVerifiedTransaction(id: string, apiKey: string): Promise<any | null> {
  // Endpoint oficial da NexusPag para consultar um PIX.
  try {
    const response = await fetch(
      `https://nexuspag.com/api/pix/${encodeURIComponent(id)}`,
      { headers: { 'x-api-key': apiKey } },
    );
    const text = await response.text();
    if (!response.ok) return null;
    const data = JSON.parse(text);
    return data?.transaction ?? data?.data ?? data;
  } catch {
    return null;
  }
}

async function recordPurchase(paymentId: string, amount: number, sessionId: string): Promise<boolean> {
  const { url, publicKey, serviceKey } = getBackendConfig();
  const databaseKey = serviceKey || publicKey;
  if (!url || !databaseKey) throw new Error('Banco não configurado na Vercel');
  const safeAmount = Math.max(0, Math.min(Number(amount) || 0, 10000));

  const lookup = await fetch(
    `${url}/rest/v1/purchases?mp_payment_id=eq.${encodeURIComponent(paymentId)}&select=id&limit=1`,
    { headers: databaseHeaders(databaseKey) },
  );
  if (!lookup.ok) throw new Error('Falha ao verificar venda existente');
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
      amount: safeAmount,
      session_id: sessionId.slice(0, 200),
      status: 'approved',
      approved_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Falha ao registrar venda: ${response.status}`);
  const inserted = await response.json().catch(() => []);
  return Array.isArray(inserted) && inserted.length > 0;
}

async function sendPurchaseToMeta(paymentId: string, amount: number, metadata: Record<string, any>) {
  const pixelId = await getSetting('meta_pixel_id');
  const accessToken = process.env.META_CAPI_TOKEN || (await getSetting('meta_capi_token'));
  if (!pixelId || !accessToken) throw new Error('Pixel ID ou token CAPI não configurado');

  const userData: Record<string, string> = {};
  const clientIp = getClientIpFromMetadata(metadata);
  if (clientIp) userData.client_ip_address = clientIp;
  if (metadata?.user_agent) userData.client_user_agent = String(metadata.user_agent);
  if (metadata?.fbp) userData.fbp = String(metadata.fbp);
  if (metadata?.fbc) userData.fbc = String(metadata.fbc);

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${encodeURIComponent(pixelId)}/events`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: `np_${paymentId}`,
          action_source: 'website',
          event_source_url: String(metadata?.event_source_url || ''),
          user_data: userData,
          custom_data: {
            value: Math.max(0, Math.min(Number(amount) || 0, 10000)),
            currency: 'BRL',
          },
        }],
        access_token: accessToken,
      }),
    },
  );
  if (!response.ok) throw new Error(`Meta recusou o Purchase: ${response.status}`);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const apiKey = process.env.NEXUSPAG_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'NEXUSPAG_API_KEY não configurada' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const received = body?.transaction ?? body?.data?.transaction ?? body?.data ?? body?.pix ?? body;
    const receivedId = String(
      received?.id ?? received?.uuid ?? received?.transaction_id ?? received?.txid ?? received?.external_id ?? '',
    );
    if (!receivedId) return res.status(200).json({ ok: true, ignored: 'sem identificador' });

    const transaction = await fetchVerifiedTransaction(receivedId, apiKey);
    if (!transaction) return res.status(200).json({ ok: true, ignored: 'transação não localizada' });
    const status = normalizeStatus(transaction?.status);
    if (!APPROVED_STATUSES.has(status)) return res.status(200).json({ ok: true, status: status || 'pending' });

    const paymentId = String(
      transaction?.id ?? transaction?.uuid ?? transaction?.transaction_id ?? transaction?.txid ?? receivedId,
    );
    const amount = Number(transaction?.amount ?? transaction?.transaction_amount ?? transaction?.value ?? 0);
    const metadata = transaction?.metadata ?? received?.metadata ?? {};
    const inserted = await recordPurchase(paymentId, amount, String(metadata?.session_id || ''));
    if (inserted) await sendPurchaseToMeta(paymentId, amount, metadata?.meta ?? metadata);

    return res.status(200).json({ ok: true, status: 'approved', recorded: inserted });
  } catch (error) {
    console.error('[NexusPag webhook]', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return res.status(500).json({ error: message });
  }
}
