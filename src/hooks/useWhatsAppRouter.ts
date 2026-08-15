import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { appendUTMsToUrl } from "@/services/pixel";

function getSessionId() {
  let sid = sessionStorage.getItem("wa_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("wa_session_id", sid);
  }
  return sid;
}

async function logLead(payload: any) {
  try {
    const { error } = await supabase.from("lead_logs").insert([
      {
        whatsapp_number_id: payload.whatsapp_number_id,
        whatsapp_phone: payload.whatsapp_phone,
        message_text: payload.message_text,
        session_id: payload.session_id,
        user_agent: payload.user_agent,
        referer: payload.referer,
      },
    ]);
    if (error) console.error("Erro ao salvar log de lead:", error);
  } catch (err) {
    console.error("Erro ao salvar log de lead:", err);
  }
}

export function useWhatsAppRouter() {
  const pending = useRef(false);

  const redirect = useCallback(
    async (messageText = "", fallbackUrl?: string) => {
      if (pending.current) return;
      pending.current = true;
      try {
        const { data } = await supabase.functions.invoke("whatsapp-router", {
          body: { action: "get_best_number" },
        });

        const link = data?.number?.link;

        if (!link) {
          if (fallbackUrl) window.location.assign(fallbackUrl);
          return;
        }

        logLeadInBackground({
          action: "log_lead",
          whatsapp_number_id: data.number.id,
          whatsapp_phone: data.number.phone || "",
          message_text: messageText,
          user_agent: navigator.userAgent,
          referer: document.referrer,
          session_id: getSessionId(),
        });

        window.location.assign(appendUTMsToUrl(link));
      } catch {
        if (fallbackUrl) window.location.assign(fallbackUrl);
      } finally {
        pending.current = false;
      }
    },
    [],
  );

  return { redirect };
}
