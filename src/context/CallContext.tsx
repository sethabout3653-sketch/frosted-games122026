import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { ICE_SERVERS } from "../lib/webrtc-config";
import { sendBroadcastSignal, subscribeBroadcastSignals } from "../lib/database";
import { getSavedProfile } from "../lib/activity-tracker";
import {
  startRingtoneLoop,
  playCallTone,
  getSavedRingtone,
} from "../lib/ringtone-synthesizer";
import { collection, onSnapshot, query, db, toTimestampMs } from "../supabase-adapter";

export interface CallUser {
  uid: string;
  username: string;
  photoURL?: string;
  status?: string;
  activity?: any;
}

export interface IncomingCallData {
  callId: string;
  callerUid: string;
  callerName: string;
  callerPhotoURL: string;
  callType: "audio" | "video";
  timestamp: number;
}

export interface OutgoingCallData {
  callId: string;
  targetUid: string;
  targetName: string;
  targetPhotoURL: string;
  callType: "audio" | "video";
  status: "ringing" | "connecting";
  timestamp: number;
}

export interface ActiveCallData {
  callId: string;
  partnerUid: string;
  partnerName: string;
  partnerPhotoURL: string;
  callType: "audio" | "video";
  startTime: number;
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn: boolean;
  isInitiator: boolean;
}

interface CallContextType {
  onlineUsers: CallUser[];
  incomingCall: IncomingCallData | null;
  outgoingCall: OutgoingCallData | null;
  activeCall: ActiveCallData | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isVideoSwitchRequested: boolean; // Prompt displayed to receiver: "Do you want to switch to video call?"
  isVideoSwitchPending: boolean; // Waiting for receiver to answer switch prompt
  voiceUserCount: number;
  isCallMenuOpen: boolean;
  setIsCallMenuOpen: (open: boolean) => void;
  startDirectCall: (user: CallUser, type: "audio" | "video") => Promise<void>;
  startGroupCall: () => void;
  joinGeneralVoice: () => void;
  answerIncomingCall: () => Promise<void>;
  declineIncomingCall: () => void;
  cancelOutgoingCall: () => void;
  endActiveCall: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  requestSwitchToVideo: () => void;
  respondToVideoSwitch: (accept: boolean) => Promise<void>;
  toggleCamera: () => Promise<void>;
  onOpenGroupVoice?: () => void;
  setOnOpenGroupVoice: (cb: () => void) => void;
}

const CallContext = createContext<CallContextType | null>(null);

export function useCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
}

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [onlineUsers, setOnlineUsers] = useState<CallUser[]>([]);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallData | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const [isVideoSwitchRequested, setIsVideoSwitchRequested] = useState(false);
  const [isVideoSwitchPending, setIsVideoSwitchPending] = useState(false);
  const [isCallMenuOpen, setIsCallMenuOpen] = useState(false);
  const [voiceUserCount, setVoiceUserCount] = useState<number>(0);

  const onOpenGroupVoiceRef = useRef<(() => void) | null>(null);

  const setOnOpenGroupVoice = useCallback((cb: () => void) => {
    onOpenGroupVoiceRef.current = cb;
  }, []);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const ringtoneStopRef = useRef<(() => void) | null>(null);
  const ringbackStopRef = useRef<(() => void) | null>(null);
  const callTimeoutRef = useRef<any>(null);
  const currentProfile = getSavedProfile();

  // Track active participants in General Voice
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "voice_users"), (snapshot) => {
      const now = Date.now();
      let count = 0;
      snapshot.docs.forEach((d: any) => {
        const data = d.data();
        const ts = toTimestampMs(data?.timestamp || data?.lastSeen);
        if (ts > 0 && now - ts <= 30000) {
          count++;
        }
      });
      setVoiceUserCount(count);
    }, () => {});
    return () => unsub();
  }, []);

  // Keep localStreamRef synced
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // 1. Subscribe to online users via presence collection
  useEffect(() => {
    const q = query(collection(db, "presence"));
    const unsub = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const myUid = currentProfile?.uid || "";
      const myName = (currentProfile?.username || "").trim().toLowerCase();
      const map = new Map<string, CallUser>();

      snapshot.docs.forEach((d: any) => {
        const data = d.data();
        const uname = (data.username || "").trim();
        const unameClean = uname.toLowerCase();
        if (!uname || unameClean === "anonymous" || unameClean === "guest") return;
        if (data.uid === myUid || unameClean === myName) return; // Don't list self

        const ts = toTimestampMs(data.lastSeen || data.timestamp);
        if (ts > 0 && now - ts <= 35000) {
          map.set(data.uid, {
            uid: data.uid,
            username: uname,
            photoURL: data.photoURL,
            status: data.status || "online",
            activity: data.activity,
          });
        }
      });

      setOnlineUsers(Array.from(map.values()));
    });

    return () => unsub();
  }, [currentProfile?.uid]);

  // Clean up all call media and state
  const cleanupCall = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (ringtoneStopRef.current) {
      ringtoneStopRef.current();
      ringtoneStopRef.current = null;
    }

    if (ringbackStopRef.current) {
      ringbackStopRef.current();
      ringbackStopRef.current = null;
    }

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.close();
      } catch (e) {}
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);
    setIncomingCall(null);
    setOutgoingCall(null);
    setActiveCall(null);
    setIsVideoSwitchRequested(false);
    setIsVideoSwitchPending(false);
  }, []);

  // 2. Initialize WebRTC PeerConnection for 1-on-1 Call
  const createDirectPeerConnection = useCallback(
    (partnerUid: string, callId: string) => {
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch (e) {}
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && currentProfile?.uid) {
          sendBroadcastSignal({
            type: "direct_call_candidate",
            uid: currentProfile.uid,
            targetUid: partnerUid,
            callId,
            candidate: JSON.stringify(event.candidate),
          });
        }
      };

      // Handle incoming remote audio/video tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
          setRemoteStream(new MediaStream([event.track]));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          playCallTone("declined");
          cleanupCall();
        }
      };

      return pc;
    },
    [currentProfile?.uid, cleanupCall]
  );

  // 3. Listen for direct call signals targeting this user
  useEffect(() => {
    if (!currentProfile?.uid) return;

    const unsubSignals = subscribeBroadcastSignals(currentProfile.uid, async (sig) => {
      if (!sig || !sig.type) return;

      // Ensure signal is strictly for this user (1-on-1 direct targeting)
      if (sig.targetUid !== currentProfile.uid) return;

      switch (sig.type) {
        case "direct_call_invite": {
          // If already in an active or outgoing call, auto-decline as busy
          if (activeCall || outgoingCall) {
            sendBroadcastSignal({
              type: "direct_call_declined",
              uid: currentProfile.uid,
              targetUid: sig.uid,
              callId: sig.callId,
              reason: "busy",
            });
            return;
          }

          // Start musical, non-robotic ringtone loop in the background
          if (ringtoneStopRef.current) ringtoneStopRef.current();
          ringtoneStopRef.current = startRingtoneLoop(getSavedRingtone());

          setIncomingCall({
            callId: sig.callId,
            callerUid: sig.uid,
            callerName: sig.callerName || "Friend",
            callerPhotoURL: sig.callerPhotoURL || "",
            callType: sig.callType || "audio",
            timestamp: Date.now(),
          });

          // Auto-timeout incoming call after 30 seconds if unanswered
          if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = setTimeout(() => {
            if (ringtoneStopRef.current) {
              ringtoneStopRef.current();
              ringtoneStopRef.current = null;
            }
            setIncomingCall(null);
          }, 30000);
          break;
        }

        case "direct_call_declined": {
          if (outgoingCall && outgoingCall.callId === sig.callId) {
            if (ringbackStopRef.current) {
              ringbackStopRef.current();
              ringbackStopRef.current = null;
            }
            playCallTone("declined");
            cleanupCall();
          }
          break;
        }

        case "direct_call_cancelled": {
          if (incomingCall && incomingCall.callId === sig.callId) {
            if (ringtoneStopRef.current) {
              ringtoneStopRef.current();
              ringtoneStopRef.current = null;
            }
            setIncomingCall(null);
          }
          break;
        }

        case "direct_call_accepted": {
          if (outgoingCall && outgoingCall.callId === sig.callId) {
            if (ringbackStopRef.current) {
              ringbackStopRef.current();
              ringbackStopRef.current = null;
            }
            playCallTone("connected");

            // Initiator creates and sends SDP Offer
            const pc = peerConnectionRef.current;
            if (pc && localStreamRef.current) {
              try {
                localStreamRef.current.getTracks().forEach((track) => {
                  pc.addTrack(track, localStreamRef.current!);
                });

                const offer = await pc.createOffer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: outgoingCall.callType === "video",
                });
                await pc.setLocalDescription(offer);

                sendBroadcastSignal({
                  type: "direct_call_offer",
                  uid: currentProfile.uid,
                  targetUid: outgoingCall.targetUid,
                  callId: outgoingCall.callId,
                  sdp: JSON.stringify(offer),
                });

                setActiveCall({
                  callId: outgoingCall.callId,
                  partnerUid: outgoingCall.targetUid,
                  partnerName: outgoingCall.targetName,
                  partnerPhotoURL: outgoingCall.targetPhotoURL,
                  callType: outgoingCall.callType,
                  startTime: Date.now(),
                  isMuted: false,
                  isDeafened: false,
                  isCameraOn: outgoingCall.callType === "video",
                  isInitiator: true,
                });
                setOutgoingCall(null);
              } catch (err) {
                console.error("Error creating direct call offer:", err);
                cleanupCall();
              }
            }
          }
          break;
        }

        case "direct_call_offer": {
          if (incomingCall && incomingCall.callId === sig.callId && sig.sdp) {
            const pc = peerConnectionRef.current;
            if (pc && localStreamRef.current) {
              try {
                localStreamRef.current.getTracks().forEach((track) => {
                  pc.addTrack(track, localStreamRef.current!);
                });

                const offerDesc = new RTCSessionDescription(JSON.parse(sig.sdp));
                await pc.setRemoteDescription(offerDesc);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                sendBroadcastSignal({
                  type: "direct_call_answer",
                  uid: currentProfile.uid,
                  targetUid: sig.uid,
                  callId: sig.callId,
                  sdp: JSON.stringify(answer),
                });
              } catch (err) {
                console.error("Error answering direct call offer:", err);
                cleanupCall();
              }
            }
          }
          break;
        }

        case "direct_call_answer": {
          if (peerConnectionRef.current && sig.sdp) {
            try {
              const answerDesc = new RTCSessionDescription(JSON.parse(sig.sdp));
              await peerConnectionRef.current.setRemoteDescription(answerDesc);
            } catch (err) {
              console.error("Error setting remote answer:", err);
            }
          }
          break;
        }

        case "direct_call_candidate": {
          if (peerConnectionRef.current && sig.candidate) {
            try {
              const candidate = new RTCIceCandidate(JSON.parse(sig.candidate));
              await peerConnectionRef.current.addIceCandidate(candidate);
            } catch (err) {
              console.error("Error adding ice candidate:", err);
            }
          }
          break;
        }

        case "direct_call_ended": {
          playCallTone("declined");
          cleanupCall();
          break;
        }

        // Switch to Video Request from Partner:
        // "when your on audio call it doesnt let you do video until they answer like when you click video it will show on audio call 'Do you want to switch to video call?' theres a yes or no button then it will switch to video and automatically turn on their camera"
        case "switch_video_request": {
          if (activeCall && activeCall.callId === sig.callId) {
            playCallTone("switch_prompt");
            setIsVideoSwitchRequested(true);
          }
          break;
        }

        case "switch_video_response": {
          if (activeCall && activeCall.callId === sig.callId) {
            setIsVideoSwitchPending(false);
            if (sig.accepted) {
              // Partner accepted! Turn on camera and renegotiate video
              playCallTone("connected");
              try {
                const videoStream = await navigator.mediaDevices.getUserMedia({
                  video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
                });
                const videoTrack = videoStream.getVideoTracks()[0];
                if (videoTrack && peerConnectionRef.current && localStreamRef.current) {
                  localStreamRef.current.addTrack(videoTrack);
                  peerConnectionRef.current.addTrack(videoTrack, localStreamRef.current);

                  // Renegotiate offer for video
                  const offer = await peerConnectionRef.current.createOffer();
                  await peerConnectionRef.current.setLocalDescription(offer);
                  sendBroadcastSignal({
                    type: "direct_call_offer",
                    uid: currentProfile.uid,
                    targetUid: activeCall.partnerUid,
                    callId: activeCall.callId,
                    sdp: JSON.stringify(offer),
                  });

                  setActiveCall((prev) => (prev ? { ...prev, callType: "video", isCameraOn: true } : null));
                  setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
                }
              } catch (e) {
                console.error("Error activating camera on switch accepted:", e);
              }
            } else {
              playCallTone("declined");
              alert(`${activeCall.partnerName} declined to switch to video call.`);
            }
          }
          break;
        }
      }
    });

    return () => unsubSignals();
  }, [currentProfile?.uid, incomingCall, outgoingCall, activeCall, cleanupCall]);

  // 4. Action: Start 1-on-1 Direct Call (Calls ONLY this user, NOT everyone!)
  const startDirectCall = useCallback(
    async (targetUser: CallUser, type: "audio" | "video") => {
      if (!currentProfile?.uid) {
        alert("Please set up your display name in Chat first to start direct calling.");
        return;
      }

      cleanupCall();
      const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      try {
        // Acquire user media with clean noise cancellation and zero compression
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
          },
          video: type === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        });
        setLocalStream(stream);
        localStreamRef.current = stream;

        // Initialize PeerConnection
        createDirectPeerConnection(targetUser.uid, callId);

        // Start musical outgoing ringback sound
        ringbackStopRef.current = playCallTone("calling");

        setOutgoingCall({
          callId,
          targetUid: targetUser.uid,
          targetName: targetUser.username,
          targetPhotoURL: targetUser.photoURL || "",
          callType: type,
          status: "ringing",
          timestamp: Date.now(),
        });

        // Send direct signal targeted ONLY to this specific user!
        sendBroadcastSignal({
          type: "direct_call_invite",
          uid: currentProfile.uid,
          targetUid: targetUser.uid, // Strictly target this user
          callId,
          callerName: currentProfile.username,
          callerPhotoURL: currentProfile.photoURL || "",
          callType: type,
        });

        setIsCallMenuOpen(false);

        // 35s timeout if no answer
        callTimeoutRef.current = setTimeout(() => {
          if (ringbackStopRef.current) {
            ringbackStopRef.current();
            ringbackStopRef.current = null;
          }
          playCallTone("declined");
          cleanupCall();
          alert(`${targetUser.username} did not answer.`);
        }, 35000);
      } catch (err: any) {
        console.error("Failed to access microphone or camera for direct call:", err);
        alert("Could not access microphone/camera. Please grant media permissions.");
        cleanupCall();
      }
    },
    [currentProfile, cleanupCall, createDirectPeerConnection]
  );

  // 5. Action: Answer Incoming Call
  const answerIncomingCall = useCallback(async () => {
    if (!incomingCall || !currentProfile?.uid) return;

    if (ringtoneStopRef.current) {
      ringtoneStopRef.current();
      ringtoneStopRef.current = null;
    }

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    playCallTone("connected");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
        video: incomingCall.callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      createDirectPeerConnection(incomingCall.callerUid, incomingCall.callId);

      setActiveCall({
        callId: incomingCall.callId,
        partnerUid: incomingCall.callerUid,
        partnerName: incomingCall.callerName,
        partnerPhotoURL: incomingCall.callerPhotoURL,
        callType: incomingCall.callType,
        startTime: Date.now(),
        isMuted: false,
        isDeafened: false,
        isCameraOn: incomingCall.callType === "video",
        isInitiator: false,
      });

      // Send direct acceptance signal back to caller
      sendBroadcastSignal({
        type: "direct_call_accepted",
        uid: currentProfile.uid,
        targetUid: incomingCall.callerUid,
        callId: incomingCall.callId,
      });

      setIncomingCall(null);
    } catch (err) {
      console.error("Failed to answer call:", err);
      alert("Could not access media devices to answer call.");
      cleanupCall();
    }
  }, [incomingCall, currentProfile, createDirectPeerConnection, cleanupCall]);

  // 6. Action: Decline Incoming Call
  const declineIncomingCall = useCallback(() => {
    if (!incomingCall || !currentProfile?.uid) return;

    if (ringtoneStopRef.current) {
      ringtoneStopRef.current();
      ringtoneStopRef.current = null;
    }

    sendBroadcastSignal({
      type: "direct_call_declined",
      uid: currentProfile.uid,
      targetUid: incomingCall.callerUid,
      callId: incomingCall.callId,
    });

    setIncomingCall(null);
  }, [incomingCall, currentProfile]);

  // 7. Action: Cancel Outgoing Call
  const cancelOutgoingCall = useCallback(() => {
    if (!outgoingCall || !currentProfile?.uid) return;

    sendBroadcastSignal({
      type: "direct_call_cancelled",
      uid: currentProfile.uid,
      targetUid: outgoingCall.targetUid,
      callId: outgoingCall.callId,
    });

    cleanupCall();
  }, [outgoingCall, currentProfile, cleanupCall]);

  // 8. Action: End Active Call
  const endActiveCall = useCallback(() => {
    if (!activeCall || !currentProfile?.uid) return;

    sendBroadcastSignal({
      type: "direct_call_ended",
      uid: currentProfile.uid,
      targetUid: activeCall.partnerUid,
      callId: activeCall.callId,
    });

    playCallTone("declined");
    cleanupCall();
  }, [activeCall, currentProfile, cleanupCall]);

  // 9. Action: Switch to Video Request (during audio call)
  const requestSwitchToVideo = useCallback(() => {
    if (!activeCall || !currentProfile?.uid || activeCall.callType === "video") return;

    setIsVideoSwitchPending(true);
    sendBroadcastSignal({
      type: "switch_video_request",
      uid: currentProfile.uid,
      targetUid: activeCall.partnerUid,
      callId: activeCall.callId,
    });
  }, [activeCall, currentProfile]);

  // 10. Action: Respond to Switch to Video Request (Yes or No)
  const respondToVideoSwitch = useCallback(
    async (accept: boolean) => {
      if (!activeCall || !currentProfile?.uid) return;

      setIsVideoSwitchRequested(false);

      if (!accept) {
        sendBroadcastSignal({
          type: "switch_video_response",
          uid: currentProfile.uid,
          targetUid: activeCall.partnerUid,
          callId: activeCall.callId,
          accepted: false,
        });
        return;
      }

      // Automatically turn on their camera when clicking Yes!
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (videoTrack && peerConnectionRef.current && localStreamRef.current) {
          localStreamRef.current.addTrack(videoTrack);
          peerConnectionRef.current.addTrack(videoTrack, localStreamRef.current);

          sendBroadcastSignal({
            type: "switch_video_response",
            uid: currentProfile.uid,
            targetUid: activeCall.partnerUid,
            callId: activeCall.callId,
            accepted: true,
          });

          setActiveCall((prev) => (prev ? { ...prev, callType: "video", isCameraOn: true } : null));
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
      } catch (err) {
        console.error("Error activating camera on switch response:", err);
        alert("Could not access camera to switch to video call.");
      }
    },
    [activeCall, currentProfile]
  );

  // 11. Mute Toggle
  const toggleMute = useCallback(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setActiveCall((prev) => (prev ? { ...prev, isMuted: !audioTrack.enabled } : null));
    }
  }, [localStream]);

  // 12. Deafen Toggle
  const toggleDeafen = useCallback(() => {
    setActiveCall((prev) => (prev ? { ...prev, isDeafened: !prev.isDeafened } : null));
  }, []);

  // 13. Camera Toggle (when already in video call)
  const toggleCamera = useCallback(async () => {
    if (!localStream || !activeCall) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setActiveCall((prev) => (prev ? { ...prev, isCameraOn: videoTrack.enabled } : null));
    }
  }, [localStream, activeCall]);

  // 14. Action: Start Group Call (Separate feature to call everyone / group room)
  const startGroupCall = useCallback(() => {
    setIsCallMenuOpen(false);
    if (onOpenGroupVoiceRef.current) {
      onOpenGroupVoiceRef.current();
    }
  }, []);

  return (
    <CallContext.Provider
      value={{
        onlineUsers,
        incomingCall,
        outgoingCall,
        activeCall,
        localStream,
        remoteStream,
        isVideoSwitchRequested,
        isVideoSwitchPending,
        voiceUserCount,
        isCallMenuOpen,
        setIsCallMenuOpen,
        startDirectCall,
        startGroupCall,
        joinGeneralVoice: startGroupCall,
        answerIncomingCall,
        declineIncomingCall,
        cancelOutgoingCall,
        endActiveCall,
        toggleMute,
        toggleDeafen,
        requestSwitchToVideo,
        respondToVideoSwitch,
        toggleCamera,
        setOnOpenGroupVoice,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
