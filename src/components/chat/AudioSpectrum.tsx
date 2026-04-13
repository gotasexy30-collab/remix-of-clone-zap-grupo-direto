import React, { useRef, useEffect } from 'react';

interface AudioSpectrumProps {
  audioElement: HTMLAudioElement | null;
  isPlaying: boolean;
  barCount?: number;
  width?: number;
  height?: number;
}

const AudioSpectrum: React.FC<AudioSpectrumProps> = ({
  audioElement,
  isPlaying,
  barCount = 32,
  width = 200,
  height = 28,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number>(0);
  const barsRef = useRef<number[]>(new Array(barCount).fill(0));

  useEffect(() => {
    if (!audioElement) return;

    // Create or reuse AudioContext
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;

    // Create source only once per audio element
    if (!sourceRef.current) {
      try {
        sourceRef.current = ctx.createMediaElementSource(audioElement);
      } catch {
        // Already connected
        return;
      }
    }

    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.75;
      sourceRef.current.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
    }

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [audioElement]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const bars = barsRef.current;

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);

      if (isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      }

      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = Math.max(2, (canvas.width / barCount) - 2);
      const gap = 2;

      for (let i = 0; i < barCount; i++) {
        // Map bar index to frequency bin
        const freqIndex = Math.floor((i / barCount) * bufferLength);
        const targetHeight = isPlaying
          ? (dataArray[freqIndex] / 255) * canvas.height
          : 0;

        // Smooth animation
        bars[i] += (targetHeight - bars[i]) * 0.3;
        const barHeight = Math.max(2, bars[i]);

        const x = i * (barWidth + gap);
        const y = canvas.height - barHeight;

        // Gradient color based on height
        const intensity = barHeight / canvas.height;
        const r = Math.floor(52 + intensity * 0);
        const g = Math.floor(183 + intensity * 40);
        const b = Math.floor(241 - intensity * 50);
        canvasCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;

        canvasCtx.beginPath();
        canvasCtx.roundRect(x, y, barWidth, barHeight, 1);
        canvasCtx.fill();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, barCount]);

  // Draw idle bars when not playing
  useEffect(() => {
    if (isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    const barWidth = Math.max(2, (canvas.width / barCount) - 2);
    const gap = 2;

    // Draw static idle waveform
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < barCount; i++) {
      const h = 2 + Math.sin(i * 0.5) * 4 + Math.random() * 3;
      const x = i * (barWidth + gap);
      const y = canvas.height - h;
      canvasCtx.fillStyle = '#B0B5BA';
      canvasCtx.beginPath();
      canvasCtx.roundRect(x, y, barWidth, h, 1);
      canvasCtx.fill();
    }
  }, [isPlaying, barCount]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="w-full h-full"
    />
  );
};

export default AudioSpectrum;
