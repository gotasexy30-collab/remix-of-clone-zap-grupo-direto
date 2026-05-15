import React, { useState } from 'react';
import { ShieldCheck, Lock, CheckCircle2, Smartphone, RefreshCw } from 'lucide-react';

/**
 * PRESSEL DE TESTE — espelha o fluxo de produção (/pressel).
 * Renderizada apenas dentro do painel admin para preview/QA.
 */

const QUESTIONS = [
  { text: 'Você é maior de 18 anos?', options: ['Sim, sou maior', 'Não'] },
  { text: 'Quer conhecer pessoas da sua região?', options: ['Sim, da minha cidade', 'Tanto faz'] },
];

export const PresselTest: React.FC = () => {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  const total = QUESTIONS.length;
  const progress = done ? 100 : Math.round(20 + (step / total) * 70);
  const question = QUESTIONS[step];

  const handleAnswer = () => {
    if (step + 1 < total) setStep(step + 1);
    else setDone(true);
  };

  const reset = () => {
    setStep(0);
    setDone(false);
  };

  const handleContinue = () => {
    alert('[TESTE] Aqui o lead seria enviado para o link do anúncio (fluxo atual do /r mobile).');
  };

  return (
    <div className="bg-[#202c33] rounded-3xl p-6 border border-white/5 shadow-xl animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-[#e9edef] flex items-center gap-2">
            <Smartphone size={18} className="text-[#00a884]" /> Pressel Mobile (TESTE)
          </h2>
          <p className="text-xs text-[#8696a0] mt-1">
            Espelha o fluxo de produção em <code className="text-[#00a884]">/pressel</code>.
          </p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs text-[#8696a0] hover:text-[#e9edef] bg-[#2a3942] px-3 py-2 rounded-lg border border-white/5"
        >
          <RefreshCw size={11} /> Reiniciar
        </button>
      </div>

      <div className="mx-auto max-w-[380px] bg-black rounded-[2.5rem] p-3 shadow-2xl border border-white/10">
        <div className="bg-gradient-to-b from-[#0b141a] to-[#111b21] rounded-[2rem] overflow-hidden min-h-[640px] flex flex-col">
          <div className="h-6 bg-black/30" />

          <div className="px-5 pt-5 pb-3 flex items-center gap-2 border-b border-white/5">
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
              <span>{done ? 'Concluído' : `Etapa ${step + 1} de ${total}`}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1 bg-[#2a3942] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00a884] to-[#00d09c] transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex-1 px-6 pt-8 pb-6 flex flex-col">
            {!done ? (
              <>
                <h1 className="text-[#e9edef] text-[22px] font-bold leading-tight mb-2">{question.text}</h1>
                <p className="text-[13px] text-[#8696a0] mb-6">
                  Esta resposta é anônima e usada apenas para liberar seu acesso.
                </p>

                <div className="space-y-3">
                  {question.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={handleAnswer}
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
                  Suas respostas foram confirmadas. Toque abaixo para continuar com segurança.
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
                  className="w-full bg-gradient-to-r from-[#00a884] to-[#00d09c] hover:brightness-110 active:scale-[0.98] text-white text-[16px] font-bold py-4 rounded-2xl shadow-lg shadow-[#00a884]/30 transition-all"
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
      </div>
    </div>
  );
};

export default PresselTest;
