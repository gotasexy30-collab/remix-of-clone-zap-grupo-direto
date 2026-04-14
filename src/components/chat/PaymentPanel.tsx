import React, { useState, useEffect, useRef } from 'react';
import { MoreVertical, Video, Phone, Mic, Paperclip, Smile, ShieldCheck } from 'lucide-react';
import { getCurrentTime } from '../../services/location';
import { trackEvent } from '../../services/tracking';
import { getSetting } from '../../services/settings';

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
        timeoutId = setTimeout(() => setShowModal(true), 1500);
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
    trackEvent('h3');
    let link = localStorage.getItem('payment_redirect_link');
    if (!link) {
      link = await getSetting('payment_redirect_link');
    }
    if (link) {
      window.location.href = link;
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
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] z-50 flex items-center justify-center animate-fadeIn">
          <div className="w-full sm:max-w-[480px] bg-white sm:rounded-xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col relative animate-slideIn">
            <div className="overflow-y-auto p-4 sm:p-6">
              <div className="flex flex-col items-center gap-5">
                <div className="text-center">
                  <h2 className="text-lg font-bold text-gray-800 uppercase">🔥 Acesso ao Clube Secreto</h2>
                  <p className="text-gray-500 text-sm">Últimas vagas para sua região!</p>
                  <div className="my-2">
                    <span className="text-xl text-gray-400 line-through mr-2">R$ 29,90</span>
                    <span className="text-4xl font-black text-[#16A349]">R$ 19,00</span>
                  </div>
                </div>
                <button onClick={handleAccessClick} className="w-full bg-[#16A349] text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all text-center">
                  LIBERAR MEU ACESSO AGORA
                </button>
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <ShieldCheck size={14} /> Compra 100% Segura e Sigilosa
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};