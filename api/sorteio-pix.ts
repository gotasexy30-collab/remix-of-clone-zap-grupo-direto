// Pagamento opcional do sorteio. Separado do PIX principal e da tabela purchases.
const API = 'https://nexuspag.com/api/pix/';
const MODELS = new Set(['Alice', 'Thaisinha', 'Camila']);
const APPROVED = new Set(['approved', 'paid', 'completed', 'confirmed', 'success', 'pago', 'confirmado', 'concluido']);
const RATE_CENTS = 460;

function normalizeStatus(value: unknown) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
function dbConfig() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Banco de dados não configurado para esta oferta.');
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } };
}
async function dbRequest(path: string, init: RequestInit = {}) {
  const { url, headers } = dbConfig();
  return fetch(url + '/rest/v1/' + path, { ...init, headers: { ...headers, ...init.headers } });
}
async function getTransaction(id: string, key: string): Promise<any | null> {
  const response = await fetch(API + encodeURIComponent(id), { headers: { 'x-api-key': key } });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return payload?.transaction ?? payload?.data?.transaction ?? payload?.data ?? payload;
}
async function approvedOriginalPayment(parentPaymentId: string, sessionId: string, apiKey: string) {
  const response = await dbRequest(`purchases?mp_payment_id=eq.${encodeURIComponent(parentPaymentId)}&select=status,session_id,amount&limit=1`);
  if (!response.ok) return false;
  const rows = await response.json();
  const purchase = rows?.[0];
  if (!purchase || !APPROVED.has(normalizeStatus(purchase.status)) || Number(purchase.amount) !== 19.9) return false;
  // Quando a sessão foi persistida, somente seu titular pode adicionar a oferta.
  if (purchase.session_id && purchase.session_id !== sessionId) return false;
  // Exige ainda a transação paga na NexusPag; não aceita somente IDs enviados pelo navegador.
  const original = await getTransaction(parentPaymentId, apiKey);
  return Boolean(original && APPROVED.has(normalizeStatus(original.status)));
}
async function findOffer(paymentId: string) {
  const response = await dbRequest(`sorteio_entries?payment_id=eq.${encodeURIComponent(paymentId)}&select=payment_id,status,amount,quantity,model,session_id&limit=1`);
  if (!response.ok) throw new Error('Falha ao consultar participação.');
  const rows = await response.json();
  return rows?.[0] || null;
}
async function approveOffer(paymentId: string, amount: number) {
  const response = await dbRequest(`sorteio_entries?payment_id=eq.${encodeURIComponent(paymentId)}&status=eq.pending&amount=eq.${encodeURIComponent(amount.toFixed(2))}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ status: 'approved', approved_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error('Não foi possível registrar sua participação.');
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}
export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  try {
    const apiKey = process.env.NEXUSPAG_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'Pagamento adicional indisponível no momento.' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (body.action === 'check_status') {
      const id = String(body.id || '');
      const sessionId = String(body.session_id || '');
      if (!id || !sessionId) return res.status(400).json({ error: 'Dados da participação incompletos.' });
      const offer = await findOffer(id);
      if (!offer || offer.session_id !== sessionId) return res.status(404).json({ error: 'Participação não encontrada.' });
      if (offer.status === 'approved') return res.status(200).json({ status: 'approved' });
      const transaction = await getTransaction(id, apiKey);
      if (!transaction) return res.status(200).json({ status: 'pending' });
      if (!APPROVED.has(normalizeStatus(transaction.status))) return res.status(200).json({ status: 'pending' });
      const paid = Number(transaction.amount ?? transaction.transaction_amount ?? transaction.value);
      const transactionId = String(transaction.id ?? transaction.uuid ?? transaction.transaction_id ?? transaction.txid ?? id);
      if (transactionId !== id || !Number.isFinite(paid) || Math.round(paid * 100) !== Math.round(Number(offer.amount) * 100)) {
        return res.status(409).json({ error: 'Dados do pagamento não correspondem à participação.' });
      }
      await approveOffer(id, Number(offer.amount));
      return res.status(200).json({ status: 'approved' });
    }
    if (body.action !== 'create') return res.status(400).json({ error: 'Operação inválida.' });
    const model = String(body.model || '');
    const quantity = Number(body.quantity);
    const sessionId = String(body.session_id || '');
    const parentPaymentId = String(body.parent_payment_id || '');
    if (!MODELS.has(model) || !Number.isInteger(quantity) || quantity < 1 || quantity > 100 ||
        !sessionId || sessionId.length > 200 || !parentPaymentId || parentPaymentId.length > 200) {
      return res.status(400).json({ error: 'Seleção de cotas inválida.' });
    }
    if (!await approvedOriginalPayment(parentPaymentId, sessionId, apiKey)) {
      return res.status(403).json({ error: 'Não foi possível confirmar o pagamento original. Seu acesso já comprado permanece disponível.' });
    }
    const amount = Number((quantity * RATE_CENTS / 100).toFixed(2));
    const forwardedHost = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
    const forwardedProto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
    const webhookUrl = forwardedHost ? `${forwardedProto}://${forwardedHost}/api/nexuspag-webhook` : undefined;
    const metadata = { offer_type: 'sorteio_cota', parent_payment_id: parentPaymentId, session_id: sessionId, model, quantity, amount };
    const createResponse = await fetch(API + 'create', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount, description: `Participação opcional - ${quantity} cota(s) - ${model}`,
        external_id: 'sorteio-' + crypto.randomUUID(),
        metadata,
        ...(webhookUrl ? { webhook_url: webhookUrl } : {}),
      }),
    });
    const data = await createResponse.json().catch(() => null);
    if (!createResponse.ok || !data?.success || !data?.transaction?.id) return res.status(502).json({ error: 'Não foi possível gerar o PIX adicional. Você pode pular esta oferta e acessar seu conteúdo.' });
    const transaction = data.transaction;
    const paymentId = String(transaction.id);
    const insertResponse = await dbRequest('sorteio_entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_payment_id: parentPaymentId, payment_id: paymentId, session_id: sessionId, model, quantity, amount, status: 'pending' }),
    });
    if (!insertResponse.ok) {
      console.error('[Sorteio] PIX criado mas não registrado:', paymentId, insertResponse.status);
      return res.status(503).json({ error: 'Não foi possível registrar a participação. Não pague este PIX. Seu conteúdo original segue disponível.' });
    }
    return res.status(200).json({ id: paymentId, qr_code: transaction.pix_copia_cola || '', qr_code_base64: transaction.qr_code_base64 || '', status: 'pending', amount });
  } catch (error) {
    console.error('[Sorteio PIX]', error);
    return res.status(500).json({ error: 'Não foi possível processar a oferta. Seu acesso original permanece disponível.' });
  }
}
