import React, { useEffect, useState } from 'react';
import { DollarSign, Target, RefreshCw, TrendingUp, Link2, Save, User } from 'lucide-react';
import { getStats } from '../../services/tracking';

export const ChatDashboard: React.FC = () => {
  const [stats, setStats] = useState({ visits: 0, chat: 0, checkout: 0, sale1: 0, sale2: 0 });
  const [loading, setLoading] = useState(true);
  const [redirectLink, setRedirectLink] = useState(localStorage.getItem('payment_redirect_link') || '');
  const [linkSaved, setLinkSaved] = useState(false);
  const [profileName, setProfileName] = useState(localStorage.getItem('chat_profile_name') || 'Thaisinha');
  const [profilePhoto, setProfilePhoto] = useState(localStorage.getItem('chat_profile_photo') || '');
  const [profileSaved, setProfileSaved] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const data = await getStats();
    setStats(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveLink = () => {
    localStorage.setItem('payment_redirect_link', redirectLink);
    setLinkSaved(true);
    setTimeout(() => setLinkSaved(false), 2000);
  };

  const handleSaveProfile = () => {
    localStorage.setItem('chat_profile_name', profileName);
    localStorage.setItem('chat_profile_photo', profilePhoto);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const calcPct = (part: number, total: number) => {
    if (!total || total === 0) return "0.0";
    return ((part / total) * 100).toFixed(1);
  };

  const totalRevenue = (stats.sale1 * 19.00) + (stats.sale2 * 9.90);
  const convVenda1 = calcPct(stats.sale1, stats.visits);
  const convVenda2 = calcPct(stats.sale2, stats.sale1);
  const convFinal = calcPct(stats.sale2, stats.visits);

  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef] p-4 font-sans select-none">
      <div className="max-w-xl mx-auto pb-20">

        <div className="flex justify-between items-center mb-6 pt-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <TrendingUp className="text-[#00a884]" /> DASHBOARD
            </h1>
            <p className="text-[#8696a0] text-xs font-medium uppercase tracking-wider">Métricas de Vendas em Tempo Real</p>
          </div>
          <button
            onClick={loadData}
            className={`p-3 rounded-xl bg-[#202c33] border border-white/10 active:scale-95 transition-all ${loading ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={20} className="text-[#00a884]" />
          </button>
        </div>

        {/* Link de Redirecionamento */}
        <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5 shadow-lg mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={16} className="text-[#00a884]" />
            <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Link do Botão "Liberar Acesso"</span>
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://seu-link-de-pagamento.com"
              value={redirectLink}
              onChange={(e) => setRedirectLink(e.target.value)}
              className="flex-1 bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50"
            />
            <button
              onClick={handleSaveLink}
              className={`px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${linkSaved ? 'bg-[#00a884] text-white' : 'bg-[#00a884]/20 text-[#00a884] hover:bg-[#00a884]/30'}`}
            >
              <Save size={16} />
              {linkSaved ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* Configuração do Perfil */}
        <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5 shadow-lg mb-6">
          <div className="flex items-center gap-2 mb-3">
            <User size={16} className="text-[#00a884]" />
            <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Nome e Foto do Perfil</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">Nome exibido no chat</label>
              <input
                type="text"
                placeholder="Ex: Thaisinha"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">URL da foto de perfil</label>
              <input
                type="url"
                placeholder="https://exemplo.com/foto.jpg"
                value={profilePhoto}
                onChange={(e) => setProfilePhoto(e.target.value)}
                className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50"
              />
            </div>
            {profilePhoto && (
              <div className="flex items-center gap-3">
                <img src={profilePhoto} alt="Preview" className="w-12 h-12 rounded-full object-cover border-2 border-[#00a884]/30" />
                <span className="text-[11px] text-[#8696a0]">Preview da foto</span>
              </div>
            )}
            <button
              onClick={handleSaveProfile}
              className={`w-full px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${profileSaved ? 'bg-[#00a884] text-white' : 'bg-[#00a884]/20 text-[#00a884] hover:bg-[#00a884]/30'}`}
            >
              <Save size={16} />
              {profileSaved ? 'Salvo!' : 'Salvar Perfil'}
            </button>
          </div>
        </div>

          <DollarSign className="absolute -right-4 -bottom-4 w-32 h-32 opacity-20 rotate-12" />
          <div className="relative z-10">
            <span className="text-white/80 text-sm font-bold uppercase">Faturamento Estimado</span>
            <div className="text-4xl font-black text-white mt-1">R$ {totalRevenue.toFixed(2)}</div>
            <div className="flex gap-4 mt-4 text-xs font-bold text-white/90">
              <span className="bg-white/20 px-2 py-1 rounded">Vendas: {stats.sale1 + stats.sale2}</span>
              <span className="bg-white/20 px-2 py-1 rounded">Taxa Final: {convFinal}%</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#202c33] p-4 rounded-2xl border border-white/5 shadow-lg">
            <div className="text-[#8696a0] text-[10px] font-black uppercase mb-1">Visitas Totais</div>
            <div className="text-2xl font-bold text-white">{stats.visits}</div>
          </div>
          <div className="bg-[#202c33] p-4 rounded-2xl border border-white/5 shadow-lg">
            <div className="text-[#8696a0] text-[10px] font-black uppercase mb-1">Iniciaram Chat</div>
            <div className="text-2xl font-bold text-white">{stats.chat}</div>
            <div className="text-[10px] text-[#00a884] font-bold">Retenção: {calcPct(stats.chat, stats.visits)}%</div>
          </div>
        </div>

        <div className="bg-[#202c33] rounded-3xl p-6 border border-white/5 shadow-xl mb-6">
          <h2 className="text-sm font-black text-white/50 uppercase mb-6 flex items-center gap-2 tracking-widest">
            <Target size={16} /> Etapas do Funil
          </h2>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0 font-bold text-xs">1</div>
              <div className="flex-1">
                <div className="flex justify-between text-sm font-bold mb-1"><span>Acesso à Home</span><span>100%</span></div>
                <div className="w-full bg-[#2a3942] h-2 rounded-full"><div className="bg-blue-500 h-full w-full rounded-full"></div></div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0 font-bold text-xs">2</div>
              <div className="flex-1">
                <div className="flex justify-between text-sm font-bold mb-1"><span>Chat Ativo</span><span>{calcPct(stats.chat, stats.visits)}%</span></div>
                <div className="w-full bg-[#2a3942] h-2 rounded-full">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${calcPct(stats.chat, stats.visits)}%` }}></div>
                </div>
                <p className="text-[10px] text-[#8696a0] mt-1 italic">Pessoas que começaram a interagir</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0 font-bold text-xs">3</div>
              <div className="flex-1">
                <div className="flex justify-between text-sm font-bold mb-1"><span>Clique no Botão / Checkout</span><span>{calcPct(stats.checkout, stats.visits)}%</span></div>
                <div className="w-full bg-[#2a3942] h-2 rounded-full">
                  <div className="bg-orange-500 h-full rounded-full" style={{ width: `${calcPct(stats.checkout, stats.visits)}%` }}></div>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-[#16A349]/20 text-[#16A349] flex items-center justify-center shrink-0 font-bold text-xs">4</div>
              <div className="flex-1">
                <div className="flex justify-between text-sm font-bold mb-1 text-[#16A349]"><span>Venda R$ 19,00 Concluída</span><span>{convVenda1}%</span></div>
                <div className="w-full bg-[#2a3942] h-2 rounded-full">
                  <div className="bg-[#16A349] h-full rounded-full" style={{ width: `${convVenda1}%` }}></div>
                </div>
                <p className="text-[11px] font-bold mt-1">{stats.sale1} leads converteram aqui</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center shrink-0 font-bold text-xs">5</div>
              <div className="flex-1 border-l-2 border-yellow-500/20 pl-4 py-1 bg-yellow-500/5 rounded-r-lg">
                <div className="flex justify-between text-sm font-bold mb-1 text-yellow-500"><span>Upsell R$ 9,90</span><span>{convVenda2}% de conv.</span></div>
                <div className="w-full bg-[#2a3942] h-2 rounded-full">
                  <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${convVenda2}%` }}></div>
                </div>
                <p className="text-[10px] text-[#8696a0] mt-1">Total de Upsells: {stats.sale2}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#1f2c34] p-4 rounded-2xl border border-white/5 text-center">
          <div className="text-[10px] text-[#8696a0] font-bold uppercase tracking-widest mb-1">Status do Tráfego</div>
          <div className="inline-flex items-center gap-2 bg-[#00a884]/20 text-[#00a884] px-3 py-1 rounded-full text-xs font-bold">
            <div className="w-2 h-2 bg-[#00a884] rounded-full animate-pulse"></div>
            RECEBENDO DADOS AGORA
          </div>
        </div>

      </div>
    </div>
  );
};