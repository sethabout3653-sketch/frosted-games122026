import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ICE_SERVERS,
  acquireRobustMediaStream,
  IceManager,
  gatherAndConsolidate,
  optimizeAudioSdp,
  requestScreenWakeLock,
  releaseScreenWakeLock,
  unlockMobileAudio,
} from "../lib/webrtc-config";
import { sendBroadcastSignal, subscribeBroadcastSignals } from "../lib/database";
import { getSavedProfile } from "../lib/activity-tracker";
import {
  startRingtoneLoop,
  playCallTone,
  getSavedRingtone,
  SOUND_ASSETS,
} from "../lib/ringtone-synthesizer";
import { collection, onSnapshot, query, db, toTimestampMs, doc, getDoc } from "../supabase-adapter";


import { isAllowedUsername, isGuestUser } from "../lib/user-filter";

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
  screenStream: MediaStream | null;
  isScreenSharing: boolean;
  isVideoSwitchRequested: boolean;
  isVideoSwitchPending: boolean;
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
  toggleScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  startScreenShare: () => Promise<void>;
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
  const [myProfile, setMyProfile] = useState(() => getSavedProfile());
  const [onlineUsers, setOnlineUsers] = useState<CallUser[]>([]);
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<OutgoingCallData | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCallData | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const [isVideoSwitchRequested, setIsVideoSwitchRequested] = useState(false);
  const [isVideoSwitchPending, setIsVideoSwitchPending] = useState(false);
  const [isCallMenuOpen, setIsCallMenuOpen] = useState(false);
  const [voiceUserCount, setVoiceUserCount] = useState<number>(0);

  const onOpenGroupVoiceRef = useRef<(() => void) | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const ringtoneStopRef = useRef<(() => void) | null>(null);
  const ringbackStopRef = useRef<(() => void) | null>(null);
  const callTimeoutRef = useRef<any>(null);

  // References to keep state accessible in async signal handlers without stale closures
  const activeCallRef = useRef<ActiveCallData | null>(null);
  const outgoingCallRef = useRef<OutgoingCallData | null>(null);
  const incomingCallRef = useRef<IncomingCallData | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const onlineUsersRef = useRef<CallUser[]>([]);
  const directCallFailCountRef = useRef<Record<string, number>>({});

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    outgoingCallRef.current = outgoingCall;
  }, [outgoingCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    onlineUsersRef.current = onlineUsers;
  }, [onlineUsers]);

  // Dynamic profile sync
  useEffect(() => {
    const handleProfileUpdate = () => {
      const p = getSavedProfile();
      setMyProfile((prev) => {
        if (prev?.uid === p.uid && prev?.username === p.username && prev?.photoURL === p.photoURL && prev?.tag === p.tag) {
          return prev;
        }
        return p;
      });
    };

    window.addEventListener("frosted_profile_updated", handleProfileUpdate);
    window.addEventListener("storage", handleProfileUpdate);
    return () => {
      window.removeEventListener("frosted_profile_updated", handleProfileUpdate);
      window.removeEventListener("storage", handleProfileUpdate);
    };
  }, []);

  const getMyProfile = useCallback(() => {
    return getSavedProfile();
  }, []);

  const setOnOpenGroupVoice = useCallback((cb: () => void) => {
    onOpenGroupVoiceRef.current = cb;
  }, []);

  // Track active participants in General Voice
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "voice_users"),
      (snapshot) => {
        const now = Date.now();
        let count = 0;
        snapshot.docs.forEach((d: any) => {
          const data = d.data();
          const uname = (data?.username || "").trim();
          if (!isAllowedUsername(uname, data?.uid, myProfile?.uid)) return;
          const ts = toTimestampMs(data?.timestamp || data?.lastSeen);
          if (ts > 0 && Math.abs(now - ts) <= 12000 && data.inVoice !== false) {
            count++;
          }
        });
        setVoiceUserCount(count);
      },
      () => {}
    );
    return () => unsub();
  }, [myProfile?.uid]);

  // Keep localStreamRef synced
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // Subscribe to online users via presence collection
  useEffect(() => {
    const q = query(collection(db, "presence"));
    const unsub = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const current = getMyProfile();
      const myUid = current?.uid || "";
      const myName = (current?.username || "").trim().toLowerCase();
      const map = new Map<string, CallUser>();

      snapshot.docs.forEach((d: any) => {
        const data = d.data();
        const uname = (data.username || "").trim();
        if (!uname || uname.toLowerCase() === "anonymous" || !isAllowedUsername(uname, data.uid, myUid)) return;
        if (data.uid === myUid) return;

        const ts = toTimestampMs(data.lastSeen || data.timestamp);
        if (ts > 0 && now - ts <= 35000) {
          const userPhoto =
            data.photoURL ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(uname)}`;

          map.set(data.uid, {
            uid: data.uid,
            username: uname,
            photoURL: userPhoto,
            status: data.status || "online",
            activity: data.activity,
          });
        }
      });

      const usersList = Array.from(map.values());
      setOnlineUsers(usersList);
      onlineUsersRef.current = usersList;
    });

    return () => unsub();
  }, [getMyProfile]);

  // Clean up all call media and state
  const cleanupCall = useCallback(() => {
    releaseScreenWakeLock();
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
        peerConnectionRef.current.onconnectionstatechange = null;
        peerConnectionRef.current.close();
      } catch (e) {}
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);

    pendingIceCandidatesRef.current = [];
    currentCallIdRef.current = null;
    activeCallRef.current = null;
    outgoingCallRef.current = null;
    incomingCallRef.current = null;

    setRemoteStream(null);
    setIncomingCall(null);
    setOutgoingCall(null);
    setActiveCall(null);
    setIsVideoSwitchRequested(false);
    setIsVideoSwitchPending(false);
  }, []);

  // Initialize WebRTC PeerConnection for 1-on-1 Call
  const createDirectPeerConnection = useCallback(
    (partnerUid: string, callId: string) => {
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.onicecandidate = null;
          peerConnectionRef.current.ontrack = null;
          peerConnectionRef.current.close();
        } catch (e) {}
      }

      currentCallIdRef.current = callId;
      pendingIceCandidatesRef.current = [];

      const config: RTCConfiguration = {
        ...ICE_SERVERS,
        iceTransportPolicy: "all",
      };
      const pc = new RTCPeerConnection(config);
      peerConnectionRef.current = pc;

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const cached = IceManager.getCachedCandidates(partnerUid);
          IceManager.saveCandidates(partnerUid, [...cached, event.candidate]);
          const prof = getSavedProfile();
          sendBroadcastSignal({
            type: "direct_call_candidate",
            uid: prof.uid,
            targetUid: partnerUid,
            callId,
            candidate: JSON.stringify(event.candidate),
          });
        }
      };

      // Handle incoming remote audio/video tracks
      pc.ontrack = (event) => {
        event.track.enabled = true;
        setRemoteStream((prev) => {
          const currentTracks = prev ? prev.getTracks().filter((t) => t.id !== event.track.id) : [];
          return new MediaStream([...currentTracks, event.track]);
        });

        event.track.onunmute = () => {
          setRemoteStream((prev) => {
            if (!prev) return new MediaStream([event.track]);
            const currentTracks = prev.getTracks().filter((t) => t.id !== event.track.id);
            return new MediaStream([...currentTracks, event.track]);
          });
        };

        event.track.onended = () => {
          setRemoteStream((prev) => {
            if (!prev) return null;
            const remaining = prev.getTracks().filter((t) => t.id !== event.track.id);
            return remaining.length > 0 ? new MediaStream(remaining) : null;
          });
        };
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        console.log(`Direct Connection State: ${state}`);
        if (state === "connected") {
          directCallFailCountRef.current[partnerUid] = 0;
        }
        if (state === "failed") {
          console.warn("Direct WebRTC connection failed. Initiating ICE Restart fallback...");
          directCallFailCountRef.current[partnerUid] = (directCallFailCountRef.current[partnerUid] || 0) + 1;
          if (activeCallRef.current) {
            try {
              if (typeof pc.restartIce === "function") {
                pc.restartIce();
              }
              pc.createOffer({ iceRestart: true }).then((offer) => {
                const optOfferSdp = optimizeAudioSdp(offer.sdp || "");
                return pc.setLocalDescription({ type: "offer", sdp: optOfferSdp }).then(() => {
                  const prof = getSavedProfile();
                  sendBroadcastSignal({
                    type: "direct_call_offer",
                    uid: prof.uid,
                    targetUid: partnerUid,
                    callId,
                    sdp: JSON.stringify({ type: "offer", sdp: optOfferSdp }),
                  });
                });
              }).catch((err) => {
                console.error("Direct ICE Restart offer failed, cleaning up call:", err);
                playCallTone("declined");
                cleanupCall();
              });
            } catch (err) {
              console.error("Failed to trigger direct call ICE restart:", err);
              playCallTone("declined");
              cleanupCall();
            }
          } else {
            playCallTone("declined");
            cleanupCall();
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        console.log(`Direct ICE Connection State: ${iceState}`);
        if (iceState === "failed" || iceState === "disconnected") {
          if (activeCallRef.current) {
            // Wait 2.5 seconds to see if connection naturally recovers, otherwise trigger restart
            setTimeout(() => {
              if (
                peerConnectionRef.current === pc &&
                (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") &&
                pc.connectionState !== "connected"
              ) {
                console.warn("ICE connection remains disconnected. Triggering ICE Restart...");
                try {
                  if (typeof pc.restartIce === "function") {
                    pc.restartIce();
                  }
                  pc.createOffer({ iceRestart: true }).then((offer) => {
                    const optOfferSdp = optimizeAudioSdp(offer.sdp || "");
                    return pc.setLocalDescription({ type: "offer", sdp: optOfferSdp }).then(() => {
                      const prof = getSavedProfile();
                      sendBroadcastSignal({
                        type: "direct_call_offer",
                        uid: prof.uid,
                        targetUid: partnerUid,
                        callId,
                        sdp: JSON.stringify({ type: "offer", sdp: optOfferSdp }),
                      });
                    });
                  }).catch(() => {});
                } catch (e) {}
              }
            }, 2500);
          }
        }
      };

      return pc;
    },
    [cleanupCall]
  );

  // Drain pending ICE candidates once remote description is set
  const drainIceCandidates = useCallback(async (pc: RTCPeerConnection) => {
    while (pendingIceCandidatesRef.current.length > 0) {
      const candidateInit = pendingIceCandidatesRef.current.shift();
      if (candidateInit) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch (e) {
          console.warn("Error adding queued ice candidate:", e);
        }
      }
    }
  }, []);

  // Listen for direct call signals targeting this user
  useEffect(() => {
    const prof = myProfile || getSavedProfile();
    if (!prof?.uid) return;

    const unsubSignals = subscribeBroadcastSignals(prof.uid, async (sig) => {
      if (!sig || !sig.type) return;

      const myProf = getSavedProfile();
      // Ensure signal is strictly for this user (1-on-1 direct targeting)
      const target = sig.targetUid || "";
      const myUid = myProf.uid || "";
      const myBase = myUid.split("_tab_")[0];
      const targetBase = target.split("_tab_")[0];

      const isTargetedToMe =
        !target ||
        target === "all" ||
        target === myUid ||
        target.startsWith(myUid) ||
        myUid.startsWith(target) ||
        (targetBase && myBase && targetBase === myBase);

      if (!isTargetedToMe) return;

      switch (sig.type) {
        case "direct_call_invite": {
          if (isGuestUser(myProf.username)) return;
          // If already in an active or outgoing call, auto-decline as busy
          if (activeCallRef.current || outgoingCallRef.current) {
            sendBroadcastSignal({
              type: "direct_call_declined",
              uid: myProf.uid,
              targetUid: sig.uid,
              callId: sig.callId,
              reason: "busy",
            });
            return;
          }

          // Resolve caller name and photo accurately
          let callerName = (sig.callerName || "").trim();
          if (!callerName || callerName.toLowerCase() === "friend") {
            const match = onlineUsersRef.current.find((u) => u.uid === sig.uid);
            callerName = match?.username || `Player_${sig.uid.slice(-4)}`;
          }

          let callerPhoto = sig.callerPhotoURL;
          if (!callerPhoto) {
            const match = onlineUsersRef.current.find((u) => u.uid === sig.uid);
            callerPhoto =
              match?.photoURL ||
              `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(callerName)}`;
          }

          // Start musical ringtone loop in the background
          if (ringtoneStopRef.current) ringtoneStopRef.current();
          ringtoneStopRef.current = startRingtoneLoop(getSavedRingtone());

          const incomingData: IncomingCallData = {
            callId: sig.callId,
            callerUid: sig.uid,
            callerName,
            callerPhotoURL: callerPhoto,
            callType: sig.callType || "audio",
            timestamp: Date.now(),
          };

          currentCallIdRef.current = sig.callId;
          incomingCallRef.current = incomingData;
          setIncomingCall(incomingData);

          // Auto-timeout incoming call after 30 seconds if unanswered
          if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = setTimeout(() => {
            if (ringtoneStopRef.current) {
              ringtoneStopRef.current();
              ringtoneStopRef.current = null;
            }
            incomingCallRef.current = null;
            setIncomingCall(null);
          }, 30000);
          break;
        }

        case "direct_call_declined": {
          if (
            outgoingCallRef.current &&
            outgoingCallRef.current.callId === sig.callId
          ) {
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
          if (
            incomingCallRef.current &&
            incomingCallRef.current.callId === sig.callId
          ) {
            if (ringtoneStopRef.current) {
              ringtoneStopRef.current();
              ringtoneStopRef.current = null;
            }
            incomingCallRef.current = null;
            setIncomingCall(null);
          }
          break;
        }

        case "direct_call_answered_elsewhere":
        case "direct_call_declined_elsewhere": {
          // If another device of the same user handled the call, dismiss it here
          if (
            incomingCallRef.current &&
            incomingCallRef.current.callId === sig.callId
          ) {
            if (ringtoneStopRef.current) {
              ringtoneStopRef.current();
              ringtoneStopRef.current = null;
            }
            incomingCallRef.current = null;
            setIncomingCall(null);
          }
          break;
        }

        case "direct_call_accepted": {
          const currentOut = outgoingCallRef.current;
          const isMatch =
            currentOut &&
            (!sig.callId ||
              currentOut.callId === sig.callId ||
              currentOut.targetUid === sig.uid ||
              currentOut.targetUid.split("_tab_")[0] === (sig.uid || "").split("_tab_")[0]);

          if (isMatch && currentOut) {
            if (callTimeoutRef.current) {
              clearTimeout(callTimeoutRef.current);
              callTimeoutRef.current = null;
            }
            if (ringbackStopRef.current) {
              ringbackStopRef.current();
              ringbackStopRef.current = null;
            }
            playCallTone("connected");

            let pc = peerConnectionRef.current;
            if (!pc) {
              pc = createDirectPeerConnection(currentOut.targetUid, currentOut.callId);
            }

            if (pc) {
              try {
                // Ensure local stream and tracks are attached
                if (localStreamRef.current) {
                  const currentSenders = pc.getSenders();
                  localStreamRef.current.getTracks().forEach((track) => {
                    const alreadyAdded = currentSenders.some(
                      (s) => s.track && s.track.kind === track.kind
                    );
                    if (!alreadyAdded) {
                      pc!.addTrack(track, localStreamRef.current!);
                    }
                  });
                }

                // Reuse cached candidates for direct calls
                const cached = IceManager.getCachedCandidates(currentOut.targetUid);
                for (const cand of cached) {
                  try { await pc.addIceCandidate(cand); } catch {}
                }

                const offer = await pc.createOffer({
                  offerToReceiveAudio: true,
                  offerToReceiveVideo: true,
                });
                
                const optOfferSdp = optimizeAudioSdp(offer.sdp || "");
                await pc.setLocalDescription({ type: "offer", sdp: optOfferSdp });

                // Consolidate gathering
                const consolidatedSdp = await gatherAndConsolidate(pc, 400);

                // Optimize senders bitrate
                pc.getSenders().forEach((s) => {
                  try {
                    const params = s.getParameters();
                    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
                    if (s.track?.kind === "video") {
                      params.encodings[0].maxBitrate = 1200000;
                      params.encodings[0].priority = "high";
                      params.encodings[0].networkPriority = "high";
                    } else if (s.track?.kind === "audio") {
                      params.encodings[0].maxBitrate = 96000;
                      params.encodings[0].priority = "high";
                    }
                    s.setParameters(params).catch(() => {});
                  } catch {}
                });

                sendBroadcastSignal({
                  type: "direct_call_offer",
                  uid: myProf.uid,
                  targetUid: currentOut.targetUid,
                  callId: currentOut.callId,
                  sdp: JSON.stringify({ type: "offer", sdp: consolidatedSdp }),
                });

                const activeData: ActiveCallData = {
                  callId: currentOut.callId,
                  partnerUid: currentOut.targetUid,
                  partnerName: currentOut.targetName,
                  partnerPhotoURL: currentOut.targetPhotoURL,
                  callType: currentOut.callType,
                  startTime: Date.now(),
                  isMuted: false,
                  isDeafened: false,
                  isCameraOn: currentOut.callType === "video",
                  isInitiator: true,
                };

                activeCallRef.current = activeData;
                currentCallIdRef.current = currentOut.callId;
                outgoingCallRef.current = null;

                setActiveCall(activeData);
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
          // Accept offer if this is the active/incoming call session
          const activePartner = activeCallRef.current?.partnerUid || incomingCallRef.current?.callerUid;
          const isPartnerMatch =
            activePartner &&
            (activePartner === sig.uid ||
              activePartner.split("_tab_")[0] === (sig.uid || "").split("_tab_")[0] ||
              (sig.uid || "").startsWith(activePartner));

          const isValidCall =
            !sig.callId ||
            currentCallIdRef.current === sig.callId ||
            activeCallRef.current?.callId === sig.callId ||
            incomingCallRef.current?.callId === sig.callId ||
            Boolean(isPartnerMatch);

          if (isValidCall && sig.sdp) {
            let pc = peerConnectionRef.current;
            if (!pc) {
              pc = createDirectPeerConnection(sig.uid, sig.callId);
            }

            try {
              // Add local tracks if available
              if (localStreamRef.current) {
                const currentSenders = pc.getSenders();
                localStreamRef.current.getTracks().forEach((track) => {
                  const alreadyAdded = currentSenders.some(
                    (s) => s.track && s.track.kind === track.kind
                  );
                  if (!alreadyAdded) {
                    pc!.addTrack(track, localStreamRef.current!);
                  }
                });
              }

              let offerParsed: any = sig.sdp;
              if (typeof offerParsed === "string") {
                try {
                  offerParsed = JSON.parse(offerParsed);
                } catch {
                  offerParsed = { type: "offer", sdp: sig.sdp };
                }
              }
              const offerSdpStr = offerParsed?.sdp || (typeof offerParsed === "string" ? offerParsed : "");
              const offerDesc = new RTCSessionDescription({
                type: offerParsed?.type || "offer",
                sdp: offerSdpStr,
              });
              await pc.setRemoteDescription(offerDesc);

              // Drain any queued ICE candidates
              await drainIceCandidates(pc);

              const answer = await pc.createAnswer();
              const optAnswerSdp = optimizeAudioSdp(answer.sdp || "");
              await pc.setLocalDescription({ type: "answer", sdp: optAnswerSdp });

              // Optimize senders bitrate
              pc.getSenders().forEach((s) => {
                try {
                  const params = s.getParameters();
                  if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
                  if (s.track?.kind === "video") {
                    params.encodings[0].maxBitrate = 1200000;
                    params.encodings[0].priority = "high";
                    params.encodings[0].networkPriority = "high";
                  } else if (s.track?.kind === "audio") {
                    params.encodings[0].maxBitrate = 96000;
                    params.encodings[0].priority = "high";
                  }
                  s.setParameters(params).catch(() => {});
                } catch {}
              });

              // Consolidate
              const consolidatedSdp = await gatherAndConsolidate(pc, 300);

              sendBroadcastSignal({
                type: "direct_call_answer",
                uid: myProf.uid,
                targetUid: sig.uid,
                callId: sig.callId,
                sdp: JSON.stringify({ type: "answer", sdp: consolidatedSdp }),
              });
            } catch (err) {
              console.error("Error answering direct call offer:", err);
            }
          }
          break;
        }

        case "direct_call_answer": {
          const pc = peerConnectionRef.current;
          if (pc && sig.sdp) {
            try {
              let answerParsed: any = sig.sdp;
              if (typeof answerParsed === "string") {
                try {
                  answerParsed = JSON.parse(answerParsed);
                } catch {
                  answerParsed = { type: "answer", sdp: sig.sdp };
                }
              }
              const answerSdpStr = answerParsed?.sdp || (typeof answerParsed === "string" ? answerParsed : "");
              const answerDesc = new RTCSessionDescription({
                type: answerParsed?.type || "answer",
                sdp: answerSdpStr,
              });
              await pc.setRemoteDescription(answerDesc);
              await drainIceCandidates(pc);
            } catch (err) {
              console.error("Error setting remote answer:", err);
            }
          }
          break;
        }

        case "direct_call_candidate": {
          const pc = peerConnectionRef.current;
          if (sig.candidate) {
            try {
              let candidate: any = sig.candidate;
              if (typeof candidate === "string") {
                try {
                  candidate = JSON.parse(candidate);
                } catch {}
              }
              if (candidate && candidate.candidate && typeof candidate.candidate === "object") {
                candidate = candidate.candidate;
              }
              if (candidate) {
                if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                  } catch (e) {}
                } else {
                  // Queue until remote description is set
                  pendingIceCandidatesRef.current.push(candidate);
                }
              }
            } catch (err) {
              console.error("Error handling ice candidate:", err);
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
        case "switch_video_request": {
          const cur = activeCallRef.current;
          const isMatch =
            cur &&
            (cur.callId === sig.callId ||
              cur.partnerUid === sig.uid ||
              cur.partnerUid.split("_tab_")[0] === sig.uid.split("_tab_")[0] ||
              sig.uid.startsWith(cur.partnerUid));

          if (isMatch) {
            playCallTone("switch_prompt");
            setIsVideoSwitchRequested(true);
          }
          break;
        }

        case "switch_video_response": {
          const cur = activeCallRef.current;
          const isMatch =
            cur &&
            (cur.callId === sig.callId ||
              cur.partnerUid === sig.uid ||
              cur.partnerUid.split("_tab_")[0] === sig.uid.split("_tab_")[0] ||
              sig.uid.startsWith(cur.partnerUid));

          if (isMatch) {
            setIsVideoSwitchPending(false);
            if (sig.accepted) {
              // Partner accepted! Turn on camera, add video track and renegotiate
              playCallTone("connected");
              try {
                let videoStream: MediaStream;
                try {
                  videoStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                      width: { ideal: 1280, max: 1280 },
                      height: { ideal: 720, max: 720 },
                      frameRate: { ideal: 30, max: 30 },
                    },
                  });
                } catch {
                  videoStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
                  });
                }
                const videoTrack = videoStream.getVideoTracks()[0];
                if (videoTrack) {
                  try {
                    (videoTrack as any).contentHint = "motion";
                  } catch {}
                }
                const pc = peerConnectionRef.current;

                if (videoTrack && pc && localStreamRef.current) {
                  // Add track to local stream
                  localStreamRef.current.addTrack(videoTrack);
                  setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

                  // Add or replace track on peer connection
                  const senders = pc.getSenders();
                  const videoSender = senders.find(
                    (s) => s.track && s.track.kind === "video"
                  );
                  if (videoSender) {
                    await videoSender.replaceTrack(videoTrack);
                    try {
                      const params = videoSender.getParameters();
                      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
                      params.encodings[0].maxBitrate = 1200000;
                      params.encodings[0].priority = "high";
                      params.encodings[0].networkPriority = "high";
                      await videoSender.setParameters(params).catch(() => {});
                    } catch {}
                  } else {
                    pc.addTrack(videoTrack, localStreamRef.current);
                  }

                  // Renegotiate offer for video
                  const offer = await pc.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                  });
                  const optOfferSdp = optimizeAudioSdp(offer.sdp || "");
                  await pc.setLocalDescription({ type: "offer", sdp: optOfferSdp });

                  sendBroadcastSignal({
                    type: "direct_call_offer",
                    uid: myProf.uid,
                    targetUid: activeCallRef.current!.partnerUid,
                    callId: activeCallRef.current!.callId,
                    sdp: JSON.stringify({ type: "offer", sdp: optOfferSdp }),
                  });

                  setActiveCall((prev) =>
                    prev ? { ...prev, callType: "video", isCameraOn: true } : null
                  );
                }
              } catch (e) {
                console.error("Error activating camera on switch accepted:", e);
                alert("Could not access camera to switch to video call.");
              }
            } else {
              playCallTone("declined");
              alert(
                `${activeCallRef.current?.partnerName || "User"} declined to switch to video call.`
              );
            }
          }
          break;
        }

        case "soundboard_played": {
          if (activeCallRef.current) {
            try {
              const data = JSON.parse(sig.sdp || "{}");
              if (data && data.soundUrl) {
                const audio = new Audio(data.soundUrl);
                audio.volume = 0.65;
                audio.play().catch(() => {});
              }
            } catch (e) {}
          }
          break;
        }
      }
    });

    return () => unsubSignals();
  }, [cleanupCall, createDirectPeerConnection, drainIceCandidates, myProfile?.uid]);

  // Action: Start 1-on-1 Direct Call
  const startDirectCall = useCallback(
    async (targetUser: CallUser, type: "audio" | "video") => {
      const myProf = getMyProfile();
      if (isGuestUser(myProf?.username)) {
        alert("Guest accounts do not have access to phone, video, or voice calls.");
        return;
      }

      // Check if target user is currently in General Voice
      try {
        const vSnap = await getDoc(doc(db, "voice_users", targetUser.uid));
        const pSnap = await getDoc(doc(db, "presence", targetUser.uid));
        const now = Date.now();
        let targetInVoice = false;

        if (vSnap.exists()) {
          const data = vSnap.data();
          const ts = toTimestampMs(data.timestamp || data.lastSeen);
          if (data.inVoice !== false && ts > 0 && Math.abs(now - ts) <= 60000) {
            targetInVoice = true;
          }
        }
        if (!targetInVoice && pSnap.exists()) {
          const data = pSnap.data();
          const ts = toTimestampMs(data.lastSeen || data.timestamp);
          if (data.inVoice && ts > 0 && Math.abs(now - ts) <= 60000) {
            targetInVoice = true;
          }
        }

        if (targetInVoice) {
          alert(`${targetUser.username} is in general voice rn wait`);
          return;
        }
      } catch (e) {}

      cleanupCall();
      unlockMobileAudio();
      try {
        // Automatically leave general voice channel when initiating a direct call
        window.dispatchEvent(new CustomEvent("leave_general_voice"));
      } catch (e) {}
      const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      try {
        requestScreenWakeLock();
        const stream = await acquireRobustMediaStream({ audio: true, video: type === "video" });

        setLocalStream(stream);
        localStreamRef.current = stream;

        // Initialize PeerConnection
        const pc = createDirectPeerConnection(targetUser.uid, callId);

        // Add initial tracks to PC
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Start outgoing ringback sound
        ringbackStopRef.current = playCallTone("calling");

        const outData: OutgoingCallData = {
          callId,
          targetUid: targetUser.uid,
          targetName: targetUser.username,
          targetPhotoURL:
            targetUser.photoURL ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(targetUser.username)}`,
          callType: type,
          status: "ringing",
          timestamp: Date.now(),
        };

        outgoingCallRef.current = outData;
        currentCallIdRef.current = callId;
        setOutgoingCall(outData);

        // Send direct signal targeted to this specific user
        sendBroadcastSignal({
          type: "direct_call_invite",
          uid: myProf.uid,
          targetUid: targetUser.uid,
          callId,
          callerName: myProf.username,
          callerPhotoURL:
            myProf.photoURL ||
            `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(myProf.username)}`,
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
        alert("Could not access microphone/camera. Please grant media permissions in browser.");
        cleanupCall();
      }
    },
    [getMyProfile, cleanupCall, createDirectPeerConnection]
  );

  // Action: Answer Incoming Call
  const answerIncomingCall = useCallback(async () => {
    const currentInc = incomingCallRef.current;
    const myProf = getMyProfile();
    if (isGuestUser(myProf?.username)) {
      alert("Guest accounts do not have access to calls.");
      return;
    }
    if (!currentInc || !myProf?.uid) return;

    if (ringtoneStopRef.current) {
      ringtoneStopRef.current();
      ringtoneStopRef.current = null;
    }

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    unlockMobileAudio();
    try {
      // Automatically leave general voice channel when answering a direct call
      window.dispatchEvent(new CustomEvent("leave_general_voice"));
    } catch (e) {}

    playCallTone("connected");

    try {
      requestScreenWakeLock();
      const stream = await acquireRobustMediaStream({ audio: true, video: currentInc.callType === "video" });

      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = createDirectPeerConnection(currentInc.callerUid, currentInc.callId);

      // Add local tracks to PeerConnection immediately
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const activeData: ActiveCallData = {
        callId: currentInc.callId,
        partnerUid: currentInc.callerUid,
        partnerName: currentInc.callerName,
        partnerPhotoURL: currentInc.callerPhotoURL,
        callType: currentInc.callType,
        startTime: Date.now(),
        isMuted: false,
        isDeafened: false,
        isCameraOn: currentInc.callType === "video",
        isInitiator: false,
      };

      activeCallRef.current = activeData;
      currentCallIdRef.current = currentInc.callId;
      incomingCallRef.current = null;

      setActiveCall(activeData);
      setIncomingCall(null);

      // Send acceptance signal back to caller instantly and with 250ms backup retry
      const sendAcceptSignal = () => {
        sendBroadcastSignal({
          type: "direct_call_accepted",
          uid: myProf.uid,
          targetUid: currentInc.callerUid,
          callId: currentInc.callId,
          callerName: myProf.username,
          callerPhotoURL: myProf.photoURL,
        });
      };

      sendAcceptSignal();
      setTimeout(() => {
        if (activeCallRef.current && activeCallRef.current.callId === currentInc.callId) {
          sendAcceptSignal();
        }
      }, 250);

      // Also notify other tabs of the same receiver that the call is answered/handled elsewhere
      sendBroadcastSignal({
        type: "direct_call_answered_elsewhere",
        uid: myProf.uid,
        targetUid: myProf.uid,
        callId: currentInc.callId,
      });
    } catch (err) {
      console.error("Failed to answer call:", err);
      alert("Could not access media devices to answer call.");
      cleanupCall();
    }
  }, [getMyProfile, createDirectPeerConnection, cleanupCall]);

  // Action: Decline Incoming Call
  const declineIncomingCall = useCallback(() => {
    const currentInc = incomingCallRef.current;
    const myProf = getMyProfile();
    if (!currentInc || !myProf?.uid) return;

    if (ringtoneStopRef.current) {
      ringtoneStopRef.current();
      ringtoneStopRef.current = null;
    }

    sendBroadcastSignal({
      type: "direct_call_declined",
      uid: myProf.uid,
      targetUid: currentInc.callerUid,
      callId: currentInc.callId,
    });

    // Notify other tabs of the same user to stop ringing
    sendBroadcastSignal({
      type: "direct_call_declined_elsewhere",
      uid: myProf.uid,
      targetUid: myProf.uid,
      callId: currentInc.callId,
    });

    incomingCallRef.current = null;
    setIncomingCall(null);
  }, [getMyProfile]);

  // Action: Cancel Outgoing Call
  const cancelOutgoingCall = useCallback(() => {
    const currentOut = outgoingCallRef.current;
    const myProf = getMyProfile();
    if (!currentOut || !myProf?.uid) return;

    sendBroadcastSignal({
      type: "direct_call_cancelled",
      uid: myProf.uid,
      targetUid: currentOut.targetUid,
      callId: currentOut.callId,
    });

    cleanupCall();
  }, [getMyProfile, cleanupCall]);

  // Action: End Active Call
  const endActiveCall = useCallback(() => {
    const currentAct = activeCallRef.current;
    const myProf = getMyProfile();
    if (!currentAct || !myProf?.uid) return;

    sendBroadcastSignal({
      type: "direct_call_ended",
      uid: myProf.uid,
      targetUid: currentAct.partnerUid,
      callId: currentAct.callId,
    });

    playCallTone("declined");
    cleanupCall();
  }, [getMyProfile, cleanupCall]);

  // Action: Switch to Video Request (during audio call)
  const requestSwitchToVideo = useCallback(() => {
    const currentAct = activeCallRef.current;
    const myProf = getMyProfile();
    if (!currentAct || !myProf?.uid || currentAct.callType === "video") return;

    setIsVideoSwitchPending(true);
    sendBroadcastSignal({
      type: "switch_video_request",
      uid: myProf.uid,
      targetUid: currentAct.partnerUid,
      callId: currentAct.callId,
    });
  }, [getMyProfile]);

  // Action: Respond to Switch to Video Request (Yes or No)
  const respondToVideoSwitch = useCallback(
    async (accept: boolean) => {
      const currentAct = activeCallRef.current;
      const myProf = getMyProfile();
      if (!currentAct || !myProf?.uid) return;

      setIsVideoSwitchRequested(false);

      if (!accept) {
        sendBroadcastSignal({
          type: "switch_video_response",
          uid: myProf.uid,
          targetUid: currentAct.partnerUid,
          callId: currentAct.callId,
          accepted: false,
        });
        return;
      }

      // Automatically turn on camera when clicking Yes!
      try {
        let videoStream: MediaStream;
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, max: 1280 },
              height: { ideal: 720, max: 720 },
              frameRate: { ideal: 30, max: 30 },
            },
          });
        } catch {
          videoStream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
          });
        }
        const videoTrack = videoStream.getVideoTracks()[0];
        if (videoTrack) {
          try {
            (videoTrack as any).contentHint = "motion";
          } catch {}
        }
        const pc = peerConnectionRef.current;

        if (videoTrack && pc && localStreamRef.current) {
          // Add video track to local stream
          localStreamRef.current.addTrack(videoTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

          // Replace or add video track to peer connection
          const senders = pc.getSenders();
          const videoSender = senders.find(
            (s) => s.track && s.track.kind === "video"
          );
          if (videoSender) {
            await videoSender.replaceTrack(videoTrack);
            try {
              const params = videoSender.getParameters();
              if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
              params.encodings[0].maxBitrate = 5000000;
              params.encodings[0].priority = "high";
              params.encodings[0].networkPriority = "high";
              await videoSender.setParameters(params).catch(() => {});
            } catch {}
          } else {
            pc.addTrack(videoTrack, localStreamRef.current);
          }

          sendBroadcastSignal({
            type: "switch_video_response",
            uid: myProf.uid,
            targetUid: currentAct.partnerUid,
            callId: currentAct.callId,
            accepted: true,
          });

          setActiveCall((prev) =>
            prev ? { ...prev, callType: "video", isCameraOn: true } : null
          );
        }
      } catch (err) {
        console.error("Error activating camera on switch response:", err);
        alert("Could not access camera to switch to video call.");
      }
    },
    [getMyProfile]
  );

  // Mute Toggle
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setActiveCall((prev) =>
        prev ? { ...prev, isMuted: !audioTrack.enabled } : null
      );
    }
  }, []);

  // Deafen Toggle
  const toggleDeafen = useCallback(() => {
    setActiveCall((prev) =>
      prev ? { ...prev, isDeafened: !prev.isDeafened } : null
    );
  }, []);

  // Camera Toggle (when already in video call)
  const toggleCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setActiveCall((prev) =>
        prev ? { ...prev, isCameraOn: videoTrack.enabled } : null
      );
    }
  }, []);

  // Stop Screen Share for 1-on-1 Direct Calls
  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      try {
        screenStreamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {}
        });
      } catch {}
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);

    const pc = peerConnectionRef.current;
    const currentAct = activeCallRef.current;
    const myProf = getMyProfile();

    if (pc && currentAct && myProf?.uid) {
      try {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");
        const localCameraTrack = localStreamRef.current?.getVideoTracks()[0];

        if (videoSender) {
          await videoSender.replaceTrack(
            localCameraTrack && activeCallRef.current?.isCameraOn ? localCameraTrack : null
          ).catch(() => {});
        }

        const offer = await pc.createOffer();
        const optOfferSdp = optimizeAudioSdp(offer.sdp || "");
        await pc.setLocalDescription({ type: "offer", sdp: optOfferSdp });
        sendBroadcastSignal({
          type: "direct_call_offer",
          uid: myProf.uid,
          targetUid: currentAct.partnerUid,
          callId: currentAct.callId,
          sdp: JSON.stringify({ type: "offer", sdp: optOfferSdp }),
        });
      } catch (err) {
        console.error("Error finalizing offer after stopping screen share:", err);
      }
    }
  }, [getMyProfile]);

  // Start Screen Share for 1-on-1 Direct Calls
  const startScreenShare = useCallback(async () => {
    const pc = peerConnectionRef.current;
    const currentAct = activeCallRef.current;
    const myProf = getMyProfile();
    if (!currentAct || !myProf?.uid || !pc) return;

    try {
      let displayStream: MediaStream;
      try {
        // Optimized lag-free 30 FPS screen capture
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1280, max: 1280 },
            height: { ideal: 720, max: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: { ideal: 2 },
            sampleRate: { ideal: 48000 },
            suppressLocalAudioPlayback: false,
            systemAudio: "include",
            selfBrowserSurface: "exclude",
            surfaceSwitching: "include",
          } as any,
        });
      } catch (errAudio1) {
        try {
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1280, max: 1280 },
              height: { ideal: 720, max: 720 },
              frameRate: { ideal: 30, max: 30 },
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: false,
            } as any,
          });
        } catch (errAudio2) {
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1280, max: 1280 },
              height: { ideal: 720, max: 720 },
              frameRate: { ideal: 30, max: 30 },
            },
            audio: false,
          });
        }
      }

      screenStreamRef.current = displayStream;
      setScreenStream(displayStream);
      setIsScreenSharing(true);

      const screenVideoTrack = displayStream.getVideoTracks()[0];
      const screenAudioTrack = displayStream.getAudioTracks()[0];

      if (screenVideoTrack) {
        screenVideoTrack.enabled = true;
        if ("contentHint" in screenVideoTrack) {
          try {
            (screenVideoTrack as any).contentHint = "motion";
          } catch (e) {}
        }
      }

      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === "video");

      if (videoSender) {
        await videoSender.replaceTrack(screenVideoTrack);
        try {
          const params = videoSender.getParameters();
          if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
          params.encodings[0].maxBitrate = 2000000; // Optimized 2 Mbps stream for smooth lag-free screen sharing
          params.encodings[0].priority = "high";
          params.encodings[0].networkPriority = "high";
          params.encodings[0].maxFramerate = 30;
          (params as any).degradationPreference = "maintain-framerate";
          await videoSender.setParameters(params).catch(() => {});
        } catch {}
      } else {
        pc.addTrack(screenVideoTrack, displayStream);
      }

      if (screenAudioTrack) {
        const audioSenders = senders.filter((s) => s.track && s.track.kind === "audio");
        const alreadyAdded = audioSenders.some((s) => s.track?.id === screenAudioTrack.id);
        if (!alreadyAdded) {
          pc.addTrack(screenAudioTrack, displayStream);
        }
      }

      const offer = await pc.createOffer();
      const optOfferSdp = optimizeAudioSdp(offer.sdp || "");
      await pc.setLocalDescription({ type: "offer", sdp: optOfferSdp });
      sendBroadcastSignal({
        type: "direct_call_offer",
        uid: myProf.uid,
        targetUid: currentAct.partnerUid,
        callId: currentAct.callId,
        sdp: JSON.stringify({ type: "offer", sdp: optOfferSdp }),
      });

      screenVideoTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Error starting screen share in direct call:", err);
      setScreenStream(null);
      setIsScreenSharing(false);
    }
  }, [getMyProfile, stopScreenShare]);

  // Screen Share Toggle for 1-on-1 Direct Calls
  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing || screenStreamRef.current) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, stopScreenShare, startScreenShare]);

  // Action: Start Group Call (General Voice)
  const startGroupCall = useCallback(() => {
    setIsCallMenuOpen(false);
    if (onOpenGroupVoiceRef.current) {
      onOpenGroupVoiceRef.current();
    }
  }, []);

  const contextValue = useMemo(
    () => ({
      onlineUsers,
      incomingCall,
      outgoingCall,
      activeCall,
      localStream,
      remoteStream,
      screenStream,
      isScreenSharing,
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
      toggleScreenShare,
      stopScreenShare,
      startScreenShare,
      requestSwitchToVideo,
      respondToVideoSwitch,
      toggleCamera,
      setOnOpenGroupVoice,
    }),
    [
      onlineUsers,
      incomingCall,
      outgoingCall,
      activeCall,
      localStream,
      remoteStream,
      screenStream,
      isScreenSharing,
      isVideoSwitchRequested,
      isVideoSwitchPending,
      voiceUserCount,
      isCallMenuOpen,
      startDirectCall,
      startGroupCall,
      answerIncomingCall,
      declineIncomingCall,
      cancelOutgoingCall,
      endActiveCall,
      toggleMute,
      toggleDeafen,
      toggleScreenShare,
      stopScreenShare,
      startScreenShare,
      requestSwitchToVideo,
      respondToVideoSwitch,
      toggleCamera,
      setOnOpenGroupVoice,
    ]
  );

  return (
    <CallContext.Provider value={contextValue}>
      {children}
    </CallContext.Provider>
  );
};
