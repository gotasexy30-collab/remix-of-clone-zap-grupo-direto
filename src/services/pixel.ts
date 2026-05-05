// Meta Pixel + UTM forwarding service
import { getSetting } from './settings';

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

let pixelLoaded = false;
let currentPixelId = '';

export async function initMetaPixel(): Promise<void> {
  if (pixelLoaded) return;
  let pixelId = localStorage.getItem('meta_pixel_id') || '';
  if (!pixelId) {
    pixelId = (await getSetting('meta_pixel_id')) || '';
    if (pixelId) localStorage.setItem('meta_pixel_id', pixelId);
  }
  if (!pixelId) return;

  currentPixelId = pixelId;

  // Standard Meta Pixel snippet
  (function (f: any, b, e, v, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq?.('init', pixelId);
  window.fbq?.('track', 'PageView');
  pixelLoaded = true;
}

export function fbqTrack(event: string, params?: Record<string, any>, options?: Record<string, any>) {
  if (window.fbq) {
    if (options) window.fbq('track', event, params || {}, options);
    else window.fbq('track', event, params || {});
  }
}

// ============ Meta CAPI (server-side) ============
function getCookie(name: string): string {
  try {
    const m = document.cookie.match(new RegExp('(^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[2]) : '';
  } catch { return ''; }
}

export function getMetaTrackingContext() {
  return {
    fbp: getCookie('_fbp'),
    fbc: getCookie('_fbc'),
    event_source_url: window.location.href,
    user_agent: navigator.userAgent,
  };
}

function genEventId(): string {
  return (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/**
 * Tracks an event via BOTH client-side Pixel AND server-side CAPI with the same
 * event_id, so Meta deduplicates automatically. Use for high-value events (Lead, Purchase).
 */
export function logTrackedEvent(event: string) {
  try {
    const sessionId = sessionStorage.getItem('wa_session_id') || '';
    const slug = (() => {
      try {
        const parts = window.location.pathname.split('/').filter(Boolean);
        return parts[0] || 'main';
      } catch { return 'main'; }
    })();
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase.from('tracked_events').insert({ event_name: event, session_id: sessionId, slug }).then(() => {});
    });
  } catch { /* noop */ }
}

export function trackEventDual(event: string, params?: Record<string, any>) {
  const eventId = genEventId();

  // 1. Client-side pixel with eventID
  if (window.fbq) {
    window.fbq('track', event, params || {}, { eventID: eventId });
  }

  // Log to DB for funnel metrics
  logTrackedEvent(event);

  // 2. Server-side CAPI (fire-and-forget)
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meta-capi`;
    fetch(url, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        event_name: event,
        event_id: eventId,
        event_source_url: window.location.href,
        value: params?.value,
        currency: params?.currency || 'BRL',
        fbp: getCookie('_fbp'),
        fbc: getCookie('_fbc'),
        user_agent: navigator.userAgent,
      }),
    }).catch(() => {});
  } catch { /* noop */ }
}

// ============ UTM persistence ============
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];

export function captureUTMs() {
  try {
    const params = new URLSearchParams(window.location.search);
    const stored: Record<string, string> = {};
    let found = false;
    UTM_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) {
        stored[k] = v;
        found = true;
      }
    });
    if (found) {
      sessionStorage.setItem('utm_data', JSON.stringify(stored));
      localStorage.setItem('utm_data', JSON.stringify(stored));
    }
  } catch { /* noop */ }
}

export function getStoredUTMs(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem('utm_data') || localStorage.getItem('utm_data');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function appendUTMsToUrl(url: string): string {
  if (!url) return url;
  const utms = getStoredUTMs();
  if (Object.keys(utms).length === 0) return url;
  try {
    const u = new URL(url);
    Object.entries(utms).forEach(([k, v]) => {
      if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    });
    return u.toString();
  } catch {
    // For wa.me links etc, append as query
    const sep = url.includes('?') ? '&' : '?';
    const qs = Object.entries(utms).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `${url}${sep}${qs}`;
  }
}
