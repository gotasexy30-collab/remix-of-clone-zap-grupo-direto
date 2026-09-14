const ALLOWED_PERIODS = new Set(['today', 'yesterday', '7d', '30d', 'all']);

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Banco não configurado' });

  const period = ALLOWED_PERIODS.has(String(req.query?.period)) ? String(req.query.period) : 'today';
  const { start, end } = getPeriodRange(period);
  const dateFilter = `${start ? `&created_at=gte.${encodeURIComponent(start.toISOString())}` : ''}${end ? `&created_at=lt.${encodeURIComponent(end.toISOString())}` : ''}`;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };

  try {
    const [eventsResponse, salesResponse] = await Promise.all([
      fetch(`${url}/rest/v1/tracked_events?select=event_name${dateFilter}`, { headers }),
      fetch(`${url}/rest/v1/purchases?select=amount,status,created_at&status=eq.approved${dateFilter}`, { headers }),
    ]);
    if (!eventsResponse.ok || !salesResponse.ok) throw new Error('Falha ao consultar métricas');

    const events = await eventsResponse.json();
    const sales = await salesResponse.json();
    const counts = events.reduce((acc: Record<string, number>, event: { event_name: string }) => {
      acc[event.event_name] = (acc[event.event_name] || 0) + 1;
      return acc;
    }, {});
    const revenue = sales.reduce((sum: number, sale: { amount: number }) => sum + Number(sale.amount || 0), 0);

    return res.status(200).json({
      total_visits: counts.page_view || 0,
      total_clicks: counts.chat_start || 0,
      total_sales: sales.length,
      revenue,
      initiate_checkout: counts.checkout || 0,
      lead: counts.checkout_button_click || 0,
      purchase: sales.length,
      pressel_passed: counts.PresselPassed || 0,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao consultar métricas' });
  }
}