import React from "react";
import { useCall } from "../context/CallContext";
import { Phone, PhoneOff, Video, Sparkles, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function IncomingCallNotification() {
  const { incomingCall, answerIncomingCall, declineIncomingCall } = useCall();

  if (!incomingCall) return null;

  return (
    <AnimatePresence>
      <motion.div
        id="incoming-call-notification"
        initial={{ opacity: 0, y: -20, scale: 0.92, x: 20 }}
        animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
        exit={{ opacity: 0, y: -20, scale: 0.9, x: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="fixed top-4 right-4 z-[9999] w-[350px] max-w-[calc(100vw-2rem)] rounded-2xl border shadow-2xl p-4 backdrop-blur-xl bg-neutral-900/95 text-white border-white/15"
        style={{
          boxShadow: "0 20px 45px -10px rgba(0, 0, 0, 0.7), 0 0 30px rgba(16, 185, 129, 0.15)",
        }}
      >
        <div className="flex items-start gap-3.5">
          {/* Avatar with pulsing ring */}
          <div className="relative shrink-0">
            <div className="w-13 h-13 rounded-full overflow-hidden border-2 border-emerald-400/80 bg-neutral-800 shadow-md">
              <img
                src={
                  incomingCall.callerPhotoURL ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(incomingCall.callerName)}`
                }
                alt={incomingCall.callerName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            {/* Pulsing ring indicator */}
            <span className="absolute -inset-1 rounded-full border-2 border-emerald-400 animate-ping opacity-60 pointer-events-none" />
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-neutral-900 flex items-center justify-center">
              {incomingCall.callType === "video" ? (
                <Video size={9} className="text-white" />
              ) : (
                <Phone size={9} className="text-white" />
              )}
            </span>
          </div>

          {/* Caller Details & Type */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <Volume2 size={12} className="animate-pulse text-emerald-400" />
                {incomingCall.callType === "video" ? "Incoming Video Call" : "Incoming Audio Call"}
              </span>
            </div>
            <h4 className="text-base font-bold text-white truncate mt-0.5" title={incomingCall.callerName}>
              {incomingCall.callerName}
            </h4>
            <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1.5">
              <span>{incomingCall.callType === "video" ? "FaceTime Video" : "Audio Call"}</span>
              <span className="text-neutral-600">•</span>
              <span className="text-[11px] text-emerald-400 font-medium">Ringing...</span>
            </p>
          </div>
        </div>

        {/* Action Buttons: Answer & Decline */}
        <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3 border-t border-white/10">
          <button
            id="decline-call-btn"
            type="button"
            onClick={declineIncomingCall}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 border border-rose-500/30 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
          >
            <PhoneOff size={15} className="text-rose-400" />
            <span>Decline</span>
          </button>

          <button
            id="answer-call-btn"
            type="button"
            onClick={answerIncomingCall}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 border border-emerald-400/30 transition-all cursor-pointer shadow-md hover:scale-[1.02] active:scale-[0.98] shadow-emerald-900/40"
          >
            {incomingCall.callType === "video" ? (
              <Video size={15} className="text-white" />
            ) : (
              <Phone size={15} className="text-white" />
            )}
            <span>Answer</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
