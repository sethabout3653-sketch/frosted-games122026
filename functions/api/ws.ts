// Cloudflare Pages Function: /api/ws
// Native Cloudflare Workers WebSocket Engine with WebSocketPair() API and Database Persistence

interface Env {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const request = context.request;

  // Ensure request is requesting a WebSocket upgrade
  const upgradeHeader = request.headers.get("Upgrade");
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  // Cloudflare Workers WebSocketPair API:
  // Returns [client, server] WebSocket pair
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  // Accept the WebSocket connection on the server instance
  server.accept();

  // Listen for incoming WebSocket messages
  server.addEventListener("message", async (event) => {
    try {
      const msg = JSON.parse(typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data));
      if (!msg || typeof msg !== "object") return;

      // 1. Heartbeat
      if (msg.type === "ping") {
        server.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        return;
      }

      // 2. Real-Time Database Mutation over WebSocket
      if (msg.type === "change" && msg.collection && msg.id) {
        const op = msg.op || "set";
        const collection = msg.collection;
        const id = msg.id;
        const data = msg.data;
        const timestamp = Date.now();

        // Echo response back to client
        server.send(
          JSON.stringify({
            type: "change",
            op,
            collection,
            id,
            data,
            timestamp,
          })
        );

        // Optional: Persist to Upstash Redis if environment variables are set in Cloudflare Dashboard
        const redisUrl = context.env.UPSTASH_REDIS_REST_URL || "https://ideal-ray-149114.upstash.io";
        const redisToken = context.env.UPSTASH_REDIS_REST_TOKEN || "gQAAAAAAAkZ6AAIgcDI2NmNkOTFjMWZkMzc0YWRkODc1OWJmMDRlMjlhZTZiOA";

        if (redisUrl && redisToken) {
          if (op === "delete") {
            await fetch(`${redisUrl}/hdel/db:${collection}/${id}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${redisToken}` },
            }).catch(() => {});
          } else {
            await fetch(`${redisUrl}/hset/db:${collection}/${id}`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${redisToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(data),
            }).catch(() => {});
          }
        }
      }

      // 3. WebRTC Signal Routing
      if (msg.type === "webrtc_signal" && msg.payload) {
        server.send(
          JSON.stringify({
            type: "webrtc_signal",
            payload: msg.payload,
            timestamp: Date.now(),
          })
        );
      }
    } catch (err) {
      console.error("Cloudflare WebSocket message error:", err);
    }
  });

  server.addEventListener("close", () => {
    try {
      server.close();
    } catch (e) {}
  });

  // Return HTTP 101 Switching Protocols with the client WebSocket
  return new Response(null, {
    status: 101,
    webSocket: client,
  });
};
