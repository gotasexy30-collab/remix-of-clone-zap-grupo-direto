import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Minus, Plus } from 'lucide-react';

const PRICE_CENTS = 460;
const MODELS = [
  { name: 'Alice', photo: 'https://zfkixusybzbtnvufufrm.supabase.co/storage/v1/object/public/media-privacy-club/imagens%20pagina%20sorteio/gf4xz.jpg' },
  { name: 'Thaisinha', photo: 'https://zfkixusybzbtnvufufrm.supabase.co/storage/v1/object/public/media-privacy-club/imagens%20pagina%20sorteio/Girl_holding_item_2K_20260924181817.jpeg' },
  { name: 'Camila', photo: 'https://zfkixusybzbtnvufufrm.supabase.co/storage/v1/object/public/media-privacy-club/imagens%20pagina%20sorteio/P1Bbq.jpg' },
] as const;
type Pix = { id: string; qr_code: string; qr_code_base64: string };
type Props = { parentPaymentId: string; sessionId: string; onContinue: () => void; isRedirecting: boolean };
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function SorteioOffer({ parentPaymentId, sessionId, onContinue, isRedirecting }: Props) {
  const [model, setModel] = useState<string>('Alice');
  const [quantity, setQuantity] = useState(1);
  const [pix, setPix] = useState<Pix | null>(null);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const requestRef = useRef(false);
  const approvedRef = useRef(false);

  const check = async (id: string, showError = false) => {
    if (approvedRef.current || !sessionId) return;
    try {
      const response = await fetch('/api/sorteio-pix', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_status', id, session_id: sessionId }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (showError) setError(data?.error || 'Não foi possível consultar o PIX adicional.');
        return;
      }
      if (data.status === 'approved') {
        approvedRef.current = true;
        setApproved(true);
        setError('');
      } else if (showError) {
        setError('O pagamento adicional ainda não foi confirmado. Você pode aguardar ou acessar seu conteúdo já pago.');
      }
    } catch {
      if (showError) setError('Falha de conexão ao verificar o PIX adicional. O seu conteúdo original segue disponível.');
    }
  };

  useEffect(() => {
    if (!pix?.id || approved) return;
    void check(pix.id);
    const interval = window.setInterval(() => { void check(pix.id); }, 3500);
    return () => window.clearInterval(interval);
  }, [pix?.id, approved, sessionId]);

  const createPix = async () => {
    if (requestRef.current || pix || isRedirecting) return;
    requestRef.current = true;
    setCreating(true);
    setError('');
    try {
      const response = await fetch('/api/sorteio-pix', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', parent_payment_id: parentPaymentId, session_id: sessionId, model, quantity }),
      });
      const data = await response.json();
      if (!response.ok || !data?.id || !data?.qr_code) {
        setError(data?.error || 'Não foi possível gerar o PIX adicional. Você pode pular esta oferta.');
        return;
      }
      setPix({ id: String(data.id), qr_code: data.qr_code, qr_code_base64: data.qr_code_base64 || '' });
    } catch {
      setError('Erro de conexão. Você pode pular esta oferta e acessar seu conteúdo.');
    } finally {
      requestRef.current = false;
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!pix?.qr_code) return;
    try {
      await navigator.clipboard.writeText(pix.qr_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione e copie o código PIX abaixo.');
    }
  };

  return (
    <div className="fixed inset-0 z-[250] overflow-y-auto overscroll-contain text-[#f7f2f7]" style={{ background: 'radial-gradient(circle at 50% -15%, #5d214c 0%, #19101e 43%, #0c0b13 78%)', touchAction: 'manipulation' }}>
      <main className="mx-auto w-[calc(100%-32px)] max-w-[460px] py-6 sm:py-10">
        <header className="text-center mb-6">
          <p className="text-[11px] font-extrabold tracking-[.2em] text-[#e7a9c9]">SEU CONTEÚDO JÁ ESTÁ GARANTIDO ❤️</p>
          <h1 className="text-[clamp(27px,7vw,38px)] leading-[1.13] tracking-tight font-extrabold my-3">Participe do sorteio da <span className="text-[#ffb7d4]">peça íntima da sua modelo favorita</span></h1>
          <p className="text-sm leading-relaxed text-[#c4b8c5]">Quer participar? Escolha sua modelo favorita e a quantidade de cotas. <strong className="text-white">Esta é uma oferta extra, não é taxa de liberação nem pagamento obrigatório.</strong> Se não quiser participar, é só pular e acessar o conteúdo que você já comprou.</p>
        </header>
        <section className="overflow-hidden rounded-[22px] border border-[#69425d] shadow-2xl" style={{ background: 'linear-gradient(155deg,#2c1c2f,#1a1523)' }}>
          <div className="px-4 pt-5 sm:px-[22px]">
            <p className="text-[11px] tracking-[.12em] uppercase text-[#d8a8bf] font-extrabold mb-3">01 · Escolha sua modelo</p>
            <div className="grid grid-cols-3 gap-2">
              {MODELS.map(item => (
                <button key={item.name} type="button" disabled={Boolean(pix)} onClick={() => setModel(item.name)}
                  aria-pressed={model === item.name}
                  className={`min-w-0 flex flex-col items-center gap-2 rounded-[13px] p-2 text-xs font-extrabold transition-colors border-2 ${model === item.name ? 'border-[#ff91c1] bg-[#512e49]' : 'border-[#514056] bg-[#211a28]'} disabled:opacity-70`}>
                  <span>{item.name}</span>
                  <img src={item.photo} alt={`Foto de ${item.name}`} loading="lazy" className="w-full aspect-[4/5] rounded-[9px] object-cover" />
                </button>
              ))}
            </div>
          </div>
          <div className="h-px bg-[#50394c] mx-4 sm:mx-[22px] my-5" />
          <div className="px-4 pb-5 sm:px-[22px]">
            <p className="text-[11px] tracking-[.12em] uppercase text-[#d8a8bf] font-extrabold mb-2">02 · Quantas cotas?</p>
            <p className="text-[13px] text-[#ffd6e7] leading-relaxed mb-4">✨ Quanto mais cotas você escolher, mais chances terá de ganhar no sorteio.</p>
            <div className="flex items-center justify-between gap-2">
              <div><span className="block text-[13px] text-[#c9b8c8]">Valor por cota</span><strong className="text-[23px]">{money(PRICE_CENTS)}</strong></div>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="Diminuir cotas" disabled={quantity <= 1 || Boolean(pix)} onClick={() => setQuantity(n => Math.max(1, n - 1))} className="w-10 h-10 rounded-xl border border-[#79506b] bg-[#493045] disabled:opacity-40 grid place-items-center"><Minus size={18}/></button>
                <span className="text-2xl font-extrabold min-w-5 text-center tabular-nums">{quantity}</span>
                <button type="button" aria-label="Aumentar cotas" disabled={quantity >= 100 || Boolean(pix)} onClick={() => setQuantity(n => Math.min(100, n + 1))} className="w-10 h-10 rounded-xl border border-[#79506b] bg-[#493045] disabled:opacity-40 grid place-items-center"><Plus size={18}/></button>
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center gap-2 px-4 sm:px-[22px] py-5 border-t border-[#50394c] bg-[#241b2a]">
            <span className="text-[13px] text-[#e2c9d7]">Total {pix ? 'do PIX adicional' : 'das cotas'}</span>
            <strong className="text-[27px] text-[#ffd39d] tabular-nums">{money(quantity * PRICE_CENTS)}</strong>
          </div>
          <div className="px-4 sm:px-[22px] py-5">
            {approved ? (
              <div className="text-center rounded-xl p-4 bg-[#2a4938] mb-3"><Check className="mx-auto text-[#a7f3c1] mb-2" /><strong>Pagamento adicional confirmado!</strong><p className="text-xs mt-2">Participação registrada: {quantity} {quantity === 1 ? 'cota' : 'cotas'} de {model}.</p></div>
            ) : pix ? (
              <div className="mb-4 text-center">
                <p className="text-sm font-bold mb-3">Pague o PIX adicional para confirmar suas cotas.</p>
                {pix.qr_code_base64 && <img src={pix.qr_code_base64} alt="QR Code do PIX adicional" className="w-44 h-44 object-contain bg-white rounded-lg p-2 mx-auto mb-3" />}
                <label htmlFor="sorteio-copy" className="text-xs text-[#c9b8c8] block mb-2">PIX copia e cola:</label>
                <textarea id="sorteio-copy" readOnly value={pix.qr_code} rows={3} className="w-full rounded-lg bg-[#120f19] border border-[#79506b] text-white text-xs break-all p-2 resize-none" />
                <button type="button" onClick={() => void copy()} className="w-full rounded-xl bg-[#493045] border border-[#79506b] py-3 font-bold text-sm mt-2 flex items-center justify-center gap-2"><Copy size={16} />{copied ? 'Código copiado!' : 'COPIAR CÓDIGO PIX'}</button>
                <button type="button" disabled={checking} onClick={async () => { setChecking(true); await check(pix.id, true); setChecking(false); }} className="text-[#ffb7d4] text-sm underline mt-4 disabled:opacity-50">{checking ? 'Verificando...' : 'Já paguei · verificar pagamento'}</button>
              </div>
            ) : (
              <button type="button" disabled={creating || !sessionId} onClick={() => void createPix()} className="w-full rounded-[13px] bg-gradient-to-r from-[#ff8ebd] to-[#ffb78c] text-[#341323] font-black text-sm py-4 disabled:opacity-50 flex items-center justify-center gap-2">
                {creating ? <><Loader2 size={18} className="animate-spin"/> GERANDO PIX ADICIONAL...</> : `PARTICIPAR · ${money(quantity * PRICE_CENTS)}`}
              </button>
            )}
            {approved && <button type="button" onClick={onContinue} disabled={isRedirecting} className="w-full rounded-[13px] bg-[#16A349] text-white font-black text-sm py-4 disabled:opacity-50">{isRedirecting ? 'ABRINDO CONTEÚDO...' : 'ACESSAR MEU CONTEÚDO AGORA'}</button>}
            {!approved && <button type="button" onClick={onContinue} disabled={isRedirecting} className="block mx-auto mt-4 text-[#e6cdda] text-[13px] underline underline-offset-2 disabled:opacity-50">{isRedirecting ? 'ABRINDO CONTEÚDO...' : 'Pular oferta e acessar meu conteúdo já pago →'}</button>}
            {error && <p role="alert" className="text-[#ffc4c4] text-xs leading-relaxed text-center mt-4">{error}</p>}
          </div>
        </section>
        <p className="text-center text-[11px] leading-relaxed text-[#a99eaf] mt-4">A participação é opcional. Não é necessária para liberar o conteúdo de R$ 19,90 já adquirido.</p>
      </main>
    </div>
  );
}
