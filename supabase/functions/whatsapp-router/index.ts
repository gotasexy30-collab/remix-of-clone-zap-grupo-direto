import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function getAdminPassword(): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "admin_password")
    .maybeSingle();
  return data?.value ?? null;
}

async function requireAdmin(password: string | undefined): Promise<boolean> {
  if (!password) return false;
  const saved = await getAdminPassword();
  return !!saved && password === saved;
}

// ---------- Public actions ----------

async function getBestNumber() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: numbers } = await supabase
    .from("whatsapp_numbers")
    .select("*")
    .eq("manually_disabled", false);

  if (!numbers?.length) return { number: null };

  const { data: recentLogs } = await supabase
    .from("lead_logs")
    .select("whatsapp_number_id")
    .gte("redirected_at", oneHourAgo);

  const hourlyCount: Record<string, number> = {};
  recentLogs?.forEach((l) => {
    if (l.whatsapp_number_id) {
      hourlyCount[l.whatsapp_number_id] =
        (hourlyCount[l.whatsapp_number_id] || 0) + 1;
    }
  });

  const available = numbers.filter((n) => {
    if (n.status === "inactive") return false;
    return (hourlyCount[n.id] || 0) < n.hourly_limit;
  });

  if (!available.length) return { number: null };

  available.sort((a, b) => {
    // Round-robin real: quem foi atribuído há mais tempo (ou nunca) vai primeiro
    const al = a.last_assigned_at ? new Date(a.last_assigned_at).getTime() : 0;
    const bl = b.last_assigned_at ? new Date(b.last_assigned_at).getTime() : 0;
    return al - bl;
  });

  const n = available[0];

  // Marca imediatamente como "atribuído agora" para próximo lead pular para outro chip
  await supabase
    .from("whatsapp_numbers")
    .update({ last_assigned_at: new Date().toISOString() })
    .eq("id", n.id);

  // Auto-reativa: se estava auto_paused mas agora tem vaga, volta para active
  if (n.status === "auto_paused") {
    await supabase
      .from("whatsapp_numbers")
      .update({ status: "active" })
      .eq("id", n.id);
  }

  return {
    number: { id: n.id, phone: n.phone, label: n.label, link: n.link },
  };
}

async function logLead(body: any) {
  const {
    whatsapp_number_id,
    whatsapp_phone = "",
    message_text = "",
    user_agent = "",
    referer = "",
    session_id = "",
  } = body;

  if (!whatsapp_number_id) return { success: false, error: "missing id" };

  await supabase.from("lead_logs").insert({
    whatsapp_number_id,
    whatsapp_phone,
    message_text,
    user_agent,
    referer,
    session_id,
  });

  const { data: num } = await supabase
    .from("whatsapp_numbers")
    .select("total_leads, hourly_limit")
    .eq("id", whatsapp_number_id)
    .maybeSingle();

  await supabase
    .from("whatsapp_numbers")
    .update({
      total_leads: (num?.total_leads || 0) + 1,
      last_lead_at: new Date().toISOString(),
    })
    .eq("id", whatsapp_number_id);

  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { data: logs } = await supabase
    .from("lead_logs")
    .select("id")
    .eq("whatsapp_number_id", whatsapp_number_id)
    .gte("redirected_at", oneHourAgo);

  if (logs && num && logs.length >= num.hourly_limit) {
    await supabase
      .from("whatsapp_numbers")
      .update({ status: "auto_paused" })
      .eq("id", whatsapp_number_id);
  }

  return { success: true };
}

async function trackVisit(body: any) {
  const {
    session_id = "",
    slug = "",
    user_agent = "",
    referer = "",
  } = body;
  await supabase.from("page_visits").insert({
    session_id,
    slug,
    user_agent,
    referer,
  });
  return { success: true };
}

async function dailyFunnel() {
  // Janela do dia em horário de Brasília (00:00 a 23:59)
  const now = new Date();
  // BRT = UTC-3 (sem DST atualmente)
  const brtOffsetMs = 3 * 60 * 60 * 1000;
  const brtNow = new Date(now.getTime() - brtOffsetMs);
  const startBrt = new Date(
    Date.UTC(
      brtNow.getUTCFullYear(),
      brtNow.getUTCMonth(),
      brtNow.getUTCDate(),
      0,
      0,
      0,
    ),
  );
  // Converte de volta pra UTC somando o offset
  const startUtc = new Date(startBrt.getTime() + brtOffsetMs).toISOString();

  const [{ data: visits }, { data: clicks }, { data: sales }] = await Promise.all([
    supabase
      .from("page_visits")
      .select("session_id")
      .gte("visited_at", startUtc),
    supabase
      .from("lead_logs")
      .select("session_id")
      .gte("redirected_at", startUtc),
    supabase
      .from("purchases")
      .select("amount, session_id")
      .eq("status", "approved")
      .gte("approved_at", startUtc),
  ]);

  const totalVisits = visits?.length || 0;
  const uniqueVisitors = new Set(
    (visits || []).map((v) => v.session_id).filter(Boolean),
  ).size;
  const totalClicks = clicks?.length || 0;
  const uniqueClickers = new Set(
    (clicks || []).map((c) => c.session_id).filter(Boolean),
  ).size;
  const totalSales = sales?.length || 0;
  const revenue = (sales || []).reduce((s, p) => s + Number(p.amount || 0), 0);
  const conversion =
    uniqueVisitors > 0 ? (uniqueClickers / uniqueVisitors) * 100 : 0;
  const conversionCapped = Math.min(conversion, 100);
  const salesConversion =
    uniqueVisitors > 0 ? (totalSales / uniqueVisitors) * 100 : 0;

  return {
    day_start_utc: startUtc,
    total_visits: totalVisits,
    unique_visitors: uniqueVisitors,
    total_clicks: totalClicks,
    unique_clickers: uniqueClickers,
    conversion_pct: Math.round(conversionCapped * 10) / 10,
    total_sales: totalSales,
    revenue: Math.round(revenue * 100) / 100,
    sales_conversion_pct: Math.round(salesConversion * 10) / 10,
  };
}

// ---------- Admin actions ----------

async function listNumbers() {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  // Início do dia em horário de Brasília (UTC-3)
  const now = new Date();
  const brtOffsetMs = 3 * 60 * 60 * 1000;
  const brtNow = new Date(now.getTime() - brtOffsetMs);
  const startBrt = new Date(
    Date.UTC(
      brtNow.getUTCFullYear(),
      brtNow.getUTCMonth(),
      brtNow.getUTCDate(),
      0,
      0,
      0,
    ),
  );
  const startOfDayUtc = new Date(startBrt.getTime() + brtOffsetMs).toISOString();

  const [{ data: numbers }, { data: recentLogs }, { data: todayLogs }] = await Promise.all([
    supabase
      .from("whatsapp_numbers")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase
      .from("lead_logs")
      .select("whatsapp_number_id")
      .gte("redirected_at", oneHourAgo),
    supabase
      .from("lead_logs")
      .select("whatsapp_number_id")
      .gte("redirected_at", startOfDayUtc),
  ]);

  const hourlyCount: Record<string, number> = {};
  recentLogs?.forEach((l) => {
    if (l.whatsapp_number_id)
      hourlyCount[l.whatsapp_number_id] =
        (hourlyCount[l.whatsapp_number_id] || 0) + 1;
  });

  const todayCount: Record<string, number> = {};
  todayLogs?.forEach((l) => {
    if (l.whatsapp_number_id)
      todayCount[l.whatsapp_number_id] =
        (todayCount[l.whatsapp_number_id] || 0) + 1;
  });

  // Auto-reativa chips que estavam auto_paused mas já têm vaga na janela deslizante
  const toReactivate = (numbers || []).filter(
    (n) =>
      n.status === "auto_paused" &&
      !n.manually_disabled &&
      (hourlyCount[n.id] || 0) < n.hourly_limit,
  );
  if (toReactivate.length) {
    await supabase
      .from("whatsapp_numbers")
      .update({ status: "active" })
      .in(
        "id",
        toReactivate.map((n) => n.id),
      );
    toReactivate.forEach((n) => (n.status = "active"));
  }

  return {
    numbers: (numbers || []).map((n) => ({
      ...n,
      leads_last_hour: hourlyCount[n.id] || 0,
      leads_today: todayCount[n.id] || 0,
    })),
  };
}

async function addNumber(body: any) {
  const { phone, label = "", link, hourly_limit = 30 } = body;
  if (!phone || !link) return { error: "phone and link required" };
  const { data, error } = await supabase
    .from("whatsapp_numbers")
    .insert({ phone, label, link, hourly_limit })
    .select()
    .single();
  if (error) return { error: error.message };
  return { number: data };
}

async function updateNumber(body: any) {
  const { id, ...updates } = body;
  if (!id) return { error: "id required" };
  delete updates.action;
  delete updates.password;
  const { data, error } = await supabase
    .from("whatsapp_numbers")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return { error: error.message };
  return { number: data };
}

async function deleteNumber(body: any) {
  const { id } = body;
  if (!id) return { error: "id required" };
  const { error } = await supabase
    .from("whatsapp_numbers")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };
  return { success: true };
}

async function getLogs(body: any) {
  const limit = Math.min(body?.limit || 100, 500);
  const { data } = await supabase
    .from("lead_logs")
    .select("*")
    .order("redirected_at", { ascending: false })
    .limit(limit);
  return { logs: data || [] };
}

// ---------- Router ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    switch (action) {
      case "get_best_number":
        return json(await getBestNumber());
      case "log_lead":
        return json(await logLead(body));
      case "track_visit":
        return json(await trackVisit(body));
      case "daily_funnel":
        return json(await dailyFunnel());
      case "list_numbers":
        if (!(await requireAdmin(body.password)))
          return json({ error: "unauthorized" }, 401);
        return json(await listNumbers());
      case "add_number":
        if (!(await requireAdmin(body.password)))
          return json({ error: "unauthorized" }, 401);
        return json(await addNumber(body));
      case "update_number":
        if (!(await requireAdmin(body.password)))
          return json({ error: "unauthorized" }, 401);
        return json(await updateNumber(body));
      case "delete_number":
        if (!(await requireAdmin(body.password)))
          return json({ error: "unauthorized" }, 401);
        return json(await deleteNumber(body));
      case "get_logs":
        if (!(await requireAdmin(body.password)))
          return json({ error: "unauthorized" }, 401);
        return json(await getLogs(body));
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
