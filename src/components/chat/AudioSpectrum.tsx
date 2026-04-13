import React, { useRef, useEffect, useCallback } from 'react';

interface AudioSpectrumProps {
  isPlaying: boolean;
  barCount?: number;
  width?: number;
  height?: number;
}

const AudioSpectrum: React.FC<AudioSpectrumProps> = ({
  isPlaying,
  barCount = 32,
  width = 200,
  height = 28,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const barsRef = useRef<number[]>(new Array(barCount).fill(0));
  const timeRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bars = barsRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const barWidth = Math.max(2, (canvas.width / barCount) - 2);
    const gap = 2;
    timeRef.current += 0.08;

    for (let i = 0; i < barCount; i++) {
      let targetHeight: number;

      if (isPlaying) {
        // Simulate frequency spectrum with varied sine waves
        const t = timeRef.current;
        const freq1 = Math.sin(t * 2.5 + i * 0.4) * 0.5 + 0.5;
        const freq2 = Math.sin(t * 3.7 + i * 0.7) * 0.3 + 0.3;
        const freq3 = Math.sin(t * 1.3 + i * 1.1) * 0.2 + 0.2;
        const bass = i < barCount * 0.3 ? 0.8 : 0.4;
        const mid = (i >= barCount * 0.3 && i < barCount * 0.7) ? 0.7 : 0.3;
        const treble = i >= barCount * 0.7 ? 0.5 : 0.3;
        const envelope = bass * freq1 + mid * freq2 + treble * freq3;
        targetHeight = (envelope * 0.7 + Math.random() * 0.15) * canvas.height;
      } else {
        targetHeight = 0;
      }

      // Smooth animation
      bars[i] += (targetHeight - bars[i]) * 0.25;
      const barHeight = Math.max(2, bars[i]);

      const x = i * (barWidth + gap);
      const y = canvas.height - barHeight;

      // Color gradient based on height
      const intensity = barHeight / canvas.height;
      const r = Math.floor(52 + intensity * 0);
      const g = Math.floor(183 + intensity * 40);
      const b = Math.floor(241 - intensity * 50);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 1);
      ctx.fill();
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [isPlaying, barCount]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  // Draw idle static bars when not playing and animation settles
  useEffect(() => {
    if (isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const timeout = setTimeout(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = Math.max(2, (canvas.width / barCount) - 2);
      const gap = 2;
      for (let i = 0; i < barCount; i++) {
        const h = 2 + Math.sin(i * 0.5) * 4 + 2;
        const x = i * (barWidth + gap);
        const y = canvas.height - h;
        ctx.fillStyle = '#B0B5BA';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, h, 1);
        ctx.fill();
      }
      barsRef.current = new Array(barCount).fill(0);
    }, 600);

    return () => clearTimeout(timeout);
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
