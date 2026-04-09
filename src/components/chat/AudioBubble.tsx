import React, { useState, useRef, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface AudioBubbleProps {
  id: string;
  src: string;
  isUser: boolean;
  playingAudioId: string | null;
  setPlayingAudioId: (id: string | null) => void;
}

const PlayIcon = () => (
  <svg viewBox="0 0 34 34" height="34" width="34">
    <path fill="#8c949c" d="M8.5,8.7c0-1.7,1.2-2.4,2.6-1.5l14.4,8.3c1.4,0.8,1.4,2.2,0,3l-14.4,8.3 c-1.4,0.8-2.6,0.2-2.6-1.5V8.7z"></path>
  </svg>
);

const PauseIcon = () => (
  <div className="w-[30px] h-[30px] rounded flex items-center justify-center bg-transparent border-2 border-[#8c949c]/30">
    <svg viewBox="0 0 24 24" height="16" width="16" fill="#8c949c">
       <rect x="6" y="4" width="4" height="16" rx="1" />
       <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  </div>
);

const MicrophoneIcon = ({ color }: { color: string }) => (
  <div style={{ color }} className="z-10 flex items-end justify-end pb-1 pr-2 transition-colors duration-300">
      <svg viewBox="0 0 19 26" width="20" height="20">
        <path fill="#FFFFFF" d="M9.217,24.401c-1.158,0-2.1-0.941-2.1-2.1v-2.366c-2.646-0.848-4.652-3.146-5.061-5.958L2.004,13.62 l-0.003-0.081c-0.021-0.559,0.182-1.088,0.571-1.492c0.39-0.404,0.939-0.637,1.507-0.637h0.3c0.254,0,0.498,0.044,0.724,0.125v-6.27 C5.103,2.913,7.016,1,9.367,1c2.352,0,4.265,1.913,4.265,4.265v6.271c0.226-0.081,0.469-0.125,0.723-0.125h0.3 c0.564,0,1.112,0.233,1.501,0.64s0.597,0.963,0.571,1.526c0,0.005,0.001,0.124-0.08,0.6c-0.47,2.703-2.459,4.917-5.029,5.748v2.378 c0,1.158-0.942,2.1-2.1,2.1H9.217V24.401z"></path>
        <path fill="currentColor" d="M9.367,15.668c1.527,0,2.765-1.238,2.765-2.765V5.265c0-1.527-1.238-2.765-2.765-2.765 S6.603,3.738,6.603,5.265v7.638C6.603,14.43,7.84,15.668,9.367,15.668z M14.655,12.91h-0.3c-0.33,0-0.614,0.269-0.631,0.598 c0,0,0,0-0.059,0.285c-0.41,1.997-2.182,3.505-4.298,3.505c-2.126,0-3.904-1.521-4.304-3.531C5.008,13.49,5.008,13.49,5.008,13.49 c-0.016-0.319-0.299-0.579-0.629-0.579h-0.3c-0.33,0-0.591,0.258-0.579,0.573c0,0,0,0,0.04,0.278 c0.378,2.599,2.464,4.643,5.076,4.978v3.562c0,0.33,0.27,0.6,0.6,0.6h0.3c0.33,0,0.6-0.27,0.6-0.6V18.73 c2.557-0.33,4.613-2.286,5.051-4.809c0.057-0.328,0.061-0.411,0.061-0.411C15.243,13.18,14.985,12.91,14.655,12.91z"></path>
      </svg>
  </div>
);

function formatTime(seconds: number) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const AudioBubble: React.FC<AudioBubbleProps> = ({ id, src, isUser, playingAudioId, setPlayingAudioId }) => {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [micColor, setMicColor] = useState('#0cd464');
  const [progressPercent, setProgressPercent] = useState(0);

  const isThisPlaying = id === playingAudioId;

  useEffect(() => {
    if (waveformRef.current && audioRef.current && !wavesurferRef.current) {
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        media: audioRef.current,
        waveColor: '#B0B5BA',
        progressColor: '#34B7F1',
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        height: 28,
        cursorWidth: 0,
        normalize: true,
        interact: false,
      });

      wavesurferRef.current = wavesurfer;

      wavesurfer.on('finish', () => {
        setPlayingAudioId(null);
        setMicColor('#0cd464');
        setCurrentTime(0);
        setProgressPercent(0);
        if (audioRef.current) audioRef.current.currentTime = 0;
      });

      return () => {
        wavesurfer.destroy();
        wavesurferRef.current = null;
      };
    }
  }, [src, setPlayingAudioId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      if (isThisPlaying) {
        audio.play().then(() => {
          setMicColor('#34b7f1');
        }).catch(err => {
          console.error("Erro ao tocar:", err);
          setPlayingAudioId(null);
        });
      } else {
        audio.pause();
        if (audio.currentTime > 0 && !audio.ended) {
          setMicColor('#34b7f1');
        } else {
          setMicColor('#0cd464');
        }
      }
    }
  }, [isThisPlaying, setPlayingAudioId]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const curr = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      setCurrentTime(curr);
      if (dur > 0) {
        setProgressPercent((curr / dur) * 100);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const dur = audioRef.current.duration;
      if (dur !== Infinity && !isNaN(dur)) {
        setDuration(dur);
      }
    }
  };

  const togglePlay = () => {
    if (isThisPlaying) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(id);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      if (duration > 0) {
        setProgressPercent((time / duration) * 100);
      }
    }
  };

  return (
    <div className="flex w-full items-center relative h-[62px] bg-[#262D31] rounded-[10px] shadow-sm pl-2 pr-1 py-2 box-border select-none max-w-full group">
      <div className="absolute left-[-8px] top-0 w-3 h-3 bg-[#262D31] transform rotate-45 z-0" />

      <audio
        ref={audioRef}
        src={src}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      <div className="relative z-10 shrink-0">
        <img
          src="https://midia.jdfnu287h7dujn2jndjsifd.com/perfil.webp"
          alt="Avatar"
          className="w-[44px] h-[44px] rounded-full object-cover"
        />
      </div>

      <div className="z-10 shrink-0 ml-2">
        <button
          onClick={togglePlay}
          className="w-[30px] h-[30px] flex items-center justify-center bg-transparent border-none p-0 cursor-pointer text-[#8c949c]"
        >
          {isThisPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
      </div>

      <div className="flex flex-col flex-grow ml-3 mr-2 justify-center min-w-0 z-10 h-full relative">
        <div className="relative w-full h-[28px] flex items-center">
          <div ref={waveformRef} className="w-full h-full opacity-80 pointer-events-none" />
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
          />
          <div
            className="absolute top-1/2 w-[13px] h-[13px] bg-[#34B7F1] rounded-full border border-black/10 shadow-sm pointer-events-none transition-all duration-75 ease-linear z-20"
            style={{
              left: `${progressPercent}%`,
              transform: 'translate(-50%, -50%)',
              opacity: duration > 0 ? 1 : 0
            }}
          />
        </div>
        <div className="flex justify-between items-center text-[11px] text-[#8c949c] mt-0.5 leading-none w-full tabular-nums">
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
      </div>

      <MicrophoneIcon color={micColor} />
    </div>
  );
};
