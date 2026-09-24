// Shared Production WebRTC STUN & TURN Configuration with Port 443 STUN and Port 80/443 TCP fallback TURN
export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    // Standard STUN on default port 19302
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    
    // STUN on Port 443 (HTTPS port - bypasses standard UDP/STUN firewalls)
    { urls: "stun:stun.l.google.com:443" },
    { urls: "stun:stun1.l.google.com:443" },
    { urls: "stun:stun2.l.google.com:443" },
    { urls: "stun:stun3.l.google.com:443" },
    { urls: "stun:stun4.l.google.com:443" },
    
    // Extra secure public STUN servers
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.twilio.com:3478" },
    { urls: "stun:stun.infra.ringcentral.com:443" },

    // Metered Open Relay 1 (Ports 80 & 443 with TCP fallbacks)
    {
      urls: [
        "turns:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
        "turn:openrelay.metered.ca:80?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },

    // Metered Open Relay 2 (Ports 80 & 443 with TCP fallbacks)
    {
      urls: [
        "turns:relay.metered.ca:443",
        "turn:relay.metered.ca:443",
        "turn:relay.metered.ca:443?transport=tcp",
        "turn:relay.metered.ca:80?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },

    // FreeSTUN (Fallback)
    {
      urls: [
        "turns:freestun.net:443",
        "turn:freestun.net:443",
        "turn:freestun.net:443?transport=tcp",
        "turn:freestun.net:80?transport=tcp",
      ],
      username: "free",
      credential: "free",
    },

    // ViaGenie (Fallback)
    {
      urls: [
        "turn:numb.viagenie.ca:443",
        "turn:numb.viagenie.ca:443?transport=tcp",
        "turn:numb.viagenie.ca:80?transport=tcp",
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
