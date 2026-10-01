import React from "react";
import {
  Sliders,
  Clock,
  RotateCcw,
  Zap,
  X,
  SlidersHorizontal,
} from "lucide-react";
import {
  useMusicPlayer,
  EQ_PRESETS,
} from "../context/MusicPlayerContext";

interface AudioEqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AudioEqualizerModal({
  isOpen,
  onClose,
}: AudioEqualizerModalProps) {
  const {
    equalizerBands,
    activePreset,
    bassBoost,
    stereoWidth,
    playbackRate,
    sleepTimerMinutes,
    sleepTimerRemaining,
    setEqualizerGain,
    applyEqualizerPreset,
    setBassBoost,
    setStereoWidth,
    setPlaybackRate,
    setSleepTimer,
  } = useMusicPlayer();

  if (!isOpen) return null;

  const formatSleepTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div
        style={{
          backgroundColor: "var(--theme-surface)",
          borderColor: "var(--theme-border-subtle)",
        }}
        className="w-full max-w-2xl border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div
          style={{ borderColor: "var(--theme-border-subtle)" }}
          className="flex items-center justify-between px-6 py-4 border-b bg-white/5"
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                backgroundColor: "var(--theme-accent)",
                color: "#ffffff",
              }}
              className="w-9 h-9 rounded-2xl flex items-center justify-center shadow-md"
            >
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Audio Equalizer
              </h2>
              <p
                style={{ color: "var(--theme-text-muted)" }}
                className="text-xs"
              >
                10-band equalizer and sound adjustments
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {/* Preset Selector */}
          <div className="space-y-2">
            <div
              style={{ color: "var(--theme-text-muted)" }}
              className="flex items-center justify-between text-xs"
            >
              <span className="font-semibold uppercase tracking-wider text-neutral-300">
                Acoustic Presets
              </span>
              <span>Active: <strong style={{ color: "var(--theme-accent)" }}>{activePreset}</strong></span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {Object.keys(EQ_PRESETS).map((presetKey) => {
                const isActive = activePreset === presetKey;
                return (
                  <button
                    key={presetKey}
                    type="button"
                    onClick={() => applyEqualizerPreset(presetKey)}
                    style={{
                      backgroundColor: isActive ? "var(--theme-accent)" : "rgba(255,255,255,0.05)",
                      color: isActive ? "#ffffff" : "var(--theme-text-muted)",
                      borderColor: isActive ? "var(--theme-border-strong)" : "var(--theme-border-subtle)",
                    }}
                    className="px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer hover:text-white"
                  >
                    {presetKey}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 10-Band Graphic EQ Sliders */}
          <div
            style={{
              backgroundColor: "rgba(0,0,0,0.35)",
              borderColor: "var(--theme-border-subtle)",
            }}
            className="space-y-3 p-5 rounded-2xl border"
          >
            <div
              style={{
                color: "var(--theme-text-muted)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="flex items-center justify-between text-xs pb-2 border-b"
            >
              <span className="font-semibold text-neutral-300">Frequency Curve</span>
              <span className="font-mono text-[11px] tabular-nums">-12dB to +12dB</span>
            </div>

            <div className="grid grid-cols-10 gap-2 sm:gap-4 pt-4 pb-2 items-end h-48">
              {equalizerBands.map((band, idx) => (
                <div key={band.freq} className="flex flex-col items-center gap-2 h-full justify-end">
                  <span
                    style={{ color: "var(--theme-text-accent)" }}
                    className="font-mono text-[10px] tabular-nums font-bold"
                  >
                    {band.gain > 0 ? `+${band.gain}` : band.gain}
                  </span>

                  {/* Vertical Slider Track */}
                  <div className="relative flex-1 flex items-center justify-center w-full">
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={band.gain}
                      onChange={(e) => setEqualizerGain(idx, parseFloat(e.target.value))}
                      className="eq-vertical-slider"
                      style={{
                        transform: "rotate(-90deg)",
                        width: "120px",
                        accentColor: "var(--theme-accent)",
                      }}
                    />
                  </div>

                  <span
                    style={{ color: "var(--theme-text-muted)" }}
                    className="font-mono text-[10px] tracking-tighter truncate w-full text-center"
                  >
                    {band.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bass & Sound Stage Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bass Boost */}
            <div
              style={{
                backgroundColor: "rgba(0,0,0,0.35)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="p-4 rounded-2xl border space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Zap size={14} style={{ color: "var(--theme-accent)" }} />
                  <span>Bass Boost</span>
                </span>
                <span
                  style={{ color: "var(--theme-text-accent)" }}
                  className="font-mono text-xs"
                >
                  +{bassBoost} dB
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={bassBoost}
                onChange={(e) => setBassBoost(parseFloat(e.target.value))}
                style={{ accentColor: "var(--theme-accent)" }}
                className="w-full h-1.5 bg-white/10 rounded-lg cursor-pointer"
              />
            </div>

            {/* Sleep Timer */}
            <div
              style={{
                backgroundColor: "rgba(0,0,0,0.35)",
                borderColor: "var(--theme-border-subtle)",
              }}
              className="p-4 rounded-2xl border space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Clock size={14} style={{ color: "var(--theme-accent)" }} />
                  <span>Sleep Timer</span>
                </span>
                <span
                  style={{ color: "var(--theme-text-accent)" }}
                  className="font-mono text-xs"
                >
                  {sleepTimerRemaining !== null ? formatSleepTime(sleepTimerRemaining) : "Off"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[0, 15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setSleepTimer(mins)}
                    style={{
                      backgroundColor: sleepTimerMinutes === mins ? "var(--theme-accent)" : "rgba(255,255,255,0.06)",
                      color: sleepTimerMinutes === mins ? "#ffffff" : "var(--theme-text-muted)",
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                  >
                    {mins === 0 ? "Off" : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
