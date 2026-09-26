import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Upload,
  Music,
  Sliders,
  Check,
  Radio,
  HelpCircle,
  Play,
  Square,
  ShieldCheck,
  Mic,
  Camera,
  Video,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  VOICE_FILTERS,
  BACKGROUND_SOUNDS,
  CAMERA_EFFECTS,
  VoiceFilterId,
  BackgroundSoundId,
  CameraEffectId,
  globalVoiceProcessor,
  getSavedCustomBackgroundData,
  getSavedCameraEffect,
  saveCameraEffect,
} from "../lib/voice-processor";

export type CallAnimMode = "nervous" | "goof" | "pulse" | "none";

export function getSavedCallAnimMode(): CallAnimMode {
  try {
    const saved = localStorage.getItem("frosted_call_anim_mode");
    if (saved === "nervous" || saved === "goof" || saved === "pulse" || saved === "none") {
      return saved;
    }
  } catch {}
  return "nervous";
}

export function saveCallAnimMode(mode: CallAnimMode) {
  try {
    localStorage.setItem("frosted_call_anim_mode", mode);
  } catch {}
}

export const CALL_ANIM_OPTIONS: { id: CallAnimMode; name: string; icon: string; desc: string }[] = [
  {
    id: "nervous",
    name: "Nervous Vibration",
    icon: "📳",
    desc: "Rapid 0.15s micro-jitter shake & rotation",
  },
  {
    id: "goof",
    name: "Goof Rubbery Wobble",
    icon: "🤪",
    desc: "Elastic cartoon squash & stretch bounce",
  },
  {
    id: "pulse",
    name: "Gentle Pulse",
    icon: "💓",
    desc: "Smooth scaling rhythmic ring indicator",
  },
  {
    id: "none",
    name: "Standard Quiet",
    icon: "⏹️",
    desc: "Static avatar frame without motion",
  },
];

interface VoiceEffectsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceEffectsModal({ isOpen, onClose }: VoiceEffectsModalProps) {
  const [activeTab, setActiveTab] = useState<"voice" | "camera" | "anim" | "bg">("voice");

  const [activeFilter, setActiveFilter] = useState<VoiceFilterId>(() =>
    globalVoiceProcessor.getFilter()
  );
  const [activeBgSound, setActiveBgSound] = useState<BackgroundSoundId>(() =>
    globalVoiceProcessor.getBackgroundSound()
  );
  const [activeCameraFx, setActiveCameraFx] = useState<CameraEffectId>(() =>
    getSavedCameraEffect()
  );
  const [activeAnimMode, setActiveAnimMode] = useState<CallAnimMode>(() =>
    getSavedCallAnimMode()
  );

  const [bgVolume, setBgVolume] = useState<number>(() =>
    globalVoiceProcessor.getBackgroundVolume()
  );
  const [isMonitoring, setIsMonitoring] = useState<boolean>(() =>
    globalVoiceProcessor.isVoiceMonitoring()
  );

  const [customBgData, setCustomBgData] = useState<{ url: string; name: string }>(() =>
    getSavedCustomBackgroundData()
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveFilter(globalVoiceProcessor.getFilter());
      setActiveBgSound(globalVoiceProcessor.getBackgroundSound());
      setActiveCameraFx(getSavedCameraEffect());
      setActiveAnimMode(getSavedCallAnimMode());
      setBgVolume(globalVoiceProcessor.getBackgroundVolume());
      setIsMonitoring(globalVoiceProcessor.isVoiceMonitoring());
      setCustomBgData(getSavedCustomBackgroundData());
    }
  }, [isOpen]);

  const handleSelectFilter = (filterId: VoiceFilterId) => {
    setActiveFilter(filterId);
    globalVoiceProcessor.setFilter(filterId);
  };

  const handleSelectBgSound = (bgId: BackgroundSoundId) => {
    setActiveBgSound(bgId);
    if (bgId === "custom" && !customBgData.url) {
      fileInputRef.current?.click();
    } else {
      globalVoiceProcessor.setBackgroundSound(bgId);
    }
  };

  const handleSelectCameraFx = (camId: CameraEffectId) => {
    setActiveCameraFx(camId);
    saveCameraEffect(camId);
    window.dispatchEvent(new CustomEvent("frosted_camera_fx_changed", { detail: camId }));
  };

  const handleSelectAnimMode = (animId: CallAnimMode) => {
    setActiveAnimMode(animId);
    saveCallAnimMode(animId);
    window.dispatchEvent(new CustomEvent("frosted_call_anim_changed", { detail: animId }));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setBgVolume(val);
    globalVoiceProcessor.setBackgroundVolume(val);
  };

  const handleToggleMonitoring = () => {
    const next = !isMonitoring;
    setIsMonitoring(next);
    globalVoiceProcessor.setMonitoring(next);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const fileName = file.name;

    setCustomBgData({ url: objectUrl, name: fileName });
    setActiveBgSound("custom");
    globalVoiceProcessor.setCustomBackgroundTrack(objectUrl, fileName);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-2xl max-h-[90vh] rounded-3xl border border-white/15 bg-neutral-900/95 text-white shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-neutral-950/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Call Effects & Audio Studio</span>
              </h2>
              <p className="text-xs text-neutral-400">
                Voice filters, camera backgrounds, call animations & soundscapes
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-6 pt-3 pb-2 border-b border-white/10 bg-neutral-950/30 flex items-center gap-2 overflow-x-auto custom-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("voice")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "voice"
                ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                : "bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Radio size={13} />
            <span>Voice Modulation</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("camera")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "camera"
                ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                : "bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Camera size={13} />
            <span>Camera & Blur</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("anim")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "anim"
                ? "bg-purple-500 text-white shadow-md shadow-purple-500/20"
                : "bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Activity size={13} />
            <span>Call Motion FX</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bg")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              activeTab === "bg"
                ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                : "bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Music size={13} />
            <span>Audio Ambiance</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-scrollbar">
          {/* TAB 1: VOICE MODULATION */}
          {activeTab === "voice" && (
            <div className="space-y-4">
              {/* Test Voice Monitor Toggle */}
              <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Mic size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-300">Test My Voice (Mic Monitor)</div>
                    <div className="text-[11px] text-neutral-300">
                      Listen to your live voice modulation filter & background sound in headphones
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleMonitoring}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md ${
                    isMonitoring
                      ? "bg-emerald-500 text-black shadow-emerald-500/30"
                      : "bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700"
                  }`}
                >
                  {isMonitoring ? "Monitoring On" : "Listen Live"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {VOICE_FILTERS.map((filter) => {
                  const isSelected = activeFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => handleSelectFilter(filter.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex items-start gap-3 ${
                        isSelected
                          ? "border-amber-500/80 bg-amber-500/10 shadow-lg shadow-amber-500/10 text-white"
                          : "border-white/10 bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      <span className="text-2xl shrink-0">{filter.icon}</span>
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white">{filter.name}</span>
                          {filter.badge && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 uppercase">
                              {filter.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                          {filter.description}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-amber-500 text-black flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CAMERA & BLUR EFFECTS */}
          {activeTab === "camera" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <Camera size={14} />
                  <span>Video Call Camera Effects & Backgrounds</span>
                </h3>
                <span className="text-[11px] text-neutral-400 font-medium">Applied to camera feed</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CAMERA_EFFECTS.map((cam) => {
                  const isSelected = activeCameraFx === cam.id;
                  return (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => handleSelectCameraFx(cam.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative flex items-center gap-3 ${
                        isSelected
                          ? "border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/10 text-white"
                          : "border-white/10 bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-2xl shrink-0">
                        {cam.icon}
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white">{cam.name}</span>
                          {cam.badge && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 uppercase">
                              {cam.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                          {cam.description}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: CALL MOTION FX */}
          {activeTab === "anim" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Activity size={14} />
                  <span>Call UI Animation Loop</span>
                </h3>
                <span className="text-[11px] text-neutral-400 font-medium">Applied to call avatars</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CALL_ANIM_OPTIONS.map((opt) => {
                  const isSelected = activeAnimMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectAnimMode(opt.id)}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex items-center gap-3.5 ${
                        isSelected
                          ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/10 text-white"
                          : "border-white/10 bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-2xl bg-neutral-800 border border-white/10 flex items-center justify-center text-2xl shrink-0 ${
                          opt.id === "nervous"
                            ? "animate-nervous"
                            : opt.id === "goof"
                            ? "animate-goof"
                            : opt.id === "pulse"
                            ? "animate-pulse"
                            : ""
                        }`}
                      >
                        {opt.icon}
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <span className="font-bold text-xs text-white block">{opt.name}</span>
                        <p className="text-[11px] text-neutral-400 mt-0.5 leading-snug">
                          {opt.desc}
                        </p>
                      </div>

                      {isSelected && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: AUDIO AMBIANCE */}
          {activeTab === "bg" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Music size={14} />
                  <span>Background Ambiance & Audio</span>
                </h3>
                <span className="text-[11px] text-neutral-400 font-medium">Mixed behind your voice</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {BACKGROUND_SOUNDS.map((bg) => {
                  const isSelected = activeBgSound === bg.id;
                  return (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() => handleSelectBgSound(bg.id)}
                      className={`p-3 rounded-2xl border text-center transition-all cursor-pointer relative flex flex-col items-center justify-center gap-1.5 ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/10 text-white"
                          : "border-white/10 bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      <span className="text-2xl">{bg.icon}</span>
                      <span className="font-bold text-xs text-white truncate w-full">{bg.name}</span>

                      {isSelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 text-black flex items-center justify-center">
                          <Check size={10} strokeWidth={3} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom Track File Upload Area */}
              <input
                type="file"
                ref={fileInputRef}
                accept="audio/*"
                className="hidden"
                onChange={handleFileUpload}
              />

              <div className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                    <Upload size={15} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {customBgData.name || "Upload Custom Audio File"}
                    </div>
                    <div className="text-[10px] text-neutral-400">MP3, WAV, OGG, or M4A audio</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold transition-all cursor-pointer border border-cyan-500/30 shrink-0"
                >
                  Choose File
                </button>
              </div>

              {/* Background Volume Slider */}
              {activeBgSound !== "none" && (
                <div className="p-4 rounded-2xl border border-white/10 bg-white/[0.02] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-200">
                    <span className="flex items-center gap-1.5">
                      <Volume2 size={14} className="text-emerald-400" />
                      <span>Background Ambiance Volume</span>
                    </span>
                    <span className="text-emerald-400">{Math.round(bgVolume * 100)}%</span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={bgVolume}
                    onChange={handleVolumeChange}
                    className="w-full h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-neutral-950/50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Active call effects process in real time on WebRTC</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
