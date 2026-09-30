import React from "react";
import {
  Sliders,
  Sparkles,
  Volume2,
  Clock,
  RotateCcw,
  Zap,
  Radio,
  X,
  Compass,
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
      <div className="w-full max-w-2xl bg-[#11131c] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sliders size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Studio Audio Equalizer & FX</span>
              </h2>
              <p className="text-xs text-neutral-400">
                10-band parametric EQ, bass enhancement, and spatial sound stage
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
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="font-bold uppercase tracking-wider text-neutral-300">
                Acoustic Profile Presets
              </span>
              <span>Active: <strong className="text-indigo-400">{activePreset}</strong></span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {Object.keys(EQ_PRESETS).map((presetKey) => {
                const isActive = activePreset === presetKey;
                return (
                  <button
                    key={presetKey}
                    type="button"
                    onClick={() => applyEqualizerPreset(presetKey)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30"
                        : "bg-white/5 border-white/5 text-neutral-400 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {presetKey}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 10-Band Graphic EQ Sliders */}
          <div className="space-y-3 bg-[#0a0c14] p-5 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between text-xs text-neutral-400 pb-2 border-b border-white/5">
              <span className="font-semibold text-neutral-300">10-Band Frequency Curve</span>
              <span className="font-mono text-[11px] tabular-nums text-neutral-400">-12dB &harr; +12dB</span>
            </div>

            <div className="grid grid-cols-10 gap-2 sm:gap-4 pt-4 pb-2 items-end h-48">
              {equalizerBands.map((band, idx) => {
                const isBoosted = band.gain > 0;
                const isCut = band.gain < 0;

                return (
                  <div key={band.freq} className="flex flex-col items-center gap-2 h-full justify-end">
                    <span className="font-mono text-[10px] tabular-nums text-indigo-300 font-bold">
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
                        }}
                      />
                    </div>

                    <span className="font-mono text-[10px] text-neutral-400 tracking-tighter truncate w-full text-center">
                      {band.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => applyEqualizerPreset("Flat")}
                className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset to Flat</span>
              </button>
            </div>
          </div>

          {/* Master Sound Enhancements: Bass Boost & Stereo Width */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bass Boost */}
            <div className="bg-[#0a0c14] p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-200 flex items-center gap-1.5">
                  <Zap size={14} className="text-indigo-400" />
                  <span>Sub-Bass Enhancement</span>
                </span>
                <span className="font-mono text-indigo-300 font-bold tabular-nums">
                  {bassBoost}/10
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={bassBoost}
                onChange={(e) => setBassBoost(parseInt(e.target.value, 10))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <p className="text-[11px] text-neutral-400">
                Low-shelf acoustic warmth emphasizing 40Hz-90Hz punch.
              </p>
            </div>

            {/* Stereo Stage Panner */}
            <div className="bg-[#0a0c14] p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-200 flex items-center gap-1.5">
                  <Compass size={14} className="text-cyan-400" />
                  <span>Stereo Balance</span>
                </span>
                <span className="font-mono text-cyan-300 font-bold tabular-nums">
                  {stereoWidth === 0
                    ? "Center"
                    : stereoWidth < 0
                    ? `${Math.abs(Math.round(stereoWidth * 100))}% Left`
                    : `${Math.round(stereoWidth * 100)}% Right`}
                </span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={stereoWidth}
                onChange={(e) => setStereoWidth(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
              <p className="text-[11px] text-neutral-400">
                Binaural stereo positioning across left and right monitors.
              </p>
            </div>
          </div>

          {/* Playback Speed & Sleep Timer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Speed & Pitch */}
            <div className="bg-[#0a0c14] p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-200 flex items-center gap-1.5">
                  <Clock size={14} className="text-emerald-400" />
                  <span>Speed & Tempo</span>
                </span>
                <span className="font-mono text-emerald-300 font-bold tabular-nums">
                  {playbackRate.toFixed(2)}x
                </span>
              </div>
              <div className="flex items-center gap-2">
                {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                    className={`flex-1 py-1 rounded-lg border text-[11px] font-mono font-bold transition-all cursor-pointer ${
                      playbackRate === rate
                        ? "bg-emerald-600 border-emerald-500 text-white"
                        : "bg-white/5 border-white/5 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>

            {/* Sleep Timer */}
            <div className="bg-[#0a0c14] p-4 rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-neutral-200 flex items-center gap-1.5">
                  <Clock size={14} className="text-purple-400" />
                  <span>Sleep Timer</span>
                </span>
                {sleepTimerRemaining !== null && (
                  <span className="font-mono text-purple-300 font-bold tabular-nums">
                    {formatSleepTime(sleepTimerRemaining)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setSleepTimer(mins)}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer ${
                      sleepTimerMinutes === mins
                        ? "bg-purple-600 border-purple-500 text-white"
                        : "bg-white/5 border-white/5 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
                {sleepTimerMinutes !== null && (
                  <button
                    type="button"
                    onClick={() => setSleepTimer(null)}
                    className="px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-500/15 text-red-300 text-[11px] font-bold hover:bg-red-500/25 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
}
