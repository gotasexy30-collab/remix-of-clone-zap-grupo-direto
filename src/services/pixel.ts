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
const eventQueue: Array<{ method: string, args: any[] }> = [];

export async function initMetaPixel(): Promise<void> {
  if (pixelLoaded) return;

  if (!window.fbq) {
    window.fbq = function() {
      if ((window.fbq as any)?.callMethod) (window.fbq as any).callMethod.apply(window.fbq, arguments);
      else (window.fbq as any)?.queue?.push(arguments);
    } as any;
    (window.fbq as any).queue = [];
  }

  let pixelId = localStorage.getItem('meta_pixel_id') || '';
  if (!pixelId) {
    pixelId = (await getSetting('meta_pixel_id')) || '';
    if (pixelId) localStorage.setItem('meta_pixel_id', pixelId);
  }
  if (!pixelId) return;

  currentPixelId = pixelId;

  (function (f: any, b, e, v, n?: any, t?: any, s?: any) {
    if (f.fbq && f.fbq.version) return;
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
    if (s && s.parentNode) s.parentNode.insertBefore(t, s);
    else b.head.appendChild(t);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq?.('init', pixelId);
  window.fbq?.('track', 'PageView');
  pixelLoaded = true;

  while (eventQueue.length > 0) {
    const ev = eventQueue.shift();
    if (ev && window.fbq) window.fbq(ev.method, ...ev.args);
  }
}

// Envia o mesmo evento para Browser Pixel + CAPI usando o mesmo event_id.
export function fbqTrack(event: string, params?: Record<string, any>, options?: Record<string, any>) {
  const eventId = options?.eventID || genEventId();
  trackEventDual(event, params, eventId);
}

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

export function trackEventDual(event: string, params?: Record<string, any>, eventId?: string) {
  const finalEventId = eventId || genEventId();

  // 1. Browser Pixel
  if (pixelLoaded && window.fbq) {
    window.fbq('track', event, params || {}, { eventID: finalEventId });
  } else {
    eventQueue.push({ method: 'track', args: [event, params || {}, { eventID: finalEventId }] });
  }

  // Registro interno para métricas
  logTrackedEvent(event);

  // 2. Server-side CAPI
  try {
    const pixelId = currentPixelId || localStorage.getItem('meta_pixel_id') || '';
    if (!pixelId) return;

    const payload = {
      pixelId,
      event_name: event,
      event_id: finalEventId,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_source_url: window.location.href,
      user_data: {
        client_user_agent: navigator.userAgent,
        fbp: getCookie('_fbp'),
        fbc: getCookie('_fbc'),
      },
      custom_data: params || {},
    };

    fetch('/api/meta-capi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(async response => {
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('[Meta CAPI] HTTP error:', response.status, text);
      }
    }).catch(error => {
      console.error('[Meta CAPI] Network error:', error);
    });
  } catch (error) {
    console.error('[Meta CAPI] Client error:', error);
  }
}

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
    const sep = url.includes('?') ? '&' : '?';
    const qs = Object.entries(utms).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    return `${url}${sep}${qs}`;
  }
}
