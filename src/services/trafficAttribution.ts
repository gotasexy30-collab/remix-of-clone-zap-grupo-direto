import { supabase } from '@/integrations/supabase/client';

export type TrafficAttribution = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
  ttclid: string;
  fbclid: string;
  gclid: string;
};

const STORAGE_KEY = 'traffic_attribution_v1';
const TRACKED_KEY = 'traffic_attribution_tracked_v1';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function resolveSource(utmSource: string, ttclid: string, fbclid: string, gclid: string): string {
  const source = normalize(utmSource);

  if (ttclid || ['tiktok', 'tiktok_ads', 'tiktokads'].includes(source)) return 'tiktok';
  if (fbclid || ['facebook', 'facebook_ads', 'fb', 'meta', 'instagram', 'ig'].includes(source)) return 'meta';
  if (gclid || ['google', 'google_ads', 'youtube'].includes(source)) return 'google';
  if (source) return source;

  return 'direct';
}

function getSessionId(): string {
  let sessionId = sessionStorage.getItem('wa_session_id') || '';
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem('wa_session_id', sessionId);
  }
  return sessionId;
}

export function getTrafficAttribution(): TrafficAttribution {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as TrafficAttribution;
  } catch {
    // Continua lendo a URL quando o storage estiver indisponível.
  }

  const params = new URLSearchParams(window.location.search);
  const utmSource = params.get('utm_source') || '';
  const ttclid = params.get('ttclid') || '';
  const fbclid = params.get('fbclid') || '';
  const gclid = params.get('gclid') || '';

  const attribution: TrafficAttribution = {
    source: resolveSource(utmSource, ttclid, fbclid, gclid),
    medium: params.get('utm_medium') || '',
    campaign: params.get('utm_campaign') || '',
    content: params.get('utm_content') || '',
    term: params.get('utm_term') || '',
    ttclid,
    fbclid,
    gclid,
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // noop
  }

  return attribution;
}

export async function captureTrafficAttribution(slug = 'main'): Promise<TrafficAttribution> {
  const attribution = getTrafficAttribution();

  try {
    if (sessionStorage.getItem(TRACKED_KEY) === '1') return attribution;
  } catch {
    // Continua e tenta registrar novamente.
  }

  const sessionId = getSessionId();

  try {
    const { error } = await supabase.from('tracked_events').insert({
      event_name: 'TrafficSource:' + attribution.source,
      session_id: sessionId,
      slug,
    });

    if (!error) {
      sessionStorage.setItem(TRACKED_KEY, '1');
    } else {
      console.warn('[Traffic] Falha ao registrar origem:', error);
    }
  } catch (error) {
    console.warn('[Traffic] Falha ao registrar origem:', error);
  }

  return attribution;
}
