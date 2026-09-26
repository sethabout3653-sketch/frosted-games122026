import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Wand2,
  Sliders,
  Check,
  Zap,
  Image as ImageIcon,
  Activity,
  VideoOff,
  Minus,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import NervousCanvasFilter from "./NervousCanvasFilter";

export type CallTab = "effects" | "filters" | "backgrounds";

export interface CallFilterState {
  effect: string; // 'none' | 'nervous'
  filter: string; // 'none'
  background: string; // 'none'
}

const STORAGE_KEY = "frosted_call_filter_settings";

export function getSavedCallFilters(): CallFilterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { effect: "nervous", filter: "none", background: "none" };
}

export function saveCallFilters(state: CallFilterState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent("call_filters_changed", { detail: state }));
  } catch (e) {}
}

interface CallFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: CallTab;
}

export default function CallFiltersModal({
  isOpen,
  onClose,
  initialTab = "effects",
}: CallFiltersModalProps) {
  const [activeTab, setActiveTab] = useState<CallTab>(initialTab);
  const [filterState, setFilterState] = useState<CallFilterState>(() => getSavedCallFilters());
  const [cameraActive, setCameraActive] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFilterState(getSavedCallFilters());
      setActiveTab(initialTab);
      
      // Attempt camera access for real-time live video preview
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 640, height: 480 } })
        .then((stream) => {
          mediaStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
          setCameraActive(true);
        })
        .catch(() => {
          setCameraActive(false);
        });
    } else {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      setCameraActive(false);
    }

    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [isOpen, initialTab]);

  const handleSelectEffect = (id: string) => {
    const updated = { ...filterState, effect: id };
    setFilterState(updated);
    saveCallFilters(updated);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          id="call-filters-modal"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-lg rounded-3xl border border-white/15 bg-neutral-900/95 text-white shadow-2xl backdrop-blur-2xl overflow-hidden flex flex-col max-h-[90vh]"
          style={{
            boxShadow: "0 25px 60px -15px rgba(0,0,0,0.8), 0 0 35px rgba(245,158,11,0.15)",
          }}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-neutral-950/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
                <Wand2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Camera Effects</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Real-time pixel displacement filter</p>
              </div>
            </div>

            <button
              id="close-call-filters-btn"
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs: Effects, Filters, Backgrounds */}
          <div className="p-2 bg-neutral-950/80 border-b border-white/10 grid grid-cols-3 gap-1 px-4">
            <button
              id="call-tab-effects"
              type="button"
              onClick={() => setActiveTab("effects")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "effects"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Zap size={14} className={activeTab === "effects" ? "text-amber-400" : ""} />
              <span>• Effects</span>
            </button>

            <button
              id="call-tab-filters"
              type="button"
              onClick={() => setActiveTab("filters")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "filters"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Sliders size={14} className={activeTab === "filters" ? "text-amber-400" : ""} />
              <span>Filters</span>
            </button>

            <button
              id="call-tab-backgrounds"
              type="button"
              onClick={() => setActiveTab("backgrounds")}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "backgrounds"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-neutral-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <ImageIcon size={14} className={activeTab === "backgrounds" ? "text-amber-400" : ""} />
              <span>Backgrounds</span>
            </button>
          </div>

          {/* Real-time Video Camera Preview Area */}
          <div className="p-4 bg-neutral-950/70 border-b border-white/5 flex flex-col items-center justify-center gap-3">
            <div className="relative w-full max-w-xs h-48 sm:h-56 rounded-2xl border-2 border-amber-500/50 bg-black overflow-hidden shadow-2xl flex items-center justify-center">
              {/* Underlying Camera Stream Video Element */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${
                  filterState.effect === "nervous" ? "hidden" : ""
                } ${!cameraActive ? "hidden" : ""}`}
              />

              {/* Real Mathematical Pixel Warp Canvas Filter */}
              {cameraActive && (
                <NervousCanvasFilter
                  videoRef={videoRef}
                  isActive={filterState.effect === "nervous"}
                />
              )}

              {/* Fallback Preview if camera offline */}
              {!cameraActive && (
                <div className="relative w-full h-full flex items-center justify-center bg-neutral-900">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80"
                    alt="Camera Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Status Badge */}
              <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md border border-white/10 text-[10px] text-white">
                {cameraActive ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Camera</span>
                  </>
                ) : (
                  <>
                    <VideoOff size={12} className="text-amber-400" />
                    <span>Webcam Standby</span>
                  </>
                )}
              </div>
            </div>

            {/* Circular Icon Selector matching Screenshot */}
            <div className="w-full pt-1 flex items-center justify-center gap-4 py-1">
              {/* Off / None Button */}
              <button
                type="button"
                onClick={() => handleSelectEffect("none")}
                className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                  filterState.effect === "none"
                    ? "bg-neutral-800 ring-2 ring-amber-400 ring-offset-2 ring-offset-neutral-900 scale-105"
                    : "bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400"
                }`}
                title="Turn off filter"
              >
                <Minus size={20} className="text-white" />
              </button>

              {/* NERVOUS FILTER BUTTON (YELLOW EMOJI & FLOATING BADGE) */}
              <div className="relative flex flex-col items-center">
                {filterState.effect === "nervous" && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -top-7 bg-neutral-900/90 text-white border border-white/20 font-bold text-[10px] px-3 py-0.5 rounded-full shadow-lg backdrop-blur-md pointer-events-none whitespace-nowrap"
                  >
                    Nervous
                  </motion.div>
                )}

                <button
                  type="button"
                  onClick={() => handleSelectEffect("nervous")}
                  className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    filterState.effect === "nervous"
                      ? "bg-amber-400 border-2 border-white ring-4 ring-amber-400/40 scale-110 shadow-lg shadow-amber-500/30"
                      : "bg-amber-400/80 hover:bg-amber-400"
                  }`}
                >
                  <svg viewBox="0 0 36 36" className="w-10 h-10 text-neutral-950 fill-current">
                    <circle cx="18" cy="18" r="17" fill="#FFCC4D" />
                    <path d="M 8 11 Q 12 14 15 12" stroke="#664E27" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <path d="M 28 11 Q 24 14 21 12" stroke="#664E27" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <path d="M 9 16 Q 13 13 17 16 M 9 16 Q 13 19 17 16" stroke="#664E27" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <path d="M 19 16 Q 23 13 27 16 M 19 16 Q 23 19 27 16" stroke="#664E27" strokeWidth="2" strokeLinecap="round" fill="none" />
                    <path d="M 7 24 Q 18 31 29 24 M 7 24 Q 18 20 29 24" stroke="#664E27" strokeWidth="2" strokeLinecap="round" fill="#FFFFFF" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Tab Contents - ONLY NERVOUS AND NONE */}
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            {activeTab === "effects" && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  {/* NERVOUS EFFECT */}
                  <div
                    onClick={() => handleSelectEffect("nervous")}
                    className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                      filterState.effect === "nervous"
                        ? "border-amber-400 bg-amber-400/10 text-white shadow-lg shadow-amber-900/20"
                        : "border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300"
                    }`}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center justify-center shrink-0">
                      <Activity size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>Nervous</span>
                          <span className="text-[10px] bg-amber-400/30 text-amber-200 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                            Pixel Warp
                          </span>
                        </h4>
                        {filterState.effect === "nervous" && <Check size={16} className="text-amber-400" />}
                      </div>
                      <p className="text-xs text-neutral-400 mt-1 leading-snug">
                        Real-time mathematical pixel displacement: stretches mouth horizontally and squashes face vertically.
                      </p>
                    </div>
                  </div>

                  {/* NONE */}
                  <div
                    onClick={() => handleSelectEffect("none")}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                      filterState.effect === "none"
                        ? "border-amber-400 bg-amber-400/10 text-white shadow-lg"
                        : "border-white/10 bg-white/5 hover:bg-white/10 text-neutral-300"
                    }`}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-neutral-800 border border-white/10 flex items-center justify-center shrink-0 text-neutral-400">
                      <Minus size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-white">None</h4>
                        {filterState.effect === "none" && <Check size={16} className="text-amber-400" />}
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">Normal raw camera video without processing.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: FILTERS */}
            {activeTab === "filters" && (
              <div className="py-10 text-center space-y-2">
                <Sliders size={32} className="mx-auto text-neutral-500 stroke-1" />
                <p className="text-sm font-medium text-neutral-300">No filters added yet</p>
              </div>
            )}

            {/* TAB 3: BACKGROUNDS */}
            {activeTab === "backgrounds" && (
              <div className="py-10 text-center space-y-2">
                <ImageIcon size={32} className="mx-auto text-neutral-500 stroke-1" />
                <p className="text-sm font-medium text-neutral-300">No backgrounds added yet</p>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="p-4 border-t border-white/10 bg-neutral-950/60 flex items-center justify-between">
            <div className="text-xs text-neutral-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Applied directly to your real video stream</span>
            </div>

            <button
              id="save-call-filters-btn"
              type="button"
              onClick={onClose}
              className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
