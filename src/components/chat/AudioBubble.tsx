import React, { useState, useRef, useEffect, useMemo } from 'react';

interface AudioBubbleProps {
  id: string;
  src: string;
  isUser: boolean;
  playingAudioId: string | null;
  setPlayingAudioId: (id: string | null) => void;
}

function generateWaveform(id: string, barCount: number): number[] {
  let seed = 0;
  for (let i = 0; i < id.length; i++) {
    seed = ((seed << 5) - seed + id.charCodeAt(i)) | 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    seed = (seed * 16807 + 12345) & 0x7fffffff;
    const base = 0.2 + ((seed % 1000) / 1000) * 0.8;
    const wave = Math.sin(i * 0.4) * 0.15 + Math.sin(i * 0.9) * 0.1;
    bars.push(Math.min(1, Math.max(0.12, base + wave)));
  }
  return bars;
}

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const ThumbOverlay: React.FC<{ waveformRef: React.RefObject<HTMLDivElement>; barIndex: number }> = ({ waveformRef, barIndex }) => {
  const [leftPx, setLeftPx] = useState(0);

  useEffect(() => {
    const container = waveformRef.current;
    if (!container) return;
    const bars = container.querySelectorAll<HTMLDivElement>('[data-bar-index]');
    const bar = bars[barIndex];
    if (bar) {
      const containerRect = container.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      setLeftPx(barRect.left - containerRect.left + barRect.width / 2);
    }
  }, [barIndex, waveformRef]);

  return (
    <div
      className="absolute top-1/2 w-[12px] h-[12px] rounded-full pointer-events-none z-10"
      style={{
        left: `${leftPx}px`,
        transform: 'translate(-50%, -50%)',
        backgroundColor: '#D9DEE0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }}
    />
  );
};

export const AudioBubble: React.FC<AudioBubbleProps> = ({ id, src, isUser, playingAudioId, setPlayingAudioId }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasPlayed, setHasPlayed] = useState(false);

  const isThisPlaying = id === playingAudioId;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const BAR_COUNT = 50;
  const waveform = useMemo(() => generateWaveform(id, BAR_COUNT), [id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      setPlayingAudioId(null);
      setCurrentTime(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
    };
    const onDurationChange = () => {
      if (audio.duration && audio.duration !== Infinity && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onTimeUpdateForDuration = () => {
      // Fallback: some streams only reveal duration during playback
      if (duration === 0 && audio.duration && audio.duration !== Infinity && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('timeupdate', onTimeUpdateForDuration);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('timeupdate', onTimeUpdateForDuration);
    };
  }, [setPlayingAudioId, duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isThisPlaying) {
      setHasPlayed(true);
      audio.play().catch(err => {
        console.error("Erro ao tocar:", err);
        setPlayingAudioId(null);
      });
    } else {
      audio.pause();
    }
  }, [isThisPlaying, setPlayingAudioId]);

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      if (dur !== Infinity && !isNaN(dur)) setDuration(dur);
    }
  };

  const togglePlay = () => {
    if (isThisPlaying) setPlayingAudioId(null);
    else setPlayingAudioId(id);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const time = pct * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const displayTime = isThisPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration);
  const progressBarIndex = Math.min(BAR_COUNT - 1, Math.floor((progressPercent / 100) * BAR_COUNT));

  // Colors matching WhatsApp exactly
  const playedColor = '#34B7F1';
  const unplayedColor = hasPlayed ? '#8696A0' : '#5DB37E';

  return (
    <div className="flex w-full items-center relative rounded-[7.5px] shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] pl-1 pr-2 py-[5px] box-border select-none max-w-full"
      style={{ backgroundColor: '#202C33' }}>
      {/* Tail */}
      <div className="absolute left-[-8px] top-0 w-0 h-0" style={{
        borderTop: '0px solid transparent',
        borderRight: '8px solid #202C33',
        borderBottom: '8px solid transparent',
      }} />

      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      {/* Avatar */}
      <div className="relative shrink-0 w-[46px] h-[46px] mr-1">
        <img
          src="https://midia.jdfnu287h7dujn2jndjsifd.com/perfil.webp"
          alt="Avatar"
          className="w-[46px] h-[46px] rounded-full object-cover"
        />
        <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center"
          style={{ backgroundColor: hasPlayed ? '#34B7F1' : '#25D366' }}>
          <svg viewBox="0 0 19 26" width="10" height="10">
            <path fill="#FFFFFF" d="M9.217,24.401c-1.158,0-2.1-0.941-2.1-2.1v-2.366c-2.646-0.848-4.652-3.146-5.061-5.958L2.004,13.62 l-0.003-0.081c-0.021-0.559,0.182-1.088,0.571-1.492c0.39-0.404,0.939-0.637,1.507-0.637h0.3c0.254,0,0.498,0.044,0.724,0.125v-6.27 C5.103,2.913,7.016,1,9.367,1c2.352,0,4.265,1.913,4.265,4.265v6.271c0.226-0.081,0.469-0.125,0.723-0.125h0.3 c0.564,0,1.112,0.233,1.501,0.64s0.597,0.963,0.571,1.526c0,0.005,0.001,0.124-0.08,0.6c-0.47,2.703-2.459,4.917-5.029,5.748v2.378 c0,1.158-0.942,2.1-2.1,2.1H9.217V24.401z"></path>
            <path fill={hasPlayed ? '#34B7F1' : '#25D366'} d="M9.367,15.668c1.527,0,2.765-1.238,2.765-2.765V5.265c0-1.527-1.238-2.765-2.765-2.765 S6.603,3.738,6.603,5.265v7.638C6.603,14.43,7.84,15.668,9.367,15.668z"></path>
          </svg>
        </div>
      </div>

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className="shrink-0 w-[28px] h-[28px] flex items-center justify-center bg-transparent border-none p-0 cursor-pointer ml-0.5"
      >
        {isThisPlaying ? (
          <svg viewBox="0 0 15 20" width="15" height="20">
            <rect x="1" y="1" width="4.5" height="18" rx="1" fill="#8696A0" />
            <rect x="9.5" y="1" width="4.5" height="18" rx="1" fill="#8696A0" />
          </svg>
        ) : (
          <svg viewBox="0 0 18 20" width="18" height="20">
            <path d="M2 1.5L16 10L2 18.5V1.5Z" fill="#8696A0" />
          </svg>
        )}
      </button>

      {/* Waveform - centered vertically like WhatsApp */}
      <div className="flex flex-col flex-grow ml-2 mr-1 justify-center min-w-0">
        <div
          ref={waveformRef}
          className="relative w-full h-[30px] flex items-center gap-[1px] cursor-pointer"
          onClick={handleSeek}
        >
          {waveform.map((h, i) => {
            const isPast = i <= progressBarIndex;
            const barHeight = Math.max(4, h * 28);
            return (
              <div
                key={i}
                className="flex-1 rounded-full"
                data-bar-index={i}
                style={{
                  height: `${barHeight}px`,
                  minWidth: '2.5px',
                  maxWidth: '3.5px',
                  backgroundColor: isPast ? playedColor : unplayedColor,
                  opacity: isPast ? 1 : 0.85,
                  transition: 'background-color 0.15s',
                }}
              />
            );
          })}
          {/* Seek thumb - stays on top of the current bar */}
          <ThumbOverlay waveformRef={waveformRef} barIndex={progressBarIndex} />
        </div>
        <div className="flex justify-between items-center mt-[1px]">
          <span className="text-[11px] leading-none tabular-nums" style={{ color: '#8696A0' }}>{displayTime}</span>
        </div>
      </div>
    </div>
  );
};
