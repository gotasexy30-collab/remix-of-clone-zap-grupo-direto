import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { BASE_URL, AUDIO_BASE_URL } from '../constants';
import { ChatMessage, DialogueMessage } from '../types';
import { getUserLocation, getCurrentTime } from '../services/location';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatHeader } from '../components/chat/ChatHeader';
import { PaymentPanel } from '../components/chat/PaymentPanel';
import { trackEvent } from '../services/tracking';
import { generateImageWithCity } from '../services/imageOverlay';
import { getSetting } from '../services/settings';
import { initMetaPixel, fbqTrack, captureUTMs } from '../services/pixel';
import { captureTrafficAttribution } from '../services/trafficAttribution';
import { captureLandingParameters } from '../services/landingAttribution';
import { supabase } from '@/integrations/supabase/client';

const BACKGROUND_IMAGE = 'https://i.pinimg.com/736x/56/ea/b7/56eab7512f1021bdd4cf04952ad45a2c.jpg';

const getSlug = () => window.location.pathname.replace('/painel', '').split('/').filter(p => p).pop() || 'home';

// O roteiro não é empacotado no JavaScript público: a API fornece uma etapa por vez.
type VisibleOption = { text: string; payload: string };
type RemoteStep = {
  messages?: DialogueMessage[];
  response?: { type: 'text' | 'buttons' | 'continue'; options?: VisibleOption[] };
  action?: { type: 'open_payment' };
};
type RequestedAction = 'start' | 'text' | 'choice' | 'continue';

const Index = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStepId, setCurrentStepId] = useState<string>('START');
  const [serverStep, setServerStep] = useState<RemoteStep | null>(null);
  const [stepError, setStepError] = useState(false);
  const stepTokenRef = useRef('');
  const requestingRef = useRef(false);
  const lastRequestRef = useRef<{ action: RequestedAction; choice?: string }>({ action: 'start' });
  const [locationData, setLocationData] = useState<{ city: string; ddd: string }>({ city: '', ddd: '11' });
  const [typingStatus, setTypingStatus] = useState<string | null>(null);
  const [activeOptions, setActiveOptions] = useState<VisibleOption[] | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [inputType, setInputType] = useState<'text' | 'buttons' | 'none'>('none');
  
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const processedSteps = useRef(new Set<string>());
  const visitTracked = useRef(false);

  // Restrito à conversa: não interfere nos campos de texto nem no checkout PIX.
  // Atalhos do navegador podem continuar acessíveis pelo menu do próprio navegador.
  useEffect(() => {
    if (showPayment) return;

    const protectChatShortcuts = (event: KeyboardEvent) => {
      const target = event.target;
      const editing = target instanceof HTMLElement &&
        Boolean(target.closest('input, textarea, [contenteditable="true"]'));
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const inspectorShortcut = event.key === 'F12' ||
        (modifier && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (modifier && key === 'u');
      const copyOrSelectShortcut = !editing && modifier && !event.altKey &&
        !event.shiftKey && ['a', 'c'].includes(key);

      if (inspectorShortcut || copyOrSelectShortcut) {
        event.preventDefault();
      }
    };

    document.addEventListener('keydown', protectChatShortcuts, true);
    return () => document.removeEventListener('keydown', protectChatShortcuts, true);
  }, [showPayment]);

  const requestStep = useCallback(async (action: RequestedAction, choice?: string) => {
    if (requestingRef.current) return;
    requestingRef.current = true;
    lastRequestRef.current = { action, choice };
    setStepError(false);
    try {
      let sid = sessionStorage.getItem('wa_session_id');
      if (!sid) {
        sid = crypto.randomUUID();
        sessionStorage.setItem('wa_session_id', sid);
      }
      const body = JSON.stringify({
        session_id: sid,
        action,
        ...(action !== 'start' ? { token: stepTokenRef.current } : {}),
        ...(action === 'choice' ? { choice } : {}),
      });

      // Apenas para uma eventual diferença de milissegundos entre a animação
      // das mensagens e a liberação da etapa pelo servidor.
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetch('/api/lead-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body,
        });
        const payload = await response.json().catch(() => ({}));
        if (response.status === 425 && attempt < 2) {
          const wait = Math.max(200, Math.min(10000, Number(payload.retryAfterMs) || 800));
          await new Promise(resolve => setTimeout(resolve, wait));
          continue;
        }
        if (!response.ok || !payload?.token || !payload?.stepId || !payload?.step) {
          throw new Error('Etapa indisponível');
        }
        stepTokenRef.current = String(payload.token);
        setServerStep(payload.step as RemoteStep);
        setCurrentStepId(String(payload.stepId));
        lastRequestRef.current = { action: 'start' };
        return;
      }
    } catch (error) {
      console.error('Não foi possível carregar a etapa da conversa:', error);
      setStepError(true);
    } finally {
      requestingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!visitTracked.current) {
      trackEvent('page_view');
      visitTracked.current = true;
      captureUTMs();
      void captureLandingParameters('chat');
      void captureTrafficAttribution(getSlug());
      void initMetaPixel();
      
      // Registra visita no banco usando a tabela page_visits
      try {
        let sid = sessionStorage.getItem('wa_session_id');
        if (!sid) {
          sid = crypto.randomUUID();
          sessionStorage.setItem('wa_session_id', sid);
        }
        
        supabase.from('page_visits').insert([{
          session_id: sid,
          slug: getSlug(),
          user_agent: navigator.userAgent,
          referer: document.referrer,
        }]).then(({ error }) => {
          if (error) console.error('Erro ao registrar visita:', error);
        });
      } catch (err) {
        console.error('Erro ao registrar visita:', err);
      }
    }
    getUserLocation().then(data => setLocationData(data));
    void requestStep('start');
  }, [requestStep]);

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  }, [messages, typingStatus, activeOptions, inputType]);

  useEffect(() => {
    if (inputType === 'text') {
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 300);
    }
  }, [inputType]);

  useEffect(() => {
    if (!serverStep || !currentStepId) return;
    if (processedSteps.current.has(currentStepId)) return;
    processedSteps.current.add(currentStepId);

    if (currentStepId === 'AWAITING_CITY') {
      trackEvent('chat_start');
      fbqTrack('ViewContent', { content_name: 'chat_started' });
      import('../services/pixel').then(({ logTrackedEvent }) => logTrackedEvent('ChatStarted'));
    }

    const step = serverStep;
    if (step.action?.type === 'open_payment') {
      setTimeout(() => {
        setShowPayment(true);
        trackEvent('checkout');
      }, 500);
      return;
    }

    const processMessages = async () => {
      if (!step.messages) return;
      setInputType('none');
      setActiveOptions(null);

      for (let i = 0; i < step.messages.length; i++) {
        const msg = step.messages[i];
        let status = 'digitando...';
        if (msg.type === 'audio') status = 'gravando áudio...';
        else if (['image', 'image_with_location', 'gif'].includes(msg.type)) status = 'enviando foto...';

        const isFirstGlobalMsg = currentStepId === 'START' && i === 0;
        const duration = isFirstGlobalMsg ? 800 : msg.delay;

        setTypingStatus(status);
        await new Promise(resolve => setTimeout(resolve, duration));
        setTypingStatus(null);

        let content = msg.content;
        let type = msg.type;
        if (typeof content === 'string') {
          content = content.replace('{{city}}', locationData.city || 'sua cidade');
        }
        if (type === 'image_with_location') {
          const city = locationData.city || 'Sua Cidade';
          let baseImage = localStorage.getItem('chat_location_image');
          if (!baseImage) baseImage = await getSetting('chat_location_image');
          if (baseImage) {
            content = await generateImageWithCity(baseImage, city);
          } else {
            content = `${BASE_URL}/generate-image-with-city?cidade=${encodeURIComponent(city)}`;
          }
          type = 'image';
        }

        const newMsg: ChatMessage = {
          id: Math.random().toString(36).substr(2, 9),
          isUser: false,
          type,
          content: content as string,
          timestamp: getCurrentTime()
        };

        try {
          const audio = new Audio(`${AUDIO_BASE_URL}/audios/notification.mp3`);
          audio.volume = 0.4;
          await audio.play().catch(() => {});
        } catch { /* silent */ }

        setMessages(prev => [...prev, newMsg]);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      if (step.response) {
        if (step.response.type === 'buttons' && step.response.options) {
          setActiveOptions(step.response.options);
          setInputType('buttons');
        } else if (step.response.type === 'text') {
          setInputType('text');
        } else if (step.response.type === 'continue') {
          void requestStep('continue');
        }
      }
    };
    void processMessages();
  }, [serverStep, currentStepId, locationData.city, requestStep]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      isUser: true,
      type: 'text',
      content: inputText,
      timestamp: getCurrentTime()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setInputType('none');
    void requestStep('text');
  };

  const handleOptionClick = (option: VisibleOption) => {
    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      isUser: true,
      type: 'text',
      content: option.text,
      timestamp: getCurrentTime()
    };
    setMessages(prev => [...prev, userMsg]);
    setActiveOptions(null);
    setInputType('none');
    void requestStep('choice', option.payload);
  };

  if (showPayment) {
    return <PaymentPanel userCity={locationData.city} userDDD={locationData.ddd} />;
  }

  const isInputVisible = inputType !== 'none';

  return (
    <div
      className="flex justify-center items-center h-[100dvh] bg-[#111b21] overflow-hidden fixed inset-0 select-none"
      onContextMenu={(event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) return;
        event.preventDefault();
      }}
      onCopy={(event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) return;
        event.preventDefault();
      }}
      onDragStartCapture={(event) => {
        if (event.target instanceof HTMLImageElement) event.preventDefault();
      }}
    >
      <div className="w-full sm:max-w-[480px] h-[100dvh] sm:h-[90vh] bg-[#0b141a] relative flex flex-col shadow-2xl sm:rounded-xl overflow-hidden">
        <ChatHeader status={typingStatus || "online"} />
        <div
          className="flex-1 overflow-y-auto p-3 sm:p-4 relative flex flex-col"
          style={{
            backgroundImage: `url("${BACKGROUND_IMAGE}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            WebkitTouchCallout: 'none',
          }}
        >
          <div className="flex justify-center mb-6 shrink-0">
            <div className="bg-[#FFFDE3] text-[#54656F] text-[10px] sm:text-[13px] px-3 py-2 rounded-lg shadow-sm text-center max-w-[90%] shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
              As mensagens e as chamadas são protegidas com a criptografia de ponta a ponta.
            </div>
          </div>
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              id={msg.id}
              type={msg.type}
              content={msg.content}
              isUser={msg.isUser}
              timestamp={msg.timestamp}
              playingAudioId={playingAudioId}
              setPlayingAudioId={setPlayingAudioId}
            />
          ))}
          {typingStatus === 'digitando...' && (
            <div className="flex mb-2 items-end shrink-0 animate-fadeIn">
              <img src={localStorage.getItem('chat_profile_photo') || "https://midia.jdfnu287h7dujn2jndjsifd.com/perfil.webp"} className="w-[30px] h-[30px] rounded-full mr-2" />
              <div className="bg-[#262d31] rounded-[18px] rounded-tl-none p-3 shadow-sm inline-flex items-center gap-1 h-9">
                <span className="w-1.5 h-1.5 bg-[#8c949c] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-[#8c949c] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-[#8c949c] rounded-full animate-bounce"></span>
              </div>
            </div>
          )}
          {inputType === 'buttons' && activeOptions && (
            <div className="flex flex-col w-full gap-2 px-1 mt-2 mb-4 animate-slideIn shrink-0">
              {activeOptions.map((opt, idx) => (
                <button key={idx} onClick={() => handleOptionClick(opt)} className="w-full bg-[#005c4b] text-[#e9edef] py-3.5 rounded-lg font-semibold text-[15px] shadow-md active:scale-[0.99] transition-all">
                  {opt.text}
                </button>
              ))}
            </div>
          )}
          {stepError && (
            <button
              type="button"
              onClick={() => void requestStep(lastRequestRef.current.action, lastRequestRef.current.choice)}
              className="mx-auto my-4 rounded-lg bg-[#005c4b] text-white px-4 py-2 text-sm"
            >
              Conexão instável. Toque para continuar a conversa.
            </button>
          )}
          <div ref={messagesEndRef} />
        </div>
        {inputType === 'text' && (
          <div className="bg-[#202c33] p-2 flex items-center gap-2 shrink-0">
            <div className="flex-1 bg-[#2a3942] rounded-lg flex items-center px-4 py-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Mensagem"
                className="w-full bg-transparent outline-none text-[#d1d7db] select-text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              />
            </div>
            <button onClick={handleSendMessage} className="w-10 h-10 rounded-full bg-[#005c4b] flex items-center justify-center">
              <Send size={20} className="text-[#e9edef]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
