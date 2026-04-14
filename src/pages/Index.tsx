import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { DIALOGUE, BASE_URL } from '../constants';
import { ChatMessage, ButtonOption } from '../types';
import { getUserLocation, getCurrentTime } from '../services/location';
import { ChatBubble } from '../components/chat/ChatBubble';
import { ChatHeader } from '../components/chat/ChatHeader';
import { PaymentPanel } from '../components/chat/PaymentPanel';
import { trackEvent } from '../services/tracking';
import { generateImageWithCity } from '../services/imageOverlay';
import { getSetting } from '../services/settings';

const BACKGROUND_IMAGE = 'https://i.pinimg.com/736x/56/ea/b7/56eab7512f1021bdd4cf04952ad45a2c.jpg';

const getSlug = () => window.location.pathname.replace('/painel', '').split('/').filter(p => p).pop() || 'home';

const Index = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStepId, setCurrentStepId] = useState<string>('START');
  const [locationData, setLocationData] = useState<{ city: string; ddd: string }>({ city: '', ddd: '11' });
  const [typingStatus, setTypingStatus] = useState<string | null>(null);
  const [activeOptions, setActiveOptions] = useState<ButtonOption[] | null>(null);
  const [inputText, setInputText] = useState<string>('');
  const [inputType, setInputType] = useState<'text' | 'buttons' | 'none'>('none');
  
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const processedSteps = useRef(new Set<string>());
  const visitTracked = useRef(false);

  useEffect(() => {
    if (!visitTracked.current) {
      trackEvent('h1');
      visitTracked.current = true;
    }
    getUserLocation().then(data => setLocationData(data));
  }, []);

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
    if (!currentStepId || !DIALOGUE[currentStepId]) return;
    if (processedSteps.current.has(currentStepId)) return;
    processedSteps.current.add(currentStepId);

    if (currentStepId === 'AWAITING_CITY') {
      trackEvent('h2');
    }

    const step = DIALOGUE[currentStepId];

    if (step.action) {
      if (step.action.type === 'open_payment') {
        setTimeout(() => {
          setShowPayment(true);
          trackEvent('h3');
        }, 500);
        return;
      }
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
          if (!baseImage) {
            baseImage = await getSetting('chat_location_image');
          }
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
          type: type,
          content: content as string,
          timestamp: getCurrentTime()
        };

        try {
          const audio = new Audio(`${BASE_URL}/audios/notification.mp3`);
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
        } else if (step.response.type === 'continue' && step.response.next) {
          setCurrentStepId(step.response.next);
        }
      }
    };
    processMessages();
  }, [currentStepId, locationData.city]);

  const handleSendMessage = () => {
    if (!inputText.trim()) return;
    const currentStep = DIALOGUE[currentStepId];
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
    if (currentStep.response?.next) setCurrentStepId(currentStep.response.next);
  };

  const handleOptionClick = (option: ButtonOption) => {
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
    setCurrentStepId(option.next);
  };

  if (showPayment) {
    return <PaymentPanel userCity={locationData.city} userDDD={locationData.ddd} />;
  }

  const isInputVisible = inputType !== 'none';

  return (
    <div className="flex justify-center items-center min-h-[100dvh] bg-[#111b21]">
      <div className="w-full sm:max-w-[480px] h-[100dvh] sm:h-[90vh] bg-[#0b141a] relative flex flex-col shadow-2xl sm:rounded-xl overflow-hidden">
        <ChatHeader status={typingStatus || "online"} />
        <div
          className="flex-1 overflow-y-auto p-3 sm:p-4 relative flex flex-col"
          style={{
            backgroundImage: `url("${BACKGROUND_IMAGE}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
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
          <div ref={messagesEndRef} />
        </div>
        {inputType === 'text' && (
          <div className="bg-[#202c33] p-2 flex items-center gap-2 shrink-0">
            <div className="flex-1 bg-[#2a3942] rounded-lg flex items-center px-4 py-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Mensagem"
                className="w-full bg-transparent outline-none text-[#d1d7db]"
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
