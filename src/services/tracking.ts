import { supabase } from "@/integrations/supabase/client";

const getSessionId = () => {
  let sid = sessionStorage.getItem("wa_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("wa_session_id", sid);
  }
  return sid;
};

export const trackEvent = async (eventName: string, slug?: string) => {
  try {
    const sessionId = getSessionId();
    const { error } = await supabase
      .from("tracked_events")
      .insert([
        {
          event_name: eventName,
          session_id: sessionId,
          slug: slug || "main",
        },
      ]);
    
    if (error) throw error;
    console.log(`[Track] Evento ${eventName} disparado com sucesso no Supabase.`);
  } catch (error) {
    console.warn(`[Track] Falha no evento ${eventName}:`, error);
  }
};

export const getStats = async () => {
  try {
    // Definimos os mapeamentos de eventos
    const eventMapping = {
      h1: "page_view",
      h2: "chat_start",
      h3: "checkout",
      h4: "sale_approved",
      h5: "lead",
    };

    const { data, error } = await supabase
      .from("tracked_events")
      .select("event_name");

    if (error) throw error;

    const counts = (data || []).reduce((acc: Record<string, number>, curr) => {
      acc[curr.event_name] = (acc[curr.event_name] || 0) + 1;
      return acc;
    }, {});

    return {
      visits: counts["page_view"] || 0,
      chat: counts["chat_start"] || 0,
      checkout: counts["checkout"] || 0,
      sale1: counts["sale_approved"] || 0,
      sale2: counts["lead"] || 0,
    };
  } catch (e) {
    console.error("[Dashboard] Erro ao buscar estatísticas do Supabase:", e);
    return { visits: 0, chat: 0, checkout: 0, sale1: 0, sale2: 0 };
  }
};
