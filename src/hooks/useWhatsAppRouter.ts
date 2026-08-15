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
        // Obter todos os números ativos
        const { data: numbers, error } = await supabase
          .from("whatsapp_numbers")
          .select("*")
          .eq("status", "active")
          .eq("manually_disabled", false);

        if (error || !numbers || numbers.length === 0) {
          if (fallbackUrl) window.location.assign(fallbackUrl);
          return;
        }

        // Selecionar um número aleatório (round-robin simples ou random)
        const bestNumber = numbers[Math.floor(Math.random() * numbers.length)];
        const link = bestNumber.link;

        await logLead({
          whatsapp_number_id: bestNumber.id,
          whatsapp_phone: bestNumber.phone || "",
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
