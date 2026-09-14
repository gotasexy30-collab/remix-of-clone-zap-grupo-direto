import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_PERIODS = new Set(["today", "yesterday", "7d", "30d", "all"]);

function getPeriodRange(period: string): { start: Date | null; end: Date | null } {
  const now = new Date();
  if (period === "all") return { start: null, end: null };
  if (period === "7d") return { start: new Date(now.getTime() - 7 * 86400000), end: null };
  if (period === "30d") return { start: new Date(now.getTime() - 30 * 86400000), end: null };

  const brtNow = new Date(now.getTime() - 3 * 3600000);
  const today = new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate(), 3));
  return period === "yesterday"
    ? { start: new Date(today.getTime() - 86400000), end: today }
    : { start: today, end: new Date(today.getTime() + 86400000) };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const requestedPeriod = String(body?.period || "today");
    const period = ALLOWED_PERIODS.has(requestedPeriod) ? requestedPeriod : "today";
    const { start, end } = getPeriodRange(period);

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return json({ error: "Banco não configurado" }, 500);

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let eventsQuery = supabase.from("tracked_events").select("event_name");
    let salesQuery = supabase.from("purchases").select("amount,status,created_at").eq("status", "approved");
    if (start) {
      eventsQuery = eventsQuery.gte("created_at", start.toISOString());
      salesQuery = salesQuery.gte("created_at", start.toISOString());
    }
    if (end) {
      eventsQuery = eventsQuery.lt("created_at", end.toISOString());
      salesQuery = salesQuery.lt("created_at", end.toISOString());
    }

    const [eventsResult, salesResult] = await Promise.all([eventsQuery, salesQuery]);
    if (eventsResult.error) throw eventsResult.error;
    if (salesResult.error) throw salesResult.error;

    const counts = (eventsResult.data || []).reduce((acc: Record<string, number>, event) => {
      acc[event.event_name] = (acc[event.event_name] || 0) + 1;
      return acc;
    }, {});
    const sales = salesResult.data || [];
    const revenue = sales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);

    return json({
      total_visits: counts.page_view || 0,
      total_clicks: counts.chat_start || 0,
      total_sales: sales.length,
      revenue,
      initiate_checkout: counts.checkout || counts.InitiateCheckout || 0,
      lead: counts.checkout_button_click || counts.Lead || 0,
      purchase: sales.length,
      pressel_passed: counts.PresselPassed || 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao consultar métricas";
    return json({ error: message }, 500);
  }
});