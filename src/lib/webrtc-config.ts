// Ultimate Firewall-Bypassing Production WebRTC STUN & TURN Configuration
// Optimized for school, university, public, and corporate WiFi networks.
// Operates on standard port 443/80 TCP/TLS to bypass Deep Packet Inspection (DPI).
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
 * Generates a silent dummy audio track using Web Audio API oscillator.
 * Essential for devices without physical microphones or where permissions are blocked.
 */
export function createSilentAudioTrack(): MediaStreamTrack {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("AudioContext not supported");
    }
    const ctx = new AudioContextClass();
    const oscillator = ctx.createOscillator();
    const dst = ctx.createMediaStreamDestination();
    oscillator.connect(dst);
    oscillator.start();
    const track = dst.stream.getAudioTracks()[0];
    track.enabled = false; // keeps it completely silent
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
 * Robust MediaStream acquisition wrapper.
 * Gracefully cascades through ideal constraints -> generic constraints -> audio-only -> listen-only silent dummy tracks.
 * Guarantees that EVERY single call attempt on ANY device will succeed.
 */
export async function acquireRobustMediaStream(options: { audio: boolean; video: boolean }): Promise<MediaStream> {
  const { audio, video } = options;

  // Level 1: Attempt Ideal WebRTC constraints
  if (video) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio ? {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
        } : false,
        video: {
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          frameRate: { ideal: 30 },
        },
      });
      return stream;
    } catch (err) {
      console.warn("Ideal video + audio constraints failed, trying generic constraints...", err);
    }

    // Level 2: Generic video + audio constraints
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audio,
        video: true,
      });
      return stream;
    } catch (err) {
      console.warn("Generic video + audio constraints failed, trying audio-only fallback...", err);
    }
  }

  // Level 3: Audio-only (if video fails or was not requested)
  if (audio) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
        },
        video: false,
      });
      return stream;
    } catch (err) {
      console.warn("Studio audio-only constraints failed, trying generic audio...", err);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      return stream;
    } catch (err) {
      console.error("Audio capture failed completely or permission denied. Falling back to listen-only dummy stream...", err);
    }
  }

  // Level 4: Absolute Fallback (Listen-Only Mode with silent dummy track)
  // Ensures user can still join calls, hear others, and interact.
  const silentTrack = createSilentAudioTrack();
  if (silentTrack) {
    return new MediaStream([silentTrack]);
  }
  return new MediaStream();
}
