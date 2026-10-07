const META_GRAPH_VERSION = 'v19.0';
const APPROVED_STATUSES = new Set(['paid', 'approved', 'completed', 'confirmed', 'success', 'pago', 'confirmado', 'concluido']);

function normalizeStatus(value: unknown): string {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function getTransactionEventTime(transaction: any): number {
  const now = Math.floor(Date.now() / 1000);
  const candidates = [
    transaction?.approved_at,
    transaction?.approvedAt,
    transaction?.paid_at,
    transaction?.paidAt,
    transaction?.date_approved,
    transaction?.dateApproved,
    transaction?.confirmed_at,
    transaction?.confirmedAt,
    transaction?.payment_date,
    transaction?.paymentDate,
    transaction?.updated_at,
    transaction?.updatedAt,
  ];

  for (const value of candidates) {
    if (value === null || value === undefined || value === '') continue;
    let seconds = 0;

    if (typeof value === 'number' && Number.isFinite(value)) {
      seconds = value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
    } else {
      const raw = String(value).trim();
      const numeric = Number(raw);
      if (raw && Number.isFinite(numeric) && numeric > 0) {
        seconds = numeric > 1e12 ? Math.floor(numeric / 1000) : Math.floor(numeric);
      } else {
        const parsed = Date.parse(raw);
        if (Number.isFinite(parsed)) seconds = Math.floor(parsed / 1000);
      }
    }

    if (seconds > 0 && seconds <= now + 300 && seconds >= now - (7 * 24 * 60 * 60)) {
      return seconds;
    }
  }

  return now;
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

async function recordPurchase(paymentId: string, amount: number, sessionId: string, approvedAt?: number): Promise<boolean> {
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
      approved_at: new Date((approvedAt || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Falha ao registrar venda: ${response.status}`);
  const inserted = await response.json().catch(() => []);
  return Array.isArray(inserted) && inserted.length > 0;
}

async function sendPurchaseToMeta(paymentId: string, amount: number, metadata: Record<string, any>, eventTime?: number) {
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
          event_time: eventTime || Math.floor(Date.now() / 1000),
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
    const transactionEventTime = getTransactionEventTime(transaction);
    // Sorteio é um pagamento adicional: nunca registrar em purchases nem disparar Purchase do ingresso original.
    // Verificar também o identificador externo e o registro próprio, pois alguns retornos da NexusPag omitem metadata.
    const externalId = String(transaction?.external_id ?? transaction?.externalId ?? received?.external_id ?? received?.externalId ?? '');

    // A Proteção do Grupo é um upsell pós-compra separado. Nunca registrar esse
    // PIX de R$ 7,90 na tabela purchases nem disparar o Purchase do acesso base.
    if (metadata?.offer_type === 'group_protection' || externalId.startsWith('protecao-')) {
      return res.status(200).json({ ok: true, status: 'approved', recorded: false, offer: 'group_protection' });
    }

    const dbForOffer = getBackendConfig();
    let storedOffer: any = null;
    if (dbForOffer.url && dbForOffer.serviceKey) {
      const offerLookup = await fetch(
        `${dbForOffer.url}/rest/v1/sorteio_entries?payment_id=eq.${encodeURIComponent(paymentId)}&select=payment_id,amount,status&limit=1`,
        { headers: databaseHeaders(dbForOffer.serviceKey) },
      );
      if (offerLookup.ok) {
        const offerRows = await offerLookup.json().catch(() => []);
        storedOffer = offerRows?.[0] || null;
      }
    }
    if (metadata?.offer_type === 'sorteio_cota' || externalId.startsWith('sorteio-') || storedOffer) {
      const { url, serviceKey } = getBackendConfig();
      if (!url || !serviceKey) return res.status(503).json({ error: 'Banco da oferta indisponível' });
      const headers = databaseHeaders(serviceKey);
      const lookup = await fetch(
        `${url}/rest/v1/sorteio_entries?payment_id=eq.${encodeURIComponent(paymentId)}&select=payment_id,amount,status&limit=1`,
        { headers },
      );
      if (!lookup.ok) return res.status(500).json({ error: 'Falha ao consultar participação' });
      const offers = await lookup.json().catch(() => []);
      const offer = storedOffer || offers?.[0];
      if (!offer) return res.status(200).json({ ok: true, status: 'approved', recorded: false, reason: 'participacao_aguardando_registro' });
      if (offer.status === 'approved') return res.status(200).json({ ok: true, status: 'approved', recorded: false });
      if (!Number.isFinite(amount) || Math.round(amount * 100) !== Math.round(Number(offer.amount) * 100)) {
        return res.status(409).json({ error: 'Valor divergente do pedido de participação' });
      }
      const update = await fetch(
        `${url}/rest/v1/sorteio_entries?payment_id=eq.${encodeURIComponent(paymentId)}&status=eq.pending`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'approved', approved_at: new Date().toISOString() }),
        },
      );
      if (!update.ok) return res.status(500).json({ error: 'Falha ao registrar participação' });
      return res.status(200).json({ ok: true, status: 'approved', recorded: true, offer: 'sorteio_cota' });
    }
    const inserted = await recordPurchase(paymentId, amount, String(metadata?.session_id || ''), transactionEventTime);
    if (inserted) await sendPurchaseToMeta(paymentId, amount, metadata?.meta ?? metadata, transactionEventTime);

    return res.status(200).json({ ok: true, status: 'approved', recorded: inserted });
  } catch (error) {
    console.error('[NexusPag webhook]', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return res.status(500).json({ error: message });
  }
}
