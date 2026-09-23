import React, { useState, useEffect, useRef } from "react";
import { useCall } from "../context/CallContext";
import {
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Minimize2,
  ShieldCheck,
  Loader2,
  MonitorUp,
  MonitorOff,
  ScreenShareOff,
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

  // Connect remote stream to single dedicated audio element
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
      remoteAudioRef.current.muted = activeCall?.isDeafened || false;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, activeCall?.isDeafened]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.muted = true;
      remoteVideoRef.current.defaultMuted = true;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, activeCall?.callType]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.muted = true;
      localVideoRef.current.defaultMuted = true;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, activeCall?.callType, activeCall?.isCameraOn]);

  // OUTGOING CALL MODAL
  if (outgoingCall && !activeCall) {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          id="outgoing-call-dialog"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900/95 p-6 text-center text-white shadow-2xl backdrop-blur-xl"
        >
          <div className="relative mx-auto mb-5 w-24 h-24">
            <div className="w-full h-full rounded-full overflow-hidden border-2 border-emerald-500/50 bg-neutral-800 shadow-xl">
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
            <span className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping opacity-30 pointer-events-none" />
          </div>

          <h3 className="text-lg font-bold text-white tracking-tight">{outgoingCall.targetName}</h3>
          <p className="text-xs text-neutral-400 mt-1 flex items-center justify-center gap-1.5">
            <Loader2 size={13} className="animate-spin text-emerald-400" />
            <span>Calling...</span>
          </p>

          <div className="mt-6 flex justify-center">
            <button
              id="cancel-outgoing-call-btn"
              type="button"
              onClick={cancelOutgoingCall}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-xs shadow-lg shadow-rose-900/40 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <PhoneOff size={15} />
              <span>Cancel</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!activeCall) return null;

  // MINIMIZED FLOATING PILL
  if (isMinimized) {
    return (
      <motion.div
        id="active-call-minimized-widget"
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className="fixed bottom-6 right-6 z-[9998] flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/15 bg-neutral-900/95 text-white shadow-2xl backdrop-blur-xl"
        style={{
          boxShadow: "0 20px 40px -15px rgba(0, 0, 0, 0.7), 0 0 20px rgba(16, 185, 129, 0.2)",
        }}
      >
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
        />

        <div className="flex items-center gap-2.5">
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
          <div>
            <p className="text-xs font-bold text-white tracking-tight truncate max-w-[100px]">
              {activeCall.partnerName}
            </p>
            <p className="text-[10px] text-neutral-400 font-mono">{callDuration}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-2 border-l border-white/10 pl-2">
          <button
            type="button"
            onClick={toggleMute}
            className={`p-1.5 rounded-lg text-xs transition-colors ${
              activeCall.isMuted
                ? "bg-rose-500/20 text-rose-300"
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            }`}
            title={activeCall.isMuted ? "Unmute" : "Mute"}
          >
            {activeCall.isMuted ? <MicOff size={13} /> : <Mic size={13} />}
          </button>

          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
            title="Expand Call"
          >
            <ShieldCheck size={13} />
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
      {/* Single dedicated audio player for remote call stream */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
      />

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
                <span className="text-[10px] font-semibold text-emerald-400 border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck size={11} className="text-emerald-400" />
                  <span>Port 443 • DTLS-SRTP Encrypted</span>
                </span>
              </h3>
              <p className="text-[11px] text-neutral-400 font-mono">{callDuration}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

        {/* Call Main Stage (Video, Screen Share, or Audio Visualizer) */}
        <div className="relative flex-1 bg-neutral-950 flex items-center justify-center overflow-hidden min-h-[320px] sm:min-h-[400px] group">
          {isScreenSharing ? (
            // Local Screen Sharing status box (prevents hall-of-mirrors / mirror loop / live preview clutter)
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
                Your screen is being broadcast to {activeCall.partnerName} in high definition.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={stopScreenShare}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow-lg flex items-center gap-1.5 active:scale-95"
                >
                  <ScreenShareOff size={14} />
                  <span>Stop Sharing</span>
                </button>
              </div>
            </div>
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
                    el.muted = true;
                    el.defaultMuted = true;
                    el.volume = 0;
                    el.play().catch(() => {});
                  }
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain max-h-[500px]"
              />

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
                        el.muted = true;
                        el.defaultMuted = true;
                        el.volume = 0;
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

          {/* PROMPT BANNER FOR SWITCH TO VIDEO */}
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

          {/* Video Switch or Camera Toggle Button */}
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
    </div>
  );
}
