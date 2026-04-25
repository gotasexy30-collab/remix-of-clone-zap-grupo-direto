import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { appendUTMsToUrl } from "@/services/pixel";

const ROUTER_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-router`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function getSessionId() {
  let sid = sessionStorage.getItem("wa_session_id");
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem("wa_session_id", sid);
  }
  return sid;
}

// keepalive garante que o log seja enviado antes do redirect
function logLeadInBackground(payload: Record<string, unknown>) {
  try {
    fetch(ROUTER_URL, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: ANON_KEY,
        authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    /* noop */
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
