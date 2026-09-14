import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical, Video, Phone, Mic, Paperclip, Smile, ShieldCheck, Copy, Check, Loader2, Play, Pause, Volume2, VolumeX, X, HelpCircle } from 'lucide-react';
import { getCurrentTime } from '../../services/location';
import { trackEvent } from '../../services/tracking';
import { getSetting } from '../../services/settings';
import { fbqTrack, trackEventDual, appendUTMsToUrl, logTrackedEvent, getMetaTrackingContext } from '../../services/pixel';
import { supabase } from '@/integrations/supabase/client';

interface PaymentPanelProps {
  userCity: string;
  userDDD: string;
}

const generatePhone = (ddd: string) => {
  const part1 = Math.floor(90000 + Math.random() * 9000);
  const part2 = Math.floor(1000 + Math.random() * 9000);
  return `+55 ${ddd} ${part1}-${part2}`;
};

interface GroupMessage {
  id: number;
  phone: string;
  content?: string;
  media?: { type: 'image' | 'video', url: string };
  avatar?: string;
  time: string;
  isMe?: boolean;
  delay?: number;
}

export const PaymentPanel: React.FC<PaymentPanelProps> = ({ userCity, userDDD }) => {
  const [displayedMessages, setDisplayedMessages] = useState<GroupMessage[]>([]);
  const [isTyping, setIsTyping] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);
  const [pix, setPix] = useState<{ id: string; qr_code: string; qr_code_base64: string } | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const [pixError, setPixError] = useState('');
  const [copied, setCopied] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'approved'>('pending');
  const [checkingManual, setCheckingManual] = useState(false);
  const [notPaidMsg, setNotPaidMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const notPaidRef = useRef<HTMLDivElement>(null);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [videoMuted, setVideoMuted] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [tutorialVideoUrl, setTutorialVideoUrl] = useState<string>(
    localStorage.getItem('pix_tutorial_video_url') || '/pix-tutorial.mp4'
  );

  useEffect(() => {
    (async () => {
      const url = await getSetting('pix_tutorial_video_url');
      if (url) setTutorialVideoUrl(url);
    })();
  }, []);

  // Preload video in background para abrir instantaneamente
  useEffect(() => {
    if (!tutorialVideoUrl) return;
    const v = document.createElement('video');
    v.src = tutorialVideoUrl;
    v.preload = 'auto';
    v.muted = true;
    v.style.display = 'none';
    document.body.appendChild(v);
    v.load();
    return () => { try { document.body.removeChild(v); } catch {} };
  }, [tutorialVideoUrl]);

  const toggleVideoPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setVideoPlaying(true); }
    else { v.pause(); setVideoPlaying(false); }
  };
  const toggleVideoMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setVideoMuted(v.muted);
  };

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let currentMsgIndex = 0;

    const dynamicMessages: GroupMessage[] = [
      { id: 1, phone: generatePhone(userDDD), content: "Meu corninho nao para de me ligar gente, afff", avatar: "https://midia.jdfnu287h7dujn2jndjsifd.com/IMG-20230920-204325646464.webp", delay: 600, time: getCurrentTime() },
      { id: 2, phone: generatePhone(userDDD), content: "Vou fazer ele esperar, olha como eu to agora gente", avatar: "https://midia.jdfnu287h7dujn2jndjsifd.com/IMG-20230920-204325646464.webp", delay: 1500, time: getCurrentTime() },
      { id: 3, phone: generatePhone(userDDD), media: { type: 'image', url: "https://midia.jdfnu287h7dujn2jndjsifd.com/IMG-20240925-211627.webp" }, avatar: "https://midia.jdfnu287h7dujn2jndjsifd.com/IMG-20230920-204325646464.webp", delay: 1000, time: getCurrentTime() },
      { id: 4, phone: generatePhone(userDDD === '11' ? '21' : '11'), content: "O meu ja adestrei, pica nova todo dia kkk", avatar: "https://midia.jdfnu287h7dujn2jndjsifd.com/1718211968653.webp", delay: 2000, time: getCurrentTime() },
      { id: 5, phone: generatePhone(userDDD), content: "Genteee, o Paulo que entrou ontem me comeu tao bem", avatar: "https://midia.jdfnu287h7dujn2jndjsifd.com/1641853871190.webp", delay: 2000, time: getCurrentTime() }
    ];

    const processNextMessage = async () => {
      if (currentMsgIndex >= dynamicMessages.length) {
        timeoutId = setTimeout(() => {
          setShowModal(true);
          fbqTrack('InitiateCheckout', { value: 19.90, currency: 'BRL' });
          logTrackedEvent('InitiateCheckout');
        }, 1500);
        return;
      }
      const msgData = dynamicMessages[currentMsgIndex];
      setIsTyping(msgData.phone);
      await new Promise(r => setTimeout(r, 1000));
      setIsTyping(null);
      setDisplayedMessages(prev => [...prev, { ...msgData, time: getCurrentTime() }]);
      currentMsgIndex++;
      timeoutId = setTimeout(processNextMessage, msgData.delay || 1000);
    };

    processNextMessage();
    return () => clearTimeout(timeoutId);
  }, [userDDD]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [displayedMessages, isTyping]);

  const handleAccessClick = async () => {
    if (pixLoading || pix) return;
    trackEvent('checkout_button_click');
    trackEventDual('Lead', { value: 19.90, currency: 'BRL' });
    setPixLoading(true);
    setPixError('');
    try {
      // Chamando a nova API Route interna da Vercel
      const response = await fetch('/api/generate-pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 19.90,
          name: 'Cliente VIP',
          cpf: '00000000000',
          email: 'cliente@exemplo.com',
          description: `Clube Secreto - ${userCity || 'VIP'}`,
          metadata: {
            session_id: sessionStorage.getItem('wa_session_id') || '',
            meta: getMetaTrackingContext(),
          },
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok || data.error) {
        setPixError(data?.error || 'Erro ao gerar PIX. Tente novamente.');
        return;
      }
      setPix({ id: data.id, qr_code: data.qr_code, qr_code_base64: data.qr_code_base64 });
      logTrackedEvent('PixGenerated');
    } catch (err) {
      console.error('Fetch error:', err);
      setPixError('Erro de conexão. Tente novamente.');
    } finally {
      setPixLoading(false);
    }
  };

  useEffect(() => {
    if (!pix?.id || paymentStatus === 'approved') return;
    const startedAt = Date.now();
    const MAX_POLL_MS = 12 * 60 * 1000; // para PIX abandonado: não consulta para sempre
    pollRef.current = setInterval(async () => {
      // Encerra o polling de sessões abandonadas para economizar chamadas
      if (Date.now() - startedAt > MAX_POLL_MS) {
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      // Não consulta com a aba em segundo plano (lead saiu da tela)
      if (typeof document !== 'undefined' && document.hidden) return;
      const sessionId = sessionStorage.getItem('wa_session_id') || '';
      const response = await fetch('/api/generate-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_status', id: pix.id, session_id: sessionId }),
      });
      const data = await response.json();
      if (data?.status === 'approved') {
        setPaymentStatus('approved');
        if (pollRef.current) clearInterval(pollRef.current);
        const eventId = `np_${pix.id}`;
        fbqTrack('Purchase', { value: 19.90, currency: 'BRL' }, { eventID: eventId });
        let url = localStorage.getItem('pix_success_url') || '';
        if (!url) url = (await getSetting('pix_success_url')) || '';
        if (url) setTimeout(() => window.location.assign(appendUTMsToUrl(url)), 1500);
      }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pix?.id, paymentStatus]);

  const handleCopy = async () => {
    if (!pix?.qr_code) return;
    const text = pix.qr_code;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.setAttribute('readonly', '');
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(ta);
      }
      setCopied(true);
      logTrackedEvent('PixCopied');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed', err);
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleManualCheck = async () => {
    if (!pix?.id || checkingManual) return;
    setCheckingManual(true);
    setNotPaidMsg('');
    logTrackedEvent('AlreadyPaid');
    try {
      const sessionId = sessionStorage.getItem('wa_session_id') || '';
      const response = await fetch('/api/generate-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_status', id: pix.id, session_id: sessionId }),
      });
      const data = await response.json();
      if (data?.status === 'approved') {
        setPaymentStatus('approved');
        if (pollRef.current) clearInterval(pollRef.current);
        const eventId = `np_${pix.id}`;
        fbqTrack('Purchase', { value: 19.90, currency: 'BRL' }, { eventID: eventId });
        let url = localStorage.getItem('pix_success_url') || '';
        if (!url) url = (await getSetting('pix_success_url')) || '';
        if (url) setTimeout(() => window.location.assign(appendUTMsToUrl(url)), 1200);
      } else {
        setNotPaidMsg('amor so esta faltando voce pagar pra me te adicionar no grupo vem logo safado🔥');
        setTimeout(() => notPaidRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
    } catch {
      setNotPaidMsg('amor so esta faltando voce pagar pra me te adicionar no grupo vem logo safado🔥');
      setTimeout(() => notPaidRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    } finally {
      setCheckingManual(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a] flex justify-center animate-fadeIn h-[100dvh]">
      <div className="w-full sm:max-w-[480px] bg-[#0b141a] flex flex-col h-full relative shadow-2xl">
        <div className="bg-[#1f2c34] px-4 py-2 flex items-center justify-between z-10 shrink-0 h-[60px]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="text-[#d9dee0]">
              <svg viewBox="0 0 24 24" height="24" width="24" fill="currentColor"><path d="M12,4l1.4,1.4L7.8,11H20v2H7.8l5.6,5.6L12,20l-8-8L12,4z"></path></svg>
            </div>
            <div className="w-[40px] h-[40px] rounded-full overflow-hidden shrink-0">
              <img src="https://midia.jdfnu287h7dujn2jndjsifd.com/IMG-20240711-00350743535.webp" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col justify-center overflow-hidden">
              <h1 className="text-[#e9edef] text-[16px] font-semibold leading-tight truncate">🔥CLUBE SECRETO - {userCity || "VIP"}</h1>
              <span className="text-[#8696a0] text-[12px] truncate">{isTyping ? `${isTyping} está digitando...` : `Ativo agora`}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[#d9dee0]">
            <Video size={22} /><Phone size={20} /><MoreVertical size={20} />
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3" style={{ backgroundImage: `url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")`, backgroundSize: 'contain' }}>
          {displayedMessages.map((msg) => (
            <div key={msg.id} className="flex mb-3 justify-start animate-fadeIn">
              <img src={msg.avatar} className="w-[30px] h-[30px] rounded-full mr-2 self-start mt-1" />
              <div className="relative max-w-[85%] rounded-lg p-1.5 shadow-sm text-white bg-[#202c33]">
                <div className="text-[#53bdeb] text-[13px] font-medium px-1 mb-0.5 leading-tight">{msg.phone}</div>
                {msg.media && <img src={msg.media.url} className="w-full h-auto rounded mb-1" />}
                {msg.content && <div className="px-1 text-[15px]">{msg.content}</div>}
                <div className="text-[10px] text-white/60 text-right px-1">{msg.time}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#202c33] p-2 flex items-center gap-2 shrink-0 h-[62px]">
          <div className="flex gap-4 px-2 text-[#8696a0]"><Smile /><Paperclip /></div>
          <div className="flex-1 bg-[#2a3942] rounded-lg h-[40px] flex items-center px-4"><span className="text-[#8696a0] text-[15px]">Mensagem</span></div>
          <div className="w-[45px] flex justify-center text-[#8696a0]"><Mic /></div>
        </div>
      </div>

      {showModal && (
        <div ref={modalScrollRef} className="absolute inset-0 bg-black/70 backdrop-blur-[2px] z-50 overflow-y-auto overscroll-contain animate-fadeIn" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="min-h-full flex items-start sm:items-center justify-center p-2 sm:p-4">
          <div className="w-full sm:max-w-[480px] bg-white rounded-xl shadow-2xl flex flex-col relative animate-slideIn my-2">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col items-center gap-4">
                <div className="text-center">
                  <h2 className="text-lg font-bold text-gray-800 uppercase">🔥 Acesso ao Clube Secreto</h2>
                  <p className="text-gray-500 text-sm">Últimas vagas para {userCity || 'sua região'}!</p>
                  <div className="my-2">
                    <span className="text-xl text-gray-400 line-through mr-2">R$ 29,90</span>
                    <span className="text-4xl font-black text-[#16A349]">R$ 19,90</span>
                  </div>
                </div>

                {paymentStatus === 'approved' ? (
                  <div className="w-full text-center py-6">
                    <div className="w-16 h-16 mx-auto rounded-full bg-[#16A349] flex items-center justify-center mb-3">
                      <Check size={36} className="text-white" />
                    </div>
                    <h3 className="text-xl font-black text-[#16A349] mb-1">PAGAMENTO APROVADO!</h3>
                    <p className="text-gray-500 text-sm">Liberando seu acesso...</p>
                  </div>
                ) : !pix ? (
                  <>
                    <button
                      onClick={handleAccessClick}
                      disabled={pixLoading}
                      className="w-full bg-[#16A349] text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all text-center disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {pixLoading ? <><Loader2 size={20} className="animate-spin" /> Gerando PIX...</> : 'GERAR PIX AGORA'}
                    </button>
                    {pixError && <p className="text-red-500 text-xs text-center">{pixError}</p>}
                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                      <ShieldCheck size={14} /> Compra 100% Segura e Sigilosa
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-full bg-gray-50 rounded-xl p-2 flex flex-col items-center">
                      {pix.qr_code_base64 && (
                        <img
                          src={pix.qr_code_base64}
                          alt="QR Code PIX"
                          className="w-36 h-36 object-contain"
                        />
                      )}
                      <p className="text-[10px] text-gray-500 mt-1 text-center">Escaneie o QR Code no app do seu banco</p>
                    </div>

                    {/* Video movido para modal — abre no clique do botão "Como pagar" */}

                    <div className="w-full">
                      <p className="text-xs font-bold text-gray-600 mb-1 text-center">Ou use PIX Copia e Cola:</p>
                      <div className="bg-gray-100 rounded-lg p-2 text-[10px] text-gray-700 break-all max-h-20 overflow-y-auto border">
                        {pix.qr_code}
                      </div>
                      <button
                        onClick={handleCopy}
                        className="w-full mt-2 bg-[#16A349] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        {copied ? <><Check size={18} /> Código Copiado!</> : <><Copy size={18} /> COPIAR CÓDIGO PIX</>}
                      </button>
                      <button
                        onClick={handleManualCheck}
                        disabled={checkingManual}
                        className="w-full mt-2 bg-white border-2 border-[#16A349] text-[#16A349] py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60"
                      >
                        {checkingManual ? <><Loader2 size={18} className="animate-spin" /> Verificando...</> : <><Check size={18} /> JÁ PAGUEI</>}
                      </button>
                      <button
                        onClick={() => { setShowVideoModal(true); setVideoPlaying(true); setVideoMuted(false); logTrackedEvent('TutorialOpened'); }}
                        className="w-full mt-2 bg-blue-50 border-2 border-blue-400 text-blue-600 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
                      >
                        <HelpCircle size={18} /> COMO PAGAR
                      </button>
                      {notPaidMsg && (
                        <div ref={notPaidRef} className="mt-2 bg-pink-50 border border-pink-200 rounded-lg p-3 text-center">
                          <p className="text-[13px] text-pink-700 font-medium leading-snug">{notPaidMsg}</p>
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
                  </>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {showVideoModal && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setShowVideoModal(false)}>
          <div className="relative w-full sm:max-w-[480px]" onClick={(e) => e.stopPropagation()}>
            <div className="w-full rounded-xl overflow-hidden bg-black relative">
              <button
                onClick={() => setShowVideoModal(false)}
                aria-label="Fechar"
                className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur-sm transition active:scale-95"
              >
                <X size={18} />
              </button>
              <video
                ref={videoRef}
                src={tutorialVideoUrl}
                autoPlay
                loop
                playsInline
                preload="auto"
                className="w-full h-auto"
                onLoadedMetadata={(e) => { (e.currentTarget as HTMLVideoElement).muted = false; }}
              />
              <div className="absolute bottom-2 right-2 flex gap-2">
                <button
                  onClick={toggleVideoPlay}
                  aria-label={videoPlaying ? 'Pausar' : 'Reproduzir'}
                  className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur-sm transition"
                >
                  {videoPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  onClick={toggleVideoMute}
                  aria-label={videoMuted ? 'Ativar som' : 'Mutar'}
                  className="bg-black/60 hover:bg-black/80 text-white rounded-full p-2 backdrop-blur-sm transition"
                >
                  {videoMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
