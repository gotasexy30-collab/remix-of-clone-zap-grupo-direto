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

function formatUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

export function useWhatsAppRouter() {
  const pending = useRef(false);

  const redirect = useCallback(
    async (messageText = "", fallbackUrl?: string): Promise<boolean> => {
      if (pending.current) return false;
      pending.current = true;
      try {
        console.log("Iniciando redirecionamento WhatsApp Router...");
        // Obter todos os números ativos
        const { data: numbers, error } = await supabase
          .from("whatsapp_numbers")
          .select("*")
          .eq("status", "active")
          .eq("manually_disabled", false);

        if (error || !numbers || numbers.length === 0) {
          console.log("Nenhum número WhatsApp ativo encontrado. Usando fallback URL.");
          if (fallbackUrl) {
            window.location.href = formatUrl(fallbackUrl);
            return true;
          }
          return false;
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

        const finalUrl = appendUTMsToUrl(formatUrl(link));
        console.log("URL final WhatsApp resolvida:", finalUrl);
        window.location.href = finalUrl;
        return true;
      } catch (err) {
        console.error("Erro no WhatsApp Router:", err);
        if (fallbackUrl) {
          const finalFallbackUrl = formatUrl(fallbackUrl);
          console.log("Usando URL de fallback devido a erro no router:", finalFallbackUrl);
          window.location.href = finalFallbackUrl;
          return true;
        }
        return false;
      } finally {
        pending.current = false;
      }
    },
    [],
  );

  return { redirect };
}
