import React, { useEffect, useState } from 'react';
import { Target, TrendingUp, Link2, Save, User } from 'lucide-react';
import { getStats } from '../../services/tracking';

export const ChatDashboard: React.FC = () => {
  const [stats, setStats] = useState({ visits: 0, chat: 0, checkout: 0, sale1: 0, sale2: 0 });
  const [loading, setLoading] = useState(true);
  const [redirectLink, setRedirectLink] = useState(localStorage.getItem('payment_redirect_link') || '');
  const [profileName, setProfileName] = useState(localStorage.getItem('chat_profile_name') || 'Thaisinha');
  const [profilePhoto, setProfilePhoto] = useState(localStorage.getItem('chat_profile_photo') || '');
  const [locationImage, setLocationImage] = useState(localStorage.getItem('chat_location_image') || '');
  

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

  const [allSaved, setAllSaved] = useState(false);

  const handleSaveAll = () => {
    localStorage.setItem('payment_redirect_link', redirectLink);
    localStorage.setItem('chat_profile_name', profileName);
    localStorage.setItem('chat_profile_photo', profilePhoto);
    localStorage.setItem('chat_location_image', locationImage);
    setAllSaved(true);
    setTimeout(() => setAllSaved(false), 2000);
  };

  const calcPct = (part: number, total: number) => {
    if (!total || total === 0) return "0.0";
    return ((part / total) * 100).toFixed(1);
  };


  return (
    <div className="min-h-screen bg-[#0b141a] text-[#e9edef] p-4 font-sans select-none">
      <div className="max-w-xl mx-auto pb-20">

        <div className="mb-6 pt-4">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <TrendingUp className="text-[#00a884]" /> DASHBOARD
          </h1>
          <p className="text-[#8696a0] text-xs font-medium uppercase tracking-wider">Métricas de Vendas em Tempo Real</p>
        </div>

        {/* Link de Redirecionamento */}
        <div className="bg-[#202c33] rounded-2xl p-4 border border-white/5 shadow-lg mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Link2 size={16} className="text-[#00a884]" />
            <span className="text-[10px] font-black uppercase text-[#8696a0] tracking-widest">Link do Botão "Liberar Acesso"</span>
          </div>
          <input
            type="url"
            placeholder="https://seu-link-de-pagamento.com"
            value={redirectLink}
            onChange={(e) => setRedirectLink(e.target.value)}
            className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50"
          />
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
            <div>
              <label className="text-[11px] text-[#8696a0] font-bold mb-1 block">URL da imagem com localização (base)</label>
              <input
                type="url"
                placeholder="https://exemplo.com/imagem-base.jpg"
                value={locationImage}
                onChange={(e) => setLocationImage(e.target.value)}
                className="w-full bg-[#2a3942] text-[#e9edef] px-4 py-3 rounded-xl text-sm outline-none border border-white/5 focus:border-[#00a884] transition-colors placeholder:text-[#8696a0]/50"
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

        {/* Botão único de salvar */}
        <button
          onClick={handleSaveAll}
          className={`w-full px-4 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all mb-6 ${allSaved ? 'bg-[#00a884] text-white' : 'bg-[#00a884]/20 text-[#00a884] hover:bg-[#00a884]/30'}`}
        >
          <Save size={18} />
          {allSaved ? 'Configurações Salvas!' : 'Salvar Configurações'}
        </button>


        <div className="bg-[#202c33] rounded-3xl p-6 border border-white/5 shadow-xl mb-6">
          <h2 className="text-sm font-black text-white/50 uppercase mb-6 flex items-center gap-2 tracking-widest">
            <Target size={16} /> Etapas do Funil
          </h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#2a3942] p-4 rounded-xl">
              <span className="text-sm font-bold">Chegaram ao final do funil</span>
              <div className="text-right">
                <span className="text-xl font-black text-[#00a884]">{stats.checkout}</span>
                <span className="text-[10px] text-[#8696a0] block">{calcPct(stats.checkout, stats.visits)}% das visitas</span>
              </div>
            </div>
            <div className="flex justify-between items-center bg-[#2a3942] p-4 rounded-xl">
              <span className="text-sm font-bold">Clicaram no link final</span>
              <div className="text-right">
                <span className="text-xl font-black text-[#00a884]">{stats.sale1}</span>
                <span className="text-[10px] text-[#8696a0] block">{calcPct(stats.sale1, stats.visits)}% das visitas</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
