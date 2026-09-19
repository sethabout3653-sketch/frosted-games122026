// Real-Time Memory-Backed Data Store (No Database / Fully Decoupled)
// Accepts any arbitrary JSON document without external SQL, Redis, or Firestore dependencies.

export const memoryStore: Record<string, Record<string, any>> = {};
const memorySubscribers: Record<string, Set<(event: any) => void>> = {};

export function notifyLocalSubscribers(path: string, event: any) {
  // Notify specific path subscribers
  if (memorySubscribers[path]) {
    memorySubscribers[path].forEach((cb) => {
      try {
        cb(event);
      } catch {}
    });
  }
  // Notify wildcard '*' subscribers
  if (memorySubscribers["*"]) {
    memorySubscribers["*"].forEach((cb) => {
      try {
        cb(event);
      } catch {}
    });
  }
}

export function addLocalSubscriber(path: string, cb: (event: any) => void) {
  if (!memorySubscribers[path]) memorySubscribers[path] = new Set();
  memorySubscribers[path].add(cb);
  return () => {
    memorySubscribers[path]?.delete(cb);
  };
}

export function getLocalSnapshot(path: string) {
  return memoryStore[path] || {};
}

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { searchParams } = new URL(req.url, "http://localhost");
  const path = (req.query?.collection || req.query?.path || searchParams.get("collection") || searchParams.get("path") || "root").toString();
  const id = (req.query?.id || searchParams.get("id") || "").toString();

  // 1. GET: Read document or full collection from Memory Store
  if (req.method === "GET") {
    try {
      if (id) {
        const docData = memoryStore[path]?.[id] || null;
        return res.status(200).json({ success: true, id, data: docData });
      }
      const combinedData = memoryStore[path] || {};
      return res.status(200).json({ success: true, path, data: combinedData });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  }

  // 2. POST / PUT: Upsert document in Memory Store
  if (req.method === "POST" || req.method === "PUT") {
    try {
      let body = req.body;
      if (!body) {
        body = await new Promise((resolve) => {
          let raw = "";
          req.on("data", (c: any) => { raw += c; });
          req.on("end", () => {
            try { resolve(JSON.parse(raw)); } catch { resolve({}); }
          });
          req.on("error", () => resolve({}));
        });
      } else if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { body = {}; }
      } else if (Buffer.isBuffer(body)) {
        try { body = JSON.parse(body.toString("utf-8")); } catch { body = {}; }
      }
      body = body || {};

      const targetPath = body.collection || body.path || path || "root";
      const docId = body.id || id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      
      // Handle delete via POST if op is delete
      if (body.op === "delete") {
        const timestamp = Date.now();
        if (memoryStore[targetPath]) {
          delete memoryStore[targetPath][docId];
        }

        notifyLocalSubscribers(targetPath, {
          op: "delete",
          path: targetPath,
          id: docId,
          timestamp,
        });
        return res.status(200).json({ success: true, op: "delete", path: targetPath, id: docId, timestamp });
      }

      const data = body.data !== undefined ? body.data : body;
      const timestamp = Date.now();

      if (!memoryStore[targetPath]) memoryStore[targetPath] = {};
      const payload = { ...data, id: docId, timestamp };
      memoryStore[targetPath][docId] = payload;

      notifyLocalSubscribers(targetPath, {
        op: "upsert",
        path: targetPath,
        id: docId,
        data: payload,
        timestamp,
      });

      return res.status(200).json({
        success: true,
        op: "upsert",
        path: targetPath,
        id: docId,
        data: payload,
        timestamp,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  }

  // 3. DELETE: Remove document
  if (req.method === "DELETE") {
    try {
      if (!id) {
        return res.status(400).json({ success: false, error: "Missing required 'id' parameter" });
      }

      const timestamp = Date.now();

      if (memoryStore[path]) {
        delete memoryStore[path][id];
      }

      notifyLocalSubscribers(path, {
        op: "delete",
        path,
        id,
        timestamp,
      });

      return res.status(200).json({ success: true, op: "delete", path, id, timestamp });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || String(err) });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
