import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Lock, CheckCircle2 } from 'lucide-react';
import { getSetting } from '../services/settings';
import { supabase } from '@/integrations/supabase/client';

const getOrCreateSessionId = () => {
  try {
    const k = 'pressel_session_id';
    let s = sessionStorage.getItem(k);
    if (!s) {
      s = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(k, s);
    }
    return s;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
};

const QUESTION = {
  text: 'Você é maior de 18 anos?',
  options: ['Sim, sou maior', 'Não'],
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

const Pressel = () => {
  const [answered, setAnswered] = useState<string | null>(null);
  const [progress, setProgress] = useState(35);
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const mobileUrl = await getSetting('redirect_mobile_url');
      const desktopUrl = await getSetting('redirect_desktop_url');
      setTarget((mobileUrl && mobileUrl.trim()) || (desktopUrl && desktopUrl.trim()) || null);
    })();
  }, []);

  const handleAnswer = (opt: string) => {
    setAnswered(opt);
    setProgress(100);
  };

  const handleContinue = async () => {
    if (!target) return;
    try {
      await supabase.from('tracked_events').insert({
        event_name: 'PresselPassed',
        session_id: getOrCreateSessionId(),
        slug: 'pressel',
      });
    } catch {}
    window.location.replace(appendQuery(target));
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#0b141a] to-[#111b21] flex flex-col">
      <div className="px-5 pt-6 pb-3 flex items-center gap-2 border-b border-white/5">
        <div className="w-9 h-9 rounded-full bg-[#00a884]/20 flex items-center justify-center">
          <ShieldCheck size={18} className="text-[#00a884]" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-[#e9edef] leading-tight">Verificação de acesso</p>
          <p className="text-[10px] text-[#8696a0] flex items-center gap-1">
            <Lock size={9} /> Conexão segura · Confidencial
          </p>
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="flex justify-between text-[10px] text-[#8696a0] uppercase tracking-widest mb-1">
          <span>Etapa rápida</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1 bg-[#2a3942] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00a884] to-[#00d09c] transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex-1 px-6 pt-8 pb-6 flex flex-col max-w-[480px] mx-auto w-full">
        {!answered ? (
          <>
            <h1 className="text-[#e9edef] text-[22px] font-bold leading-tight mb-2">{QUESTION.text}</h1>
            <p className="text-[13px] text-[#8696a0] mb-6">
              Esta resposta é anônima e usada apenas para liberar seu acesso.
            </p>

            <div className="space-y-3">
              {QUESTION.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  className="w-full bg-[#2a3942] hover:bg-[#374550] active:scale-[0.98] text-[#e9edef] text-[15px] font-medium py-4 px-5 rounded-2xl border border-white/5 hover:border-[#00a884]/40 transition-all text-left"
                >
                  {opt}
                </button>
              ))}
            </div>

            <div className="mt-auto pt-8 space-y-2">
              <div className="flex items-center gap-2 text-[11px] text-[#8696a0]">
                <CheckCircle2 size={12} className="text-[#00a884]" /> +12.847 pessoas verificadas hoje
              </div>
              <div className="flex items-center gap-2 text-[11px] text-[#8696a0]">
                <CheckCircle2 size={12} className="text-[#00a884]" /> Seus dados não são compartilhados
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-[#00a884]/15 flex items-center justify-center mb-4 mx-auto">
              <CheckCircle2 size={36} className="text-[#00a884]" />
            </div>
            <h1 className="text-[#e9edef] text-[22px] font-bold leading-tight mb-2 text-center">
              Acesso liberado!
            </h1>
            <p className="text-[13px] text-[#8696a0] mb-6 text-center">
              Sua resposta foi confirmada. Toque abaixo para continuar com segurança.
            </p>

            <div className="bg-[#1a242b] rounded-2xl p-4 border border-white/5 mb-6 space-y-2">
              <div className="flex items-center gap-2 text-[12px] text-[#e9edef]">
                <CheckCircle2 size={14} className="text-[#00a884]" /> Verificação concluída
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#e9edef]">
                <CheckCircle2 size={14} className="text-[#00a884]" /> Localização compatível
              </div>
              <div className="flex items-center gap-2 text-[12px] text-[#e9edef]">
                <CheckCircle2 size={14} className="text-[#00a884]" /> Acesso disponível por tempo limitado
              </div>
            </div>

            <button
              onClick={handleContinue}
              disabled={!target}
              className="w-full bg-gradient-to-r from-[#00a884] to-[#00d09c] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 text-white text-[16px] font-bold py-4 rounded-2xl shadow-lg shadow-[#00a884]/30 transition-all"
            >
              Continuar →
            </button>
          </>
        )}
      </div>

      <div className="px-5 py-3 border-t border-white/5 flex items-center justify-center gap-3 text-[10px] text-[#8696a0]">
        <span className="flex items-center gap-1"><Lock size={10} /> SSL</span>
        <span>·</span>
        <span>Anônimo</span>
        <span>·</span>
        <span>+18</span>
      </div>
    </div>
  );
};

export default Pressel;
