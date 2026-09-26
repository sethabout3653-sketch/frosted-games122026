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
