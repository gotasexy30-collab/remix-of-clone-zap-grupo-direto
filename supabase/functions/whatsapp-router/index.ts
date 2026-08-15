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

// A validação de administrador agora é feita via Supabase Auth.
// O backend verifica se a requisição contém um token JWT válido.
async function getAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
  return user;
}

const PUBLIC_SETTING_KEYS = new Set([
  "chat_profile_name",
  "chat_profile_photo",
  "chat_location_image",
  "meta_pixel_id",
  "pix_tutorial_video_url",
  "payment_redirect_link",
  "pix_success_url",
  "redirect_mobile_url",
  "redirect_desktop_url",
]);

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
    const al = a.last_assigned_at ? new Date(a.last_assigned_at).getTime() : 0;
    const bl = b.last_assigned_at ? new Date(b.last_assigned_at).getTime() : 0;
    return al - bl;
  });

  const n = available[0];

  await supabase
    .from("whatsapp_numbers")
    .update({ last_assigned_at: new Date().toISOString() })
    .eq("id", n.id);

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
  const whatsapp_number_id = body?.whatsapp_number_id;
  if (!whatsapp_number_id || typeof whatsapp_number_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(whatsapp_number_id)) {
    return { success: false, error: "invalid id" };
  }
  const clip = (v: any, n: number) => String(v ?? "").slice(0, n);
  const whatsapp_phone = clip(body.whatsapp_phone, 30);
  const message_text   = clip(body.message_text, 500);
  const user_agent     = clip(body.user_agent, 500);
  const referer        = clip(body.referer, 2000);
  const session_id     = clip(body.session_id, 200);

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
  const clip = (v: any, n: number) => String(v ?? "").slice(0, n);
  await supabase.from("page_visits").insert({
    session_id: clip(body.session_id, 200),
    slug: clip(body.slug, 200),
    user_agent: clip(body.user_agent, 1000),
    referer: clip(body.referer, 2000),
  });
  return { success: true };
}

function brtDayStart(): string {
  const now = new Date();
  const brtOffsetMs = 3 * 60 * 60 * 1000;
  const brtNow = new Date(now.getTime() - brtOffsetMs);
  const startBrt = new Date(
    Date.UTC(
      brtNow.getUTCFullYear(),
      brtNow.getUTCMonth(),
      brtNow.getUTCDate(),
      0, 0, 0,
    ),
  );
  return new Date(startBrt.getTime() + brtOffsetMs).toISOString();
}

const fetchAll = async (build: (from: number, to: number) => any) => {
  const PAGE = 1000;
  let from = 0;
  const all: any[] = [];
  while (true) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error || !data) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
};

async function dailyFunnel() {
  const startUtc = brtDayStart();

  const [visits, clicks, sales, events] = await Promise.all([
    fetchAll((f, t) =>
      supabase.from("page_visits").select("session_id").gte("visited_at", startUtc).range(f, t),
    ),
    fetchAll((f, t) =>
      supabase.from("lead_logs").select("session_id").gte("redirected_at", startUtc).range(f, t),
    ),
    fetchAll((f, t) =>
      supabase
        .from("purchases")
        .select("amount, session_id")
        .eq("status", "approved")
        .gte("approved_at", startUtc)
        .range(f, t),
    ),
    fetchAll((f, t) =>
      supabase
        .from("tracked_events")
        .select("event_name, session_id, slug")
        .gte("created_at", startUtc)
        .range(f, t),
    ),
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

  const countEvent = (name: string) =>
    (events || []).filter((e) => e.event_name === name).length;
  const uniqByEventSession = (name: string) =>
    new Set((events || []).filter((e) => e.event_name === name).map((e) => e.session_id).filter(Boolean)).size;

  const initiate_checkout = countEvent("InitiateCheckout");
  const lead = countEvent("Lead");
  const purchase = totalSales;
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
    initiate_checkout,
    lead,
    purchase,
    pressel_passed: uniqByEventSession("PresselPassed"),
  };
}

// Public action for FunnelLiveFeed: aggregated counts + recent feed (no PII)
async function funnelFeed(body: any) {
  const range = body?.range || "today";
  let fromIso: string;
  if (range === "today") fromIso = brtDayStart();
  else if (range === "7d") fromIso = new Date(Date.now() - 7 * 86400000).toISOString();
  else fromIso = new Date(Date.now() - 30 * 86400000).toISOString();

  const [visits, events, sales, feedRes] = await Promise.all([
    fetchAll((f, t) =>
      supabase.from("page_visits").select("session_id").gte("visited_at", fromIso).range(f, t),
    ),
    fetchAll((f, t) =>
      supabase.from("tracked_events").select("event_name, session_id").gte("created_at", fromIso).range(f, t),
    ),
    fetchAll((f, t) =>
      supabase.from("purchases").select("session_id").eq("status", "approved").gte("approved_at", fromIso).range(f, t),
    ),
    supabase
      .from("tracked_events")
      .select("id, event_name, session_id, created_at")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const uniqueVisits = new Set((visits || []).map((v: any) => v.session_id).filter(Boolean)).size;

  const uniqueByEvent: Record<string, Set<string>> = {};
  (events || []).forEach((e: any) => {
    if (!uniqueByEvent[e.event_name]) uniqueByEvent[e.event_name] = new Set();
    if (e.session_id) uniqueByEvent[e.event_name].add(e.session_id);
  });

  const sessionsWithId = new Set((sales || []).map((p: any) => p.session_id).filter((s: any) => !!s)).size;
  const purchasesWithoutSession = (sales || []).filter((p: any) => !p.session_id).length;
  const uniquePurchases = sessionsWithId + purchasesWithoutSession;

  const feed = (feedRes.data || []).map((e: any) => ({
    id: e.id,
    event: e.event_name,
    session: e.session_id || "—",
    time: e.created_at,
  }));

  return {
    counts: {
      Visited: uniqueVisits,
      ChatStarted: uniqueByEvent["ChatStarted"]?.size || 0,
      InitiateCheckout: uniqueByEvent["InitiateCheckout"]?.size || 0,
      PixGenerated: uniqueByEvent["PixGenerated"]?.size || 0,
      PixCopied: uniqueByEvent["PixCopied"]?.size || 0,
      TutorialOpened: uniqueByEvent["TutorialOpened"]?.size || 0,
      AlreadyPaid: uniqueByEvent["AlreadyPaid"]?.size || 0,
      Purchase: uniquePurchases || (uniqueByEvent["Purchase"]?.size || 0),
    },
    feed,
  };
}

async function desktopRedirectsCount() {
  const { count } = await supabase
    .from("tracked_events")
    .select("*", { count: "exact", head: true })
    .eq("event_name", "RedirectDesktop");
  return { count: count ?? 0 };
}

// ---------- Admin actions ----------

async function listNumbers() {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const startOfDayUtc = brtDayStart();

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
      .in("id", toReactivate.map((n) => n.id));
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

async function adminGetAllSettings() {
  const { data } = await supabase.from("app_settings").select("key, value");
  const settings: Record<string, string> = {};
  (data || []).forEach((row: any) => { settings[row.key] = row.value; });
  return { settings };
}

async function adminSetSetting(body: any) {
  const { key, value } = body;
  if (!key || typeof key !== "string") return { error: "key required" };
  if (typeof value !== "string") return { error: "value must be string" };
  // Block sensitive keys via this endpoint — they live in secrets now
  if (key === "admin_password") {
    return { error: "this key is managed as a secret, not editable here" };
  }
  const { data: existing } = await supabase
    .from("app_settings")
    .select("id")
    .eq("key", key)
    .maybeSingle();
  if (existing) {
    await supabase.from("app_settings").update({ value }).eq("key", key);
  } else {
    await supabase.from("app_settings").insert({ key, value });
  }
  return { success: true };
}

// ---------- Router ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // Ações públicas
    if (action === "get_best_number") return json(await getBestNumber());
    if (action === "log_lead") return json(await logLead(body));
    if (action === "track_visit") return json(await trackVisit(body));

    // Ações administrativas requerem autenticação via Supabase
    const user = await getAuthUser(req);
    if (!user) {
      return json({ error: "unauthorized" }, 401);
    }

    switch (action) {
      case "daily_funnel":
        return json(await dailyFunnel());
      case "funnel_feed":
        return json(await funnelFeed(body));
      case "desktop_redirects_count":
        return json(await desktopRedirectsCount());
      case "verify_admin":
        return json({ ok: true });
      case "list_numbers":
        return json(await listNumbers());
      case "add_number":
        return json(await addNumber(body));
      case "update_number":
        return json(await updateNumber(body));
      case "delete_number":
        return json(await deleteNumber(body));
      case "get_logs":
        return json(await getLogs(body));
      case "admin_get_settings":
        return json(await adminGetAllSettings());
      case "admin_set_setting":
        return json(await adminSetSetting(body));
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
