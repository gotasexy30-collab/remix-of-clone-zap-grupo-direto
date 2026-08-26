import React, { useEffect, useRef, useState } from 'react';
import { Target, TrendingUp, Link2, Save, User, Loader2, LogOut, Activity, QrCode, Copy, Check, RefreshCw, ShieldCheck, Play, Pause, Volume2, VolumeX, X, HelpCircle, Smartphone, Monitor, Split, UploadCloud } from 'lucide-react';
import { getStats } from '../../services/tracking';
import { getUserLocation } from '../../services/location';
import { adminGetAllSettings, setSetting } from '../../services/settings';
import { WhatsAppRouterPanel } from './WhatsAppRouterPanel';
import { FunnelLiveFeed } from './FunnelLiveFeed';
import { supabase } from '@/integrations/supabase/client';
import { PresselTest } from './PresselTest';
import { toast } from 'sonner';

type FunnelPeriod = 'today' | 'yesterday' | '7d' | '30d' | 'all';

const FUNNEL_PERIODS: { key: FunnelPeriod; label: string; short: string }[] = [
  { key: 'today',     label: 'Hoje',           short: 'hoje' },
  { key: 'yesterday', label: 'Ontem',          short: 'ontem' },
  { key: '7d',        label: 'Últimos 7 dias',  short: 'nos últimos 7 dias' },
  { key: '30d',       label: 'Últimos 30 dias', short: 'nos últimos 30 dias' },
  { key: 'all',       label: 'Todo o período',  short: 'em todo o período' },
];

// Retorna o intervalo [start, end) em instantes absolutos, usando fuso BRT (UTC-3)
const getFunnelPeriodRange = (period: FunnelPeriod): { start: Date | null; end: Date | null } => {
  const now = new Date();
  if (period === 'all') return { start: null, end: null };
  if (period === '7d') return { start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), end: null };
  if (period === '30d') return { start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), end: null };
  // 00:00 BRT = 03:00 UTC
  const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const startOfToday = new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate(), 3, 0, 0, 0));
  if (period === 'today') return { start: startOfToday, end: new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000) };
  // yesterday
  return { start: new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000), end: startOfToday };
};

const isInFunnelPeriod = (dateStr: string, period: FunnelPeriod): boolean => {
  const { start, end } = getFunnelPeriodRange(period);
  if (!start) return true;
  const t = new Date(dateStr).getTime();
  if (t < start.getTime()) return false;
  if (end && t >= end.getTime()) return false;
  return true;
};

export const ChatDashboard: React.FC = () => {
  const [stats, setStats] = useState({ visits: 0, chat: 0, checkout: 0, sale1: 0, sale2: 0 });
  const [funnel, setFunnel] = useState({
    total_visits: 0,
    unique_visitors: 0,
    total_clicks: 0,
    unique_clickers: 0,
    conversion_pct: 0,
    total_sales: 0,
    revenue: 0,
    sales_conversion_pct: 0,
    initiate_checkout: 0,
    lead: 0,
    purchase: 0,
    pressel_passed: 0,
  });

  const [loading, setLoading] = useState(true);
  const [funnelPeriod, setFunnelPeriod] = useState<FunnelPeriod>('today');
  const funnelPeriodMeta = FUNNEL_PERIODS.find(p => p.key === funnelPeriod) || FUNNEL_PERIODS[0];
  const [redirectLink, setRedirectLink] = useState(localStorage.getItem('payment_redirect_link') || '');
  const [pixSuccessUrl, setPixSuccessUrl] = useState(localStorage.getItem('pix_success_url') || '');
  const [profileName, setProfileName] = useState(localStorage.getItem('chat_profile_name') || 'Thaisinha');
  const [profilePhoto, setProfilePhoto] = useState(localStorage.getItem('chat_profile_photo') || '');
  const [locationImage, setLocationImage] = useState(localStorage.getItem('chat_location_image') || '');
  const [metaPixelId, setMetaPixelId] = useState(localStorage.getItem('meta_pixel_id') || '');
  const [metaCapiToken, setMetaCapiToken] = useState(localStorage.getItem('meta_capi_token') || '');

  const [pixTutorialVideoUrl, setPixTutorialVideoUrl] = useState(localStorage.getItem('pix_tutorial_video_url') || '/pix-tutorial.mp4');
  const [redirectMobileUrl, setRedirectMobileUrl] = useState(localStorage.getItem('redirect_mobile_url') || '');
  const [redirectDesktopUrl, setRedirectDesktopUrl] = useState(localStorage.getItem('redirect_desktop_url') || '');
  const [redirectCopied, setRedirectCopied] = useState(false);
  const [desktopRedirects, setDesktopRedirects] = useState<number | null>(null);
  const [allSaved, setAllSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState<'profile' | 'location' | null>(null);
  const [activeTab, setActiveTab] = useState<'funil' | 'pagamento' | 'perfil' | 'pixel' | 'redirect' | 'pressel'>('funil');
  // presselPassed vem do daily_funnel (calculado pela edge function)
  const presselPassed = funnel.pressel_passed;



  // PIX preview state
  const [previewPix, setPreviewPix] = useState<{ id: number; qr_code: string; qr_code_base64: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewCity, setPreviewCity] = useState<string>('');

  useEffect(() => {
    getUserLocation().then(loc => setPreviewCity(loc.city)).catch(() => {});
  }, []);

  const loadDesktopRedirects = async () => {
    try {
      // Simulação: contar visitas marcadas como desktop no banco
      const { count } = await supabase
        .from('page_visits')
        .select('*', { count: 'exact', head: true });
      setDesktopRedirects(count || 0);
    } catch (err) {
      console.error(err);
    }
  };


  useEffect(() => {
    if (activeTab === 'redirect') loadDesktopRedirects();
  }, [activeTab]);

  const [previewError, setPreviewError] = useState('');
  const [previewCopied, setPreviewCopied] = useState(false);
  const [previewShowNotPaid, setPreviewShowNotPaid] = useState(false);

  const handlePreviewPix = async () => {
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewPix(null);
    try {
      const response = await fetch('/api/generate-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          amount: 19.9, 
          name: 'Preview Dashboard',
          cpf: '00000000000',
          email: 'admin@dashboard.com',
          description: 'PREVIEW Dashboard' 
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setPreviewError(data?.error || 'Erro ao gerar PIX.');
      } else {
        setPreviewPix({ id: data.id, qr_code: data.qr_code, qr_code_base64: data.qr_code_base64 });
      }
    } catch {
      setPreviewError('Erro de conexão.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const [previewVideoPlaying, setPreviewVideoPlaying] = useState(true);
  const [previewVideoMuted, setPreviewVideoMuted] = useState(false);
  const [previewShowVideoModal, setPreviewShowVideoModal] = useState(false);
  const togglePreviewVideoPlay = () => {
    const v = previewVideoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPreviewVideoPlaying(true); }
    else { v.pause(); setPreviewVideoPlaying(false); }
  };
  const togglePreviewVideoMute = () => {
    const v = previewVideoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setPreviewVideoMuted(v.muted);
  };

  const handlePreviewCopy = async () => {
    if (!previewPix?.qr_code) return;
    await navigator.clipboard.writeText(previewPix.qr_code);
    setPreviewCopied(true);
    setTimeout(() => setPreviewCopied(false), 2000);
  };

  const loadFunnel = async (period: FunnelPeriod) => {
    try {
      const { data: events } = await supabase.from('tracked_events').select('event_name, created_at');
      const { data: sales } = await supabase.from('purchases').select('amount, status, created_at').eq('status', 'approved');

      const filteredEvents = (events || []).filter((e: any) => isInFunnelPeriod(e.created_at, period));
      const filteredSales = (sales || []).filter((s: any) => isInFunnelPeriod(s.created_at, period));

      const eventCounts = filteredEvents.reduce((acc: any, e: any) => {
        acc[e.event_name] = (acc[e.event_name] || 0) + 1;
        return acc;
      }, {});

      const totalRevenue = filteredSales.reduce((acc: number, s: any) => acc + Number(s.amount), 0);

      setFunnel({
        total_visits: eventCounts['page_view'] || 0,
        unique_visitors: eventCounts['page_view'] || 0,
        total_clicks: eventCounts['chat_start'] || 0,
        unique_clickers: eventCounts['chat_start'] || 0,
        conversion_pct: Number(calcPct(eventCounts['chat_start'] || 0, eventCounts['page_view'] || 0)),
        total_sales: filteredSales.length,
        revenue: totalRevenue,
        sales_conversion_pct: Number(calcPct(filteredSales.length, eventCounts['page_view'] || 0)),
        initiate_checkout: eventCounts['checkout'] || 0,
        lead: eventCounts['checkout_button_click'] || 0,
        purchase: filteredSales.length,
        pressel_passed: eventCounts['chat_start'] || 0,
      });
    } catch (err) {
      console.error('Erro ao carregar dados do funil:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    const [data, settings] = await Promise.all([
      getStats(),
      adminGetAllSettings(),
    ]);
    setStats(data);
    
    await loadFunnel(funnelPeriod);
    if (settings.payment_redirect_link) setRedirectLink(settings.payment_redirect_link);
    if (settings.pix_success_url) setPixSuccessUrl(settings.pix_success_url);
    if (settings.chat_profile_name) setProfileName(settings.chat_profile_name);
    if (settings.chat_profile_photo) setProfilePhoto(settings.chat_profile_photo);
    if (settings.chat_location_image) setLocationImage(settings.chat_location_image);
    if (settings.meta_pixel_id) setMetaPixelId(settings.meta_pixel_id);
    if (settings.meta_capi_token) setMetaCapiToken(settings.meta_capi_token);
    if (settings.pix_tutorial_video_url) setPixTutorialVideoUrl(settings.pix_tutorial_video_url);
    if (settings.redirect_mobile_url) setRedirectMobileUrl(settings.redirect_mobile_url);
    if (settings.redirect_desktop_url) setRedirectDesktopUrl(settings.redirect_desktop_url);
    setLoading(false);
  };


  useEffect(() => {
    loadData();
    const interval = setInterval(async () => {
      const data = await getStats();
      setStats(data);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleImageUpload = async (
    file: File | undefined,
    imageType: 'profile' | 'location',
  ) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem válido.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5 MB.');
      return;
    }

    setUploadingImage(imageType);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const filePath = `${imageType}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('admin-uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('admin-uploads')
        .getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      if (imageType === 'profile') {
        setProfilePhoto(publicUrl);
        localStorage.setItem('chat_profile_photo', publicUrl);
        await setSetting('chat_profile_photo', publicUrl);
      } else {
        setLocationImage(publicUrl);
        localStorage.setItem('chat_location_image', publicUrl);
        await setSetting('chat_location_image', publicUrl);
      }

      toast.success('Imagem enviada e salva com sucesso!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível enviar a imagem.';
      console.error('image upload error', error);
      toast.error(`Erro no upload: ${message}`);
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      await Promise.all([
        setSetting('payment_redirect_link', redirectLink),
        setSetting('pix_success_url', pixSuccessUrl),
        setSetting('chat_profile_name', profileName),
        setSetting('chat_profile_photo', profilePhoto),
        setSetting('chat_location_image', locationImage),
        setSetting('meta_pixel_id', metaPixelId),
        setSetting('meta_capi_token', metaCapiToken),
        setSetting('pix_tutorial_video_url', pixTutorialVideoUrl),
        setSetting('redirect_mobile_url', redirectMobileUrl),
        setSetting('redirect_desktop_url', redirectDesktopUrl),
      ]);
      // Cache local para uso imediato pelos componentes do chat
      localStorage.setItem('payment_redirect_link', redirectLink);
      localStorage.setItem('pix_success_url', pixSuccessUrl);
      localStorage.setItem('chat_profile_name', profileName);
      localStorage.setItem('chat_profile_photo', profilePhoto);
      localStorage.setItem('chat_location_image', locationImage);
      localStorage.setItem('meta_pixel_id', metaPixelId);
      localStorage.setItem('meta_capi_token', metaCapiToken);
      localStorage.setItem('pix_tutorial_video_url', pixTutorialVideoUrl);
      localStorage.setItem('redirect_mobile_url', redirectMobileUrl);
      localStorage.setItem('redirect_desktop_url', redirectDesktopUrl);
      setAllSaved(true);
      toast.success('Configurações salvas com sucesso!');
      setTimeout(() => setAllSaved(false), 2000);
    } catch (e: any) {
      console.error('save settings error', e);
      toast.error(`Erro ao salvar: ${e.message || 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };


  const calcPct = (part: number, total: number) => {
    if (!total || total === 0) return "0.0";
    return ((part / total) * 100).toFixed(1);
  };

  return (
    <div className="fixed inset-0 bg-[#0b141a] text-[#e9edef] p-4 font-sans select-none overflow-y-auto">
      <div className="max-w-xl mx-auto pb-20">
        <div className="mb-6 pt-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <TrendingUp className="text-[#00a884]" /> DASHBOARD
            </h1>
            <p className="text-[#8696a0] text-xs font-medium uppercase tracking-wider">Métricas de Vendas em Tempo Real</p>
          </div>
          <button
            onClick={async () => { 
              await supabase.auth.signOut();
              window.location.href = '/'; 
            }}
            className="flex items-center gap-2 text-[#8696a0] hover:text-red-400 transition-colors text-xs font-bold"
          >
            <LogOut size={16} /> Sair do Painel
          </button>
        </div>

        {/* Tabs de navegação rápida */}
        <div className="grid grid-cols-6 gap-1 mb-5 bg-[#202c33] p-1 rounded-2xl border border-white/5 sticky top-0 z-10">
          {[
            { id: 'funil', label: 'Funil', icon: TrendingUp },
            { id: 'pagamento', label: 'Pagamento', icon: Link2 },
            { id: 'perfil', label: 'Perfil', icon: User },
            { id: 'pixel', label: 'Pixel', icon: Activity },
            { id: 'redirect', label: 'Redirect', icon: Split },
            { id: 'pressel', label: 'Pressel', icon: Smartphone },
          ].map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${active ? 'bg-[#00a884] text-white shadow-lg' : 'text-[#8696a0] hover:bg-[#2a3942]'}`}
              >
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'funil' && (
          <div className="bg-[#202c33] rounded-3xl p-6 border border-white/5 shadow-xl mb-6 animate-fadeIn">
            <h2 className="text-sm font-black text-white/50 uppercase mb-6 flex items-center gap-2 tracking-widest">
              <Target size={16} /> Etapas do Funil
            </h2>
            <div className="mb-5 bg-gradient-to-br from-[#00a884]/15 to-[#1877F2]/10 border border-[#00a884]/20 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase text-[#00a884] tracking-widest">Hoje (00:00 – 23:59 BRT)</span>
                <span className="text-[10px] text-[#8696a0]">atualiza a cada 30s</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-[#2a3942] rounded-xl p-3 text-center">
                  <div className="text-[9px] text-[#8696a0] font-bold uppercase mb-1">Visitas</div>
                  <div className="text-2xl font-black text-white">{funnel.unique_visitors}</div>
                  <div className="text-[9px] text-[#8696a0]">{funnel.total_visits} acessos</div>
                </div>
                <div className="bg-[#2a3942] rounded-xl p-3 text-center">
                  <div className="text-[9px] text-[#8696a0] font-bold uppercase mb-1">Passou Pressel</div>
                  <div className="text-2xl font-black text-[#00a884]">{presselPassed}</div>
                  <div className="text-[9px] text-[#8696a0]">cliques no CTA (mobile)</div>
                </div>
                <div className="bg-gradient-to-br from-[#16A349]/30 to-[#16A349]/10 border border-[#16A349]/30 rounded-xl p-3 text-center">
                  <div className="text-[9px] text-[#16A349] font-bold uppercase mb-1">💰 Pagou (PIX)</div>
                  <div className="text-2xl font-black text-[#16A349]">{funnel.total_sales}</div>
                  <div className="text-[9px] text-[#8696a0]">{funnel.sales_conversion_pct}% das visitas</div>
                </div>
                <div className="bg-gradient-to-br from-[#1877F2]/30 to-[#1877F2]/10 border border-[#1877F2]/30 rounded-xl p-3 text-center">
                  <div className="text-[9px] text-[#1877F2] font-bold uppercase mb-1">Faturamento</div>
                  <div className="text-2xl font-black text-[#1877F2]">R$ {funnel.revenue.toFixed(2).replace('.', ',')}</div>
                  <div className="text-[9px] text-[#8696a0]">hoje</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-[#2a3942] rounded-xl p-3 text-center border border-[#FFA500]/20">
                  <div className="text-[9px] text-[#FFA500] font-bold uppercase mb-1">Initiate Checkout</div>
                  <div className="text-xl font-black text-[#FFA500]">{funnel.initiate_checkout}</div>
                  <div className="text-[9px] text-[#8696a0]">modais abertos</div>
                </div>
                <div className="bg-[#2a3942] rounded-xl p-3 text-center border border-[#1877F2]/20">
                  <div className="text-[9px] text-[#1877F2] font-bold uppercase mb-1">Lead</div>
                  <div className="text-xl font-black text-[#1877F2]">{funnel.lead}</div>
                  <div className="text-[9px] text-[#8696a0]">PIX gerados</div>
                </div>
                <div className="bg-[#2a3942] rounded-xl p-3 text-center border border-[#16A349]/20">
                  <div className="text-[9px] text-[#16A349] font-bold uppercase mb-1">Purchase</div>
                  <div className="text-xl font-black text-[#16A349]">{funnel.purchase}</div>
                  <div className="text-[9px] text-[#8696a0]">aprovados</div>
                </div>
              </div>
              {(() => {
                const rate = funnel.lead > 0
                  ? (funnel.purchase / funnel.lead) * 100
                  : 0;
                return (
                  <div className="bg-gradient-to-br from-[#00a884]/20 to-[#16A349]/10 border border-[#00a884]/30 rounded-xl p-3 text-center mb-3">
                    <div className="text-[9px] text-[#00a884] font-bold uppercase mb-1 tracking-widest">🎯 Taxa de Conversão (PIX gerado → Venda)</div>
                    <div className="text-3xl font-black text-[#00a884]">{rate.toFixed(1).replace('.', ',')}%</div>
                    <div className="text-[10px] text-[#8696a0] mt-1">{funnel.purchase} vendas de {funnel.lead} PIX gerados</div>
                  </div>
                );
              })()}
              <p className="text-[10px] text-[#8696a0] italic leading-relaxed">
                <strong className="text-white/80">Pagou</strong> = PIX confirmados pelo Mercado Pago hoje. <strong className="text-white/80">Faturamento</strong> = soma de todas as vendas aprovadas hoje. <strong className="text-white/80">Taxa de conversão</strong> = vendas aprovadas ÷ PIX gerados.
              </p>
            </div>

            {/* Funil completo + feed ao vivo */}
            <FunnelLiveFeed />
          </div>
        )}

        {activeTab === 'pagamento' && (
          <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5 shadow-lg mb-6 animate-fadeIn">
            <div className="flex items-center gap-2 mb-3">
              <Link2 size={16} className="text-[#00a884]" />
              <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Pagamento PIX (NexusPag)</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">URL de redirecionamento APÓS pagamento aprovado</label>
                <input type="url" placeholder="https://area-de-membros.com/acesso" value={pixSuccessUrl} onChange={(e) => setPixSuccessUrl(e.target.value)} className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50" />
                <p className="text-[10px] text-[#8696a0] mt-1 italic">Cliente é redirecionado aqui automaticamente quando o PIX é confirmado.</p>
              </div>
              <div>
                <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">Link Fallback (legado WhatsApp)</label>
                <input type="url" placeholder="https://seu-link-de-pagamento.com" value={redirectLink} onChange={(e) => setRedirectLink(e.target.value)} className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50" />
              </div>
              <div>
                <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">URL do vídeo tutorial PIX (mp4)</label>
                <input type="url" placeholder="/pix-tutorial.mp4 ou https://..." value={pixTutorialVideoUrl} onChange={(e) => setPixTutorialVideoUrl(e.target.value)} className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50" />
                <p className="text-[10px] text-[#8696a0] mt-1 italic">Vídeo exibido abaixo do QR Code no checkout. Pode ser um link externo (CDN).</p>
              </div>
            </div>

            {/* Prévia do checkout PIX */}
            <div className="mt-5 pt-5 border-t border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <QrCode size={16} className="text-[#00a884]" />
                  <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Prévia do Checkout (R$ 19,90)</span>
                </div>
                <button
                  onClick={handlePreviewPix}
                  disabled={previewLoading}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-[#00a884] hover:text-[#00c896] disabled:opacity-50"
                >
                  {previewLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  {previewPix ? 'Gerar novo' : 'Gerar PIX teste'}
                </button>
              </div>

              {previewError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-[11px] text-red-400">
                  {previewError}
                </div>
              )}

              {!previewPix && !previewLoading && !previewError && (
                <div className="bg-[#2a3942]/40 border border-dashed border-white/10 rounded-xl p-6 text-center">
                  <QrCode size={32} className="text-[#8696a0]/40 mx-auto mb-2" />
                  <p className="text-[11px] text-[#8696a0]">Clique em "Gerar PIX teste" para visualizar o QR Code aqui mesmo, sem abrir o chat.</p>
                </div>
              )}

              {previewLoading && (
                <div className="bg-[#2a3942]/40 rounded-xl p-8 flex flex-col items-center justify-center gap-2">
                  <Loader2 size={24} className="animate-spin text-[#00a884]" />
                  <p className="text-[11px] text-[#8696a0]">Gerando QR Code...</p>
                </div>
              )}

              {previewPix && (
                <div className="bg-white sm:rounded-xl rounded-2xl shadow-2xl overflow-hidden">
                  <div className="overflow-y-auto p-4 max-h-[70vh]">
                    <div className="flex flex-col items-center gap-4">
                      <div className="text-center">
                        <h2 className="text-lg font-bold text-gray-800 uppercase">🔥 Acesso ao Clube Secreto</h2>
                        <p className="text-gray-500 text-sm">Últimas vagas para {previewCity || 'sua região'}!</p>
                        <div className="my-2">
                          <span className="text-xl text-gray-400 line-through mr-2">R$ 29,90</span>
                          <span className="text-4xl font-black text-[#16A349]">R$ 19,90</span>
                        </div>
                      </div>

                      <div className="w-full bg-gray-50 rounded-xl p-2 flex flex-col items-center">
                        {previewPix.qr_code_base64 && (
                          <img
                            src={previewPix.qr_code_base64}
                            alt="QR Code PIX"
                            className="w-36 h-36 object-contain"
                          />
                        )}
                        <p className="text-[10px] text-gray-500 mt-1 text-center">Escaneie o QR Code no app do seu banco</p>
                      </div>

                      {/* Vídeo movido para modal acionado pelo botão "Como pagar" */}

                      <div className="w-full">
                        <p className="text-xs font-bold text-gray-600 mb-1 text-center">Ou use PIX Copia e Cola:</p>
                        <div className="bg-gray-100 rounded-lg p-2 text-[10px] text-gray-700 break-all max-h-20 overflow-y-auto border">
                          {previewPix.qr_code}
                        </div>
                        <button
                          onClick={handlePreviewCopy}
                          className="w-full mt-2 bg-[#16A349] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                          {previewCopied ? <><Check size={18} /> Código Copiado!</> : <><Copy size={18} /> COPIAR CÓDIGO PIX</>}
                        </button>
                        <button
                          onClick={() => { setPreviewShowNotPaid(true); setTimeout(() => setPreviewShowNotPaid(false), 6000); }}
                          className="w-full mt-2 bg-white border-2 border-[#16A349] text-[#16A349] py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                          <Check size={18} /> JÁ PAGUEI
                        </button>
                        {pixTutorialVideoUrl && (
                          <button
                            onClick={() => { setPreviewShowVideoModal(true); setPreviewVideoPlaying(true); setPreviewVideoMuted(false); }}
                            className="w-full mt-2 bg-blue-50 border-2 border-blue-400 text-blue-600 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                          >
                            <HelpCircle size={18} /> COMO PAGAR
                          </button>
                        )}
                        {previewShowNotPaid && (
                          <div className="mt-2 bg-pink-50 border border-pink-200 rounded-lg p-3 text-center animate-fadeIn">
                            <p className="text-[13px] text-pink-700 font-medium leading-snug">amor so esta faltando voce pagar pra me te adicionar no grupo vem logo safado🔥</p>
                          </div>
                        )}
                      </div>

                      <div className="w-full bg-yellow-50 border border-yellow-200 rounded-lg p-2 flex items-center justify-center gap-2">
                        <Loader2 size={14} className="animate-spin text-yellow-700" />
                        <span className="text-xs text-yellow-800 font-medium">Aguardando pagamento...</span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-400 text-xs">
                        <ShieldCheck size={14} /> Compra 100% Segura e Sigilosa
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 italic text-center bg-gray-50 py-2 border-t border-gray-100">⚠️ PIX real de teste — não pague, ou cancele depois no Mercado Pago.</p>
                </div>
              )}
            </div>

            {previewShowVideoModal && pixTutorialVideoUrl && (
              <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setPreviewShowVideoModal(false)}>
                <div className="relative w-full sm:max-w-[480px]" onClick={(e) => e.stopPropagation()}>
                  <div className="w-full rounded-xl overflow-hidden bg-black relative">
                    <button
                      onClick={() => setPreviewShowVideoModal(false)}
                      aria-label="Fechar"
                      className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur-sm transition active:scale-95"
                    >
                      <X size={18} />
                    </button>
                    <video
                      ref={previewVideoRef}
                      src={pixTutorialVideoUrl}
                      autoPlay
                      loop
                      playsInline
                      preload="auto"
                      className="w-full h-auto"
                      onLoadedMetadata={(e) => { (e.currentTarget as HTMLVideoElement).muted = false; }}
                    />
                    <div className="absolute bottom-2 right-2 flex gap-2">
                      <button
                        onClick={togglePreviewVideoPlay}
                        aria-label={previewVideoPlaying ? 'Pausar' : 'Reproduzir'}
                        className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur-sm transition"
                      >
                        {previewVideoPlaying ? <Pause size={18} /> : <Play size={18} />}
                      </button>
                      <button
                        onClick={togglePreviewVideoMute}
                        aria-label={previewVideoMuted ? 'Ativar som' : 'Mutar'}
                        className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur-sm transition"
                      >
                        {previewVideoMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'perfil' && (
          <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5 shadow-lg mb-6 animate-fadeIn">
            <div className="flex items-center gap-2 mb-3">
              <User size={16} className="text-[#00a884]" />
              <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Nome e Foto do Perfil</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">Nome exibido no chat</label>
                <input type="text" placeholder="Ex: Thaisinha" value={profileName} onChange={(e) => setProfileName(e.target.value)} className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50" />
              </div>
              <div>
                <label htmlFor="profile-photo-upload" className="text-[11px] text-[#8696a0] font-bold mb-1 block">Foto de perfil</label>
                <label
                  htmlFor="profile-photo-upload"
                  className="flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-[#00a884]/40 bg-[#2a3942] px-4 py-4 text-center transition-colors hover:border-[#00a884]"
                >
                  {uploadingImage === 'profile' ? <Loader2 size={20} className="animate-spin text-[#00a884]" /> : <UploadCloud size={20} className="text-[#00a884]" />}
                  <span className="text-xs text-[#e9edef]">{uploadingImage === 'profile' ? 'Enviando imagem...' : 'Selecionar imagem'}</span>
                </label>
                <input
                  id="profile-photo-upload"
                  type="file"
                  accept="image/*"
                  disabled={uploadingImage !== null}
                  onChange={(event) => {
                    void handleImageUpload(event.target.files?.[0], 'profile');
                    event.target.value = '';
                  }}
                  className="sr-only"
                />
              </div>
              <div>
                <label htmlFor="location-image-upload" className="text-[11px] text-[#8696a0] font-bold mb-1 block">Imagem com localização (base)</label>
                <label
                  htmlFor="location-image-upload"
                  className="flex min-h-24 cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-[#00a884]/40 bg-[#2a3942] px-4 py-4 text-center transition-colors hover:border-[#00a884]"
                >
                  {uploadingImage === 'location' ? <Loader2 size={20} className="animate-spin text-[#00a884]" /> : <UploadCloud size={20} className="text-[#00a884]" />}
                  <span className="text-xs text-[#e9edef]">{uploadingImage === 'location' ? 'Enviando imagem...' : 'Selecionar imagem'}</span>
                </label>
                <input
                  id="location-image-upload"
                  type="file"
                  accept="image/*"
                  disabled={uploadingImage !== null}
                  onChange={(event) => {
                    void handleImageUpload(event.target.files?.[0], 'location');
                    event.target.value = '';
                  }}
                  className="sr-only"
                />
                <p className="text-[10px] text-[#8696a0] mt-1 italic">A cidade do usuário será sobreposta automaticamente nesta imagem</p>
              </div>
              {profilePhoto && (
                <div className="flex items-center gap-3">
                  <img src={profilePhoto} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-[#00a884]/30" />
                  <span className="text-[11px] text-[#8696a0]">Preview da foto</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pixel' && (
          <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5 shadow-lg mb-6 animate-fadeIn">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={16} className="text-[#1877F2]" />
              <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Meta Pixel + CAPI (opcional)</span>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">Pixel ID (16 dígitos)</label>
                <input type="text" placeholder="Ex: 1234567890123456" value={metaPixelId} onChange={(e) => setMetaPixelId(e.target.value.trim())} className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#1877F2] transition-colors placeholder:text-[#8696a0]/50" />
                <p className="text-[10px] text-[#8696a0] mt-1 italic">Gerenciador de Eventos → Fontes de dados → seu Pixel</p>
              </div>
              <div>
                <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">Meta CAPI Access Token (opcional)</label>
                <input 
                  type="password" 
                  placeholder="EAA..." 
                  value={metaCapiToken} 
                  onChange={(e) => setMetaCapiToken(e.target.value.trim())} 
                  className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#1877F2] transition-colors placeholder:text-[#8696a0]/50" 
                />
                <p className="text-[10px] text-[#8696a0] mt-1 italic">
                  Gerenciador de Eventos → Configurações → Conversions API → Gerar token de acesso
                </p>
              </div>

              <div className="bg-[#1877F2]/10 border border-[#1877F2]/20 rounded-lg p-3">
                <p className="text-[11px] text-[#e9edef]/80 leading-relaxed">
                  <strong className="text-[#1877F2]">Segurança Backend:</strong> O token é enviado apenas para a Edge Function e nunca exposto no navegador dos visitantes.
                </p>
              </div>

              <div className="bg-[#1877F2]/10 border border-[#1877F2]/20 rounded-lg p-3">
                <p className="text-[11px] text-[#e9edef]/80 leading-relaxed">
                  <strong className="text-[#1877F2]">Eventos disparados:</strong> PageView, ViewContent, InitiateCheckout, Lead.
                </p>
              </div>
            </div>
          </div>
        )}


        {activeTab === 'redirect' && (
          <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5 shadow-lg mb-6 animate-fadeIn">
            <div className="flex items-center gap-2 mb-3">
              <Split size={16} className="text-[#00a884]" />
              <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Redirecionador por Dispositivo</span>
            </div>

            <div className="bg-gradient-to-br from-[#00a884]/15 to-[#1877F2]/10 border border-[#00a884]/20 rounded-xl p-3 mb-4">
              <p className="text-[11px] text-[#e9edef] font-semibold mb-1">Como funciona</p>
              <p className="text-[10px] text-[#8696a0] leading-relaxed">
                Use o link <strong className="text-[#00a884]">{`${window.location.origin}/r`}</strong> nos seus anúncios. Ele detecta o aparelho e manda automaticamente:<br />
                📱 <strong className="text-white/80">Celular/Tablet</strong> → URL Mobile<br />
                💻 <strong className="text-white/80">PC/Notebook</strong> → URL Desktop
              </p>
            </div>

            <div className="bg-[#0b141a] border border-[#1877F2]/30 rounded-xl p-4 mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest mb-1 flex items-center gap-1.5">
                  <Monitor size={12} className="text-[#1877F2]" /> Redirecionados para PC/Notebook
                </p>
                <p className="text-3xl font-black text-white tabular-nums">
                  {desktopRedirects === null ? '—' : desktopRedirects}
                </p>
                <p className="text-[10px] text-[#8696a0] italic mt-1">Total acumulado de cliques no link /r vindos de desktop.</p>
              </div>
              <button
                onClick={loadDesktopRedirects}
                className="text-[#1877F2] hover:text-[#3b8df5] p-2 rounded-lg hover:bg-white/5 transition"
                title="Atualizar"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="bg-[#2a3942]/50 border border-white/5 rounded-xl p-3 mb-4 flex items-center gap-2">
              <input
                readOnly
                value={`${window.location.origin}/r`}
                className="flex-1 bg-transparent text-[#e9edef] text-sm outline-none font-mono"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(`${window.location.origin}/r`);
                  setRedirectCopied(true);
                  setTimeout(() => setRedirectCopied(false), 1500);
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-[#00a884] hover:text-[#00c896] px-2 py-1"
              >
                {redirectCopied ? <Check size={14} /> : <Copy size={14} />}
                {redirectCopied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-[#8696a0] font-bold mb-1 flex items-center gap-1.5">
                  <Smartphone size={12} className="text-[#00a884]" /> URL para Celular / Tablet
                </label>
                <input
                  type="url"
                  placeholder="https://sua-pagina-de-vendas.com"
                  value={redirectMobileUrl}
                  onChange={(e) => setRedirectMobileUrl(e.target.value)}
                  className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50"
                />
                <p className="text-[10px] text-[#8696a0] mt-1 italic">Para onde o usuário de celular será enviado.</p>
              </div>
              <div>
                <label className="text-[11px] text-[#8696a0] font-bold mb-1 flex items-center gap-1.5">
                  <Monitor size={12} className="text-[#1877F2]" /> URL para PC / Notebook
                </label>
                <input
                  type="url"
                  placeholder="https://outra-pagina.com"
                  value={redirectDesktopUrl}
                  onChange={(e) => setRedirectDesktopUrl(e.target.value)}
                  className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#1877F2] transition-colors placeholder:text-[#8696a0]/50"
                />
                <p className="text-[10px] text-[#8696a0] mt-1 italic">Para onde o usuário de PC/Notebook será enviado. Se ficar vazio, usa a URL Mobile como fallback.</p>
              </div>
            </div>

            <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
              <p className="text-[10px] text-yellow-200/80 leading-relaxed">
                💡 <strong>Dica:</strong> Os parâmetros UTM da URL (ex: <code className="text-yellow-300">?utm_source=facebook</code>) são repassados automaticamente para o destino.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'pressel' && <PresselTest />}

        {activeTab !== 'funil' && activeTab !== 'pressel' && (
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className={`w-full px-4 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all mb-6 ${allSaved ? 'bg-[#00a884] text-white' : 'bg-[#00a884]/20 text-[#00a884] hover:bg-[#00a884]/30'} disabled:opacity-50`}
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Salvando...' : allSaved ? 'Configurações Salvas!' : 'Salvar Configurações'}
          </button>
        )}
      </div>
    </div>
  );
};
