// Vercel Serverless Function: /api/db/stream
// Custom Real-Time Database Engine - Server-Sent Events (SSE) Streaming Layer
// Completely stateless, proxy-safe, and Vercel execution-limit aware

import { addLocalSubscriber, getLocalSnapshot } from "./data";

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || "https://ideal-ray-149114.upstash.io";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "gQAAAAAAAkZ6AAIgcDI2NmNkOTFjMWZkMzc0YWRkODc1OWJmMDRlMjlhZTZiOA";

async function redisRest(command: string, ...args: (string | number)[]) {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const url = `${REDIS_URL}/${command}/${args.map((a) => encodeURIComponent(String(a))).join("/")}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result;
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Last-Event-ID");
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed. Use GET for SSE streaming." });
  }

  const { searchParams } = new URL(req.url, "http://localhost");
  const path = (req.query?.collection || req.query?.path || searchParams.get("collection") || searchParams.get("path") || "root").toString();
  const lastEventId = req.headers["last-event-id"] || searchParams.get("lastEventId") || "$";

  // Initialize SSE streaming headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
  });

  // Instruct client to retry after 1 second if disconnected
  res.write("retry: 1000\n\n");

  let isAlive = true;
  let lastStreamId = lastEventId;

  // 1. Stream initial snapshot on connection
  try {
    if (REDIS_URL && REDIS_TOKEN) {
      const rawMap = await redisRest("HGETALL", `db:${path}`);
      const parsed: Record<string, any> = {};
      if (Array.isArray(rawMap)) {
        for (let i = 0; i < rawMap.length; i += 2) {
          const key = rawMap[i];
          const val = rawMap[i + 1];
          if (!key) continue;
          try {
            parsed[key] = typeof val === "string" ? JSON.parse(val) : val;
          } catch {
            parsed[key] = val;
          }
        }
      } else if (rawMap && typeof rawMap === "object") {
        for (const [k, v] of Object.entries(rawMap)) {
          try {
            parsed[k] = typeof v === "string" ? JSON.parse(v as string) : v;
          } catch {
            parsed[k] = v;
          }
        }
      }
      res.write(`event: snapshot\ndata: ${JSON.stringify(parsed)}\n\n`);
    } else {
      const snapshot = getLocalSnapshot(path);
      res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
    }
  } catch (err) {
    console.warn("[SSE] Snapshot error:", err);
  }

  // 2. Local in-process subscriber (instant notification for same-instance writes)
  const unsubscribeLocal = addLocalSubscriber(path, (event) => {
    if (!isAlive) return;
    try {
      res.write(`id: ${event.timestamp}\nevent: change\ndata: ${JSON.stringify(event)}\n\n`);
    } catch {
      isAlive = false;
    }
  });

  // 3. Heartbeat ping to prevent Cloudflare/Vercel timeouts (every 15s)
  const heartbeat = setInterval(() => {
    if (!isAlive) {
      clearInterval(heartbeat);
      return;
    }
    try {
      res.write(`: ping\n\n`);
    } catch {
      isAlive = false;
      clearInterval(heartbeat);
    }
  }, 15000);

  // 4. Remote distributed stream polling (for cross-instance serverless synchronization)
  if (REDIS_URL && REDIS_TOKEN) {
    const pollRemoteStream = async () => {
      while (isAlive) {
        try {
          const response = await redisRest("XREAD", "COUNT", 100, "STREAMS", `stream:${path}`, lastStreamId);
          if (response && Array.isArray(response) && response.length > 0) {
            const streamData = response[0];
            if (Array.isArray(streamData) && streamData.length >= 2) {
              const entries = streamData[1];
              if (Array.isArray(entries)) {
                for (const entry of entries) {
                  if (!Array.isArray(entry) || entry.length < 2) continue;
                  const msgId = entry[0];
                  lastStreamId = msgId;
                  const fields = entry[1];
                  const delta: Record<string, any> = {};
                  if (Array.isArray(fields)) {
                    for (let i = 0; i < fields.length; i += 2) {
                      delta[fields[i]] = fields[i + 1];
                    }
                  }
                  if (delta.data && typeof delta.data === "string") {
                    try {
                      delta.data = JSON.parse(delta.data);
                    } catch {}
                  }
                  if (isAlive) {
                    res.write(`id: ${msgId}\nevent: change\ndata: ${JSON.stringify(delta)}\n\n`);
                  }
                }
              }
            }
          }
          await new Promise((r) => setTimeout(r, 1500));
        } catch {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    };
    pollRemoteStream();
  }

  // Graceful cleanup on client disconnection or Vercel function termination
  req.on("close", () => {
    isAlive = false;
    clearInterval(heartbeat);
    unsubscribeLocal();
  });
}
