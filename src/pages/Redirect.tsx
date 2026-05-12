import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSetting } from '../services/settings';
import { supabase } from '@/integrations/supabase/client';

const isMobileOrTablet = () => {
  const ua = navigator.userAgent || '';
  // Trata tablets como mobile (iPad moderno se reporta como Mac, então checamos touch)
  const iPadOSDesktop = /Macintosh/i.test(ua) && (navigator as any).maxTouchPoints > 1;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua) || iPadOSDesktop;
};

const appendQuery = (url: string) => {
  try {
    const incoming = window.location.search;
    if (!incoming) return url;
    const u = new URL(url);
    const params = new URLSearchParams(incoming);
    params.forEach((v, k) => u.searchParams.append(k, v));
    return u.toString();
  } catch {
    return url;
  }
};

const Redirect = () => {
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const isMobile = isMobileOrTablet();

        // Mobile: envia para a pressel (preserva query string para UTMs)
        if (isMobile) {
          navigate({ pathname: '/pressel', search: window.location.search }, { replace: true });
          return;
        }

        const desktopUrl = await getSetting('redirect_desktop_url');
        const mobileUrl = await getSetting('redirect_mobile_url');
        const finalUrl = (desktopUrl && desktopUrl.trim()) || (mobileUrl && mobileUrl.trim());
        if (!finalUrl) {
          setError('URLs de redirecionamento não configuradas. Acesse /painel para configurar.');
          return;
        }
        try {
          const sessionId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          await supabase.from('tracked_events').insert({
            event_name: 'RedirectDesktop',
            session_id: sessionId,
            slug: 'r',
          });
        } catch {}
        window.location.replace(appendQuery(finalUrl));
      } catch (e) {
        setError('Erro ao carregar redirecionamento.');
      }
    })();
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0b141a] text-[#e9edef] flex items-center justify-center p-6">
      <div className="text-center">
        {error ? (
          <p className="text-sm text-red-400 max-w-sm">{error}</p>
        ) : (
          <>
            <div className="w-10 h-10 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-[#8696a0] uppercase tracking-widest">Redirecionando...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default Redirect;
