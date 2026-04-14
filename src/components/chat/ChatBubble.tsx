import React from 'react';
import { AudioBubble } from './AudioBubble';
import { MessageType } from '../../types';

interface ChatBubbleProps {
  id: string;
  type: MessageType;
  content: string | Record<string, unknown>;
  isUser: boolean;
  timestamp: string;
  playingAudioId: string | null;
  setPlayingAudioId: (id: string | null) => void;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  id,
  type,
  content,
  isUser,
  timestamp,
  playingAudioId,
  setPlayingAudioId
}) => {

  if (type === 'audio') {
    if (isUser) return null;
    return (
      <div className="flex mb-2 items-end justify-start">
        <div className="relative w-full max-w-[90%] sm:max-w-[400px]">
          <AudioBubble
            id={id}
            src={content as string}
            isUser={isUser}
            playingAudioId={playingAudioId}
            setPlayingAudioId={setPlayingAudioId}
          />
        </div>
      </div>
    );
  }

  const isMedia = type === 'image' || type === 'gif' || type === 'image_with_location';

  const displayContent = content as string;

  if (isUser) {
    return (
      <div className="flex mb-2 justify-end animate-fadeIn">
        <div className="relative max-w-[80%] bg-[#005c4b] rounded-[18px] rounded-tr-none p-2 px-3 shadow-sm">
          <p className="text-[#e9edef] text-[15px] leading-snug whitespace-pre-wrap break-words">{displayContent}</p>
          <div className="flex justify-end items-center gap-1 mt-0.5">
            <span className="text-[10px] text-white/60">{timestamp}</span>
            <svg viewBox="0 0 16 11" height="11" width="16" fill="none"><path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.011-2.095a.46.46 0 0 0-.329-.149.449.449 0 0 0-.33.149l-.463.462a.498.498 0 0 0 0 .69l2.87 2.994a.46.46 0 0 0 .329.149.449.449 0 0 0 .33-.149l7.075-8.724a.498.498 0 0 0 0-.69l-.596-.349z" fill="#53bdeb"></path></svg>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex mb-2 items-end justify-start animate-fadeIn">
      <img src={localStorage.getItem('chat_profile_photo') || "https://midia.jdfnu287h7dujn2jndjsifd.com/perfil.webp"} className="w-[30px] h-[30px] rounded-full mr-2" />
      <div className={`relative max-w-[80%] bg-[#262d31] rounded-[18px] rounded-tl-none shadow-sm ${isMedia ? 'p-1' : 'p-2 px-3'}`}>
        {isMedia ? (
          <img src={displayContent} className="w-full max-w-[300px] rounded-lg" alt="media" loading="lazy" />
        ) : (
          <p className="text-[#e9edef] text-[15px] leading-snug whitespace-pre-wrap break-words">{displayContent}</p>
        )}
        <div className="flex justify-end items-center mt-0.5 px-1">
          <span className="text-[10px] text-white/60">{timestamp}</span>
        </div>
      </div>
    </div>
  );
};
