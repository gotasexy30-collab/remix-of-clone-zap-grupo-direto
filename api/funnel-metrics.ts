const ALLOWED_PERIODS = new Set(['today', 'yesterday', '7d', '30d', 'all', 'custom']);

function getPeriodRange(period: string): { start: Date | null; end: Date | null } {
  const now = new Date();
  if (period === 'all') return { start: null, end: null };
  if (period === '7d') return { start: new Date(now.getTime() - 7 * 86400000), end: null };
  if (period === '30d') return { start: new Date(now.getTime() - 30 * 86400000), end: null };
  const brtNow = new Date(now.getTime() - 3 * 3600000);
  const today = new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate(), 3));
  return period === 'yesterday'
    ? { start: new Date(today.getTime() - 86400000), end: today }
    : { start: today, end: new Date(today.getTime() + 86400000) };
}

// Um dia civil em Brasília: início 00:00 (03:00 UTC), fim exclusivo no dia seguinte.
// Validação estrita evita datas inexistentes (ex.: 31/02) e parâmetros incompletos.
function getCustomDayRange(value: unknown): { start: Date; end: Date } | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 3));
  if (start.getUTCFullYear() !== year || start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) return null;
  return { start, end: new Date(start.getTime() + 86400000) };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, private');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Banco não configurado' });

  // Este endpoint é administrativo e consulta vendas com a service_role.
  const token = String(req.headers?.authorization || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
  if (!token) return res.status(401).json({ error: 'Autenticação obrigatória.' });
  const userResponse = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!userResponse.ok) return res.status(401).json({ error: 'Sessão inválida.' });
  const user = await userResponse.json().catch(() => null);
  if (!user || String(user.email || '').toLowerCase() !== 'admin@meusistema.com') {
    return res.status(403).json({ error: 'Acesso restrito.' });
  }

  const period = String(req.query?.period || 'today');
  if (!ALLOWED_PERIODS.has(period)) return res.status(400).json({ error: 'Período inválido.' });
  const range = period === 'custom' ? getCustomDayRange(req.query?.date) : getPeriodRange(period);
  if (!range) return res.status(400).json({ error: 'Escolha uma data válida (AAAA-MM-DD).' });
  const { start, end } = range;

  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  try {
    const result = await fetch(`${url}/rest/v1/rpc/admin_funnel_metrics`, {
      method: 'POST',
      headers,
      cache: 'no-store',
      body: JSON.stringify({
        p_start: start?.toISOString() || null,
        p_end: end?.toISOString() || null,
      }),
    });
    if (!result.ok) throw new Error('Não foi possível consultar as métricas completas');
    const metrics = await result.json();
    return res.status(200).json(metrics);
  } catch (error: any) {
    console.error('[Funil]', error);
    return res.status(500).json({ error: 'Não foi possível consultar as métricas do período.' });
  }
}