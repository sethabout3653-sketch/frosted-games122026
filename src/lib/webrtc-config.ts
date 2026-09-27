// Ultimate Firewall-Bypassing Production WebRTC STUN & TURN Configuration
// Optimized for school, university, public, corporate WiFi, and mobile cellular networks.
// Operates on standard port 443/80 TCP/TLS to bypass Deep Packet Inspection (DPI) & Carrier NAT.
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // 1. Google High-Availability STUN (Port 19302 standard & Port 443 TCP/UDP bypass)
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.l.google.com:443" },
    { urls: "stun:stun1.l.google.com:443" },
    { urls: "stun:stun2.l.google.com:443" },
    { urls: "stun:stun3.l.google.com:443" },
    { urls: "stun:stun4.l.google.com:443" },

    // 2. Twilio Global Premium STUN (Highly reliable across geographical boundaries)
    { urls: "stun:global.stun.twilio.com:3478" },
    { urls: "stun:stun.twilio.com:3478" },
    
    // 3. Cloudflare STUN
    { urls: "stun:stun.cloudflare.com:3478" },

    // 4. ExpressTURN Public High-Bandwidth Relay (Permanent Free Tier for NAT traversal)
    {
      urls: [
        "turn:turn.expressturn.com:3478",
        "turn:turn.expressturn.com:3478?transport=udp",
        "turn:turn.expressturn.com:3478?transport=tcp",
        "turn:turn.expressturn.com:80?transport=tcp",
        "turn:turn.expressturn.com:443?transport=tcp",
      ],
      username: "guest",
      credential: "guest",
    },

    // 5. Metered Global Open Relay 1 (Ports 80 & 443 with TCP and TLS-over-TCP fallbacks)
    {
      urls: [
        "turns:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
        "turn:openrelay.metered.ca:80?transport=tcp",
        "turn:openrelay.metered.ca:80",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },

    // 6. Metered Global Open Relay 2 (Ports 80 & 443 with TCP and TLS-over-TCP fallbacks)
    {
      urls: [
        "turns:relay.metered.ca:443",
        "turn:relay.metered.ca:443",
        "turn:relay.metered.ca:443?transport=tcp",
        "turn:relay.metered.ca:80?transport=tcp",
        "turn:relay.metered.ca:80",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },

    // 7. Freestun Network Global Relay
    {
      urls: [
        "turns:freestun.net:443",
        "turn:freestun.net:443",
        "turn:freestun.net:443?transport=tcp",
        "turn:freestun.net:80?transport=tcp",
        "turn:freestun.net:3478",
      ],
      username: "free",
      credential: "free",
    },

    // 8. Viagenie Public TURN Server
    {
      urls: [
        "turn:numb.viagenie.ca:443",
        "turn:numb.viagenie.ca:443?transport=tcp",
        "turn:numb.viagenie.ca:80?transport=tcp",
        "turn:numb.viagenie.ca:3478",
      ],
      username: "sethabout3653@gmail.com",
      credential: "password123",
    },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
  iceTransportPolicy: "all",
};

/**
 * Global Shared AudioContext for mobile compatibility & AEC
 */
let sharedAudioCtx: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext {
  if (typeof window === "undefined") {
    throw new Error("AudioContext is only available in the browser.");
  }
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Unlocks mobile WebKit (iOS Safari) and mobile Chrome autoplay restrictions
 * by creating and playing a micro silent buffer on user interaction.
 */
export function unlockMobileAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const ctx = getSharedAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch (e) {}
}

// Auto-register mobile touch/click listeners to unlock audio immediately
if (typeof window !== "undefined") {
  const handleUserTouch = () => {
    unlockMobileAudio();
  };
  window.addEventListener("touchstart", handleUserTouch, { passive: true });
  window.addEventListener("touchend", handleUserTouch, { passive: true });
  window.addEventListener("click", handleUserTouch, { passive: true });
  window.addEventListener("keydown", handleUserTouch, { passive: true });
}

/**
 * Securely binds a MediaStream to an HTMLAudioElement with full mobile autoplay handling.
 */
export function attachAudioToElement(
  element: HTMLAudioElement | null,
  stream: MediaStream | null,
  volume = 1.0
): void {
  if (!element || !stream) return;
  try {
    (element as any).playsInline = true;
    element.autoplay = true;
    (element as any).defaultMuted = false;
    element.muted = false;
    element.volume = Math.max(0, Math.min(1, volume));

    if (element.srcObject !== stream) {
      element.srcObject = stream;
    }

    const playPromise = element.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Retry on next user touch if blocked by mobile browser
        const retryPlay = () => {
          unlockMobileAudio();
          element.play().catch(() => {});
          window.removeEventListener("touchstart", retryPlay);
          window.removeEventListener("click", retryPlay);
        };
        window.addEventListener("touchstart", retryPlay, { once: true, passive: true });
        window.addEventListener("click", retryPlay, { once: true, passive: true });
      });
    }
  } catch (err) {
    console.warn("attachAudioToElement warning:", err);
  }
}

/**
 * Mobile Screen Wake Lock: Keeps mobile screen on during calls and voice channels
 * so mobile OS does not freeze the WebSocket/WebRTC connection in the background.
 */
let wakeLockSentinel: any = null;

export async function requestScreenWakeLock(): Promise<void> {
  if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
  try {
    if (!wakeLockSentinel) {
      wakeLockSentinel = await (navigator as any).wakeLock.request("screen");
      wakeLockSentinel.addEventListener("release", () => {
        wakeLockSentinel = null;
      });
    }
  } catch (e) {}
}

export function releaseScreenWakeLock(): void {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release();
    } catch (e) {}
    wakeLockSentinel = null;
  }
}

/**
 * Global ICE Candidate Cache
 * Persists gathered candidates across session reconnects to bypass the 2-5s gathering phase.
 */
const ICE_CACHE = new Map<string, RTCIceCandidate[]>();

export const IceManager = {
  saveCandidates: (uid: string, candidates: RTCIceCandidate[]) => {
    if (candidates.length > 0) {
      ICE_CACHE.set(uid, candidates);
    }
  },
  getCachedCandidates: (uid: string): RTCIceCandidate[] => {
    return ICE_CACHE.get(uid) || [];
  },
  clearCache: (uid?: string) => {
    if (uid) ICE_CACHE.delete(uid);
    else ICE_CACHE.clear();
  },
};

/**
 * Consolidates SDP and ICE candidates into a single signaling packet.
 * This reduces round-trips by sending all gathered network info with the initial offer/answer.
 */
export async function gatherAndConsolidate(pc: RTCPeerConnection, timeoutMs = 600): Promise<string> {
  return new Promise((resolve) => {
    let resolved = false;

    const checkResolved = () => {
      if (pc.iceGatheringState === "complete") {
        if (!resolved) {
          resolved = true;
          resolve(pc.localDescription?.sdp || "");
        }
      }
    };

    pc.onicegatheringstatechange = checkResolved;

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(pc.localDescription?.sdp || "");
      }
    }, timeoutMs);

    checkResolved();
  });
}

/**
 * Optimizes WebRTC SDP for high-fidelity audio (Opus 48kHz, FEC, stereo/mono)
 * and prioritizes hardware-accelerated video codecs (AV1, VP9, H.264).
 */
export function optimizeAudioSdp(sdp: string): string {
  if (!sdp) return "";
  const lines = sdp.split("\r\n");
  let opusPayloadType: string | null = null;
  for (const line of lines) {
    const match = line.match(/^a=rtpmap:(\d+)\s+opus\/48000\/2/i);
    if (match) {
      opusPayloadType = match[1];
      break;
    }
  }

  const av1Pt: string[] = [];
  const vp9Pt: string[] = [];
  const h264Pt: string[] = [];
  const vp8Pt: string[] = [];

  for (const line of lines) {
    const av1Match = line.match(/^a=rtpmap:(\d+)\s+AV1\//i);
    if (av1Match) av1Pt.push(av1Match[1]);
    const vp9Match = line.match(/^a=rtpmap:(\d+)\s+VP9\//i);
    if (vp9Match) vp9Pt.push(vp9Match[1]);
    const h264Match = line.match(/^a=rtpmap:(\d+)\s+H264\//i);
    if (h264Match) h264Pt.push(h264Match[1]);
    const vp8Match = line.match(/^a=rtpmap:(\d+)\s+VP8\//i);
    if (vp8Match) vp8Pt.push(vp8Match[1]);
  }

  return lines
    .map((line) => {
      if (
        (opusPayloadType && line.startsWith(`a=fmtp:${opusPayloadType}`)) ||
        (line.startsWith("a=fmtp:") && line.toLowerCase().includes("opus"))
      ) {
        const base = line.split(";")[0];
        return `${base};maxaveragebitrate=64000;stereo=0;sprop-stereo=0;maxplaybackrate=48000;minptime=20;useinbandfec=1;usedtx=1;cbr=0`;
      }
      if (line.startsWith("m=video")) {
        const parts = line.split(" ");
        const prefix = parts.slice(0, 3);
        const existingPts = parts.slice(3);
        const prioritized = [...av1Pt, ...vp9Pt, ...h264Pt, ...vp8Pt];
        const others = existingPts.filter((pt) => !prioritized.includes(pt));
        return [...prefix, ...prioritized, ...others].join(" ");
      }
      return line;
    })
    .join("\r\n");
}

/**
 * Generates a silent dummy audio track using Web Audio API oscillator.
 * Essential for devices without physical microphones or where permissions are blocked.
 */
export function createSilentAudioTrack(): MediaStreamTrack {
  try {
    const ctx = getSharedAudioContext();
    const oscillator = ctx.createOscillator();
    const dst = ctx.createMediaStreamDestination();
    oscillator.connect(dst);
    oscillator.start();
    const track = dst.stream.getAudioTracks()[0];
    track.enabled = false;
    return track;
  } catch (err) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, 1, 1);
    }
    const stream = (canvas as any).captureStream ? (canvas as any).captureStream(1) : new MediaStream();
    return stream.getTracks()[0] || null;
  }
}

/**
 * Universal Mobile-Ready MediaStream acquisition wrapper.
 * Cascades gracefully across:
 * 1. Mobile/Desktop Standard Audio & Video (with facingMode user)
 * 2. Standard Audio-only (echoCancellation, noiseSuppression)
 * 3. Minimal Audio { audio: true }
 * 4. Silent Dummy Audio track (listen-only mode, 100% guarantee never throws)
 */
export async function acquireRobustMediaStream(options: { audio: boolean; video: boolean }): Promise<MediaStream> {
  const { audio, video } = options;

  // Level 1: Standard Video + Audio (with mobile front camera support)
  if (video) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio
          ? {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : false,
        video: {
          facingMode: "user",
          width: { ideal: 640, max: 1280 },
          height: { ideal: 360, max: 720 },
          frameRate: { ideal: 24, max: 30 },
        },
      });
      return stream;
    } catch (err) {
      console.warn("Primary video+audio acquisition failed, trying generic video...", err);
    }

    // Generic video fallback
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio ? true : false,
        video: true,
      });
      return stream;
    } catch (err) {
      console.warn("Generic video failed, falling back to audio...", err);
    }
  }

  // Level 2: Audio Only with Echo Cancellation
  if (audio) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      return stream;
    } catch (err) {
      console.warn("Standard audio acquisition failed, trying basic audio...", err);
    }

    // Level 3: Basic audio: true
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      return stream;
    } catch (err) {
      console.warn("Microphone access unavailable or denied. Entering Listen-Only mode...", err);
    }
  }

  // Level 4: Absolute Fallback (Listen-Only Mode)
  const silentTrack = createSilentAudioTrack();
  if (silentTrack) {
    return new MediaStream([silentTrack]);
  }
  return new MediaStream();
}

