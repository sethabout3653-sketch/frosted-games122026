// Serverless fallback endpoint for /api/ws on Vercel
// Prevents HTTP 500 errors when clients make HTTP requests to the WebSocket URL

export default function handler(req: any, res: any) {
  res.status(200).json({
    status: "ok",
    websocket: false,
    mode: "serverless_polling",
    message: "WebSocket endpoint active. In serverless environments, SSE (/api/db/stream) or HTTP polling is used automatically."
  });
}
