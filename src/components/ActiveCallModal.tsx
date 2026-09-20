import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function ActiveCallModal() {
  const {
    activeCall,
    outgoingCall,
    localStream,
    remoteStream,
    isVideoSwitchRequested,
    isVideoSwitchPending,
    endActiveCall,
    cancelOutgoingCall,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    requestSwitchToVideo,
    respondToVideoSwitch,
  } = useCall();

  const [isMinimized, setIsMinimized] = useState(false);
  const [callDuration, setCallDuration] = useState("00:00");

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

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
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-white/10 transition-colors"
              title="Minimize to floating widget"
            >
              <Minimize2 size={16} />
            </button>
          </div>
        </div>

        {/* Call Main Stage (Video or Audio Visualizer) */}
        <div className="relative flex-1 bg-neutral-950 flex items-center justify-center overflow-hidden min-h-[320px] sm:min-h-[400px]">
          {activeCall.callType === "video" ? (
            // Video Call View
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              {/* Remote Video */}
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

              {/* Local Video Thumbnail (Picture in Picture) */}
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
    </div>
  );
}
