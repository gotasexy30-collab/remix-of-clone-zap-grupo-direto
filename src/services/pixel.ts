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

export function fbqTrack(event: string, params?: Record<string, any>) {
  if (window.fbq) {
    window.fbq('track', event, params || {});
  }
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
