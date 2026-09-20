// Shared Production WebRTC STUN & TURN Configuration
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.twilio.com:3478" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: [
        "turn:relay.metered.ca:80",
        "turn:relay.metered.ca:443",
        "turn:relay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: [
        "turn:freestun.net:3478",
        "turn:freestun.net:3478?transport=tcp",
      ],
      username: "free",
      credential: "free",
    },
    {
      urls: [
        "turn:numb.viagenie.ca",
      ],
      username: "sethabout3653@gmail.com",
      credential: "password123",
    },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
};
