import { supabase } from '@/integrations/supabase/client';

// Apenas parâmetros de atribuição permitidos. Nunca armazene a URL inteira,
// IP, user-agent, cookies, nem parâmetros arbitrários do visitante.
const KEYS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id',
  'fbclid', 'gclid', 'ttclid', 'campaign_id', 'adset_id', 'ad_id',
] as const;

type EntryPoint = 'chat' | 'pressel' | 'redirect';
const trackedEntries = new Set<string>();

export async function captureLandingParameters(entryPoint: EntryPoint): Promise<void> {
  try {
    const params = new URLSearchParams(window.location.search);
    const details: Record<string, string> = {};
    for (const key of KEYS) {
      const value = (params.get(key) || '').trim().slice(0, 512);
      if (value && !/\{\{.*?\}\}/.test(value)) details[key] = value;
    }
    const key = 'wa_session_id';
    let sessionId = sessionStorage.getItem(key);
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem(key, sessionId);
    }
    const entryKey = entryPoint + ':' + sessionId + ':' + window.location.pathname + ':' + window.location.search;
    if (trackedEntries.has(entryKey)) return;
    trackedEntries.add(entryKey);
    const { error } = await supabase.from('landing_attributions').insert({
      session_id: sessionId,
      entry_point: entryPoint,
      landing_host: window.location.hostname.slice(0, 255),
      landing_path: window.location.pathname.slice(0, 255),
      ...details,
    });
    if (error) {
      trackedEntries.delete(entryKey);
      console.warn('[UTM] Registro de entrada indisponível.');
    }
  } catch {
    console.warn('[UTM] Não foi possível registrar parâmetros desta visita.');
  }
}
