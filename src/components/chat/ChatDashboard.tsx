import React, { useEffect, useState } from 'react';
import { Target, TrendingUp, Link2, Save, User, Loader2, LogOut, Activity } from 'lucide-react';
import { getStats } from '../../services/tracking';
import { getAllSettings, setSetting } from '../../services/settings';
import { WhatsAppRouterPanel } from './WhatsAppRouterPanel';
import { supabase } from '@/integrations/supabase/client';

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
  });
  const [loading, setLoading] = useState(true);
  const [redirectLink, setRedirectLink] = useState(localStorage.getItem('payment_redirect_link') || '');
  const [pixSuccessUrl, setPixSuccessUrl] = useState(localStorage.getItem('pix_success_url') || '');
  const [profileName, setProfileName] = useState(localStorage.getItem('chat_profile_name') || 'Thaisinha');
  const [profilePhoto, setProfilePhoto] = useState(localStorage.getItem('chat_profile_photo') || '');
  const [locationImage, setLocationImage] = useState(localStorage.getItem('chat_location_image') || '');
  const [metaPixelId, setMetaPixelId] = useState(localStorage.getItem('meta_pixel_id') || '');
  const [metaCapiToken, setMetaCapiToken] = useState(localStorage.getItem('meta_capi_token') || '');
  const [pixTutorialVideoUrl, setPixTutorialVideoUrl] = useState(localStorage.getItem('pix_tutorial_video_url') || '/pix-tutorial.mp4');
  const [allSaved, setAllSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [data, settings, funnelRes] = await Promise.all([
      getStats(),
      getAllSettings(),
      supabase.functions.invoke('whatsapp-router', { body: { action: 'daily_funnel' } }),
    ]);
    setStats(data);
    if (funnelRes?.data && !funnelRes.error) setFunnel(funnelRes.data);
    if (settings.payment_redirect_link) setRedirectLink(settings.payment_redirect_link);
    if (settings.pix_success_url) setPixSuccessUrl(settings.pix_success_url);
    if (settings.chat_profile_name) setProfileName(settings.chat_profile_name);
    if (settings.chat_profile_photo) setProfilePhoto(settings.chat_profile_photo);
    if (settings.chat_location_image) setLocationImage(settings.chat_location_image);
    if (settings.meta_pixel_id) setMetaPixelId(settings.meta_pixel_id);
    if (settings.meta_capi_token) setMetaCapiToken(settings.meta_capi_token);
    if (settings.pix_tutorial_video_url) setPixTutorialVideoUrl(settings.pix_tutorial_video_url);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(async () => {
      const [data, funnelRes] = await Promise.all([
        getStats(),
        supabase.functions.invoke('whatsapp-router', { body: { action: 'daily_funnel' } }),
      ]);
      setStats(data);
      if (funnelRes?.data && !funnelRes.error) setFunnel(funnelRes.data);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveAll = async () => {
    setSaving(true);
    await Promise.all([
      setSetting('payment_redirect_link', redirectLink),
      setSetting('pix_success_url', pixSuccessUrl),
      setSetting('chat_profile_name', profileName),
      setSetting('chat_profile_photo', profilePhoto),
      setSetting('chat_location_image', locationImage),
      setSetting('meta_pixel_id', metaPixelId),
      setSetting('meta_capi_token', metaCapiToken),
      setSetting('pix_tutorial_video_url', pixTutorialVideoUrl),
    ]);
    // Also update localStorage for immediate use by chat components
    localStorage.setItem('payment_redirect_link', redirectLink);
    localStorage.setItem('pix_success_url', pixSuccessUrl);
    localStorage.setItem('chat_profile_name', profileName);
    localStorage.setItem('chat_profile_photo', profilePhoto);
    localStorage.setItem('chat_location_image', locationImage);
    localStorage.setItem('meta_pixel_id', metaPixelId);
    localStorage.setItem('meta_capi_token', metaCapiToken);
    setSaving(false);
    setAllSaved(true);
    setTimeout(() => setAllSaved(false), 2000);
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
            onClick={() => { sessionStorage.removeItem('admin_auth'); window.location.reload(); }}
            className="flex items-center gap-2 text-[#8696a0] hover:text-red-400 transition-colors text-xs font-bold"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>

        <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5 shadow-lg mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={16} className="text-[#00a884]" />
            <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Pagamento PIX (Mercado Pago)</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">URL de redirecionamento APÓS pagamento aprovado</label>
              <input
                type="url"
                placeholder="https://area-de-membros.com/acesso"
                value={pixSuccessUrl}
                onChange={(e) => setPixSuccessUrl(e.target.value)}
                className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50"
              />
              <p className="text-[10px] text-[#8696a0] mt-1 italic">Cliente é redirecionado aqui automaticamente quando o PIX é confirmado.</p>
            </div>
            <div>
              <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">Link Fallback (legado WhatsApp)</label>
              <input
                type="url"
                placeholder="https://seu-link-de-pagamento.com"
                value={redirectLink}
                onChange={(e) => setRedirectLink(e.target.value)}
                className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50"
              />
            </div>
          </div>
        </div>

        <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5 shadow-lg mb-6">
          <div className="flex items-center gap-2 mb-3">
            <User size={16} className="text-[#00a884]" />
            <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Nome e Foto do Perfil</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">Nome exibido no chat</label>
              <input type="text" placeholder="Ex: Thaisinha" value={profileName} onChange={(e) => setProfileName(e.target.value)}
                className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50" />
            </div>
            <div>
              <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">URL da foto de perfil</label>
              <input type="url" placeholder="https://exemplo.com/foto.jpg" value={profilePhoto} onChange={(e) => setProfilePhoto(e.target.value)}
                className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50" />
            </div>
            <div>
              <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">URL da imagem com localização (base)</label>
              <input type="url" placeholder="https://exemplo.com/imagem-base.jpg" value={locationImage} onChange={(e) => setLocationImage(e.target.value)}
                className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50" />
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

        <button
          onClick={handleSaveAll}
          disabled={saving}
          className={`w-full px-4 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all mb-6 ${allSaved ? 'bg-[#00a884] text-white' : 'bg-[#00a884]/20 text-[#00a884] hover:bg-[#00a884]/30'} disabled:opacity-50`}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Salvando...' : allSaved ? 'Configurações Salvas!' : 'Salvar Configurações'}
        </button>

        <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5 shadow-lg mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={16} className="text-[#1877F2]" />
            <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Meta Pixel + CAPI (opcional)</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">Pixel ID (16 dígitos)</label>
              <input
                type="text"
                placeholder="Ex: 1234567890123456"
                value={metaPixelId}
                onChange={(e) => setMetaPixelId(e.target.value.trim())}
                className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#1877F2] transition-colors placeholder:text-[#8696a0]/50"
              />
              <p className="text-[10px] text-[#8696a0] mt-1 italic">Gerenciador de Eventos → Fontes de dados → seu Pixel</p>
            </div>
            <div>
              <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">Access Token CAPI (opcional)</label>
              <input
                type="password"
                placeholder="EAAxxxxxxxxxxxxxxxxxx..."
                value={metaCapiToken}
                onChange={(e) => setMetaCapiToken(e.target.value.trim())}
                className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#1877F2] transition-colors placeholder:text-[#8696a0]/50"
              />
              <p className="text-[10px] text-[#8696a0] mt-1 italic">Gerenciador de Eventos → Configurações → API de Conversões → Gerar token</p>
            </div>
            <div className="bg-[#1877F2]/10 border border-[#1877F2]/20 rounded-lg p-3">
              <p className="text-[11px] text-[#e9edef]/80 leading-relaxed">
                <strong className="text-[#1877F2]">Eventos disparados:</strong> PageView (entrada), ViewContent (chat iniciado), InitiateCheckout (modal aberto), Lead (clique em Liberar Acesso).
              </p>
            </div>
          </div>
        </div>

        <WhatsAppRouterPanel />

        <div className="bg-[#202c33] rounded-3xl p-6 border border-white/5 shadow-xl mb-6">
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
                <div className="text-[9px] text-[#8696a0] font-bold uppercase mb-1">Abriu Modal</div>
                <div className="text-2xl font-black text-[#00a884]">{funnel.unique_clickers}</div>
                <div className="text-[9px] text-[#8696a0]">{funnel.total_clicks} cliques</div>
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
            <p className="text-[10px] text-[#8696a0] italic leading-relaxed">
              <strong className="text-white/80">Pagou</strong> = PIX confirmados pelo Mercado Pago hoje. <strong className="text-white/80">Faturamento</strong> = soma de todas as vendas aprovadas hoje.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
