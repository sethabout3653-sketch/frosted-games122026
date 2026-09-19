// Cloudflare Pages Function: /api/db/data
// REST Real-Time Database Engine for Cloudflare Pages / Workers

interface Env {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  VPC_HYPERDRIVE?: {
    connectionString: string;
  };
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const req = context.request;
  const url = new URL(req.url);

  const collection = url.searchParams.get("collection") || url.searchParams.get("path") || "root";
  const id = url.searchParams.get("id");

  const redisUrl = context.env.UPSTASH_REDIS_REST_URL || "https://ideal-ray-149114.upstash.io";
  const redisToken = context.env.UPSTASH_REDIS_REST_TOKEN || "gQAAAAAAAkZ6AAIgcDI2NmNkOTFjMWZkMzc0YWRkODc1OWJmMDRlMjlhZTZiOA";

  // GET Request: Retrieve collection or document
  if (req.method === "GET") {
    try {
      if (id) {
        const res = await fetch(`${redisUrl}/hget/db:${collection}/${id}`, {
          headers: { Authorization: `Bearer ${redisToken}` },
        });
        const json: any = await res.json();
        let val = json.result;
        if (typeof val === "string") {
          try { val = JSON.parse(val); } catch {}
        }
        return new Response(JSON.stringify({ success: true, id, data: val || null }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${redisUrl}/hgetall/db:${collection}`, {
        headers: { Authorization: `Bearer ${redisToken}` },
      });
      const json: any = await res.json();
      const raw = json.result || [];
      const parsed: Record<string, any> = {};

      if (Array.isArray(raw)) {
        for (let i = 0; i < raw.length; i += 2) {
          const k = raw[i];
          let v = raw[i + 1];
          if (typeof v === "string") {
            try { v = JSON.parse(v); } catch {}
          }
          parsed[k] = v;
        }
      }

      return new Response(JSON.stringify({ success: true, path: collection, data: parsed }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // POST / PUT / DELETE Request: Upsert or Delete Document
  if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE") {
    try {
      let body: any = {};
      try {
        body = await req.json();
      } catch (e) {}

      const targetCol = body.collection || body.path || collection;
      const docId = body.id || id || `doc_${Date.now()}`;
      const op = body.op || (req.method === "DELETE" ? "delete" : "set");

      if (op === "delete") {
        await fetch(`${redisUrl}/hdel/db:${targetCol}/${docId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${redisToken}` },
        });
        return new Response(JSON.stringify({ success: true, op: "delete", path: targetCol, id: docId }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      const data = body.data !== undefined ? body.data : body;
      const serialized = typeof data === "string" ? data : JSON.stringify(data);

      await fetch(`${redisUrl}/hset/db:${targetCol}/${docId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serialized),
      });

      return new Response(
        JSON.stringify({
          success: true,
          op: "upsert",
          path: targetCol,
          id: docId,
          data,
          timestamp: Date.now(),
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
};
