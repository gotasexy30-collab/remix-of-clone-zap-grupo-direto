// A URL de entrega é lida somente no servidor, depois de validar a compra.
// Não expor pix_success_url ou payment_redirect_link ao navegador antes do pagamento.
const APPROVED = new Set(['approved', 'paid', 'completed', 'confirmed', 'success', 'pago', 'confirmado', 'concluido']);

function normalized(value: unknown): string {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

async function verifiedPurchase(paymentId: string, sessionId: string): Promise<boolean> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const nexusKey = process.env.NEXUSPAG_API_KEY;
  if (!url || !key || !nexusKey) return false;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  const saved = await fetch(
    `${url}/rest/v1/purchases?mp_payment_id=eq.${encodeURIComponent(paymentId)}&select=mp_payment_id,session_id,status,amount&limit=1`,
    { headers, cache: 'no-store' },
  );
  if (!saved.ok) return false;
  const rows = await saved.json().catch(() => []);
  const purchase = Array.isArray(rows) ? rows[0] : null;
  if (!purchase ||
      String(purchase.mp_payment_id) !== paymentId ||
      String(purchase.session_id || '') !== sessionId ||
      !APPROVED.has(normalized(purchase.status)) ||
      Math.round(Number(purchase.amount) * 100) !== 1990) return false;

  // Verificar também diretamente na NexusPag: a tabela não é prova isolada.
  const nexusResponse = await fetch(
    `https://nexuspag.com/api/pix/${encodeURIComponent(paymentId)}`,
    { headers: { 'x-api-key': nexusKey }, cache: 'no-store' },
  );
  if (!nexusResponse.ok) return false;
  const payload = await nexusResponse.json().catch(() => null);
  const tx = payload?.transaction ?? payload?.data?.transaction ?? payload?.data ?? payload;
  if (!tx || !APPROVED.has(normalized(tx.status))) return false;
  const txId = String(tx.id ?? tx.uuid ?? tx.transaction_id ?? tx.txid ?? '');
  const amount = Number(tx.amount ?? tx.transaction_amount ?? tx.value ?? 0);
  const externalId = String(tx.external_id ?? tx.externalId ?? '');
  if (txId !== paymentId ||
      Math.round(amount * 100) !== 1990 ||
      externalId.startsWith('protecao-') ||
      externalId.startsWith('sorteio-') ||
      ['group_protection','sorteio_cota'].includes(String(tx.metadata?.offer_type || ''))) {
    return false;
  }
  return true;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('Pragma', 'no-cache');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim();
  const origin = String(req.headers?.origin || '');
  if (origin) {
    try {
      if (new URL(origin).host !== host) return res.status(403).json({ error: 'Origem inválida.' });
    } catch {
      return res.status(403).json({ error: 'Origem inválida.' });
    }
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const paymentId = String(body?.parent_payment_id || '');
    const sessionId = String(body?.session_id || '');
    if (!paymentId || paymentId.length > 128 || !sessionId || sessionId.length > 200) {
      return res.status(400).json({ error: 'Dados da compra ausentes.' });
    }

    if (!await verifiedPurchase(paymentId, sessionId)) {
      return res.status(403).json({ error: 'Não foi possível confirmar este pagamento. Tente novamente ou contate o suporte.' });
    }

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return res.status(503).json({ error: 'Entrega temporariamente indisponível.' });
    const headers = { apikey: key, Authorization: `Bearer ${key}` };
    const setting = async (name: string): Promise<string> => {
      const response = await fetch(
        `${url}/rest/v1/app_settings?key=eq.${encodeURIComponent(name)}&select=value&limit=1`,
        { headers, cache: 'no-store' },
      );
      if (!response.ok) return '';
      const rows = await response.json().catch(() => []);
      return String(Array.isArray(rows) ? rows[0]?.value || '' : '').trim();
    };

    const configuredUrl = (await setting('pix_success_url')) || (await setting('payment_redirect_link'));
    if (!configuredUrl) return res.status(503).json({ error: 'A entrega não está configurada. Contate o suporte.' });
    const finalUrl = new URL(/^https?:\/\//i.test(configuredUrl) ? configuredUrl : `https://${configuredUrl}`);
    if (!['https:', 'http:'].includes(finalUrl.protocol) || !finalUrl.hostname) {
      return res.status(503).json({ error: 'Destino de entrega inválido. Contate o suporte.' });
    }
    return res.status(200).json({ url: finalUrl.toString() });
  } catch {
    return res.status(503).json({ error: 'Não foi possível confirmar a entrega agora. Tente novamente.' });
  }
}
