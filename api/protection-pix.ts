const API = 'https://nexuspag.com/api/pix/';
const APPROVED = new Set(['approved','paid','completed','confirmed','success','pago','confirmado','concluido']);
const PROTECTION_AMOUNT = 7.90;

function normalizeStatus(value: unknown) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
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

async function fetchVerifiedTransaction(id: string, apiKey: string): Promise<any | null> {
  const response = await fetch(API + encodeURIComponent(id), { headers: { 'x-api-key': apiKey } });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return payload?.transaction ?? payload?.data?.transaction ?? payload?.data ?? payload;
}

async function approvedOriginalPayment(parentPaymentId: string, sessionId: string, apiKey: string) {
  const { url, publicKey, serviceKey } = getBackendConfig();
  const key = serviceKey || publicKey;
  if (!url || !key) return false;

  const response = await fetch(
    `${url}/rest/v1/purchases?mp_payment_id=eq.${encodeURIComponent(parentPaymentId)}&select=status,session_id,amount&limit=1`,
    { headers: databaseHeaders(key) },
  );
  if (!response.ok) return false;
  const rows = await response.json().catch(() => []);
  const purchase = Array.isArray(rows) ? rows[0] : null;
  if (!purchase || !APPROVED.has(normalizeStatus(purchase.status)) || Number(purchase.amount) !== 19.9) return false;
  if (purchase.session_id && purchase.session_id !== sessionId) return false;

  const original = await fetchVerifiedTransaction(parentPaymentId, apiKey);
  return Boolean(original && APPROVED.has(normalizeStatus(original.status)));
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    const apiKey = process.env.NEXUSPAG_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Pagamento indisponível no momento.' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || '');
    const sessionId = String(body.session_id || '');
    const parentPaymentId = String(body.parent_payment_id || '');

    if (!sessionId || !parentPaymentId) {
      return res.status(400).json({ error: 'Sessão ou pagamento anterior ausente.' });
    }

    if (!await approvedOriginalPayment(parentPaymentId, sessionId, apiKey)) {
      return res.status(403).json({ error: 'Não foi possível confirmar o pagamento anterior nesta sessão.' });
    }

    if (action === 'check_status') {
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ error: 'PIX não informado.' });

      const transaction = await fetchVerifiedTransaction(id, apiKey);
      if (!transaction) return res.status(200).json({ status: 'pending' });

      const metadata = transaction?.metadata && typeof transaction.metadata === 'object'
        ? transaction.metadata
        : {};
      const paidAmount = Number(transaction?.amount ?? transaction?.transaction_amount ?? transaction?.value ?? 0);
      const transactionId = String(transaction?.id ?? transaction?.uuid ?? transaction?.transaction_id ?? transaction?.txid ?? id);

      if (
        transactionId !== id ||
        metadata?.offer_type !== 'group_protection' ||
        String(metadata?.parent_payment_id || '') !== parentPaymentId ||
        String(metadata?.session_id || '') !== sessionId ||
        Math.round(paidAmount * 100) !== Math.round(PROTECTION_AMOUNT * 100)
      ) {
        return res.status(409).json({ error: 'Os dados deste PIX não correspondem à oferta.' });
      }

      const status = normalizeStatus(transaction?.status);
      return res.status(200).json({ status: APPROVED.has(status) ? 'approved' : (status || 'pending') });
    }

    if (action !== 'create') return res.status(400).json({ error: 'Operação inválida.' });

    const forwardedHost = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
    const forwardedProto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const webhookUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}/api/nexuspag-webhook` : undefined;

    const metadata = {
      offer_type: 'group_protection',
      parent_payment_id: parentPaymentId,
      session_id: sessionId,
      amount: PROTECTION_AMOUNT,
    };

    const createResponse = await fetch(API + 'create', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: PROTECTION_AMOUNT,
        description: 'Proteção do Grupo - oferta pós-compra',
        external_id: 'protecao-' + crypto.randomUUID(),
        metadata,
        ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
      }),
    });

    const data = await createResponse.json().catch(() => null);
    if (!createResponse.ok || !data?.success || !data?.transaction?.id) {
      return res.status(502).json({ error: 'Não foi possível gerar o PIX da Proteção do Grupo.' });
    }

    const transaction = data.transaction;
    return res.status(200).json({
      id: String(transaction.id),
      qr_code: transaction.pix_copia_cola || '',
      qr_code_base64: transaction.qr_code_base64 || '',
      status: transaction.status || 'pending',
      amount: PROTECTION_AMOUNT,
    });
  } catch (error) {
    console.error('[Protection PIX]', error);
    return res.status(500).json({ error: 'Não foi possível processar a oferta agora.' });
  }
}
