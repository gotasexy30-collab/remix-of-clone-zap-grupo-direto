import React, { useState } from 'react';
import { ShieldCheck, Lock, CheckCircle2, Smartphone, RefreshCw } from 'lucide-react';

/**
 * PRESSEL DE TESTE — não está conectada ao fluxo de produção.
 * Renderizada apenas dentro do painel admin para preview/QA.
 *
 * Fluxo simulado:
 *  1. Lead vê pergunta única (ex.: maior de 18?)
 *  2. Qualquer resposta libera o CTA
 *  3. CTA "leva" pro próximo passo (no preview, só mostra alerta)
 */

type Question = {
  id: string;
  text: string;
  options: string[];
};

const QUESTIONS: Question[] = [
  {
    id: 'age',
    text: 'Você é maior de 18 anos?',
    options: ['Sim, sou maior', 'Não'],
  },
  {
    id: 'gender',
    text: 'Você é homem ou mulher?',
    options: ['Homem', 'Mulher'],
  },
  {
    id: 'relationship',
    text: 'Você está em um relacionamento atualmente?',
    options: ['Sim', 'Não', 'É complicado'],
  },
  {
    id: 'discreet',
    text: 'Você procura algo discreto e sem compromisso?',
    options: ['Sim, total discrição', 'Quero conhecer primeiro'],
  },
  {
    id: 'region',
    text: 'Você quer conhecer pessoas da sua região?',
    options: ['Sim, da minha cidade', 'Tanto faz'],
  },
  {
    id: 'available',
    text: 'Você teria disponibilidade hoje à noite?',
    options: ['Sim', 'Talvez', 'Só nos próximos dias'],
  },
];

export const PresselTest: React.FC = () => {
  const [questionId, setQuestionId] = useState<string>('age');
  const [answered, setAnswered] = useState<string | null>(null);
  const [progress, setProgress] = useState(35);

  const question = QUESTIONS.find((q) => q.id === questionId)!;

  const handleAnswer = (opt: string) => {
    setAnswered(opt);
    setProgress(100);
  };

  const reset = () => {
    setAnswered(null);
    setProgress(35);
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
            Preview isolado. Não está no fluxo do <code className="text-[#00a884]">/r</code>.
          </p>
        </div>
        <select
          value={questionId}
          onChange={(e) => {
            setQuestionId(e.target.value);
            reset();
          }}
          className="bg-[#2a3942] text-[#e9edef] text-xs rounded-lg px-3 py-2 border border-white/5 outline-none"
        >
          {QUESTIONS.map((q) => (
            <option key={q.id} value={q.id}>
              {q.text}
            </option>
          ))}
        </select>
      </div>

      {/* Mock de telefone */}
      <div className="mx-auto max-w-[380px] bg-black rounded-[2.5rem] p-3 shadow-2xl border border-white/10">
        <div className="bg-gradient-to-b from-[#0b141a] to-[#111b21] rounded-[2rem] overflow-hidden min-h-[640px] flex flex-col">
          {/* Status bar fake */}
          <div className="h-6 bg-black/30" />

          {/* Header de confiança */}
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

          {/* Progresso */}
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

          {/* Conteúdo principal */}
          <div className="flex-1 px-6 pt-8 pb-6 flex flex-col">
            {!answered ? (
              <>
                <h1 className="text-[#e9edef] text-[22px] font-bold leading-tight mb-2">
                  {question.text}
                </h1>
                <p className="text-[13px] text-[#8696a0] mb-6">
                  Esta resposta é anônima e usada apenas para liberar seu acesso.
                </p>

                <div className="space-y-3">
                  {question.options.map((opt) => (
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
                  className="w-full bg-gradient-to-r from-[#00a884] to-[#00d09c] hover:brightness-110 active:scale-[0.98] text-white text-[16px] font-bold py-4 rounded-2xl shadow-lg shadow-[#00a884]/30 transition-all"
                >
                  Continuar →
                </button>

                <button
                  onClick={reset}
                  className="mt-3 mx-auto flex items-center gap-1 text-[11px] text-[#8696a0] hover:text-[#e9edef]"
                >
                  <RefreshCw size={11} /> Reiniciar teste
                </button>
              </>
            )}
          </div>

          {/* Rodapé de confiança */}
          <div className="px-5 py-3 border-t border-white/5 flex items-center justify-center gap-3 text-[10px] text-[#8696a0]">
            <span className="flex items-center gap-1"><Lock size={10} /> SSL</span>
            <span>·</span>
            <span>Anônimo</span>
            <span>·</span>
            <span>+18</span>
          </div>
        </div>
      </div>

      <div className="mt-5 bg-[#1a242b] rounded-2xl p-4 border border-white/5">
        <p className="text-[11px] text-[#8696a0] uppercase tracking-widest mb-2">Sugestões de perguntas</p>
        <ul className="text-[12px] text-[#e9edef] space-y-1.5 list-disc list-inside">
          <li>Você é maior de 18 anos?</li>
          <li>Você é homem ou mulher?</li>
          <li>Você está em um relacionamento atualmente?</li>
          <li>Procura algo discreto e sem compromisso?</li>
          <li>Quer conhecer pessoas da sua região?</li>
          <li>Teria disponibilidade hoje à noite?</li>
          <li>Aceita conversar por chamada de vídeo?</li>
          <li>Prefere encontros presenciais ou virtuais?</li>
        </ul>
      </div>
    </div>
  );
};

export default PresselTest;
