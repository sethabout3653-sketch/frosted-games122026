// Shared Production WebRTC STUN & TURN Configuration with Port 443 TURNS Encrypted Transport
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
        "turns:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: [
        "turns:relay.metered.ca:443",
        "turn:relay.metered.ca:443",
        "turn:relay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: [
        "turns:freestun.net:443",
        "turn:freestun.net:443",
        "turn:freestun.net:443?transport=tcp",
      ],
      username: "free",
      credential: "free",
    },
    {
      urls: [
        "turn:numb.viagenie.ca:443",
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
