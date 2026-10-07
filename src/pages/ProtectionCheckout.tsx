import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { appendUTMsToUrl, logTrackedEvent } from '../services/pixel';
import { getSetting } from '../services/settings';
import { useWhatsAppRouter } from '../hooks/useWhatsAppRouter';

const PROTECTION_PRICE = 7.90;

type PixData = {
  id: string;
  qr_code: string;
  qr_code_base64: string;
};

const isApprovedStatus = (status?: string | null) => {
  const normalized = String(status || '').toLowerCase().trim();
  return ['approved','paid','completed','confirmed','success','pago','confirmado','concluido'].includes(normalized);
};

export default function ProtectionCheckout() {
  const [pix, setPix] = useState<PixData | null>(null);
  const [creating, setCreating] = useState(false);
  const [approved, setApproved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const pollRef = useRef<number | null>(null);
  const { redirect } = useWhatsAppRouter();

  const sessionId = sessionStorage.getItem('wa_session_id') || '';
  const parentPaymentId = sessionStorage.getItem('protection_parent_payment_id') || '';

  useEffect(() => {
    logTrackedEvent('ProtectionOfferViewed');
    if (!parentPaymentId || !sessionId) {
      setError('Não foi possível localizar o pagamento anterior nesta sessão.');
    }
  }, [parentPaymentId, sessionId]);

  const goToDelivery = async () => {
    if (isRedirecting) return;
    setIsRedirecting(true);
    try {
      let primaryUrl = localStorage.getItem('pix_success_url') || '';
      if (!primaryUrl) {
        primaryUrl = await getSetting('pix_success_url') || '';
        if (primaryUrl) localStorage.setItem('pix_success_url', primaryUrl);
      }
      if (primaryUrl.trim()) {
        const cleanUrl = primaryUrl.trim();
        const finalUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
        window.location.href = appendUTMsToUrl(finalUrl);
        return;
      }

      let fallbackUrl = localStorage.getItem('payment_redirect_link') || '';
      if (!fallbackUrl) {
        fallbackUrl = await getSetting('payment_redirect_link') || '';
        if (fallbackUrl) localStorage.setItem('payment_redirect_link', fallbackUrl);
      }
      const ok = await redirect('Olá! Acabei de concluir meu pagamento.', fallbackUrl || undefined);
      if (!ok) {
        setError('O link de entrega não está configurado. Contate o suporte.');
        setIsRedirecting(false);
      }
    } catch {
      setError('Não foi possível abrir a entrega agora. Tente novamente.');
      setIsRedirecting(false);
    }
  };

  const checkStatus = async (id: string) => {
    try {
      const response = await fetch('/api/protection-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_status',
          id,
          parent_payment_id: parentPaymentId,
          session_id: sessionId,
        }),
      });
      const data = await response.json();
      if (response.ok && isApprovedStatus(data?.status)) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        setApproved(true);
        setError('');
        logTrackedEvent('ProtectionPurchaseApproved');
        await goToDelivery();
      }
    } catch {
      // O polling continua tentando; não bloqueia a tela por falha transitória.
    }
  };

  useEffect(() => {
    if (!pix?.id || approved) return;
    void checkStatus(pix.id);
    pollRef.current = window.setInterval(() => void checkStatus(pix.id), 3500);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [pix?.id, approved]);

  const createPix = async () => {
    if (creating || pix || !parentPaymentId || !sessionId) return;
    setCreating(true);
    setError('');
    logTrackedEvent('ProtectionPayClicked');
    try {
      const response = await fetch('/api/protection-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          parent_payment_id: parentPaymentId,
          session_id: sessionId,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.id || !data?.qr_code) {
        setError(data?.error || 'Não foi possível gerar o PIX da proteção.');
        return;
      }
      setPix({
        id: String(data.id),
        qr_code: String(data.qr_code || ''),
        qr_code_base64: String(data.qr_code_base64 || ''),
      });
      logTrackedEvent('ProtectionPixGenerated');
    } catch {
      setError('Erro de conexão ao gerar o PIX. Tente novamente.');
    } finally {
      setCreating(false);
    }
  };

  const copyPix = async () => {
    if (!pix?.qr_code) return;
    try {
      await navigator.clipboard.writeText(pix.qr_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione o código abaixo.');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-black/80 flex items-center justify-center p-3">
      <div className="w-full max-w-[470px] bg-white rounded-2xl shadow-2xl p-5 sm:p-6 text-gray-900">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 font-black text-xl uppercase">
            <LockKeyhole className="text-amber-500" size={28} />
            Proteção do Grupo
          </div>
          <p className="mt-4 text-sm sm:text-[15px] leading-relaxed text-gray-500">
            Seu acesso já foi reservado. Conheça a Proteção do Grupo para reforçar a segurança e organização da comunidade.
          </p>
        </div>

        <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-[#16A349] text-white grid place-items-center shrink-0">
            <Check size={25} />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-[#15803d]">Pagamento confirmado</div>
            <div className="text-3xl font-black text-[#16A349]">R$ 19,90</div>
            <span className="inline-block mt-1 px-3 py-1 rounded-md bg-green-100 text-[#15803d] text-xs font-black">CONCLUÍDO</span>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 flex items-center gap-3">
          <ShieldCheck size={42} className="text-gray-500 shrink-0" />
          <div>
            <div className="font-black text-lg">Proteção do Grupo</div>
            <div className="text-4xl font-black mt-1">R$ 7,90</div>
            <div className="text-sm text-gray-500 mt-1">Oferta pós-compra para reforçar sua experiência no grupo.</div>
          </div>
        </div>

        {!pix && !approved && (
          <button
            type="button"
            onClick={() => void createPix()}
            disabled={creating || !parentPaymentId || !sessionId}
            className="w-full mt-5 bg-[#16A349] text-white py-4 rounded-xl font-black text-base flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
          >
            {creating ? <><Loader2 className="animate-spin" size={20}/> GERANDO PIX...</> : 'ADICIONAR PROTEÇÃO · R$ 7,90'}
          </button>
        )}

        {pix && !approved && (
          <div className="mt-5">
            <p className="text-center font-bold text-sm mb-3">PIX da Proteção do Grupo</p>
            {pix.qr_code_base64 && (
              <img src={pix.qr_code_base64} alt="QR Code PIX" className="w-44 h-44 mx-auto object-contain" />
            )}
            <div className="mt-3 bg-gray-100 border rounded-lg p-2 text-[10px] text-gray-700 break-all max-h-24 overflow-auto">
              {pix.qr_code}
            </div>
            <button
              type="button"
              onClick={() => void copyPix()}
              className="w-full mt-2 bg-[#16A349] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
            >
              {copied ? <><Check size={18}/> CÓDIGO COPIADO</> : <><Copy size={18}/> COPIAR CÓDIGO PIX</>}
            </button>
            <div className="mt-3 flex items-center justify-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs font-medium">
              <Loader2 size={14} className="animate-spin" /> Aguardando confirmação...
            </div>
          </div>
        )}

        {approved && (
          <div className="mt-5 text-center bg-green-50 border border-green-200 rounded-xl p-4">
            <Check className="mx-auto text-[#16A349]" size={30} />
            <div className="font-black text-[#15803d] mt-2">Pagamento confirmado</div>
            <div className="text-sm text-gray-500 mt-1">{isRedirecting ? 'Abrindo sua entrega...' : 'Sua proteção foi adicionada.'}</div>
          </div>
        )}

        <button
          type="button"
          onClick={() => void goToDelivery()}
          disabled={isRedirecting}
          className="w-full mt-4 text-sm text-gray-500 underline underline-offset-4 disabled:opacity-50"
        >
          Continuar para minha entrega sem adicionar a proteção
        </button>

        {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
