import React, { useRef, useEffect, useState } from "react";
import { useMusicPlayer } from "../context/MusicPlayerContext";

export type VisualizerMode = "spectrum" | "waveform" | "circular" | "ambient";

interface MusicVisualizerProps {
  mode?: VisualizerMode;
  className?: string;
  height?: number;
  interactive?: boolean;
}

export default function MusicVisualizer({
  mode = "spectrum",
  className = "",
  height = 180,
  interactive = false,
}: MusicVisualizerProps) {
  const { analyserNode, isPlaying } = useMusicPlayer();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentMode, setCurrentMode] = useState<VisualizerMode>(mode);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    setCurrentMode(mode);
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isRunning = true;
    const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 128;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    // Peak levels for spectrum bars
    const peaks = new Float32Array(64);
    let rotationAngle = 0;

    const render = () => {
      if (!isRunning) return;

      const width = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, width, h);

      if (analyserNode && isPlaying) {
        analyserNode.getByteFrequencyData(freqData);
        analyserNode.getByteTimeDomainData(timeData);
      } else {
        // Subtle simulated idle breath when paused
        const time = Date.now() * 0.002;
        for (let i = 0; i < 64; i++) {
          freqData[i] = Math.max(4, Math.sin(time + i * 0.15) * 12 + 14);
          timeData[i] = 128 + Math.sin(time + i * 0.2) * 6;
        }
      }

      if (currentMode === "spectrum") {
        const barCount = 48;
        const barSpacing = 4;
        const totalSpacing = barSpacing * (barCount - 1);
        const barWidth = Math.max(2, (width - totalSpacing) / barCount);

        for (let i = 0; i < barCount; i++) {
          const sampleIndex = Math.floor((i / barCount) * (freqData.length * 0.65));
          const val = freqData[sampleIndex] || 0;
          const normalized = val / 255;
          const barHeight = Math.max(3, normalized * (h - 12));

          // Peak falloff
          if (barHeight > (peaks[i] || 0)) {
            peaks[i] = barHeight;
          } else {
            peaks[i] = Math.max(0, (peaks[i] || 0) - 0.75);
          }

          const x = i * (barWidth + barSpacing);
          const y = h - barHeight;

          // Gradient for bar
          const grad = ctx.createLinearGradient(0, h, 0, y);
          grad.addColorStop(0, "rgba(56, 189, 248, 0.25)");
          grad.addColorStop(0.6, "rgba(99, 102, 241, 0.85)");
          grad.addColorStop(1, "rgba(236, 72, 153, 0.95)");

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
          ctx.fill();

          // Peak dot
          const peakY = h - (peaks[i] || 0) - 2;
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fillRect(x, Math.max(0, peakY), barWidth, 2);
        }
      } else if (currentMode === "waveform") {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(56, 189, 248, 0.9)";
        ctx.shadowColor = "rgba(56, 189, 248, 0.6)";
        ctx.shadowBlur = 8;

        ctx.beginPath();
        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0;
          const y = (v * h) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, h / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (currentMode === "circular") {
        const centerX = width / 2;
        const centerY = h / 2;
        const radius = Math.min(centerX, centerY) * 0.45;
        const bars = 48;
        rotationAngle += 0.005;

        // Bass energy calculation for core pulse
        let bassSum = 0;
        for (let i = 0; i < 8; i++) bassSum += freqData[i];
        const bassAvg = (bassSum / 8) / 255;
        const currentRadius = radius + bassAvg * 16;

        // Inner glowing core
        const coreGrad = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, currentRadius);
        coreGrad.addColorStop(0, `rgba(99, 102, 241, ${0.4 + bassAvg * 0.4})`);
        coreGrad.addColorStop(1, "rgba(15, 23, 42, 0)");
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
        ctx.fill();

        // Radiating spikes
        for (let i = 0; i < bars; i++) {
          const angle = (i / bars) * Math.PI * 2 + rotationAngle;
          const sampleIndex = Math.floor((i / bars) * (freqData.length * 0.5));
          const val = (freqData[sampleIndex] || 0) / 255;
          const spikeLength = Math.max(4, val * (radius * 0.85));

          const x1 = centerX + Math.cos(angle) * currentRadius;
          const y1 = centerY + Math.sin(angle) * currentRadius;
          const x2 = centerX + Math.cos(angle) * (currentRadius + spikeLength);
          const y2 = centerY + Math.sin(angle) * (currentRadius + spikeLength);

          ctx.strokeStyle = `hsl(${(i * 360) / bars + 180}, 90%, 65%)`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      } else if (currentMode === "ambient") {
        let energy = 0;
        for (let i = 0; i < 32; i++) energy += freqData[i];
        const normalizedEnergy = (energy / 32) / 255;

        const grad = ctx.createRadialGradient(
          width / 2,
          h / 2,
          10,
          width / 2,
          h / 2,
          Math.max(width, h) * 0.65
        );
        grad.addColorStop(0, `rgba(147, 51, 234, ${0.25 + normalizedEnergy * 0.5})`);
        grad.addColorStop(0.5, `rgba(59, 130, 246, ${0.15 + normalizedEnergy * 0.3})`);
        grad.addColorStop(1, "rgba(10, 15, 30, 0)");

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, h);

        // Ambient floating frequency bars
        const waveBars = 32;
        const wStep = width / waveBars;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + normalizedEnergy * 0.35})`;
        for (let i = 0; i < waveBars; i++) {
          const val = (freqData[i * 2] || 0) / 255;
          const barH = val * (h * 0.5);
          ctx.fillRect(i * wStep + 2, h / 2 - barH / 2, wStep - 4, barH);
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyserNode, isPlaying, currentMode]);

  return (
    <div className={`relative flex flex-col items-center justify-center overflow-hidden rounded-2xl ${className}`}>
      <canvas
        ref={canvasRef}
        width={640}
        height={height}
        className="w-full h-full object-cover pointer-events-none"
      />

      {interactive && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-1 rounded-xl border border-white/10 text-[11px] font-bold z-10">
          {(["spectrum", "waveform", "circular", "ambient"] as VisualizerMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setCurrentMode(m)}
              className={`px-2 py-0.5 rounded-lg capitalize transition-colors cursor-pointer ${
                currentMode === m
                  ? "bg-white/20 text-white font-bold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
