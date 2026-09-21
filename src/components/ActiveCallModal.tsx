import React, { useState, useEffect, useRef, useCallback } from "react";
import { useCall } from "../context/CallContext";
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Minimize2,
  Maximize2,
  ShieldCheck,
  Loader2,
  HelpCircle,
  MonitorUp,
  MonitorOff,
  ScreenShareOff,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function ActiveCallModal() {
  const {
    activeCall,
    outgoingCall,
    localStream,
    remoteStream,
    screenStream,
    isScreenSharing,
    isVideoSwitchRequested,
    isVideoSwitchPending,
    endActiveCall,
    cancelOutgoingCall,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreenShare,
    stopScreenShare,
    requestSwitchToVideo,
    respondToVideoSwitch,
  } = useCall();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [callDuration, setCallDuration] = useState("00:00");
  const [screenFitMode, setScreenFitMode] = useState<"contain" | "cover">("contain");

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const fullscreenVideoRef = useRef<HTMLVideoElement | null>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const controlsTimeoutRef = useRef<any>(null);

  // Timer for active call duration
  useEffect(() => {
    if (!activeCall) {
      setCallDuration("00:00");
      return;
    }

    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - activeCall.startTime) / 1000);
      const mins = Math.floor(elapsedSec / 60)
        .toString()
        .padStart(2, "0");
      const secs = (elapsedSec % 60).toString().padStart(2, "0");
      setCallDuration(`${mins}:${secs}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCall]);

  // Connect remote stream to audio/video elements
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = activeCall?.isDeafened || false;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, activeCall?.isDeafened]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, activeCall?.callType]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, activeCall?.callType, activeCall?.isCameraOn]);

  // Fullscreen video stream binding
  useEffect(() => {
    if (fullscreenVideoRef.current) {
      const targetStream = isScreenSharing
        ? screenStream || localStream
        : remoteStream || localStream;
      if (targetStream && fullscreenVideoRef.current.srcObject !== targetStream) {
        fullscreenVideoRef.current.srcObject = targetStream;
        fullscreenVideoRef.current.play().catch(() => {});
      }
    }
  }, [isFullscreen, isScreenSharing, screenStream, remoteStream, localStream]);

  // Exit fullscreen helper
  const exitFullscreenMode = useCallback(async () => {
    setIsFullscreen(false);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
        setIsNativeFullscreen(false);
      } catch {
        // ignore
      }
    }
  }, []);

  // Safe stop screen share that cleanly leaves fullscreen presentation
  const handleStopScreenShare = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreenMode();
    }
    await stopScreenShare();
  }, [isFullscreen, exitFullscreenMode, stopScreenShare]);

  // Auto exit fullscreen screen share when sharing ends (if not in video call)
  useEffect(() => {
    if (
      isFullscreen &&
      !isScreenSharing &&
      (!remoteStream || (activeCall?.callType !== "video" && remoteStream.getVideoTracks().length === 0))
    ) {
      exitFullscreenMode();
    }
  }, [isFullscreen, isScreenSharing, remoteStream, activeCall?.callType, exitFullscreenMode]);

  // Fullscreen toggle
  const toggleFullscreenMode = useCallback(async () => {
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);
    if (!nextState && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
        setIsNativeFullscreen(false);
      } catch {
        // ignore
      }
    }
  }, [isFullscreen]);

  const toggleNativeFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const container = fullscreenContainerRef.current || document.documentElement;
        if (container?.requestFullscreen) {
          await container.requestFullscreen();
          setIsNativeFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
          setIsNativeFullscreen(false);
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle notice:", err);
    }
  }, []);

  // Keyboard shortcut (Escape to exit fullscreen) and fullscreenchange listener
  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFullscreen(false);
      }
    };

    const handleFullscreenChange = () => {
      setIsNativeFullscreen(!!document.fullscreenElement);
      if (!document.fullscreenElement && isNativeFullscreen) {
        // user pressed Esc natively
        setIsFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [isFullscreen, isNativeFullscreen]);

  // Controls auto hide in fullscreen
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  }, []);

  // 1. OUTGOING CALL VIEW (When calling someone else)
  if (outgoingCall && !activeCall) {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-sm rounded-2xl border p-6 text-center text-white bg-neutral-900/95 border-white/15 shadow-2xl"
        >
          {/* Avatar with soft pulsing rings */}
          <div className="relative mx-auto w-24 h-24 mb-5">
            <div className="w-full h-full rounded-full overflow-hidden border-2 border-[var(--theme-border-strong,rgba(255,255,255,0.3))] bg-neutral-800 shadow-xl">
              <img
                src={
                  outgoingCall.targetPhotoURL ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(outgoingCall.targetName)}`
                }
                alt={outgoingCall.targetName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="absolute -inset-2 rounded-full border-2 border-emerald-400/50 animate-ping pointer-events-none" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
            {outgoingCall.callType === "video" ? <Video size={12} /> : <Phone size={12} />}
            {outgoingCall.callType === "video" ? "Outgoing Video Call" : "Outgoing Audio Call"}
          </span>

          <h3 className="text-xl font-bold text-white tracking-tight">{outgoingCall.targetName}</h3>
          <p className="text-xs text-neutral-400 mt-1 flex items-center justify-center gap-1.5">
            <Loader2 size={12} className="animate-spin text-emerald-400" />
            <span>Calling...</span>
          </p>

          <div className="mt-8 flex justify-center">
            <button
              id="cancel-outgoing-call-btn"
              type="button"
              onClick={cancelOutgoingCall}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-xs text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition-all cursor-pointer shadow-lg shadow-rose-900/40 hover:scale-105"
            >
              <PhoneOff size={16} />
              <span>Cancel Call</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 2. ACTIVE CALL VIEW
  if (!activeCall) return null;

  // Invisible Audio Player for Remote Stream
  const audioPlayer = <audio ref={remoteAudioRef} autoPlay playsInline />;

  // MINIMIZED FLOATING PILL
  if (isMinimized) {
    return (
      <motion.div
        id="minimized-active-call-pill"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed bottom-4 right-4 z-[9998] flex items-center gap-3 p-2.5 px-3.5 rounded-2xl bg-neutral-900/95 border border-emerald-500/30 text-white shadow-2xl backdrop-blur-lg"
      >
        {audioPlayer}
        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-emerald-400 shrink-0">
          <img
            src={
              activeCall.partnerPhotoURL ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(activeCall.partnerName)}`
            }
            alt={activeCall.partnerName}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400" />
        </div>

        <div className="min-w-0 pr-1">
          <p className="text-xs font-bold truncate max-w-[110px]">{activeCall.partnerName}</p>
          <p className="text-[10px] text-emerald-400 font-mono">{callDuration}</p>
        </div>

        <div className="flex items-center gap-1.5 border-l border-white/10 pl-2">
          <button
            type="button"
            onClick={toggleMute}
            className={`p-1.5 rounded-lg border transition-colors ${
              activeCall.isMuted
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                : "bg-white/5 border-white/10 text-neutral-300 hover:text-white"
            }`}
            title={activeCall.isMuted ? "Unmute" : "Mute"}
          >
            {activeCall.isMuted ? <MicOff size={13} /> : <Mic size={13} />}
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-neutral-300 hover:text-white transition-colors"
            title="Expand Call"
          >
            <Maximize2 size={13} />
          </button>

          <button
            type="button"
            onClick={endActiveCall}
            className="p-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors"
            title="End Call"
          >
            <PhoneOff size={13} />
          </button>
        </div>
      </motion.div>
    );
  }

  // FULL ACTIVE CALL MODAL
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md">
      {audioPlayer}

      <motion.div
        id="active-call-dialog"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl rounded-3xl border border-white/15 bg-neutral-900/95 text-white shadow-2xl overflow-hidden flex flex-col relative"
        style={{
          maxHeight: "calc(100vh - 3rem)",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(16, 185, 129, 0.15)",
        }}
      >
        {/* Top Bar */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-neutral-950/40">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>{activeCall.partnerName}</span>
                <span className="text-[10px] font-normal text-emerald-400 border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  P2P Secure
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">{callDuration}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(activeCall.callType === "video" || isScreenSharing || (remoteStream && remoteStream.getVideoTracks().length > 0)) && (
              <button
                type="button"
                onClick={toggleFullscreenMode}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                title="Fullscreen presentation"
              >
                <Maximize2 size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
              title="Minimize to floating widget"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Hidden Audio Element for Remote Stream (ensures voice & screen audio play continuously) */}
        <audio
          ref={(el) => {
            if (el && remoteStream) {
              if (el.srcObject !== remoteStream) {
                el.srcObject = remoteStream;
              }
              el.play().catch(() => {});
            }
          }}
          autoPlay
          playsInline
        />

        {/* Call Main Stage (Video, Screen Share, or Audio Visualizer) */}
        <div
          className="relative flex-1 bg-neutral-950 flex items-center justify-center overflow-hidden min-h-[320px] sm:min-h-[400px] group"
          onDoubleClick={() => {
            if (activeCall.callType === "video" || isScreenSharing || (remoteStream && remoteStream.getVideoTracks().length > 0)) {
              toggleFullscreenMode();
            }
          }}
        >
          {isScreenSharing ? (
            screenStream ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video
                  ref={(el) => {
                    if (el && screenStream) {
                      if (el.srcObject !== screenStream) {
                        el.srcObject = screenStream;
                      }
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full ${
                    screenFitMode === "cover" ? "object-cover" : "object-contain"
                  } max-h-[500px]`}
                />
                <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-neutral-900/90 border border-indigo-500/40 px-3 py-1.5 rounded-full text-xs text-white shadow-xl backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="font-semibold text-[11px]">Your Screen (Live Preview)</span>
                </div>
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleFullscreenMode}
                    className="p-2 rounded-xl bg-black/70 hover:bg-black text-white border border-white/20 shadow-lg transition-all cursor-pointer"
                    title="Fullscreen"
                  >
                    <Maximize2 size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleStopScreenShare}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg flex items-center gap-1.5 active:scale-95"
                  >
                    <ScreenShareOff size={14} />
                    <span>Stop Sharing</span>
                  </button>
                </div>
              </div>
            ) : (
              // Local Screen Sharing status box (prevents hall-of-mirrors / mirror loop)
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#0a0f2b] via-[#050717] to-[#02030a] select-none relative">
                <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-3 shadow-xl shadow-indigo-950/50 animate-pulse">
                  <MonitorUp size={32} />
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-extrabold text-white tracking-wide">You are sharing your screen</span>
                  <span className="text-[10px] bg-indigo-600 text-white font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full animate-pulse shadow">
                    LIVE
                  </span>
                </div>
                <p className="text-xs text-indigo-200/80 max-w-sm mb-4 leading-relaxed font-medium">
                  Your screen is live for {activeCall.partnerName} in high definition.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleFullscreenMode}
                    className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold border border-white/10 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Maximize2 size={14} />
                    <span>Fullscreen</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStopScreenShare}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg flex items-center gap-1.5 active:scale-95"
                  >
                    <ScreenShareOff size={14} />
                    <span>Stop Sharing</span>
                  </button>
                </div>
              </div>
            )
          ) : activeCall.callType === "video" || (remoteStream && remoteStream.getVideoTracks().length > 0) ? (
            // Video or Remote Screen Share View
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {/* Remote Video / Shared Screen */}
              <video
                ref={(el) => {
                  remoteVideoRef.current = el;
                  if (el && remoteStream) {
                    if (el.srcObject !== remoteStream) {
                      el.srcObject = remoteStream;
                    }
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                className="w-full h-full object-contain max-h-[500px]"
              />

              {/* Hover Fullscreen Overlay Button */}
              <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={toggleFullscreenMode}
                  className="p-2 rounded-xl bg-black/70 hover:bg-black text-white border border-white/20 shadow-lg transition-all cursor-pointer"
                  title="Fullscreen"
                >
                  <Maximize2 size={15} />
                </button>
              </div>

              {/* Local Camera Video Thumbnail (Picture in Picture) */}
              {activeCall.callType === "video" && (
                <div className="absolute bottom-4 right-4 w-32 sm:w-44 aspect-video rounded-xl overflow-hidden border-2 border-white/20 bg-neutral-900 shadow-2xl z-10">
                  <video
                    ref={(el) => {
                      localVideoRef.current = el;
                      if (el && localStream) {
                        if (el.srcObject !== localStream) {
                          el.srcObject = localStream;
                        }
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  {!activeCall.isCameraOn && (
                    <div className="absolute inset-0 bg-neutral-900/90 flex flex-col items-center justify-center text-neutral-400 text-[10px]">
                      <VideoOff size={14} className="mb-1" />
                      <span>Camera Off</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Audio Call View (Rich Avatar & Voice Wave)
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <div className="relative w-28 h-28 sm:w-36 sm:h-36 mb-6">
                <div className="w-full h-full rounded-full overflow-hidden border-4 border-emerald-500/40 bg-neutral-800 shadow-2xl">
                  <img
                    src={
                      activeCall.partnerPhotoURL ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(activeCall.partnerName)}`
                    }
                    alt={activeCall.partnerName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="absolute -inset-3 rounded-full border-2 border-emerald-400/30 animate-pulse pointer-events-none" />
              </div>

              <h2 className="text-xl font-bold text-white tracking-tight">{activeCall.partnerName}</h2>
              <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>Private 1-on-1 Voice Call</span>
              </p>

              {/* Voice waves representation */}
              <div className="flex items-center gap-1 mt-6 h-6">
                {[12, 20, 16, 24, 18, 14, 22, 10].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-emerald-400/80 rounded-full animate-pulse"
                    style={{
                      height: `${h}px`,
                      animationDelay: `${i * 0.12}s`,
                      animationDuration: "1s",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* PROMPT BANNER FOR SWITCH TO VIDEO:
              "Do you want to switch to video call?"
              Theres a yes or no button then it will switch to video and automatically turn on their camera */}
          <AnimatePresence>
            {isVideoSwitchRequested && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-4 left-4 right-4 z-30 p-4 rounded-2xl bg-neutral-900/95 border border-emerald-400/50 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
                    <Video size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Do you want to switch to video call?
                    </h4>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Accepting will switch to video and turn on your camera.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    id="switch-video-no-btn"
                    type="button"
                    onClick={() => respondToVideoSwitch(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-white/10 transition-colors"
                  >
                    No
                  </button>
                  <button
                    id="switch-video-yes-btn"
                    type="button"
                    onClick={() => respondToVideoSwitch(true)}
                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-md shadow-emerald-900/40 border border-emerald-400/30 transition-all hover:scale-105"
                  >
                    Yes
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pending Switch Toast for Caller */}
          {isVideoSwitchPending && (
            <div className="absolute top-4 left-4 right-4 z-20 p-3 rounded-xl bg-neutral-900/90 border border-white/10 text-xs text-center text-neutral-300 flex items-center justify-center gap-2 shadow-lg">
              <Loader2 size={14} className="animate-spin text-emerald-400" />
              <span>Asking {activeCall.partnerName} to switch to video call...</span>
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div className="px-6 py-4 bg-neutral-950/90 border-t border-white/10 flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
          {/* Mute Mic Button */}
          <button
            id="call-toggle-mic-btn"
            type="button"
            onClick={toggleMute}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              activeCall.isMuted
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30"
                : "bg-neutral-800/80 border-white/10 text-white hover:bg-neutral-700/80"
            }`}
          >
            {activeCall.isMuted ? <MicOff size={15} /> : <Mic size={15} />}
            <span>{activeCall.isMuted ? "Unmute" : "Mute"}</span>
          </button>

          {/* Video Switch or Camera Toggle Button:
              When on audio call, it doesn't let you do video until they answer; clicking video asks them! */}
          {activeCall.callType === "audio" ? (
            <button
              id="call-request-video-btn"
              type="button"
              disabled={isVideoSwitchPending}
              onClick={requestSwitchToVideo}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                isVideoSwitchPending
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 opacity-80 cursor-wait"
                  : "bg-neutral-800/80 border-white/10 text-white hover:bg-neutral-700/80 hover:border-emerald-400/40"
              }`}
              title="Request to switch to video call"
            >
              <Video size={15} className="text-emerald-400" />
              <span>{isVideoSwitchPending ? "Requesting Video..." : "Switch to Video"}</span>
            </button>
          ) : (
            <button
              id="call-toggle-camera-btn"
              type="button"
              onClick={toggleCamera}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                !activeCall.isCameraOn
                  ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                  : "bg-neutral-800/80 border-white/10 text-white hover:bg-neutral-700/80"
              }`}
            >
              {activeCall.isCameraOn ? <Video size={15} /> : <VideoOff size={15} />}
              <span>{activeCall.isCameraOn ? "Camera On" : "Camera Off"}</span>
            </button>
          )}

          {/* Screen Share Button */}
          <button
            id="call-toggle-screenshare-btn"
            type="button"
            onClick={toggleScreenShare}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              isScreenSharing
                ? "bg-indigo-500/30 border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/40"
                : "bg-neutral-800/80 border-white/10 text-white hover:bg-neutral-700/80 hover:border-indigo-400/40"
            }`}
            title={isScreenSharing ? "Stop sharing screen" : "Share screen with caller"}
          >
            {isScreenSharing ? <MonitorOff size={15} className="text-indigo-400" /> : <MonitorUp size={15} className="text-indigo-400" />}
            <span>{isScreenSharing ? "Stop Sharing" : "Share Screen"}</span>
          </button>

          {/* Deafen / Sound Toggle */}
          <button
            id="call-toggle-deafen-btn"
            type="button"
            onClick={toggleDeafen}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              activeCall.isDeafened
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30"
                : "bg-neutral-800/80 border-white/10 text-white hover:bg-neutral-700/80"
            }`}
          >
            {activeCall.isDeafened ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <span>{activeCall.isDeafened ? "Deafened" : "Sound"}</span>
          </button>

          {/* End Call Button */}
          <button
            id="end-call-btn"
            type="button"
            onClick={endActiveCall}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 border border-rose-500/40 shadow-lg shadow-rose-900/40 transition-all cursor-pointer hover:scale-105 active:scale-95"
          >
            <PhoneOff size={15} />
            <span>End Call</span>
          </button>
        </div>
      </motion.div>

      {/* FULLSCREEN CALL & SCREEN PRESENTATION OVERLAY */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            id="active-call-fullscreen-overlay"
            ref={fullscreenContainerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseMove={handleMouseMove}
            className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center select-none overflow-hidden"
          >
            {/* Top Bar Floating Controls */}
            <div
              className={`absolute top-0 inset-x-0 p-4 z-40 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent transition-opacity duration-300 pointer-events-auto ${
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Partner info */}
              <div className="flex items-center gap-3 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 shadow-xl">
                <div className="relative w-8 h-8 rounded-full overflow-hidden border border-emerald-400">
                  <img
                    src={
                      activeCall.partnerPhotoURL ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(activeCall.partnerName)}`
                    }
                    alt={activeCall.partnerName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{activeCall.partnerName}</span>
                  {isScreenSharing ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                        <MonitorUp size={11} /> SCREEN SHARE
                      </span>
                      <button
                        type="button"
                        onClick={handleStopScreenShare}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition-all cursor-pointer shadow flex items-center gap-1 active:scale-95"
                        title="Stop sharing screen"
                      >
                        <ScreenShareOff size={12} />
                        <span>Stop Sharing</span>
                      </button>
                    </div>
                  ) : activeCall.callType === "video" ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                      VIDEO CALL
                    </span>
                  ) : null}
                  <span className="text-xs text-neutral-400 font-mono pl-1">{callDuration}</span>
                </div>
              </div>

              {/* Top Right Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScreenFitMode((f) => (f === "contain" ? "cover" : "contain"))}
                  className="px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-neutral-200 hover:text-white text-xs font-medium transition-colors cursor-pointer shadow-lg"
                  title={screenFitMode === "contain" ? "Fill Screen (Crop)" : "Fit to Screen"}
                >
                  {screenFitMode === "contain" ? "Fill Screen" : "Fit to Screen"}
                </button>

                <button
                  type="button"
                  onClick={toggleNativeFullscreen}
                  className="p-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-neutral-200 hover:text-white transition-colors cursor-pointer shadow-lg"
                  title={isNativeFullscreen ? "Exit window fullscreen" : "Window fullscreen"}
                >
                  {isNativeFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreenMode}
                  className="p-2 rounded-full bg-black/60 hover:bg-rose-500/80 backdrop-blur-md border border-white/10 text-neutral-200 hover:text-white transition-colors cursor-pointer shadow-lg"
                  title="Exit fullscreen (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Center Video/Screen Presentation Area */}
            <div
              className="relative w-full h-full flex-1 flex items-center justify-center overflow-hidden bg-black"
              onDoubleClick={() => setScreenFitMode((f) => (f === "contain" ? "cover" : "contain"))}
            >
              {isScreenSharing ? (
                screenStream ? (
                  <video
                    ref={(el) => {
                      fullscreenVideoRef.current = el;
                      if (el && screenStream) {
                        if (el.srcObject !== screenStream) {
                          el.srcObject = screenStream;
                        }
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full max-w-full max-h-full transition-all duration-150 cursor-pointer ${
                      screenFitMode === "cover" ? "object-cover" : "object-contain"
                    }`}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#0a0f2b] via-[#050717] to-[#02030a] select-none relative">
                    <div className="w-20 h-20 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-4 shadow-xl shadow-indigo-950/50 animate-pulse">
                      <MonitorUp size={40} />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base font-extrabold text-white tracking-wide">You are sharing your screen</span>
                      <span className="text-[10px] bg-indigo-600 text-white font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full animate-pulse shadow">
                        LIVE
                      </span>
                    </div>
                    <p className="text-sm text-indigo-200/80 max-w-md mb-6 leading-relaxed font-medium">
                      Your screen stream is live for {activeCall.partnerName} in high definition.
                    </p>
                    <button
                      type="button"
                      onClick={handleStopScreenShare}
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg flex items-center gap-2 active:scale-95"
                    >
                      <ScreenShareOff size={16} />
                      <span>Stop Sharing</span>
                    </button>
                  </div>
                )
              ) : remoteStream && (activeCall.callType === "video" || remoteStream.getVideoTracks().length > 0) ? (
                <video
                  ref={(el) => {
                    fullscreenVideoRef.current = el;
                    if (el && remoteStream) {
                      if (el.srcObject !== remoteStream) {
                        el.srcObject = remoteStream;
                      }
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  className={`w-full h-full max-w-full max-h-full transition-all duration-150 cursor-pointer ${
                    screenFitMode === "cover" ? "object-cover" : "object-contain"
                  }`}
                />
              ) : (
                <div className="flex flex-col items-center gap-4 text-center px-4">
                  <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-emerald-500/40 bg-neutral-800 shadow-2xl">
                    <img
                      src={
                        activeCall.partnerPhotoURL ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(activeCall.partnerName)}`
                      }
                      alt={activeCall.partnerName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <h3 className="text-xl font-bold text-white">{activeCall.partnerName}</h3>
                  <p className="text-sm text-neutral-400">Voice call active</p>
                </div>
              )}

              {/* Floating PiP of local camera if video call is active */}
              {activeCall.callType === "video" && !isScreenSharing && (
                <div className="absolute bottom-24 right-6 w-44 sm:w-56 aspect-video rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-black z-30">
                  <video
                    ref={(el) => {
                      if (el && localStream) {
                        if (el.srcObject !== localStream) {
                          el.srcObject = localStream;
                        }
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: "scaleX(-1)" }}
                  />
                  {!activeCall.isCameraOn && (
                    <div className="absolute inset-0 bg-neutral-900/90 flex flex-col items-center justify-center text-neutral-400 text-[10px]">
                      <VideoOff size={14} className="mb-1" />
                      <span>Camera Off</span>
                    </div>
                  )}
                </div>
              )}

              {/* Floating banner when local user shares screen */}
              {isScreenSharing && screenStream && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-full bg-neutral-900/90 border border-indigo-500/40 text-xs text-white shadow-2xl backdrop-blur-md pointer-events-auto">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="font-semibold">You are presenting your screen</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStopScreenShare();
                    }}
                    className="ml-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition-all cursor-pointer shadow active:scale-95"
                  >
                    Stop Sharing
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Floating Control Dock */}
            <div
              className={`absolute bottom-0 inset-x-0 p-6 z-40 flex flex-col items-center gap-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 pointer-events-auto ${
                showControls ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              <div className="flex items-center gap-3 bg-[#111214]/90 backdrop-blur-xl px-4 py-2.5 rounded-2xl border border-neutral-800 shadow-2xl">
                {/* Mic toggle */}
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`p-3 rounded-xl transition-all cursor-pointer ${
                    activeCall.isMuted
                      ? "bg-rose-600/20 text-rose-500 border border-rose-800/80 hover:bg-rose-600/30"
                      : "bg-neutral-800 text-white hover:bg-neutral-700"
                  }`}
                  title={activeCall.isMuted ? "Unmute Microphone" : "Mute Microphone"}
                >
                  {activeCall.isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                {/* Camera / Video toggle */}
                {activeCall.callType === "video" ? (
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={`p-3 rounded-xl transition-all cursor-pointer ${
                      !activeCall.isCameraOn
                        ? "bg-rose-500/20 border border-rose-500/40 text-rose-300"
                        : "bg-neutral-800 text-white hover:bg-neutral-700"
                    }`}
                    title={activeCall.isCameraOn ? "Turn off camera" : "Turn on camera"}
                  >
                    {activeCall.isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isVideoSwitchPending}
                    onClick={requestSwitchToVideo}
                    className="p-3 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 transition-all cursor-pointer"
                    title="Switch to video"
                  >
                    <Video size={18} className="text-emerald-400" />
                  </button>
                )}

                {/* Screen Share toggle */}
                <button
                  type="button"
                  onClick={isScreenSharing ? handleStopScreenShare : toggleScreenShare}
                  className={`p-3 rounded-xl transition-all cursor-pointer ${
                    isScreenSharing
                      ? "bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg shadow-rose-950/50 active:scale-95"
                      : "bg-neutral-800 text-white hover:bg-neutral-700"
                  }`}
                  title={isScreenSharing ? "Stop Screen Sharing" : "Share Screen"}
                >
                  {isScreenSharing ? <ScreenShareOff size={18} /> : <MonitorUp size={18} />}
                </button>

                {/* Deafen toggle */}
                <button
                  type="button"
                  onClick={toggleDeafen}
                  className={`p-3 rounded-xl transition-all cursor-pointer ${
                    activeCall.isDeafened
                      ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                      : "bg-neutral-800 text-white hover:bg-neutral-700"
                  }`}
                  title={activeCall.isDeafened ? "Sound Off" : "Sound On"}
                >
                  {activeCall.isDeafened ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                <div className="h-6 w-px bg-neutral-700 mx-1" />

                {/* End call */}
                <button
                  type="button"
                  onClick={() => {
                    setIsFullscreen(false);
                    endActiveCall();
                  }}
                  className="p-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-lg transition-all cursor-pointer active:scale-95"
                  title="End Call"
                >
                  <PhoneOff size={18} />
                </button>

                {/* Exit Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreenMode}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white transition-all text-xs font-semibold cursor-pointer"
                  title="Exit Full Screen"
                >
                  <Minimize2 size={16} />
                  <span className="hidden sm:inline">Exit Full Screen</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
