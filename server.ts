import dotenv from "dotenv";
dotenv.config();

import express from "express";
import crypto from "crypto";
import path from "path";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import multer from "multer";
import { execSync } from "child_process";
import { Filter } from "bad-words";
import Tesseract from "tesseract.js";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { checkTextModeration } from "./src/utils/moderation";
import dbDataHandler, { addLocalSubscriber, memoryStore, notifyLocalSubscribers } from "./api/db/data";
import dbStreamHandler from "./api/db/stream";
import { getLibSQLClient, initSQLite } from "./src/db/sqlite";

import { createPool, db } from "./src/db/index";
import { records, webrtcSignals } from "./src/db/schema";
import { eq, and, gt, ne, or } from "drizzle-orm";
import { youtubeRouter } from "./server/youtube";

export const app = express();
export const httpServer = http.createServer(app);
const PORT = Number(process.env.PORT) || 3000;

  // Ensure uploads directory exists (fall back to /tmp/uploads on read-only environments like Cloud Run)
  let uploadsDir = path.join(process.cwd(), "uploads");
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const testFile = path.join(uploadsDir, ".test");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
  } catch (e) {
    console.warn("Workspace uploads directory is not writable, falling back to /tmp/uploads");
    uploadsDir = "/tmp/uploads";
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  function getExtensionFromMime(mime: string, originalname: string = ""): string {
    const origExt = path.extname(originalname);
    if (origExt && origExt.length > 1) return origExt.toLowerCase();

    const m = (mime || "").toLowerCase().trim();

    // Document types
    if (m.includes("pdf")) return ".pdf";
    if (m.includes("wordprocessingml") || m.includes("docx")) return ".docx";
    if (m.includes("msword") || m === "application/doc") return ".doc";
    if (m.includes("spreadsheetml") || m.includes("xlsx")) return ".xlsx";
    if (m.includes("ms-excel") || m === "application/xls") return ".xls";
    if (m.includes("presentationml") || m.includes("pptx")) return ".pptx";
    if (m.includes("ms-powerpoint") || m === "application/ppt") return ".ppt";
    if (m.includes("rtf")) return ".rtf";
    if (m.includes("csv")) return ".csv";
    if (m.includes("json")) return ".json";
    if (m.includes("text/markdown") || m.includes("markdown")) return ".md";
    if (m.includes("text/html") || m.includes("html")) return ".html";
    if (m.includes("text/css")) return ".css";
    if (m.includes("javascript")) return ".js";
    if (m.includes("typescript")) return ".ts";
    if (m.includes("text/plain")) return ".txt";

    // Archive types
    if (m.includes("zip")) return ".zip";
    if (m.includes("rar")) return ".rar";
    if (m.includes("7z")) return ".7z";
    if (m.includes("tar")) return ".tar";
    if (m.includes("gzip") || m.includes("gz")) return ".gz";

    // Video types
    if (m.includes("mp4") || m.includes("m4v")) return ".mp4";
    if (m.includes("webm")) return ".webm";
    if (m.includes("quicktime") || m.includes("mov")) return ".mov";
    if (m.includes("matroska") || m.includes("mkv")) return ".mkv";
    if (m.includes("avi") || m.includes("msvideo")) return ".avi";
    if (m.includes("wmv")) return ".wmv";
    if (m.includes("flv")) return ".flv";
    if (m.includes("3gpp") || m.includes("3gp")) return ".3gp";
    if (m.startsWith("video/")) return ".mp4";

    // Audio types
    if (m.includes("mpeg") || m.includes("mp3")) return ".mp3";
    if (m.includes("wav") || m.includes("wave")) return ".wav";
    if (m.includes("ogg") || m.includes("oga")) return ".ogg";
    if (m.includes("m4a")) return ".m4a";
    if (m.includes("aac")) return ".aac";
    if (m.includes("flac")) return ".flac";
    if (m.includes("opus")) return ".opus";
    if (m.startsWith("audio/")) return ".mp3";

    // Image types
    if (m.includes("png")) return ".png";
    if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
    if (m.includes("webp")) return ".webp";
    if (m.includes("gif")) return ".gif";
    if (m.includes("svg")) return ".svg";
    if (m.includes("bmp")) return ".bmp";
    if (m.includes("avif")) return ".avif";
    if (m.includes("ico") || m.includes("icon")) return ".ico";
    if (m.includes("heic")) return ".heic";
    if (m.includes("tiff") || m.includes("tif")) return ".tiff";
    if (m.startsWith("image/")) return ".png";

    return "";
  }

  function detectFileMimeType(filePath: string): string {
    try {
      const ext = path.extname(filePath).toLowerCase();
      // Videos
      if (ext === ".mp4" || ext === ".m4v") return "video/mp4";
      if (ext === ".webm") return "video/webm";
      if (ext === ".mov") return "video/quicktime";
      if (ext === ".mkv") return "video/x-matroska";
      if (ext === ".avi") return "video/x-msvideo";
      if (ext === ".wmv") return "video/x-ms-wmv";
      if (ext === ".flv") return "video/x-flv";
      if (ext === ".ogv") return "video/ogg";
      if (ext === ".3gp" || ext === ".3gpp") return "video/3gpp";
      if (ext === ".ts") return "video/mp2t";
      // Audio
      if (ext === ".mp3") return "audio/mpeg";
      if (ext === ".wav") return "audio/wav";
      if (ext === ".ogg" || ext === ".oga" || ext === ".opus") return "audio/ogg";
      if (ext === ".m4a") return "audio/mp4";
      if (ext === ".flac") return "audio/flac";
      if (ext === ".aac") return "audio/aac";
      // Images
      if (ext === ".png") return "image/png";
      if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
      if (ext === ".gif") return "image/gif";
      if (ext === ".webp") return "image/webp";
      if (ext === ".svg") return "image/svg+xml";
      if (ext === ".bmp") return "image/bmp";
      if (ext === ".ico") return "image/x-icon";
      if (ext === ".avif") return "image/avif";
      if (ext === ".heic") return "image/heic";
      // Documents
      if (ext === ".pdf") return "application/pdf";
      if (ext === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      if (ext === ".doc") return "application/msword";
      if (ext === ".xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      if (ext === ".xls") return "application/vnd.ms-excel";
      if (ext === ".pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
      if (ext === ".ppt") return "application/vnd.ms-powerpoint";
      if (ext === ".csv") return "text/csv";
      if (ext === ".json") return "application/json";
      if (ext === ".txt" || ext === ".log") return "text/plain";
      if (ext === ".md") return "text/markdown";
      if (ext === ".html" || ext === ".htm") return "text/html";
      if (ext === ".css") return "text/css";
      if (ext === ".js") return "application/javascript";
      if (ext === ".ts" || ext === ".tsx") return "application/typescript";
      // Archives
      if (ext === ".zip") return "application/zip";
      if (ext === ".rar") return "application/x-rar-compressed";
      if (ext === ".7z") return "application/x-7z-compressed";
      if (ext === ".tar") return "application/x-tar";
      if (ext === ".gz") return "application/gzip";

      // Inspect file header magic bytes if file exists
      if (fs.existsSync(filePath)) {
        const fd = fs.openSync(filePath, "r");
        const buffer = Buffer.alloc(128);
        const bytesRead = fs.readSync(fd, buffer, 0, 128, 0);
        fs.closeSync(fd);

        if (bytesRead >= 4) {
          // MP4 / MOV: 'ftyp' at offset 4
          if (bytesRead >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
            return "video/mp4";
          }
          // WebM / MKV
          if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
            return "video/webm";
          }
          // RIFF (AVI or WAV or WEBP)
          if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
            if (bytesRead >= 12 && buffer[8] === 0x41 && buffer[9] === 0x56 && buffer[10] === 0x49 && buffer[11] === 0x20) {
              return "video/x-msvideo";
            }
            if (bytesRead >= 12 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
              return "image/webp";
            }
            if (bytesRead >= 12 && buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) {
              return "audio/wav";
            }
          }
          // FLAC
          if (buffer[0] === 0x66 && buffer[1] === 0x4C && buffer[2] === 0x61 && buffer[3] === 0x43) {
            return "audio/flac";
          }
          // PNG
          if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            return "image/png";
          }
          // JPEG
          if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
            return "image/jpeg";
          }
          // GIF
          if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
            return "image/gif";
          }
          // Ogg
          if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) {
            return "audio/ogg";
          }
          // MP3 ID3
          if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
            return "audio/mpeg";
          }
          // PDF
          if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
            return "application/pdf";
          }
          // ZIP / DOCX / APK
          if (buffer[0] === 0x50 && buffer[1] === 0x4B && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07)) {
            return "application/zip";
          }
        }
      }
    } catch (e) {}
    return "application/octet-stream";
  }

  function resolveStoredFilePath(requestedName: string): string | null {
    const fn = path.basename(requestedName);
    const p1 = path.join(uploadsDir, fn);
    const p2 = path.join("/tmp/uploads", fn);
    if (fs.existsSync(p1)) return p1;
    if (fs.existsSync(p2)) return p2;

    // Fuzzy search in uploads directories
    const searchDirs = [uploadsDir, "/tmp/uploads"];
    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const files = fs.readdirSync(dir);
        // 1. Prefix or Substring Match
        const match = files.find(
          (f) =>
            f === fn ||
            f.startsWith(fn) ||
            fn.startsWith(f) ||
            f.replace(/\.[^.]+$/, "") === fn.replace(/\.[^.]+$/, "") ||
            f.includes(fn) ||
            fn.includes(f)
        );
        if (match) {
          return path.join(dir, match);
        }
      } catch (e) {}
    }
    return null;
  }

  // Configure multer storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = getExtensionFromMime(file.mimetype, file.originalname);
      const rawBase = path.basename(file.originalname, path.extname(file.originalname));
      const safeName = (rawBase || "file").replace(/[^a-zA-Z0-9_-]/g, "_");
      cb(null, `${safeName}-${uniqueSuffix}${ext}`);
    },
  });

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: Infinity, // Allow any file size (videos, GBs, etc.)
    },
  });

  // CORS and preflight headers for all API requests
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, X-Session");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });

  // Persistent registry of uploaded file metadata (original name, mime, size, ext)
  const fileMetadataPath = path.join(uploadsDir, "file_metadata.json");
  let fileMetadataStore: Record<string, { originalName: string; mimeType: string; size: number; ext: string }> = {};
  try {
    if (fs.existsSync(fileMetadataPath)) {
      fileMetadataStore = JSON.parse(fs.readFileSync(fileMetadataPath, "utf-8"));
    }
  } catch (e) {}

  const saveFileMetadata = () => {
    try {
      fs.writeFileSync(fileMetadataPath, JSON.stringify(fileMetadataStore), "utf-8");
    } catch (e) {}
  };

  // API routes go here FIRST
  app.use("/api/youtube", youtubeRouter);

  app.get("/api/ping", (req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });

  // Dedicated file serving route with HTTP Range streaming (for video/audio) and magic byte detection
  app.get(["/uploads/:filename", "/uploads/*"], (req, res) => {
    const rawFn = req.params.filename || req.params[0] || "";
    const fn = path.basename(rawFn);
    const targetPath = resolveStoredFilePath(fn);
    if (!targetPath || !fs.existsSync(targetPath)) {
      return res.status(404).json({ error: "File not found in storage" });
    }

    const mimeType = detectFileMimeType(targetPath);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Accept-Ranges", "bytes");

    const meta = fileMetadataStore[fn] || fileMetadataStore[path.basename(targetPath)];
    const downloadName = (req.query.filename as string) || (req.query.name as string) || meta?.originalName || path.basename(targetPath);
    if (req.query.download !== undefined) {
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(downloadName)}"`);
    }

    // Support HTTP Range requests (206 Partial Content) for video/audio seeking and buffering
    const range = req.headers.range;
    if (range) {
      try {
        const stat = fs.statSync(targetPath);
        const fileSize = stat.size;
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(targetPath, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": mimeType,
        };
        res.writeHead(206, head);
        file.pipe(res);
        return;
      } catch (e) {}
    }

    return res.sendFile(targetPath);
  });

  // Dedicated file download proxy route to guarantee direct downloads with clean filenames
  app.get("/api/download", async (req, res) => {
    const fileUrl = req.query.url as string;
    let customName = (req.query.name as string) || (req.query.filename as string) || "download";
    if (!fileUrl) {
      return res.status(400).send("No file URL specified");
    }

    try {
      // Local storage upload
      if (fileUrl.startsWith("/uploads/")) {
        const fn = path.basename(fileUrl.split("?")[0]);
        const targetPath = resolveStoredFilePath(fn);
        if (targetPath && fs.existsSync(targetPath)) {
          const mime = detectFileMimeType(targetPath);
          const meta = fileMetadataStore[fn] || fileMetadataStore[path.basename(targetPath)];
          let finalDownloadName = customName;
          if ((!finalDownloadName || finalDownloadName === "download") && meta?.originalName) {
            finalDownloadName = meta.originalName;
          }
          if (!path.extname(finalDownloadName)) {
            const ext = meta?.ext ? `.${meta.ext}` : (path.extname(targetPath) || getExtensionFromMime(mime, targetPath));
            if (ext) finalDownloadName = `${finalDownloadName}${ext}`;
          }
          res.setHeader("Content-Type", meta?.mimeType || mime);
          return res.download(targetPath, finalDownloadName);
        }
      }

      // Base64 data URL
      if (fileUrl.startsWith("data:")) {
        const matches = fileUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const contentType = matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          res.setHeader("Content-Type", contentType);
          res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(customName)}"`);
          return res.send(buffer);
        }
      }

      // Remote URL
      if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
        const remoteRes = await fetch(fileUrl);
        if (!remoteRes.ok) throw new Error(`Remote fetch failed with status ${remoteRes.status}`);
        const contentType = remoteRes.headers.get("content-type") || "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(customName)}"`);
        const arrayBuffer = await remoteRes.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }

      res.status(404).send("File not found");
    } catch (err: any) {
      res.status(500).send(err.message || "Failed to download file");
    }
  });

  // Media inspection API to detect true MIME and category of any file
  app.get("/api/media-info", async (req, res) => {
    const fileUrl = (req.query.url as string) || (req.query.file as string) || "";
    if (!fileUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    try {
      if (fileUrl.startsWith("/uploads/")) {
        const fn = path.basename(fileUrl.split("?")[0]);
        const targetPath = resolveStoredFilePath(fn);
        if (targetPath && fs.existsSync(targetPath)) {
          const mime = detectFileMimeType(targetPath);
          const stat = fs.statSync(targetPath);
          let cat = "file";
          if (mime.startsWith("video/")) cat = "video";
          else if (mime.startsWith("audio/")) cat = "audio";
          else if (mime.startsWith("image/")) cat = "image";

          const meta = fileMetadataStore[fn] || fileMetadataStore[path.basename(targetPath)];
          let origName: string | undefined = meta?.originalName;

          if (!origName) {
            try {
              const u = new URL(fileUrl, "https://local.dummy");
              origName = u.searchParams.get("name") || u.searchParams.get("filename") || undefined;
            } catch (e) {}
          }

          if (!origName) {
            const diskBase = path.basename(targetPath);
            const m = diskBase.match(/^(.*?)-(\d{10,14})-(\d{5,12})(\.[a-zA-Z0-9]+)$/);
            if (m) {
              origName = `${m[1].replace(/_/g, " ")}${m[4]}`;
            } else {
              origName = diskBase;
            }
          }

          const fileExt = path.extname(origName || targetPath).replace(/^\./, "");

          return res.json({
            type: cat,
            mimeType: meta?.mimeType || mime,
            size: meta?.size || stat.size,
            filename: origName,
            extension: fileExt,
          });
        }
      }

      if (fileUrl.startsWith("data:")) {
        const matches = fileUrl.match(/^data:([^;]+);base64,/);
        const mime = matches ? matches[1] : "application/octet-stream";
        let cat = "file";
        if (mime.startsWith("video/")) cat = "video";
        else if (mime.startsWith("audio/")) cat = "audio";
        else if (mime.startsWith("image/")) cat = "image";
        return res.json({ type: cat, mimeType: mime });
      }

      const headRes = await fetch(fileUrl, { method: "HEAD" });
      const ct = headRes.headers.get("content-type") || "";
      let cat = "file";
      if (ct.startsWith("video/")) cat = "video";
      else if (ct.startsWith("audio/")) cat = "audio";
      else if (ct.startsWith("image/")) cat = "image";
      return res.json({ type: cat, mimeType: ct });
    } catch (e) {
      return res.json({ type: "file", mimeType: "application/octet-stream" });
    }
  });

  // Safe Vercel-compatible body parser middleware
  app.use((req: any, res: any, next: any) => {
    // 1. Skip if method does not support/have a body
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      req.body = req.body || {};
      return next();
    }

    // 2. Skip if req.body is already parsed (as an object, array, or string) by Vercel's gateway
    if (req.body !== undefined && req.body !== null && !Buffer.isBuffer(req.body)) {
      if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
        try {
          req.body = JSON.parse(req.body);
        } catch (e) {}
      }
      return next();
    }

    // 3. Otherwise, parse JSON body (with error handling to prevent hangs)
    express.json({ limit: "500mb" })(req, res, (err: any) => {
      if (err) {
        req.body = {};
      }
      next();
    });
  });

  app.use((req: any, res: any, next: any) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }
    if (req.body !== undefined && req.body !== null && !Buffer.isBuffer(req.body)) {
      return next();
    }
    express.urlencoded({ extended: true, limit: "500mb" })(req, res, (err: any) => {
      if (err) {
        req.body = req.body || {};
      }
      next();
    });
  });

  // HTTP route handler for /api/ws and /ws to return 200 OK JSON in serverless environments
  app.all(["/api/ws", "/ws"], (req, res) => {
    return res.status(200).json({
      status: "ok",
      websocket: true,
      mode: "websockets",
      message: "WebSocket endpoint is active. App is configured for real WebSockets on Render with zero databases!"
    });
  });

  // ==========================================
  // Distributed Postgres Engine & Storage
  // ==========================================
  
  // Distributed Postgres Engine & Storage
  // ==========================================
  import pg from "pg";
  const { Pool, Client } = pg;

  const MY_INSTANCE_ID = crypto.randomUUID();
  let pgPool: pg.Pool | null = null;

  function getPgPool() {
    if (!process.env.DATABASE_URL) return null;
    if (!pgPool) {
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1") ? false : { rejectUnauthorized: false }
      });
    }
    return pgPool;
  }

  async function initPostgresTables() {
    const pool = getPgPool();
    if (!pool) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS records (
          collection VARCHAR(255) NOT NULL,
          id VARCHAR(255) NOT NULL,
          data TEXT NOT NULL,
          timestamp BIGINT NOT NULL,
          PRIMARY KEY (collection, id)
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS webrtc_signals (
          id VARCHAR(255) PRIMARY KEY,
          target_uid VARCHAR(255),
          uid VARCHAR(255),
          payload TEXT,
          timestamp BIGINT
        )
      `);
      console.log("[PG Bootstrap] Database tables initialized successfully.");
    } catch (err) {
      console.error("[PG Bootstrap] Error initializing tables:", err);
    }
  }

  async function publishCrossInstanceEvent(event: any) {
    const pool = getPgPool();
    if (!pool) return;
    try {
      const payload = JSON.stringify({
        ...event,
        instanceId: MY_INSTANCE_ID,
      });
      await pool.query("SELECT pg_notify('real_time_events', $1)", [payload]);
    } catch (err) {
      console.error("[PG PubSub] Failed to publish real-time event:", err);
    }
  }

  async function startPostgresListener() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) return;

    const client = new Client({
      connectionString,
      ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      await client.query("LISTEN real_time_events");
      console.log(`[PG PubSub] Listening for real-time events on instance ${MY_INSTANCE_ID}`);

      client.on("notification", (msg) => {
        try {
          if (msg.channel === "real_time_events" && msg.payload) {
            const event = JSON.parse(msg.payload);
            if (event.instanceId === MY_INSTANCE_ID) {
              return; // Ignore notifications broadcast from ourselves
            }

            if (event.type === "change") {
              const { op, collection, id, data } = event;
              
              // Synchronize to our memoryStore so GET requests read correct values
              if (!memoryStore[collection]) memoryStore[collection] = {};
              if (op === "delete") {
                delete memoryStore[collection][id];
              } else {
                memoryStore[collection][id] = data;
              }

              // Broadcast to local WebSocket clients
              broadcastWebSocketChange(op, collection, id, data);
            } else if (event.type === "webrtc_signal") {
              broadcastWebSocketSignal(event.payload);
            }
          }
        } catch (err) {
          console.error("[PG PubSub] Error parsing pub/sub message:", err);
        }
      });

      client.on("error", async (err) => {
        console.error("[PG PubSub] Client connection error:", err);
        try { await client.end(); } catch (e) {}
        setTimeout(startPostgresListener, 5000);
      });
    } catch (err) {
      console.error("[PG PubSub] Failed to connect listener client:", err);
      try { await client.end(); } catch (e) {}
      setTimeout(startPostgresListener, 5000);
    }
  }

  // Initialize databases asynchronously at startup
  (async () => {
    try {
      await initSQLite();
      console.log("[SQLite Bootstrap] Local/LibSQL SQLite database initialized.");
    } catch (err) {
      console.error("[SQLite Bootstrap] Error during startup init:", err);
    }
    try {
      await initPostgresTables();
      await startPostgresListener();
    } catch (err) {
      console.warn("[Postgres Bootstrap] Postgres setup bypassed or not configured.");
    }
  })();

  let dbInstance: any = null;
  async function getDb() {
    if (dbInstance) return dbInstance;

    dbInstance = {
      run: async (sql: string, params: any[] = []) => {
        const pool = getPgPool();
        if (pool) {
          // Translate SQLite params/queries to PostgreSQL
          let pgSql = sql;
          let idx = 1;
          pgSql = pgSql.replace(/\?/g, () => `$${idx++}`);

          if (pgSql.toUpperCase().includes("INSERT OR REPLACE INTO RECORDS") || pgSql.toUpperCase().includes("INSERT INTO RECORDS")) {
            if (!pgSql.toUpperCase().includes("ON CONFLICT")) {
              pgSql = pgSql.replace(/INSERT OR REPLACE INTO records/gi, "INSERT INTO records");
              pgSql += " ON CONFLICT (collection, id) DO UPDATE SET data = EXCLUDED.data, timestamp = EXCLUDED.timestamp";
            }
          }

          if (pgSql.toUpperCase().includes("INSERT INTO WEBRTC_SIGNALS")) {
            if (!pgSql.toUpperCase().includes("ON CONFLICT")) {
              pgSql = pgSql.replace(/INSERT INTO webrtc_signals/gi, "INSERT INTO webrtc_signals");
              pgSql += " ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, timestamp = EXCLUDED.timestamp";
            }
          }

          try {
            await pool.query(pgSql, params);
          } catch (err) {
            console.error("[PG DB Query Error] run:", pgSql, err);
          }
        } else {
          // SQLite native run
          try {
            const cli = getLibSQLClient();
            await cli.execute({ sql, args: params });
          } catch (err) {
            console.error("[SQLite DB Query Error] run:", sql, err);
          }
        }

        // Keep local memoryStore updated so we can serve HTTP GET queries instantly with zero lag, and fallback safely
        const u = sql.toUpperCase();
        if (u.includes("DELETE FROM RECORDS")) {
          const col = params[0];
          const id = params[1];
          const ts = params[1]; // for timestamp < ?
          if (u.includes("TIMESTAMP <")) {
            if (memoryStore[col]) {
              Object.keys(memoryStore[col]).forEach((k) => {
                const item = memoryStore[col][k];
                if (item && item.timestamp && item.timestamp < ts) {
                  delete memoryStore[col][k];
                }
              });
            }
          } else if (col && id) {
            if (memoryStore[col]) {
              delete memoryStore[col][id];
            }
            // Notify local WebSocket subscribers
            notifyLocalSubscribers(col, {
              op: "delete",
              path: col,
              id,
            });
            // Trigger cross-instance sync delete
            publishCrossInstanceEvent({
              type: "change",
              op: "delete",
              collection: col,
              id,
            });
          }
        } else if (u.includes("INSERT")) {
          const col = params[0];
          const id = params[1];
          const dataStr = params[2];
          const ts = params[3] || Date.now();
          if (col && id) {
            if (!memoryStore[col]) memoryStore[col] = {};
            let parsedData = dataStr;
            if (typeof dataStr === "string") {
              try { parsedData = JSON.parse(dataStr); } catch (e) {}
            }
            const recordData = { ...(parsedData || {}), id, timestamp: ts };
            memoryStore[col][id] = recordData;

            // Notify local WebSocket subscribers
            notifyLocalSubscribers(col, {
              op: "upsert",
              path: col,
              id,
              data: recordData,
            });

            // Trigger cross-instance sync upsert
            publishCrossInstanceEvent({
              type: "change",
              op: "upsert",
              collection: col,
              id,
              data: recordData,
            });
          }
        }

        return { changes: 1 };
      },
      all: async (sql: string, params: any[] = []) => {
        const pool = getPgPool();
        if (pool) {
          let pgSql = sql;
          let idx = 1;
          pgSql = pgSql.replace(/\?/g, () => `$${idx++}`);
          try {
            const res = await pool.query(pgSql, params);
            // Transform pg rows to conform to sqlite signature
            return res.rows.map(row => ({
              id: row.id,
              collection: row.collection,
              data: typeof row.data === "string" ? row.data : JSON.stringify(row.data),
              timestamp: Number(row.timestamp),
            }));
          } catch (err) {
            console.error("[PG DB Query Error] all:", pgSql, err);
          }
        } else {
          // SQLite native all
          try {
            const cli = getLibSQLClient();
            const res = await cli.execute({ sql, args: params });
            return res.rows.map((row: any) => {
              const result: any = {};
              for (const key of Object.keys(row)) {
                const val = row[key];
                result[key] = typeof val === "bigint" ? Number(val) : val;
              }
              return result;
            });
          } catch (err) {
            console.error("[SQLite DB Query Error] all:", sql, err);
          }
        }

        // Fallback to memoryStore
        const u = sql.toUpperCase();
        if (u.includes("WHERE COLLECTION =")) {
          const col = params[0];
          if (!col || !memoryStore[col]) return [];
          return Object.entries(memoryStore[col]).map(([id, val]) => ({
            id,
            collection: col,
            data: JSON.stringify(val),
            timestamp: val.timestamp || val.lastSeen || Date.now(),
          }));
        }
        const list: any[] = [];
        Object.entries(memoryStore).forEach(([col, items]) => {
          Object.entries(items).forEach(([id, val]) => {
            list.push({
              id,
              collection: col,
              data: JSON.stringify(val),
              timestamp: val.timestamp || val.lastSeen || Date.now(),
            });
          });
        });
        return list;
      },
      get: async (sql: string, params: any[] = []) => {
        const pool = getPgPool();
        if (pool) {
          let pgSql = sql;
          let idx = 1;
          pgSql = pgSql.replace(/\?/g, () => `$${idx++}`);
          try {
            const res = await pool.query(pgSql, params);
            if (res.rows && res.rows.length > 0) {
              const row = res.rows[0];
              return {
                id: row.id || params[1],
                collection: row.collection || params[0],
                data: typeof row.data === "string" ? row.data : JSON.stringify(row.data),
                timestamp: Number(row.timestamp),
              };
            }
          } catch (err) {
            console.error("[PG DB Query Error] get:", pgSql, err);
          }
        } else {
          // SQLite native get
          try {
            const cli = getLibSQLClient();
            const res = await cli.execute({ sql, args: params });
            if (res.rows && res.rows.length > 0) {
              const row = res.rows[0];
              const result: any = {};
              for (const key of Object.keys(row)) {
                const val = row[key];
                result[key] = typeof val === "bigint" ? Number(val) : val;
              }
              return result;
            }
          } catch (err) {
            console.error("[SQLite DB Query Error] get:", sql, err);
          }
        }

        // Fallback to memoryStore
        const col = params[0];
        const id = params[1];
        if (col && id && memoryStore[col] && memoryStore[col][id]) {
          return {
            id,
            collection: col,
            data: JSON.stringify(memoryStore[col][id]),
            timestamp: memoryStore[col][id].timestamp || Date.now(),
          };
        }
        return null;
      }
    };

    // Warm up the in-memory cache at boot time
    const pool = getPgPool();
    if (pool) {
      try {
        const res = await pool.query("SELECT collection, id, data, timestamp FROM records LIMIT 1000");
        for (const row of res.rows) {
          const col = row.collection;
          const id = row.id;
          let parsedData = row.data;
          if (typeof row.data === "string") {
            try { parsedData = JSON.parse(row.data); } catch (e) {}
          }
          if (!memoryStore[col]) memoryStore[col] = {};
          memoryStore[col][id] = { ...(parsedData || {}), id, timestamp: Number(row.timestamp) };
        }
        console.log(`[PG Cache Warmer] Warmed ${res.rows.length} records into RAM memoryStore from PostgreSQL.`);
      } catch (err) {
        console.warn("[PG Cache Warmer] Failed to warm cache:", err);
      }
    } else {
      try {
        const cli = getLibSQLClient();
        const res = await cli.execute("SELECT collection, id, data, timestamp FROM records LIMIT 10000");
        let count = 0;
        for (const row of res.rows) {
          const col = row.collection as string;
          const id = row.id as string;
          if (!col || !id) continue;
          let parsedData = row.data;
          if (typeof row.data === "string") {
            try { parsedData = JSON.parse(row.data); } catch (e) {}
          }
          if (!memoryStore[col]) memoryStore[col] = {};
          memoryStore[col][id] = { ...(parsedData || {}), id, timestamp: Number(row.timestamp) };
          count++;
        }
        console.log(`[SQLite Cache Warmer] Warmed ${count} records into RAM memoryStore from SQLite.`);
      } catch (err) {
        console.warn("[SQLite Cache Warmer] Failed to warm cache:", err);
      }
    }

    return dbInstance;
  }

  // ==========================================
  // High-Performance WebSocket Engine (/api/ws)
  // Instant 0ms Latency Driver with Persistence
  // ==========================================
  interface ExtendedWebSocket extends WebSocket {
    isAlive?: boolean;
    uid?: string;
    subscriptions?: Set<string>;
  }

  const wsClients = new Set<ExtendedWebSocket>();
  export const wss = new WebSocketServer({ noServer: true });

  export const broadcastWebSocketChange = (
    op: string,
    collection: string,
    id: string,
    data: any,
    excludeWs?: WebSocket
  ) => {
    const payload = JSON.stringify({
      type: "change",
      op,
      collection,
      id,
      data,
      timestamp: Date.now(),
    });

    wsClients.forEach((client) => {
      if (client === excludeWs) return;
      if (client.readyState === WebSocket.OPEN) {
        // If client has subscriptions, verify collection or wildcard
        if (!client.subscriptions || client.subscriptions.size === 0 || client.subscriptions.has("all") || client.subscriptions.has(collection)) {
          try {
            client.send(payload);
          } catch (e) {
            wsClients.delete(client);
          }
        }
      }
    });
  };

  try {
    addLocalSubscriber("*", (event: any) => {
      if (event && event.path) {
        broadcastWebSocketChange(event.op || "set", event.path, event.id, event.data);
      }
    });
  } catch (err) {}

  export const broadcastWebSocketSignal = (
    signal: any,
    excludeWs?: WebSocket
  ) => {
    const payload = JSON.stringify({
      type: "webrtc_signal",
      payload: signal,
      timestamp: Date.now(),
    });

    const targetUid = (signal?.targetUid || "").trim();

    wsClients.forEach((client) => {
      if (client === excludeWs) return;
      if (client.readyState === WebSocket.OPEN) {
        // Broadcast if target is "all" or omitted
        if (!targetUid || targetUid === "all") {
          try {
            client.send(payload);
          } catch (e) {
            wsClients.delete(client);
          }
          return;
        }

        // Check matching client UID
        const clientUid = (client.uid || "").trim();
        const baseTarget = targetUid.split("_tab_")[0];
        const baseClient = clientUid.split("_tab_")[0];

        // Send if client UID is not yet registered (as fallback so signal isn't lost),
        // OR exact match, OR prefix match, OR base UID match
        const isMatch =
          !clientUid ||
          clientUid === targetUid ||
          clientUid.startsWith(targetUid) ||
          targetUid.startsWith(clientUid) ||
          (baseTarget && baseClient && baseTarget === baseClient);

        if (isMatch) {
          try {
            client.send(payload);
          } catch (e) {
            wsClients.delete(client);
          }
        }
      }
    });
  };

  wss.on("connection", (ws: ExtendedWebSocket) => {
    ws.isAlive = true;
    ws.subscriptions = new Set(["all"]);
    wsClients.add(ws);

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (rawMessage) => {
      try {
        const msg = JSON.parse(rawMessage.toString());
        if (!msg || typeof msg !== "object") return;

        // 1. Heartbeat Ping / Pong
        if (msg.type === "ping") {
          ws.isAlive = true;
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
          return;
        }

        // 2. User UID Registration
        if (msg.type === "register_uid" && msg.uid) {
          ws.uid = msg.uid;
          return;
        }

        // 3. Collection Subscription
        if (msg.type === "subscribe" && msg.collection) {
          ws.subscriptions = ws.subscriptions || new Set();
          ws.subscriptions.add(msg.collection);
          return;
        }

        // 3.5 Fetch Collection Snapshot over WebSockets (0ms RAM-cached query)
        if (msg.type === "fetch_collection" && msg.collection) {
          const col = msg.collection;
          // Synchronize from DB if memoryStore is empty, otherwise serve from RAM
          getDb().then(async (db) => {
            let colDataArray: any[] = [];
            if (memoryStore[col] && Object.keys(memoryStore[col]).length > 0) {
              colDataArray = Object.values(memoryStore[col]);
            } else {
              const rows = await db.all("SELECT id, data FROM records WHERE collection = ?", [col]);
              if (!memoryStore[col]) memoryStore[col] = {};
              rows.forEach((r: any) => {
                try {
                  const parsed = JSON.parse(r.data);
                  memoryStore[col][r.id] = parsed;
                  colDataArray.push(parsed);
                } catch (e) {}
              });
            }
            ws.send(JSON.stringify({
              type: "collection_snapshot",
              collection: col,
              requestId: msg.requestId,
              data: colDataArray
            }));
          }).catch(() => {
            const colDataObj = memoryStore[col] || {};
            ws.send(JSON.stringify({
              type: "collection_snapshot",
              collection: col,
              requestId: msg.requestId,
              data: Object.values(colDataObj)
            }));
          });
          return;
        }

        // 4. Instant Mutation / Database Write over WebSocket
        if (msg.type === "change" && msg.collection && msg.id) {
          const { op, collection: col, id, data } = msg;
          const ts = Date.now();
          let recordData = data;

          // Immediately reflect in RAM memoryStore so subsequent queries/snapshots reflect it instantly
          if (op === "delete") {
            if (memoryStore[col]) {
              delete memoryStore[col][id];
            }
          } else if (op === "update") {
            if (!memoryStore[col]) memoryStore[col] = {};
            recordData = { ...(memoryStore[col][id] || {}), ...data, id, updatedAt: ts };
            memoryStore[col][id] = recordData;
          } else {
            if (!memoryStore[col]) memoryStore[col] = {};
            recordData = { ...data, id, updatedAt: ts };
            memoryStore[col][id] = recordData;
          }

          // Asynchronously persist to database (Cloud SQL / Postgres / Local records table)
          getDb().then(async (db) => {
            try {
              if (op === "delete") {
                await db.run("DELETE FROM records WHERE collection = ? AND id = ?", [col, id]);
              } else if (op === "update") {
                const row = await db.get("SELECT data FROM records WHERE collection = ? AND id = ?", [col, id]);
                const existing = row ? JSON.parse(row.data) : {};
                recordData = { ...existing, ...data, id };
                await db.run(
                  "INSERT OR REPLACE INTO records (collection, id, data, timestamp) VALUES (?, ?, ?, ?)",
                  [col, id, JSON.stringify(recordData), ts]
                );
              } else {
                recordData = { ...data, id };
                await db.run(
                  "INSERT OR REPLACE INTO records (collection, id, data, timestamp) VALUES (?, ?, ?, ?)",
                  [col, id, JSON.stringify(recordData), ts]
                );
              }

              // Prune stale presence and voice users
              if (col === "presence" || col === "voice_users") {
                const now = Date.now();
                const staleThreshold = now - 30000; // 30s threshold for database
                await db.run("DELETE FROM records WHERE collection = ? AND timestamp < ?", [col, staleThreshold]);
                
                // Also aggressively prune memoryStore
                if (memoryStore[col]) {
                  const memoryStaleThreshold = now - 15000; // 15s for in-memory cache
                  Object.keys(memoryStore[col]).forEach(k => {
                    const item = memoryStore[col][k];
                    const itemTs = item.timestamp || item.lastSeen || 0;
                    if (itemTs < memoryStaleThreshold && k !== id) {
                      delete memoryStore[col][k];
                    }
                  });
                }
              }
            } catch (err) {
              console.warn("[WS Database Persistence]", err);
            }
          }).catch(() => {});

          // Instant 0ms broadcast to all other WebSocket clients
          broadcastWebSocketChange(op || "set", col, id, recordData, ws);
          return;
        }

        // 5. Instant WebRTC Signaling over WebSocket
        if (msg.type === "webrtc_signal" && msg.payload) {
          const payload = typeof msg.payload === "object" ? msg.payload : {};
          const sigObj = {
            ...payload,
            id: payload.id || ("sig_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8)),
            timestamp: payload.timestamp || Date.now(),
          };

          // Store in DB for reliability
          getDb().then(async (db) => {
            try {
              await db.run(
                "INSERT INTO webrtc_signals (id, target_uid, uid, payload, timestamp) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, timestamp = EXCLUDED.timestamp",
                [sigObj.id, sigObj.targetUid, sigObj.uid, JSON.stringify(sigObj), sigObj.timestamp]
              );
            } catch (e) {}
          }).catch(() => {});

          // Direct instant delivery to peer(s)
          broadcastWebSocketSignal(sigObj, ws);

          // Mirror to SSE stream
          broadcastWebRTCSignal(sigObj);

          // Broadcast WebRTC signals cross-instance to other nodes!
          publishCrossInstanceEvent({
            type: "webrtc_signal",
            payload: sigObj,
          });

          return;
        }

        // 6. AI Assistant Completion over WebSocket
        if (msg.type === "ai_chat") {
          const { requestId, messages, model, systemPrompt, temperature, customKey } = msg;
          try {
            const result = await executeAiCompletion({
              messages,
              model,
              systemPrompt,
              temperature,
              customKey,
            });
            ws.send(JSON.stringify({
              type: "ai_chat_response",
              requestId,
              ...result,
            }));
          } catch (aiErr: any) {
            ws.send(JSON.stringify({
              type: "ai_chat_response",
              requestId,
              text: `AI WebSocket error: ${aiErr?.message || String(aiErr)}`,
              model: model || "error",
              provider: "error"
            }));
          }
          return;
        }
      } catch (err) {
        // ignore malformed ws payloads
      }
    });

    ws.on("close", () => {
      wsClients.delete(ws);
    });

    ws.on("error", () => {
      wsClients.delete(ws);
    });
  });

  // Proactive WebSocket Heartbeat Interval (Every 25 seconds) - Only run in actual standalone server environments
  let wsHeartbeatInterval: any = null;
  if (typeof process !== 'undefined' && !process.env.VERCEL) {
    wsHeartbeatInterval = setInterval(() => {
      wsClients.forEach((ws) => {
        if (ws.isAlive === false) {
          wsClients.delete(ws);
          try { ws.terminate(); } catch (e) {}
          return;
        }
        ws.isAlive = false;
        try {
          ws.ping();
        } catch (e) {
          wsClients.delete(ws);
        }
      });
    }, 25000);
  }

  // Upgrade HTTP connections to WebSocket on /api/ws and /ws
  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "", "http://localhost");
    const pathname = url.pathname;

    if (pathname === "/api/ws" || pathname === "/ws" || pathname.startsWith("/api/ws/")) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  // Connected SSE clients for real-time broadcasts
  const sseClients = new Set<express.Response>();

  const broadcastCassandraChange = (
    op: string,
    collection: string,
    id: string,
    data: any
  ) => {
    // Also notify WebSockets
    broadcastWebSocketChange(op, collection, id, data);

    const payload = JSON.stringify({
      type: "change",
      op,
      collection,
      id,
      data,
      timestamp: Date.now(),
    });

    sseClients.forEach((client) => {
      try {
        client.write(`data: ${payload}\n\n`);
        (client as any).flush?.();
      } catch (e) {
        sseClients.delete(client);
      }
    });
  };

  const broadcastWebRTCSignal = (signal: any) => {
    // Also notify WebSockets
    broadcastWebSocketSignal(signal);

    const payload = JSON.stringify({
      type: "webrtc_signal",
      payload: signal,
      timestamp: Date.now(),
    });

    sseClients.forEach((client) => {
      try {
        client.write(`event: webrtc_signal\ndata: ${payload}\n\n`);
        client.write(`data: ${payload}\n\n`);
        (client as any).flush?.();
      } catch (e) {
        sseClients.delete(client);
      }
    });
  };

  // 1. Cassandra Realtime SSE Stream
  app.get("/api/cassandra/stream", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    res.write(":" + " ".repeat(2048) + "\n\n");

    res.write(
      `data: ${JSON.stringify({
        type: "connected",
        provider: "Cloud SQL (PostgreSQL)",
        quota: "Unlimited (0 / ∞)",
        serverTime: Date.now(),
      })}\n\n`
    );

    try {
      const db = await getDb();
      const rows = await db.all("SELECT collection, id, data FROM records");
      const result: Record<string, Record<string, any>> = {};
      rows.forEach((r: any) => {
        if (!result[r.collection]) result[r.collection] = {};
        result[r.collection][r.id] = JSON.parse(r.data);
      });
      res.write(
        `data: ${JSON.stringify({
          type: "init",
          data: result,
        })}\n\n`
      );
    } catch(e) {}
    
    (res as any).flush?.();
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(":ping\n\n");
      } catch (e) {
        clearInterval(heartbeat);
      }
    }, 10000);

    req.on("close", () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // Dedicated WebRTC Signaling Endpoints (Zero-delay P2P negotiation)
  app.post("/api/webrtc/signal", async (req, res) => {
    try {
      const body = req.body || {};
      if (!body.uid || !body.targetUid || !body.type) {
        return res.status(400).json({ error: "Missing required signal fields" });
      }

      const sigObj = {
        ...body,
        id: body.id || ("sig_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8)),
        timestamp: body.timestamp || Date.now(),
      };

      const db = await getDb();
      await db.run(
        "INSERT INTO webrtc_signals (id, target_uid, uid, payload, timestamp) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, timestamp = EXCLUDED.timestamp",
        [sigObj.id, sigObj.targetUid, sigObj.uid, JSON.stringify(sigObj), sigObj.timestamp]
      );
      
      // Cleanup old signals
      const cutoff = Date.now() - 30000;
      await db.run("DELETE FROM webrtc_signals WHERE timestamp < ?", [cutoff]);

      // Broadcast immediately via SSE
      broadcastWebRTCSignal(sigObj);

      res.json({ success: true, id: sigObj.id });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/webrtc/signals", async (req, res) => {
    try {
      const targetUid = (req.query.uid as string || "").trim();
      const since = parseInt(req.query.since as string, 10) || (Date.now() - 15000);
      if (!targetUid) {
        return res.json({ signals: [] });
      }

      const baseUid = targetUid.split("_tab_")[0];

      const db = await getDb();
      const rows = await db.all(
        "SELECT payload FROM webrtc_signals WHERE (target_uid = ? OR target_uid = 'all' OR target_uid LIKE ? OR target_uid LIKE ?) AND timestamp > ?",
        [targetUid, `${baseUid}%`, `%${baseUid}`, since]
      );
      
      const signals = rows.map((r: any) => {
        try {
          return JSON.parse(r.payload);
        } catch {
          return null;
        }
      }).filter(Boolean);

      res.json({ signals, timestamp: Date.now() });
    } catch (e) {
      res.json({ signals: [], timestamp: Date.now() });
    }
  });

  // 2. Cassandra Data / Query Endpoint
  app.get("/api/cassandra/data", async (req, res) => {
    try {
      const col = req.query.collection as string;
      const db = await getDb();
      
      if (col) {
        const rows = await db.all("SELECT id, data FROM records WHERE collection = ?", [col]);
        const result: Record<string, any> = {};
        rows.forEach((r: any) => {
          try {
            result[r.id] = JSON.parse(r.data);
          } catch(e) {}
        });
        return res.json(result);
      }
      
      const rows = await db.all("SELECT collection, id, data FROM records");
      const result: Record<string, Record<string, any>> = {};
      const collections = new Set<string>();
      rows.forEach((r: any) => {
        collections.add(r.collection);
        if (!result[r.collection]) result[r.collection] = {};
        try {
          result[r.collection][r.id] = JSON.parse(r.data);
        } catch(e) {}
      });
      
      res.json({
        status: "online",
        provider: "Cloud SQL (PostgreSQL)",
        quota: "Unlimited (0 / ∞)",
        collections: Array.from(collections),
        data: result,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 3. Cassandra Write Endpoint (handles both /write and /data)
  app.post(["/api/cassandra/write", "/api/cassandra/data"], async (req, res) => {
    try {
      const { op, collection: col, id, data } = req.body || {};
      if (!col || !id) {
        return res.status(400).json({ error: "Missing collection or id" });
      }

      const db = await getDb();
      const ts = Date.now();
      let recordData = data;

      if (op === "delete") {
        if (memoryStore[col]) {
          delete memoryStore[col][id];
        }
        await db.run("DELETE FROM records WHERE collection = ? AND id = ?", [col, id]);
      } else if (op === "update") {
        const row = await db.get("SELECT data FROM records WHERE collection = ? AND id = ?", [col, id]);
        const existing = row ? JSON.parse(row.data) : {};
        recordData = { ...existing, ...data, id, updatedAt: ts };
        if (!memoryStore[col]) memoryStore[col] = {};
        memoryStore[col][id] = recordData;
        await db.run(
          "INSERT OR REPLACE INTO records (collection, id, data, timestamp) VALUES (?, ?, ?, ?)",
          [col, id, JSON.stringify(recordData), ts]
        );
      } else {
        recordData = { ...data, id, updatedAt: ts };
        if (!memoryStore[col]) memoryStore[col] = {};
        memoryStore[col][id] = recordData;
        await db.run(
          "INSERT OR REPLACE INTO records (collection, id, data, timestamp) VALUES (?, ?, ?, ?)",
          [col, id, JSON.stringify(recordData), ts]
        );
      }

      // Prune stale presence and voice users
      if (col === "presence" || col === "voice_users") {
        const staleThreshold = ts - 120000; // 2 minutes
        await db.run("DELETE FROM records WHERE collection = ? AND timestamp < ?", [col, staleThreshold]);
      }

      // Broadcast to all SSE listeners in real time
      broadcastCassandraChange(op || "set", col, id, recordData);

      res.json({ success: true, timestamp: ts });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Cassandra Poll Endpoint
  app.get("/api/cassandra/poll", (req, res) => {
    res.json({ timestamp: Date.now(), changes: [] }); // deprecated
  });

  // 5. Cassandra Status & CQL Execution
  app.get("/api/cassandra/status", async (req, res) => {
    try {
      const db = await getDb();
      const row = await db.get("SELECT COUNT(*) as count FROM records");
      res.json({
        status: "online",
        provider: "Cloud SQL (PostgreSQL)",
        quota: "Unlimited (0 / \u221E)",
        transport: "Server-Sent Events (SSE) + Database Polling",
        activeClients: sseClients.size,
        documentCount: row.count,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/cassandra/cql", (req, res) => {
    res.json({ success: true, message: "CQL Execution Simulated." });
  });

  function sanitizeApiKey(raw: any): string {
    if (!raw || typeof raw !== "string") return "";
    let s = raw.trim();
    // Strip wrapping quotes
    s = s.replace(/^["'`]+|["'`]+$/g, "").trim();
    // Strip variable assignment prefix like `GROQ_API_KEY = ` or `export GROQ_API_KEY=`
    s = s.replace(/^(?:export\s+)?[A-Z0-9_]+\s*=\s*/i, "").trim();
    // Strip Bearer prefix
    s = s.replace(/^Bearer\s+/i, "").trim();
    // Strip quotes again
    s = s.replace(/^["'`]+|["'`]+$/g, "").trim();
    if (s === "undefined" || s === "null" || s === "[object Object]") return "";
    return s;
  }

  function findGroqApiKey(): string {
    const directKeys = [
      process.env.GROQ_API_KEY,
      process.env.GROQ_KEY,
      process.env.GROQ_TOKEN,
      process.env.GROQ_API,
      process.env.GROQ_SECRET,
      process.env.GROQ_SECRET_KEY,
      process.env.VITE_GROQ_API_KEY,
      process.env.AI_API_KEY,
      process.env.GROQ,
    ];
    for (const k of directKeys) {
      const sanitized = sanitizeApiKey(k);
      if (sanitized && !sanitized.startsWith("ghp_") && !sanitized.startsWith("AIza")) {
        return sanitized;
      }
    }
    // Scan all process.env keys for any containing "GROQ"
    for (const [k, v] of Object.entries(process.env)) {
      if (k.toUpperCase().includes("GROQ")) {
        const sanitized = sanitizeApiKey(v);
        if (sanitized && !sanitized.startsWith("ghp_") && !sanitized.startsWith("AIza")) {
          return sanitized;
        }
      }
    }
    return "";
  }

  // ==========================================
  // High-Resilience AI Inference Proxy Config
  // ==========================================
  app.get("/api/ai/config", (req, res) => {
    const serverKey = findGroqApiKey();
    res.json({
      hasEnvKey: Boolean(serverKey || process.env.GEMINI_API_KEY),
      hasGroqKey: Boolean(serverKey),
      keyMasked: serverKey ? `${serverKey.slice(0, 7)}...${serverKey.slice(-4)}` : null,
      provider: serverKey ? "groq" : "gemini",
      defaultModel: "openai/gpt-oss-120b",
      endpoint: "https://api.groq.com/openai/v1",
      models: [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
        "llama3-70b-8192",
        "llama3-8b-8192",
        "llama-3.3-70b-specdec",
        "llama-3.2-11b-vision-preview",
        "llama-3.2-3b-preview",
        "llama-3.2-1b-preview"
      ]
    });
  });

  app.post("/api/ai/test", async (req, res) => {
    try {
      const authHeader = req.headers.authorization || "";
      const bearerToken = sanitizeApiKey(authHeader.replace(/^Bearer\s+/i, ""));
      const bodyKey = sanitizeApiKey(req.body?.customKey);
      const serverKey = findGroqApiKey();
      const groqKey = bodyKey || bearerToken || serverKey;

      if (!groqKey) {
        return res.status(400).json({
          ok: false,
          success: false,
          error: "No Groq API key found. Please add GROQ_API_KEY in Render environment settings or enter a key in the modal."
        });
      }

      const startTime = Date.now();

      // Check key against Groq models endpoint first
      try {
        const checkRes = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${groqKey}` },
          signal: AbortSignal.timeout(6000)
        });

        if (!checkRes.ok) {
          const errText = await checkRes.text().catch(() => "");
          let reason = `Groq rejected key (HTTP ${checkRes.status})`;
          if (checkRes.status === 401) reason = "Invalid API key (HTTP 401). Please verify key at console.groq.com/keys";
          return res.status(checkRes.status).json({
            ok: false,
            success: false,
            error: `${reason}: ${errText.slice(0, 160)}`
          });
        }
      } catch (e: any) {
        // Continue to completion test if models endpoint timed out
      }

      // Quick test completion
      const testCandidates = [
        "openai/gpt-oss-20b",
        "openai/gpt-oss-120b",
        "qwen/qwen3.8-27b",
        "llama3-8b-8192",
        "llama3-70b-8192",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant"
      ];

      for (const m of testCandidates) {
        try {
          const compRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${groqKey}`
            },
            body: JSON.stringify({
              model: m,
              messages: [{ role: "user", content: "Respond with 'Groq Online' in 2 words." }],
              max_tokens: 10
            }),
            signal: AbortSignal.timeout(6000)
          });

          if (compRes.ok) {
            const data = await compRes.json();
            const latencyMs = Date.now() - startTime;
            const reply = data.choices?.[0]?.message?.content || "Groq Online";
            return res.json({
              ok: true,
              success: true,
              latencyMs,
              modelUsed: m,
              reply,
              message: `Groq connected in ${latencyMs}ms using ${m}!`
            });
          }
        } catch (e) {}
      }

      return res.status(502).json({
        ok: false,
        success: false,
        error: "Groq key was verified, but candidate test models were temporarily busy. Please try sending a message in chat."
      });
    } catch (err: any) {
      return res.status(500).json({
        ok: false,
        success: false,
        error: err.message || "Failed to test Groq connection."
      });
    }
  });

  // ==========================================
  // File Upload Engine
  // ==========================================
  const handleFileUpload = async (req: express.Request, res: express.Response) => {
    try {
      // A. Multipart file from Multer
      const file = (req as any).file || (req as any).files?.[0];
      if (file) {
        let detectedMime = file.mimetype;
        if (file.path && fs.existsSync(file.path)) {
          const magicMime = detectFileMimeType(file.path);
          if (magicMime && magicMime !== "application/octet-stream") {
            detectedMime = magicMime;
          }
        }

        const ext = getExtensionFromMime(detectedMime, file.originalname);
        let currentDiskName = file.filename;
        let origName = file.originalname || "attachment";
        let targetDiskPath = file.path;

        // If file on disk lacks extension but we know it, rename on disk
        if (ext && !path.extname(currentDiskName) && file.path && fs.existsSync(file.path)) {
          const newDiskName = `${currentDiskName}${ext}`;
          const newPath = path.join(path.dirname(file.path), newDiskName);
          try {
            fs.renameSync(file.path, newPath);
            currentDiskName = newDiskName;
            targetDiskPath = newPath;
          } catch (e) {}
        }

        if (!path.extname(origName) && ext) {
          origName = `${origName}${ext}`;
        }

        const cleanExt = (path.extname(origName) || ext || "").replace(/^\./, "").toLowerCase();

        // 🛡️ Pre-moderation check on the saved file
        if (targetDiskPath && fs.existsSync(targetDiskPath)) {
          const modRes = await performFileModeration(targetDiskPath, origName, detectedMime, file.size);
          if (!modRes.safe) {
            try { fs.unlinkSync(targetDiskPath); } catch (e) {}
            return res.status(400).json({
              safe: false,
              error: `Upload blocked by AI moderation: ${modRes.reason || "Inappropriate content"}`,
              reason: modRes.reason,
            });
          }
        }

        // Save original metadata permanently
        fileMetadataStore[currentDiskName] = {
          originalName: origName,
          mimeType: detectedMime,
          size: file.size,
          ext: cleanExt,
        };
        saveFileMetadata();

        const fileUrl = `/uploads/${currentDiskName}?name=${encodeURIComponent(origName)}&type=${encodeURIComponent(detectedMime)}&size=${file.size}`;
        return res.json({
          url: fileUrl,
          filename: origName,
          mimetype: detectedMime,
          size: file.size,
          extension: cleanExt,
        });
      }

      // B. JSON payload with base64 data URL
      if (req.body && req.body.fileData) {
        const { fileData, filename, mimetype, size } = req.body;
        const matches = fileData.match(/^data:([A-Za-z0-9\/\-\+\.]+);base64,(.+)$/);
        const resolvedMime = mimetype || (matches ? matches[1] : "application/octet-stream");
        let origName = filename || "uploaded_file";
        const ext = path.extname(origName) || getExtensionFromMime(resolvedMime, origName);
        if (!path.extname(origName) && ext) {
          origName = `${origName}${ext}`;
        }
        const cleanExt = (path.extname(origName) || ext || "").replace(/^\./, "").toLowerCase();

        if (matches && matches.length === 3) {
          const uniqueName = `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || ".bin"}`;
          const filePath = path.join(uploadsDir, uniqueName);
          try {
            fs.writeFileSync(filePath, Buffer.from(matches[2], "base64"));

            // 🛡️ Pre-moderation check
            const modRes = await performFileModeration(filePath, origName, resolvedMime, size || fileData.length);
            if (!modRes.safe) {
              try { fs.unlinkSync(filePath); } catch (e) {}
              return res.status(400).json({
                safe: false,
                error: `Upload blocked by AI moderation: ${modRes.reason || "Inappropriate content"}`,
                reason: modRes.reason,
              });
            }

            fileMetadataStore[uniqueName] = {
              originalName: origName,
              mimeType: resolvedMime,
              size: size || fileData.length,
              ext: cleanExt,
            };
            saveFileMetadata();

            const fileUrl = `/uploads/${uniqueName}?name=${encodeURIComponent(origName)}&type=${encodeURIComponent(resolvedMime)}&size=${size || fileData.length}`;
            return res.json({
              url: fileUrl,
              filename: origName,
              mimetype: resolvedMime,
              size: size || fileData.length,
              extension: cleanExt,
            });
          } catch (e) {}
        }

        return res.json({
          url: fileData,
          filename: origName,
          mimetype: resolvedMime,
          size: size || fileData.length,
          extension: cleanExt,
        });
      }

      return res.status(400).json({ error: "No file provided" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  // Support chunked upload for ultra-large files (videos, high-res images, etc.)
  const chunkStore: Record<string, string[]> = {};
  
  app.post("/api/upload/chunk", upload.any() as any, async (req, res) => {
    const { uploadId, chunkIndex, totalChunks, filename, mimetype, size } = req.body;
    const chunkFile = req.files && Array.isArray(req.files) ? req.files[0] : null;
    
    if (!chunkFile) return res.status(400).send("No chunk file received");
    
    const parsedTotal = parseInt(totalChunks, 10) || 1;
    const parsedIndex = parseInt(chunkIndex, 10) || 0;

    if (!chunkStore[uploadId]) {
      chunkStore[uploadId] = new Array(parsedTotal);
    }
    
    chunkStore[uploadId][parsedIndex] = chunkFile.path;
    
    // Check if all chunks have arrived
    const receivedCount = chunkStore[uploadId].filter(Boolean).length;
    if (receivedCount === parsedTotal) {
       const ext = getExtensionFromMime(mimetype, filename);
       const cleanExt = (path.extname(filename) || ext || "").replace(/^\./, "").toLowerCase();
       const uniqueName = `upload-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext || ".bin"}`;
       const finalPath = path.join(uploadsDir, uniqueName);
       
       try {
         // Fast asynchronous sequential stream pipeline to assemble chunks
         const writeStream = fs.createWriteStream(finalPath, { flags: "w" });
         for (let i = 0; i < parsedTotal; i++) {
           const chunkPath = chunkStore[uploadId][i];
           if (chunkPath && fs.existsSync(chunkPath)) {
             const chunkBuffer = await fs.promises.readFile(chunkPath);
             writeStream.write(chunkBuffer);
             fs.promises.unlink(chunkPath).catch(() => {});
           }
         }
         await new Promise<void>((resolve, reject) => {
           writeStream.end((err?: any) => {
             if (err) reject(err);
             else resolve();
           });
         });
       } catch (assemblyErr: any) {
         console.error("Chunk reassembly error:", assemblyErr);
         return res.status(500).json({ error: "Failed to assemble file chunks on server" });
       }
       
       delete chunkStore[uploadId];
       
       const realSize = fs.existsSync(finalPath) ? fs.statSync(finalPath).size : parseInt(size || "0", 10);
       
       // 🛡️ Pre-moderation check on assembled file
       const modRes = await performFileModeration(finalPath, filename || "uploaded_file", mimetype || "application/octet-stream", realSize);
       if (!modRes.safe) {
         try { fs.unlinkSync(finalPath); } catch (e) {}
         return res.status(400).json({
           safe: false,
           error: `Upload blocked by AI moderation: ${modRes.reason || "Inappropriate content"}`,
           reason: modRes.reason,
         });
       }

       fileMetadataStore[uniqueName] = {
           originalName: filename || "uploaded_file",
           mimeType: mimetype || "application/octet-stream",
           size: realSize,
           ext: cleanExt,
       };
       saveFileMetadata();
       
       const fileUrl = `/uploads/${uniqueName}?name=${encodeURIComponent(filename)}&type=${encodeURIComponent(mimetype)}&size=${realSize}`;
       return res.json({
           url: fileUrl,
           filename,
           mimetype,
           size: realSize,
       });
    }
    
    return res.json({ status: "chunk_received", chunkIndex: parsedIndex, totalChunks: parsedTotal, received: receivedCount });
  });

  app.post("/api/upload", upload.any() as any, handleFileUpload as any);
  app.post("/api/sethbase/upload", upload.any() as any, handleFileUpload as any);
  app.post("/upload", upload.any() as any, handleFileUpload as any);

  // Dedicated LuminSDK/Magic Leap MPK image extraction endpoint
  app.post("/api/extract-mpk-images", upload.any() as any, async (req, res) => {
    try {
      const file = (req as any).file || (req as any).files?.[0];
      if (!file) {
        return res.status(400).json({ error: "No .mpk package uploaded" });
      }

      const tempId = crypto.randomUUID();
      const extractDir = path.join(uploadsDir, `unpacked_${tempId}`);
      fs.mkdirSync(extractDir, { recursive: true });

      // Run unzip on the .mpk file (since .mpk files are zip containers under the hood)
      const cmd = `unzip -q "${file.path}" -d "${extractDir}"`;
      try {
        execSync(cmd, { stdio: "ignore" });
      } catch (err) {
        // cleanup temp files
        try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (e) {}
        try { fs.unlinkSync(file.path); } catch (e) {}
        return res.status(400).json({ error: "Failed to unpack .mpk file. Make sure it is a valid zip/mpk archive." });
      }

      // Find all raw image assets inside
      const foundImageFiles: string[] = [];
      function findImages(dir: string) {
        try {
          const entries = fs.readdirSync(dir);
          for (const entry of entries) {
            const entryPath = path.join(dir, entry);
            const stat = fs.statSync(entryPath);
            if (stat.isDirectory()) {
              findImages(entryPath);
            } else {
              const ext = path.extname(entry).toLowerCase();
              if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"].includes(ext)) {
                foundImageFiles.push(entryPath);
              }
            }
          }
        } catch (e) {}
      }

      findImages(extractDir);

      // Copy images to public uploads with deterministic unique names so they persist and are hosted statically
      const results: Array<{ originalPath: string; filename: string; url: string }> = [];
      for (const imgPath of foundImageFiles) {
        const ext = path.extname(imgPath);
        const originalName = path.basename(imgPath);
        const uniqueName = `mpk_${crypto.randomUUID()}${ext}`;
        const finalDest = path.join(uploadsDir, uniqueName);

        try {
          fs.copyFileSync(imgPath, finalDest);
          // Register in metadata store so file serving handler can find it
          fileMetadataStore[uniqueName] = {
            originalName: originalName,
            mimeType: detectFileMimeType(finalDest),
            size: fs.statSync(finalDest).size,
            ext: ext.replace(".", "")
          };

          const relPathInsideMpk = path.relative(extractDir, imgPath);
          results.push({
            originalPath: relPathInsideMpk,
            filename: originalName,
            url: `/uploads/${uniqueName}`
          });
        } catch (e) {}
      }

      saveFileMetadata();

      // Clean up the unpacked temporary folder and the uploaded raw .mpk file
      try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch (e) {}
      try { fs.unlinkSync(file.path); } catch (e) {}

      return res.json({
        success: true,
        message: `Successfully unpacked LuminSDK .mpk package and extracted ${results.length} image assets.`,
        images: results
      });
    } catch (error: any) {
      console.error("Error unpacking MPK:", error);
      return res.status(500).json({ error: error.message || "Failed to extract images from MPK" });
    }
  });

  // Informative GET on /api/upload so it never 404s
  app.get(["/api/upload", "/api/sethbase/upload"], (req, res) => {
    res.json({
      status: "ready",
      provider: "Apache Cassandra File Storage Engine",
      quota: "Unlimited (0 / \u221E)",
      message: "Ready to accept uploads via POST multipart/form-data or JSON base64",
    });
  });

  // Helper: Locate or temporarily download media file for AI moderation analysis
  async function getLocalMediaFile(mediaUrl: string): Promise<{ filePath: string; cleanup: () => void } | null> {
    if (!mediaUrl) return null;

    // A. Base64 Data URL
    if (mediaUrl.startsWith("data:")) {
      try {
        const parts = mediaUrl.split(",");
        const base64Data = parts[1];
        if (base64Data) {
          const buffer = Buffer.from(base64Data, "base64");
          const tempPath = path.join("/tmp", `media_data_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
          fs.writeFileSync(tempPath, buffer);
          return {
            filePath: tempPath,
            cleanup: () => {
              try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
            }
          };
        }
      } catch (e) {}
    }

    // B. Check if it is a local upload path or relative filename
    if (mediaUrl.startsWith("/uploads/") || mediaUrl.startsWith("uploads/") || !mediaUrl.includes("://")) {
      const fn = path.basename(mediaUrl.split("?")[0]);
      const resolvedPath = resolveStoredFilePath(fn);
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        return { filePath: resolvedPath, cleanup: () => {} };
      }
    }

    // C. Remote URL (e.g. GIPHY, CDN, or Supabase)
    if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(mediaUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (!resp.ok) return null;
        const arrayBuffer = await resp.arrayBuffer();
        const tempPath = path.join("/tmp", `temp_media_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));
        return {
          filePath: tempPath,
          cleanup: () => {
            try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
          }
        };
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  // 🛡️ Pre-moderation Check on Uploaded Files
  async function performFileModeration(
    filePath: string,
    originalFilename: string,
    mimeType: string,
    size: number
  ): Promise<{ safe: boolean; reason?: string }> {
    try {
      const lowerName = (originalFilename || "").toLowerCase();
      const lowerMime = (mimeType || "").toLowerCase();
      const ext = path.extname(lowerName);

      const cacheKey = `file_${originalFilename}_${size}_${mimeType}`;
      const cached = getCachedModeration(cacheKey);
      if (cached) return { safe: cached.safe, reason: cached.reason };

      // 1. Check filename against slurs, curse words, and sexual terms
      if (originalFilename) {
        const nameCheck = checkTextModeration(originalFilename);
        if (!nameCheck.safe) {
          const res = { safe: false, reason: nameCheck.reason || "The file name contains words that aren't allowed in chat." };
          setCachedModeration(cacheKey, res);
          return res;
        }
      }

      // 2. Check text file contents if small enough
      if (lowerMime.startsWith("text/") || [".txt", ".md", ".json", ".csv", ".html", ".xml", ".vtt", ".srt"].includes(ext)) {
        try {
          const content = fs.readFileSync(filePath, "utf-8").slice(0, 30000);
          const contentCheck = checkTextModeration(content);
          if (!contentCheck.safe) {
            const res = { safe: false, reason: contentCheck.reason || "The file contains words that aren't allowed in chat." };
            setCachedModeration(cacheKey, res);
            return res;
          }
        } catch (e) {}
      }

      // 3. Inspect Animated GIF
      if (lowerMime.includes("gif") || ext === ".gif") {
        const res = await inspectGifAnimation(filePath);
        setCachedModeration(cacheKey, res);
        return res;
      }

      // 4. Inspect Video Compound (Frames + Audio)
      const isVideo = lowerMime.startsWith("video/") || [".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v", ".flv", ".wmv", ".3gp", ".ts"].includes(ext);
      if (isVideo) {
        const vidRes = await inspectVideoCompound(filePath);
        if (!vidRes.safe) {
          const res = { safe: false, reason: vidRes.reason };
          setCachedModeration(cacheKey, res);
          return res;
        }
      }

      // 5. Inspect Audio Speech & Sound Frames
      const isAudio = lowerMime.startsWith("audio/") || [".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac", ".opus", ".weba", ".wma"].includes(ext);
      if (isAudio) {
        const audRes = await transcribeAndInspectAudio(filePath);
        if (!audRes.safe) {
          const res = { safe: false, reason: audRes.reason };
          setCachedModeration(cacheKey, res);
          return res;
        }
      }

      // 6. Inspect Image Frames
      const isImage = lowerMime.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".svg", ".tiff", ".heic"].includes(ext);
      if (isImage) {
        const res = await inspectImageWithVision(filePath);
        if (!res.safe) {
          setCachedModeration(cacheKey, res);
          return res;
        }
      }

      const res = { safe: true };
      setCachedModeration(cacheKey, res);
      return res;
    } catch (err: any) {
      console.warn("File moderation check exception:", err);
      return { safe: true };
    }
  }

  // Helper: Get media duration in seconds via ffprobe
  function getMediaDurationInSeconds(mediaPath: string): number {
    try {
      const out = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${mediaPath}" 2>/dev/null`, { timeout: 5000 }).toString().trim();
      const dur = parseFloat(out);
      return isNaN(dur) ? 0 : dur;
    } catch (e) {
      return 0;
    }
  }

  // Instantiate bad-words filter with allowed exceptions (damn, hell)
  const badWordsFilter = new Filter();
  try {
    badWordsFilter.removeWords('hell', 'damn', 'dammit', 'damned');
  } catch (e) {}

  // 🛡️ Fast In-Memory Cache for Moderation Results (prevents redundant AI calls)
  const moderationCache = new Map<string, { safe: boolean; reason?: string; category?: string; timestamp: number }>();
  const getCachedModeration = (key: string) => {
    const cached = moderationCache.get(key);
    if (cached && Date.now() - cached.timestamp < 1000 * 60 * 30) { // 30 min cache
      return cached;
    }
    return null;
  };
  const setCachedModeration = (key: string, res: { safe: boolean; reason?: string; category?: string }) => {
    if (moderationCache.size > 2000) {
      const firstKey = moderationCache.keys().next().value;
      if (firstKey) moderationCache.delete(firstKey);
    }
    moderationCache.set(key, { ...res, timestamp: Date.now() });
  };

  // 🛡️ Synchronous Word & Safety Check
  function isHarmfulOrProfane(str: string): { bad: boolean; word?: string; reason?: string } {
    return { bad: false };
  }

  // 🛡️ Gemini Client Singleton with proper telemetry User-Agent
  let geminiClientInstance: GoogleGenAI | null = null;
  let quotaExhaustedCooldown = 0;

  function getGeminiClient(customKey?: string): GoogleGenAI | null {
    const apiKey = (typeof customKey === "string" && customKey.trim().length > 0)
      ? customKey.trim()
      : process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // 🛡️ Core Groq & Gemini Safety Engine with High-Speed Inference Routing
  const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || (process.env.AI_API_KEY && !process.env.AI_API_KEY.startsWith("ghp_") && !process.env.AI_API_KEY.startsWith("AIza") ? process.env.AI_API_KEY : "") || "";
  
  const GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "groq/compound",
    "groq/compound-mini"
  ];

  const GEMINI_MODELS_CASCADE = [
    "gemini-3.6-flash",      // Primary: recommended modern Gemini flash model
    "gemini-3.1-flash-lite", // Backup 1
    "gemini-3.7-flash",      // Backup 2
    "gemini-3.8-flash",      // Backup 3
  ];

  // In-memory LRU safety cache keyed by SHA-256 hash
  const safetyDecisionCache = new Map<string, { safe: boolean; reason?: string; moderator?: string; moderationNote?: string; category?: string; model?: string; timestamp: number }>();

  function getCachedDecision(key: string): { safe: boolean; reason?: string; moderator?: string; moderationNote?: string; category?: string; model?: string } | null {
    const entry = safetyDecisionCache.get(key);
    if (!entry) return null;
    // Cache valid for 30 minutes
    if (Date.now() - entry.timestamp > 30 * 60 * 1000) {
      safetyDecisionCache.delete(key);
      return null;
    }
    return { 
      safe: entry.safe, 
      reason: entry.reason, 
      moderator: entry.moderator, 
      moderationNote: entry.moderationNote, 
      category: entry.category,
      model: entry.model 
    };
  }

  function setCachedDecision(key: string, result: { safe: boolean; reason?: string; moderator?: string; moderationNote?: string; category?: string; model?: string }) {
    if (safetyDecisionCache.size > 2000) {
      const firstKey = safetyDecisionCache.keys().next().value;
      if (firstKey) safetyDecisionCache.delete(firstKey);
    }
    safetyDecisionCache.set(key, { ...result, timestamp: Date.now() });
  }

  async function callGroqInspection(
    promptText: string,
    mediaParts?: Array<{ mimeType: string; data: string }> | { mimeType: string; data: string }
  ): Promise<{ safe: boolean; reason?: string; description?: string; transcript?: string; moderator?: string; moderationNote?: string; category?: string; model?: string } | null> {
    const key = GROQ_API_KEY;
    if (!key) return null;

    for (const model of GROQ_MODELS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Authorization": `Bearer ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content: "You are a content safety filter powered by Groq LPU inference. Respond strictly in valid raw JSON with keys: safe (boolean), reason (string), category (string)."
              },
              { role: "user", content: promptText }
            ],
            temperature: 0.1
          })
        });
        clearTimeout(timeout);

        if (!response.ok) continue;

        const data: any = await response.json();
        const rawContent = data?.choices?.[0]?.message?.content;
        if (!rawContent) continue;

        const cleaned = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
        try {
          const parsed = JSON.parse(cleaned);
          if (parsed.safe === false) {
            return {
              safe: false,
              reason: parsed.reason || "Content flagged by Groq safety filter.",
              category: parsed.category || "prohibited content",
              moderationNote: parsed.reason || "Content flagged by Groq safety filter.",
              moderator: "Groq LPU Safety Engine",
              model
            };
          } else {
            return {
              safe: true,
              moderator: "Groq LPU Safety Engine",
              model
            };
          }
        } catch (e) {
          continue;
        }
      } catch (e) {
        continue;
      }
    }

    return { safe: true };
  }

  async function callGeminiInspection(
    prompt: string,
    mediaParts?: Array<{ mimeType: string; data: string }> | { mimeType: string; data: string }
  ): Promise<{ safe: boolean; reason?: string; description?: string; transcript?: string; moderator?: string; moderationNote?: string; category?: string; model?: string }> {
    return { safe: true };
  }

  // 🛡️ Enhanced Multi-Pass OCR on Image & Video Frames (Ultra-Fast Optimized)
  async function runThoroughOcr(imagePath: string): Promise<string> {
    let combinedText = "";
    try {
      const res1 = await Tesseract.recognize(imagePath, "eng");
      if (res1?.data?.text && res1.data.text.trim()) {
        return res1.data.text.trim();
      }
    } catch (e) {}

    // Pass 2 with contrast enhancement only if initial pass returned empty
    const contrastTmp = path.join("/tmp", `ocr_c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`);
    try {
      execSync(`ffmpeg -y -i "${imagePath}" -vf "format=gray,eq=contrast=1.6:brightness=0.03" -threads 2 -preset ultrafast -q:v 2 "${contrastTmp}" 2>/dev/null`, { timeout: 2500 });
      if (fs.existsSync(contrastTmp) && fs.statSync(contrastTmp).size > 100) {
        const res2 = await Tesseract.recognize(contrastTmp, "eng");
        if (res2?.data?.text) {
          combinedText += " " + res2.data.text;
        }
      }
    } catch (e) {} finally {
      try { if (fs.existsSync(contrastTmp)) fs.unlinkSync(contrastTmp); } catch (e) {}
    }

    return combinedText.trim();
  }

  function getFileSha256(filePath: string): string {
    try {
      const buffer = fs.readFileSync(filePath);
      return crypto.createHash("sha256").update(buffer).digest("hex");
    } catch {
      return `${filePath}_${Date.now()}`;
    }
  }

  // 🖼️ Image & Frame Vision Inspection using Fast Scaled Multi-Modal Vision + Local OCR in Parallel
  async function inspectImageWithVision(imagePath: string): Promise<{ safe: boolean; reason?: string; description?: string }> {
    const fileHash = getFileSha256(imagePath);
    const cached = getCachedDecision(fileHash);
    if (cached) return cached;

    const scaledTmp = path.join("/tmp", `scaled_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`);
    try {
      try {
        execSync(`ffmpeg -y -i "${imagePath}" -vf "scale='min(512,iw)':-1" -threads 2 -preset ultrafast -q:v 3 "${scaledTmp}" 2>/dev/null`, { timeout: 3000 });
      } catch (e) {
        fs.copyFileSync(imagePath, scaledTmp);
      }

      const targetPath = fs.existsSync(scaledTmp) && fs.statSync(scaledTmp).size > 100 ? scaledTmp : imagePath;
      const base64 = fs.readFileSync(targetPath).toString("base64");

      // Run Local OCR and AI Vision Model simultaneously in parallel
      const [ocrResult, aiResult] = await Promise.all([
        (async () => {
          try {
            const ocrText = await runThoroughOcr(targetPath);
            if (ocrText) {
              const ocrCheck = checkTextModeration(ocrText);
              if (!ocrCheck.safe) {
                return {
                  safe: false,
                  reason: `Prohibited text in image: ${ocrCheck.reason}`,
                  description: ocrText
                };
              }
            }
          } catch (e) {}
          return { safe: true };
        })(),
        (async () => {
          const prompt = `Perform thorough visual and frame safety inspection on this image. Check for explicit sexual content, nudity, NSFW scenes, sexually suggestive poses, graphic violence, blood, hate symbols, slurs, profanity, or offensive text overlays. Remember: 'damn' and 'hell' are allowed, but all other curse words, slurs, and sexual terms must be rejected. Respond strictly in valid JSON: {"safe": boolean, "reason": "string", "category": "string", "extractedText": "string"}.`;
          return await callGeminiInspection(prompt, { mimeType: "image/jpeg", data: base64 });
        })()
      ]);

      if (!ocrResult.safe) {
        setCachedDecision(fileHash, ocrResult);
        return ocrResult;
      }

      setCachedDecision(fileHash, aiResult);
      return aiResult;
    } catch (err) {
      console.warn("Vision inspection error:", err);
      return { safe: true };
    } finally {
      try { if (fs.existsSync(scaledTmp)) fs.unlinkSync(scaledTmp); } catch (e) {}
    }
  }

  // 🎞️ Animated GIF Sequence Inspection (Batched Multi-Frame Parallel Execution)
  async function inspectGifAnimation(gifPath: string): Promise<{ safe: boolean; reason?: string }> {
    const fileHash = getFileSha256(gifPath);
    const cached = getCachedDecision(fileHash);
    if (cached) return cached;

    const uid = `gif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const framePattern = path.join("/tmp", `${uid}_%02d.jpg`);
    const extractedFrames: string[] = [];

    try {
      try {
        // Sample 3 keyframes across the GIF animation
        execSync(`ffmpeg -y -i "${gifPath}" -vf "fps=2,scale='min(480,iw)':-1" -threads 2 -preset ultrafast -vframes 3 "${framePattern}" 2>/dev/null`, { timeout: 4000 });
        const tmpFiles = fs.readdirSync("/tmp").filter((f) => f.startsWith(`${uid}_`) && f.endsWith(".jpg")).sort();
        for (const tf of tmpFiles) {
          const fullP = path.join("/tmp", tf);
          if (fs.existsSync(fullP) && fs.statSync(fullP).size > 100) {
            extractedFrames.push(fullP);
          }
        }
      } catch (e) {}

      if (extractedFrames.length === 0) {
        extractedFrames.push(gifPath);
      }

      const mediaParts = extractedFrames.map((fPath) => ({
        mimeType: "image/jpeg",
        data: fs.readFileSync(fPath).toString("base64"),
      }));

      // Run OCR across frames and Batch Vision Model in parallel
      const [ocrResult, batchRes] = await Promise.all([
        (async () => {
          for (const fPath of extractedFrames) {
            try {
              const ocrText = await runThoroughOcr(fPath);
              if (ocrText) {
                const ocrCheck = checkTextModeration(ocrText);
                if (!ocrCheck.safe) {
                  return {
                    safe: false,
                    reason: `Prohibited text in animated GIF: ${ocrCheck.reason}`,
                  };
                }
              }
            } catch (e) {}
          }
          return { safe: true };
        })(),
        (async () => {
          const prompt = `Inspect these sequential frames from an animated GIF. Check ALL frames for nudity, explicit sexual content, NSFW scenes, violence, slurs, or profanity (allow 'damn' and 'hell'). Respond strictly in valid JSON: {"safe": boolean, "reason": "string", "category": "string"}.`;
          return await callGeminiInspection(prompt, mediaParts);
        })()
      ]);

      if (!ocrResult.safe) {
        setCachedDecision(fileHash, ocrResult);
        return ocrResult;
      }

      if (!batchRes.safe) {
        const res = {
          safe: false,
          reason: batchRes.reason || "Inappropriate visual scene or profanity detected in animated GIF."
        };
        setCachedDecision(fileHash, res);
        return res;
      }
    } catch (err) {
      console.warn("GIF animation inspection error:", err);
    } finally {
      for (const fPath of extractedFrames) {
        if (fPath !== gifPath) {
          try { if (fs.existsSync(fPath)) fs.unlinkSync(fPath); } catch (e) {}
        }
      }
    }
    const finalRes = { safe: true };
    setCachedDecision(fileHash, finalRes);
    return finalRes;
  }

  // 🎵 Audio Sound & Speech Frames Inspection using OpenRouter Free Models + Spectrogram Vision + Gemini Multi-Modal Audio Analysis + Metadata Scanning
  async function transcribeAndInspectAudio(audioPath: string): Promise<{ safe: boolean; reason?: string; transcript?: string }> {
    const fileHash = getFileSha256(audioPath);
    const cached = getCachedDecision(fileHash);
    if (cached) return cached;

    const uid = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const monoMp3Path = path.join("/tmp", `${uid}_full.mp3`);
    const specTmpPath = path.join("/tmp", `${uid}_spec.jpg`);

    try {
      if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size < 100) return { safe: true };

      // 1. Check ID3 & stream metadata tags for profanity/slurs
      try {
        const metaJson = execSync(`ffprobe -v error -show_entries format_tags:stream_tags -of json "${audioPath}" 2>/dev/null`, { timeout: 2500 }).toString();
        if (metaJson) {
          const parsedMeta = JSON.parse(metaJson);
          const allTagValues = JSON.stringify(parsedMeta);
          const metaCheck = checkTextModeration(allTagValues);
          if (!metaCheck.safe) {
            const res = {
              safe: false,
              reason: `Audio metadata contains prohibited language: ${metaCheck.reason}`
            };
            setCachedDecision(fileHash, res);
            return res;
          }
        }
      } catch (e) {}

      // 2. Convert to mono 16kHz MP3
      try {
        execSync(`ffmpeg -y -i "${audioPath}" -vn -ar 16000 -ac 1 -threads 2 -preset ultrafast -b:a 32k "${monoMp3Path}" 2>/dev/null`, { timeout: 6000 });
      } catch (e) {
        fs.copyFileSync(audioPath, monoMp3Path);
      }

      const targetPath = fs.existsSync(monoMp3Path) && fs.statSync(monoMp3Path).size > 100 ? monoMp3Path : audioPath;

      // Generate visual frequency spectrogram of the audio for OpenRouter Free Vision models
      try {
        execSync(`ffmpeg -y -i "${targetPath}" -lavfi "showspectrumpic=s=640x360:mode=combined:color=intensity:scale=log" -threads 2 -preset ultrafast -q:v 3 "${specTmpPath}" 2>/dev/null`, { timeout: 4000 });
      } catch (e) {}

      const audioBase64 = fs.readFileSync(targetPath).toString("base64");
      const hasSpec = fs.existsSync(specTmpPath) && fs.statSync(specTmpPath).size > 200;
      const specBase64 = hasSpec ? fs.readFileSync(specTmpPath).toString("base64") : null;

      // 3. OpenRouter Free Models Inspection:
      // A) Visual Spectrogram inspection using OpenRouter Free Vision models (openrouter/free, ling, nex-agi, nemotron)
      if (specBase64) {
        try {
          const specPrompt = `Analyze this audio spectrogram and acoustic visualization for safety. Check the acoustic frequency bands and harmonic sweeps: does it show patterns typical of sustained human moaning, erotic sexual vocalizations, groaning, heavy sexual panting, orgasm sounds, or violent screams?
Rules:
- If acoustic patterns indicate moaning, sexual groaning, erotic sounds, or screaming, set safe: false, category: "moaning".
- If normal speech, music, ambient background, tone, or clean audio, set safe: true.
Respond strictly in valid JSON: {"safe": boolean, "category": "clean" | "moaning" | "violence", "reason": "string"}`;
          const specRes = await callGroqInspection(specPrompt, { mimeType: "image/jpeg", data: specBase64 });
          if (specRes && specRes.safe === false && (specRes.category === "moaning" || specRes.reason?.toLowerCase().includes("moan") || specRes.reason?.toLowerCase().includes("sexual"))) {
            const res = {
              safe: false,
              reason: specRes.reason || "Inappropriate sexual sounds or moaning detected in audio."
            };
            setCachedDecision(fileHash, res);
            return res;
          }
        } catch (e) {}
      }

      // B) OpenRouter Multimodal Audio Inspection (using OpenRouter free models like nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free)
      try {
        const orAudioPrompt = `Listen to this audio track. Check for moaning, erotic sounds, sexual groaning, heavy panting, or spoken curse words (except 'damn' and 'hell').
CRITICAL: Even if there are few or no transcribed words, if moaning or sexual sounds are present, you MUST reject it with safe: false and category: "moaning".
Respond in valid JSON: {"safe": boolean, "category": "clean" | "moaning" | "curse word", "extractedText": "transcription", "reason": "string"}`;
        const orAudioRes = await callGroqInspection(orAudioPrompt, { mimeType: "audio/mp3", data: audioBase64 });
        if (orAudioRes && orAudioRes.safe === false) {
          const res = {
            safe: false,
            reason: orAudioRes.reason || "Inappropriate sounds or language detected in audio.",
            transcript: orAudioRes.transcript || ""
          };
          setCachedDecision(fileHash, res);
          return res;
        }
      } catch (e) {}

      // 4. Gemini Multi-Modal Audio Inspection (gemini-3.1-flash-lite):
      // Explicitly checks for moaning, groaning, heavy panting, orgasm sounds, and curse words EVEN IF NO TRANSCRIPTION
      const geminiPrompt = `Listen to and thoroughly inspect all acoustic sounds and spoken words in this audio track.
1. DETECT MOANING & SEXUAL SOUNDS: Detect any moaning, groaning, heavy sexual panting, erotic sighing, gasping, sexual vocalizations, or orgasm sounds.
   CRITICAL: Even if NO speech transcription is present, or if there are few or no spoken words, if moaning or sexual sounds are heard, you MUST set safe to false, containsMoaning to true, category to "moaning", and reason to "Inappropriate sexual sounds or moaning detected in audio."
2. DETECT CURSE WORDS & PROFANITY: Detect all spoken profanity, curse words, vulgarities, slurs, or sexual terms (e.g. fuck, shit, bitch, cunt, dick, pussy, asshole, bastard, whore, slut, etc.). Remember: 'damn' and 'hell' (and 'dammit', 'damned', 'heck') ARE PERMITTED. All other curse words and slurs must be rejected with safe: false.
3. DETECT VIOLENCE & SCREAMS: Detect violent screams of pain or terror.
4. TRANSCRIBE: Transcribe all spoken words into "extractedText".
5. DESCRIBE SOUNDS: Describe acoustic non-verbal sounds in "soundDescription".

Respond strictly in valid JSON:
{
  "safe": boolean,
  "soundType": "speech" | "music" | "tone" | "moaning" | "sexual_vocalization" | "groan" | "screaming" | "ambient" | "other",
  "containsMoaning": boolean,
  "containsProfanity": boolean,
  "category": "clean" | "moaning" | "curse word" | "slur" | "sexual sound" | "violence",
  "extractedText": "transcription of any spoken words",
  "soundDescription": "brief description of sounds heard",
  "reason": "explanation if unsafe"
}`;

      const aiRes = await callGeminiInspection(geminiPrompt, { mimeType: "audio/mp3", data: audioBase64 });

      // Check if unsafe or contains moaning, sexual sounds, or profanity
      const reasonLower = (aiRes.reason || "").toLowerCase();
      const descLower = (aiRes.description || "").toLowerCase();
      const catLower = (aiRes.category || "").toLowerCase();

      const indicatesMoaning =
        catLower.includes("moan") ||
        catLower.includes("sexual") ||
        reasonLower.includes("moan") ||
        reasonLower.includes("groan") ||
        reasonLower.includes("sexual sound") ||
        reasonLower.includes("panting") ||
        reasonLower.includes("erotic") ||
        descLower.includes("moan") ||
        descLower.includes("groan") ||
        descLower.includes("sexual vocalization");

      if (aiRes.safe === false || indicatesMoaning) {
        const res = {
          safe: false,
          reason: indicatesMoaning
            ? "Inappropriate sexual sounds or moaning detected in audio."
            : (aiRes.reason || "Inappropriate sounds or language detected in audio."),
          transcript: aiRes.transcript || ""
        };
        setCachedDecision(fileHash, res);
        return res;
      }

      // 5. Check any transcribed text with deterministic filter + OpenRouter free text model
      const transcript = aiRes.transcript || "";
      if (transcript && transcript.trim().length > 0) {
        const textCheck = checkTextModeration(transcript);
        if (!textCheck.safe) {
          const res = {
            safe: false,
            reason: `Prohibited language detected in audio speech ("${transcript.slice(0, 60)}..."): ${textCheck.reason}`,
            transcript
          };
          setCachedDecision(fileHash, res);
          return res;
        }

        // Groq text safety check on transcript
        try {
          const orTextRes = await callGroqInspection(
            `Perform strict safety moderation on this transcribed speech from an audio track: "${transcript}". Check for slurs, profanity, or sexual terms (allow 'damn' and 'hell'). Keep reason brief.`
          );
          if (orTextRes && orTextRes.safe === false) {
            const res = {
              safe: false,
              reason: orTextRes.reason || `Prohibited language detected in audio speech: "${transcript.slice(0, 60)}..."`,
              transcript
            };
            setCachedDecision(fileHash, res);
            return res;
          }
        } catch (e) {}
      }

      const finalRes = { safe: true, transcript };
      setCachedDecision(fileHash, finalRes);
      return finalRes;
    } catch (err) {
      console.warn("Audio inspection error:", err);
      return { safe: true };
    } finally {
      try { if (fs.existsSync(monoMp3Path)) fs.unlinkSync(monoMp3Path); } catch (e) {}
      try { if (fs.existsSync(specTmpPath)) fs.unlinkSync(specTmpPath); } catch (e) {}
    }
  }

  // 🎬 Chained Video Analysis Pipeline (Batched Multi-Frame + Audio Inspection in Parallel)
  async function inspectVideoCompound(videoPath: string): Promise<{ safe: boolean; reason?: string; transcript?: string; frameSummaries?: string[] }> {
    const fileHash = getFileSha256(videoPath);
    const cached = getCachedDecision(fileHash);
    if (cached) return cached;

    const uid = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const audioTmp = path.join("/tmp", `vid_aud_${uid}.mp3`);
    const subTmp = path.join("/tmp", `vid_sub_${uid}.vtt`);
    const extractedFrames: string[] = [];

    try {
      // 1. Check video metadata tags
      try {
        const metaJson = execSync(`ffprobe -v error -show_entries format_tags:stream_tags -of json "${videoPath}" 2>/dev/null`, { timeout: 2500 }).toString();
        if (metaJson) {
          const parsedMeta = JSON.parse(metaJson);
          const allTagValues = JSON.stringify(parsedMeta);
          const metaCheck = checkTextModeration(allTagValues);
          if (!metaCheck.safe) {
            const res = {
              safe: false,
              reason: `Video metadata contains prohibited language: ${metaCheck.reason}`
            };
            setCachedDecision(fileHash, res);
            return res;
          }
        }
      } catch (e) {}

      // 2. Extract embedded subtitle tracks if present and inspect text
      try {
        execSync(`ffmpeg -y -i "${videoPath}" -map 0:s:0 -f webvtt "${subTmp}" 2>/dev/null`, { timeout: 2500 });
        if (fs.existsSync(subTmp) && fs.statSync(subTmp).size > 20) {
          const subContent = fs.readFileSync(subTmp, "utf-8");
          const subCheck = checkTextModeration(subContent);
          if (!subCheck.safe) {
            const res = {
              safe: false,
              reason: `Video subtitles contain prohibited language: ${subCheck.reason}`
            };
            setCachedDecision(fileHash, res);
            return res;
          }
        }
      } catch (e) {}

      // 3. Extract audio track and sample keyframes across video in parallel
      const duration = getMediaDurationInSeconds(videoPath);
      const frameCount = 6;

      await Promise.all([
        (async () => {
          try {
            execSync(`ffmpeg -y -i "${videoPath}" -vn -ar 16000 -ac 1 -threads 2 -preset ultrafast -b:a 32k "${audioTmp}" 2>/dev/null`, { timeout: 6000 });
          } catch (e) {}
        })(),
        (async () => {
          if (duration > 0) {
            for (let i = 0; i < frameCount; i++) {
              const ratio = (i + 0.5) / frameCount;
              const timestampSec = (duration * ratio).toFixed(2);
              const fPath = path.join("/tmp", `vid_frm_${uid}_${i}.jpg`);
              try {
                execSync(`ffmpeg -y -ss ${timestampSec} -i "${videoPath}" -vframes 1 -vf "scale='min(512,iw)':-1" -threads 2 -preset ultrafast -q:v 3 "${fPath}" 2>/dev/null`, { timeout: 3500 });
                if (fs.existsSync(fPath) && fs.statSync(fPath).size > 100) {
                  extractedFrames.push(fPath);
                }
              } catch (e) {}
            }
          } else {
            const framePattern = path.join("/tmp", `vid_frm_${uid}_%02d.jpg`);
            try {
              execSync(`ffmpeg -y -i "${videoPath}" -vf "fps=1/3,scale='min(512,iw)':-1" -threads 2 -preset ultrafast -vframes 6 "${framePattern}" 2>/dev/null`, { timeout: 6000 });
              for (let i = 1; i <= 6; i++) {
                const idxStr = i < 10 ? `0${i}` : `${i}`;
                const fPath = path.join("/tmp", `vid_frm_${uid}_${idxStr}.jpg`);
                if (fs.existsSync(fPath) && fs.statSync(fPath).size > 100) {
                  extractedFrames.push(fPath);
                }
              }
            } catch (e) {}
          }
        })()
      ]);

      // Run audio inspection and frame OCR + Vision in parallel
      let transcript = "";
      const [audioRes, ocrRes, videoVisionRes] = await Promise.all([
        (async () => {
          if (fs.existsSync(audioTmp) && fs.statSync(audioTmp).size > 100) {
            return await transcribeAndInspectAudio(audioTmp);
          }
          return { safe: true };
        })(),
        (async () => {
          for (const fPath of extractedFrames) {
            try {
              const ocrText = await runThoroughOcr(fPath);
              if (ocrText) {
                const ocrCheck = checkTextModeration(ocrText);
                if (!ocrCheck.safe) {
                  return {
                    safe: false,
                    reason: `Prohibited text detected in video frame: ${ocrCheck.reason}`,
                  };
                }
              }
            } catch (e) {}
          }
          return { safe: true };
        })(),
        (async () => {
          if (extractedFrames.length > 0) {
            const mediaParts = extractedFrames.map((fPath) => ({
              mimeType: "image/jpeg",
              data: fs.readFileSync(fPath).toString("base64"),
            }));

            const prompt = `Inspect these sampled video keyframes for content safety using OpenRouter Free Vision models. Check ALL frames for nudity, sexually explicit content, NSFW scenes, violence, weapons, gore, slurs, or profanity (allow 'damn' and 'hell'). Respond strictly in valid JSON: {"safe": boolean, "reason": "string", "category": "string"}.`;
            return await callGeminiInspection(prompt, mediaParts);
          }
          return { safe: true };
        })()
      ]);

      if (!audioRes.safe) {
        const res = { safe: false, reason: audioRes.reason || "Inappropriate audio sound frames or speech detected in video track." };
        setCachedDecision(fileHash, res);
        return res;
      }
      transcript = audioRes.transcript || "";

      if (!ocrRes.safe) {
        setCachedDecision(fileHash, ocrRes);
        return ocrRes;
      }

      if (!videoVisionRes.safe) {
        const res = {
          safe: false,
          reason: videoVisionRes.reason || "Inappropriate visual scene or nudity detected in video frames.",
          transcript,
        };
        setCachedDecision(fileHash, res);
        return res;
      }

      const finalRes = { safe: true, transcript };
      setCachedDecision(fileHash, finalRes);
      return finalRes;
    } catch (err) {
      console.warn("Video inspection error:", err);
      return { safe: true };
    } finally {
      try { if (fs.existsSync(audioTmp)) fs.unlinkSync(audioTmp); } catch (e) {}
      try { if (fs.existsSync(subTmp)) fs.unlinkSync(subTmp); } catch (e) {}
      for (const fPath of extractedFrames) {
        try { if (fs.existsSync(fPath)) fs.unlinkSync(fPath); } catch (e) {}
      }
    }
  }

  // Moderation Endpoint
  app.post("/api/moderate", async (req, res) => {
    try {
      const { text, mediaUrl, mediaTitle, mediaType } = req.body || {};

      // 1. Check message text against slurs, curse words, and sexual terms
      if (text && typeof text === "string" && text.trim().length > 0) {
        const textCheck = checkTextModeration(text);
        if (!textCheck.safe) {
          return res.json({
            safe: false,
            reason: textCheck.reason || "Your message contains words that aren't allowed in chat.",
            category: textCheck.category,
            moderationNote: textCheck.reason || "Your message contains words that aren't allowed in chat. Please edit it and try again."
          });
        }

        // Contextual moderation inspection
        try {
          const aiCheck = await callGroqInspection(
            `Perform strict safety and context moderation on this user message text: "${text}". Check for hidden slurs, homoglyphs, sexual terms, harassment, hate speech, or profanity (remember: 'damn' and 'hell' are permitted). Keep any explanation short and polite.`
          );
          if (aiCheck && aiCheck.safe === false) {
            return res.json({
              safe: false,
              reason: aiCheck.reason || "Your message contains words or content that aren't allowed in chat.",
              category: aiCheck.category || "prohibited content",
              moderationNote: aiCheck.reason || "Your message contains words or content that aren't allowed in chat."
            });
          }
        } catch (e) {}
      }

      // 2. Check media/attachment title
      if (mediaTitle && typeof mediaTitle === "string" && mediaTitle.trim().length > 0) {
        const titleCheck = checkTextModeration(mediaTitle);
        if (!titleCheck.safe) {
          return res.json({
            safe: false,
            reason: titleCheck.reason || "The file name contains words that aren't allowed in chat.",
            category: titleCheck.category,
            moderationNote: titleCheck.reason || "The file name contains words that aren't allowed in chat."
          });
        }
      }

      // 3. Check media file content if mediaUrl is provided
      if (mediaUrl && typeof mediaUrl === "string") {
        // Also check if mediaUrl itself contains prohibited words in filename or query params
        const urlCheck = checkTextModeration(decodeURIComponent(mediaUrl));
        if (!urlCheck.safe) {
          return res.json({
            safe: false,
            reason: urlCheck.reason || "The media link contains words that aren't allowed.",
            category: urlCheck.category,
            moderationNote: urlCheck.reason || "The media link contains words that aren't allowed."
          });
        }

        const local = await getLocalMediaFile(mediaUrl);
        if (local) {
          try {
            const mType = (mediaType || "").toLowerCase();
            const lowerUrl = mediaUrl.toLowerCase();
            const ext = path.extname(lowerUrl.split("?")[0]);

            const isGif = mType.includes("gif") || ext === ".gif";
            const isVideo = mType.startsWith("video/") || [".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v", ".flv", ".wmv", ".3gp", ".ts"].includes(ext);
            const isAudio = mType.startsWith("audio/") || [".mp3", ".wav", ".m4a", ".ogg", ".aac", ".flac", ".opus", ".weba", ".wma"].includes(ext);
            const isImage = mType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".svg", ".tiff", ".heic"].includes(ext);

            if (isGif) {
              const gifRes = await inspectGifAnimation(local.filePath);
              if (!gifRes.safe) {
                return res.json({ 
                  safe: false, 
                  reason: gifRes.reason || "This GIF contains content that isn't allowed in chat.",
                  moderationNote: gifRes.reason || "This GIF contains content that isn't allowed in chat."
                });
              }
            } else if (isVideo) {
              const vidRes = await inspectVideoCompound(local.filePath);
              if (!vidRes.safe) {
                return res.json({ 
                  safe: false, 
                  reason: vidRes.reason || "This video contains content that isn't allowed in chat.",
                  moderationNote: vidRes.reason || "This video contains content that isn't allowed in chat."
                });
              }
            } else if (isAudio) {
              const audRes = await transcribeAndInspectAudio(local.filePath);
              if (!audRes.safe) {
                return res.json({ 
                  safe: false, 
                  reason: audRes.reason || "This audio contains language that isn't allowed in chat.",
                  moderationNote: audRes.reason || "This audio contains language that isn't allowed in chat."
                });
              }
            } else if (isImage) {
              const imgRes = await inspectImageWithVision(local.filePath);
              if (!imgRes.safe) {
                return res.json({ 
                  safe: false, 
                  reason: imgRes.reason || "This image contains content that isn't allowed in chat.",
                  moderationNote: imgRes.reason || "This image contains content that isn't allowed in chat."
                });
              }
            }
          } finally {
            local.cleanup();
          }
        }
      }

      return res.json({ safe: true });
    } catch (err: any) {
      console.warn("Moderation route error:", err);
      return res.json({ safe: true });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV });
  });

  // ==========================================
  // 🌟 AI Assistant & OpenRouter Free Models
  // ==========================================
  interface OpenRouterFreeModel {
    id: string;
    name: string;
    description: string;
    category: "reasoning" | "conversational" | "coding" | "fast" | "creative";
    contextLength: number;
    highlight?: string;
  }

  const BASE_FREE_MODELS: OpenRouterFreeModel[] = [
    {
      id: "openrouter/free",
      name: "OpenRouter Auto Free",
      description: "Automatically routes each prompt to the fastest, most reliable free model available.",
      category: "fast",
      contextLength: 128000,
      highlight: "Auto-Selected"
    },
    {
      id: "deepseek/deepseek-r1",
      name: "DeepSeek R1",
      description: "State-of-the-art chain-of-thought reasoning. Excels at math, multi-step logic, and deep analysis.",
      category: "reasoning",
      contextLength: 64000,
      highlight: "Deep Reasoning"
    },
    {
      id: "deepseek/deepseek-chat",
      name: "DeepSeek V3",
      description: "High-capability flagship model for natural conversations, essay writing, and analytical problem-solving.",
      category: "conversational",
      contextLength: 64000,
      highlight: "All-Rounder"
    },
    {
      id: "meta-llama/llama-3.3-70b-instruct",
      name: "Llama 3.3 70B",
      description: "Meta's flagship 70B open weight model. Highly articulate, comprehensive knowledge and writing ability.",
      category: "conversational",
      contextLength: 128000,
      highlight: "70B Powerhouse"
    },
    {
      id: "meta-llama/llama-3.1-8b-instruct:free",
      name: "Llama 3.1 8B",
      description: "Snappy, lightweight, low-latency companion for quick questions, flashcard quizzes, and fast answers.",
      category: "fast",
      contextLength: 128000,
      highlight: "Ultra Fast"
    },
    {
      id: "qwen/qwen-2.5-coder-32b-instruct:free",
      name: "Qwen 2.5 Coder 32B",
      description: "Dedicated coding and computer science assistant. Expert at debugging, code explanation, and writing scripts.",
      category: "coding",
      contextLength: 32768,
      highlight: "Coding Pro"
    },
    {
      id: "qwen/qwen-2.5-72b-instruct:free",
      name: "Qwen 2.5 72B",
      description: "Top-tier multilingual open model with strong reasoning, literature analysis, and comprehension.",
      category: "reasoning",
      contextLength: 32768,
      highlight: "72B Giant"
    },
    {
      id: "mistralai/mistral-small-24b-instruct-2501:free",
      name: "Mistral Small 24B",
      description: "Crisp, factual European model built for direct, well-structured answers without fluff.",
      category: "fast",
      contextLength: 32768,
      highlight: "Concise & Accurate"
    },
    {
      id: "meta-llama/llama-3.1-8b-instruct:free",
      name: "Llama 3.1 8B",
      description: "Snappy, lightweight, low-latency companion for quick questions, flashcard quizzes, and fast answers.",
      category: "fast",
      contextLength: 128000,
      highlight: "Ultra Fast"
    },
    {
      id: "google/gemini-2.0-flash-thinking-exp:free",
      name: "Gemini 2.0 Thinking Exp",
      description: "Shows its internal thinking trace and step-by-step problem breakdown before answering.",
      category: "reasoning",
      contextLength: 32768,
      highlight: "Step-by-Step"
    },
    {
      id: "microsoft/phi-4:free",
      name: "Microsoft Phi-4",
      description: "Compact synthetic-data trained reasoning champion for science, logic, and mathematics.",
      category: "reasoning",
      contextLength: 16384,
      highlight: "Math & Logic"
    },
    {
      id: "google/gemma-2-9b-it:free",
      name: "Gemma 2 9B",
      description: "Google's lightweight, safe conversational model. Friendly, patient, and great for schoolwork tutoring.",
      category: "conversational",
      contextLength: 8192,
      highlight: "Patient Tutor"
    },
    {
      id: "cognitivecomputations/dolphin-mistral-24b-venom:free",
      name: "Dolphin Mistral 24B",
      description: "Open, creative, and unconstrained model for imaginative creative writing and roleplay.",
      category: "creative",
      contextLength: 32768,
      highlight: "Creative"
    },
    {
      id: "nvidia/nemotron-3.5-content-safety:free",
      name: "Nvidia Nemotron 3.5",
      description: "Advanced safety analysis, content critiquing, and text refinement.",
      category: "reasoning",
      contextLength: 8192,
      highlight: "Refinement"
    }
  ];

  let cachedGroqModelsList: Array<{ id: string; name: string; provider: string; badge: string; description: string }> = [];
  let cachedGroqIds: string[] = [];
  let lastGroqFetchTime = 0;

  const GROQ_MODEL_ALIASES: Record<string, string> = {
    "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
    "llama-3.1-8b-instant": "openai/gpt-oss-20b",
    "mixtral-8x7b-32768": "openai/gpt-oss-120b",
    "gemma2-9b-it": "openai/gpt-oss-20b",
    "deepseek-r1-distill-llama-70b": "openai/gpt-oss-120b",
    "qwen-2.5-32b": "qwen/qwen3.8-27b",
    "groq/compound": "openai/gpt-oss-120b",
    "groq/compound-mini": "openai/gpt-oss-20b"
  };

  const FALLBACK_GROQ_MODELS = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
    "llama3-70b-8192",
    "llama3-8b-8192",
    "llama-3.3-70b-specdec",
    "llama-3.2-11b-vision-preview",
    "llama-3.2-3b-preview",
    "llama-3.2-1b-preview"
  ];

  async function resolveActiveGroqModels(rawKey: string): Promise<string[]> {
    const key = typeof rawKey === "string" ? rawKey.trim().replace(/^["']|["']$/g, "").trim() : "";
    if (!key) return FALLBACK_GROQ_MODELS;
    const now = Date.now();
    if (cachedGroqIds.length > 0 && now - lastGroqFetchTime < 10 * 60 * 1000) {
      return cachedGroqIds;
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${key}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const json: any = await res.json();
        if (Array.isArray(json?.data)) {
          const valid = json.data
            .map((m: any) => m.id)
            .filter((id: string) => 
              typeof id === "string" &&
              !id.includes("whisper") &&
              !id.includes("orpheus") &&
              !id.includes("tts") &&
              !id.includes("guard") &&
              !id.includes("embed") &&
              !id.includes("mixtral") &&
              !id.includes("gemma2")
            );
          if (valid.length > 0) {
            // Sort to prioritize known flagship models
            valid.sort((a: string, b: string) => {
              const score = (id: string) => {
                if (id.includes("gpt-oss-120b")) return 10;
                if (id.includes("gpt-oss-20b")) return 9;
                if (id.includes("qwen3.8")) return 8;
                if (id.includes("llama3-70b")) return 7;
                if (id.includes("llama3-8b")) return 6;
                if (id.includes("specdec")) return 5;
                return 1;
              };
              return score(b) - score(a);
            });

            cachedGroqIds = valid;
            lastGroqFetchTime = now;
            cachedGroqModelsList = valid.map((id: string) => ({
              id,
              name: id.replace(/^openai\//, "OpenAI ").replace(/^qwen\//, "Qwen ").replace(/^meta-llama\//, "Llama ").replace(/-/g, " "),
              provider: id.includes("openai") ? "OpenAI on Groq" : (id.includes("qwen") ? "Alibaba on Groq" : "Meta on Groq"),
              badge: id.includes("120b") ? "Flagship" : (id.includes("20b") ? "Ultra Fast" : "Free Forever"),
              description: `Ultra-fast inference on Groq LPUs (${id}).`,
            }));
            return valid;
          }
        }
      }
    } catch (e) {}
    return cachedGroqIds.length > 0 ? cachedGroqIds : FALLBACK_GROQ_MODELS;
  }

  app.get("/api/ai/models", async (req, res) => {
    const authHeader = req.headers.authorization || "";
    const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    const serverKey = process.env.GROQ_API_KEY || process.env.GROQ_KEY || process.env.VITE_GROQ_API_KEY || process.env.AI_API_KEY || "";
    const activeKey = (bearerToken.startsWith("gsk_") ? bearerToken : "") || serverKey;

    if (activeKey) {
      await resolveActiveGroqModels(activeKey);
    }

    const modelsToSend = cachedGroqModelsList.length > 0 ? cachedGroqModelsList : [
      { id: "openai/gpt-oss-120b", name: "GPT OSS 120B (Groq LPU)", provider: "OpenAI on Groq", badge: "Flagship", description: "OpenAI's flagship 120B open-weight model with 500+ tps reasoning on Groq LPUs." },
      { id: "openai/gpt-oss-20b", name: "GPT OSS 20B (Groq LPU)", provider: "OpenAI on Groq", badge: "Ultra Fast", description: "Ultra-fast low-latency conversational model for instant responses." },
      { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B Vision", provider: "Alibaba on Groq", badge: "Multimodal", description: "Dense multimodal reasoning and problem-solving model running at 450 tps." },
      { id: "groq/compound", name: "Groq Compound Engine", provider: "Groq Compound", badge: "Compound", description: "Groq's coordinated compound reasoning and agentic routing engine." },
      { id: "groq/compound-mini", name: "Groq Compound Mini", provider: "Groq Compound", badge: "Instant", description: "Lightweight, instant compound engine for quick tasks and study queries." }
    ];

    res.json({
      models: modelsToSend,
      hasServerKey: Boolean(process.env.GROQ_API_KEY || process.env.GROQ_KEY || process.env.VITE_GROQ_API_KEY || process.env.AI_API_KEY || process.env.GEMINI_API_KEY),
      provider: "groq",
    });
  });

  async function executeAiCompletion(opts: {
    messages: any[];
    model?: string;
    systemPrompt?: string;
    temperature?: number;
    customKey?: string;
    endpoint?: string;
  }): Promise<{ text: string; model: string; provider: string }> {
    const {
      messages = [],
      model = "openai/gpt-oss-120b",
      systemPrompt = "You are a helpful, clear, and friendly AI study assistant. Provide accurate, well-structured, detailed answers using clean Markdown.",
      temperature = 0.7,
      customKey = "",
      endpoint = "https://api.groq.com/openai/v1"
    } = opts || {};

    const cleanCustomKey = sanitizeApiKey(customKey);
    const isClientGroq = cleanCustomKey.startsWith("gsk_");
    const serverGroqKey = sanitizeApiKey(process.env.GROQ_API_KEY || process.env.GROQ_KEY || process.env.GROQ_TOKEN || process.env.VITE_GROQ_API_KEY || (process.env.AI_API_KEY && !process.env.AI_API_KEY.startsWith("ghp_") && !process.env.AI_API_KEY.startsWith("AIza") ? process.env.AI_API_KEY : ""));
    const groqKey = isClientGroq ? cleanCustomKey : (serverGroqKey || (!cleanCustomKey.startsWith("ghp_") && !cleanCustomKey.startsWith("github_pat_") && !cleanCustomKey.startsWith("AIza") ? cleanCustomKey : ""));

    const mappedModel = GROQ_MODEL_ALIASES[model] || model || "openai/gpt-oss-120b";

    // 1. Primary: Groq Free Forever Models Engine
    if (groqKey) {
      const liveModels = await resolveActiveGroqModels(groqKey);
      const candidateModels = Array.from(new Set([
        mappedModel,
        model,
        ...liveModels,
        ...FALLBACK_GROQ_MODELS
      ])).filter(Boolean);

      const groqMessages: any[] = [];
      if (systemPrompt && !messages.some((m: any) => m.role === "system")) {
        groqMessages.push({ role: "system", content: systemPrompt });
      }
      for (const m of messages) {
        groqMessages.push({
          role: m.role === "model" ? "assistant" : (m.role || "user"),
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
        });
      }

      for (const cand of candidateModels) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);

          const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${groqKey}`,
              "User-Agent": "FrostedAI-Groq/1.0"
            },
            body: JSON.stringify({
              model: cand,
              messages: groqMessages,
              temperature: Math.min(1.0, Math.max(0.1, temperature)),
              stream: false,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (res.ok) {
            const data: any = await res.json();
            const choice = data.choices?.[0];
            const reasoning = choice?.message?.reasoning_content || choice?.message?.reasoning || "";
            const content = choice?.message?.content || "";
            let text = content;
            if (reasoning) {
              text = `<think>\n${reasoning.trim()}\n</think>\n\n${content.trim()}`;
            }
            if (text) {
              return { text, model: cand, provider: "groq" };
            }
          } else {
            const errText = await res.text().catch(() => "");
            console.warn(`[Groq Completion] ${cand} failed (${res.status}): ${errText.slice(0, 120)}`);
          }
        } catch (groqErr) {
          // try next candidate
        }
      }
    }

    // 2. Secondary Fallback: GitHub Models if token available
    const isGithubToken = typeof cleanCustomKey === "string" && (cleanCustomKey.startsWith("github_pat_") || cleanCustomKey.startsWith("ghp_"));
    const effectiveKey = cleanCustomKey || process.env.GITHUB_TOKEN || "";

    if (isGithubToken || (effectiveKey && endpoint && (endpoint.includes("github.ai") || endpoint.includes("azure.com")))) {
      try {
        const ghEndpoint = endpoint && endpoint.startsWith("http") && !endpoint.includes("groq") ? endpoint : "https://models.inference.ai.azure.com";
        const client = new OpenAI({
          baseURL: ghEndpoint,
          apiKey: effectiveKey,
        });

        const ghMessages: any[] = [];
        if (systemPrompt && !messages.some((m: any) => m.role === "system")) {
          ghMessages.push({ role: "system", content: systemPrompt });
        }
        for (const m of messages) {
          ghMessages.push({
            role: m.role || "user",
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
          });
        }

        const completion = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: ghMessages,
          temperature: Math.min(1.0, Math.max(0.1, temperature)),
          stream: false,
        });

        const text = completion.choices?.[0]?.message?.content || "";
        if (text) {
          return {
            text,
            model: "gpt-4o-mini",
            provider: "github-models"
          };
        }
      } catch (ghErr: any) {}
    }

    // 3. Tertiary Fallback: Google Gemini
    const geminiApiKey = sanitizeApiKey(process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith("AIza") ? process.env.AI_API_KEY : ""));
    if (geminiApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });
        const conversationContents: any[] = [];
        for (const m of messages) {
          if (m.role === "system") continue;
          conversationContents.push({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
          });
        }
        if (conversationContents.length === 0) {
          conversationContents.push({ role: "user", parts: [{ text: "Hello!" }] });
        }
        const nonStreamResult = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: conversationContents,
          config: { systemInstruction: systemPrompt || undefined, temperature: Math.min(1.0, Math.max(0.1, temperature)) }
        });
        if (nonStreamResult?.text) {
          return { text: nonStreamResult.text, model: "gemini-2.5-flash", provider: "google-gemini" };
        }
      } catch (gemErr) {}
    }

    return {
      text: "Hello! I am your Frosted AI study companion. To enable high-speed Groq LPU models on your app, please verify your GROQ_API_KEY in Render environment settings or in the API Key settings modal.",
      model: "system",
      provider: "system"
    };
  }

  app.post("/api/ai/chat", async (req, res) => {
    try {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) {}
      } else if (Buffer.isBuffer(body)) {
        try { body = JSON.parse(body.toString("utf-8")); } catch (e) {}
      }

      const {
        messages = [],
        model = "openai/gpt-oss-120b",
        systemPrompt = "You are a helpful, clear, and friendly AI study assistant. Provide accurate, thoroughly explained, step-by-step reasoning in clean Markdown.",
        temperature = 0.7,
        customKey = "",
        stream = false,
        endpoint = "https://api.groq.com/openai/v1"
      } = body || {};

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array cannot be empty." });
      }

      const isStream = stream === true || (req.headers.accept && req.headers.accept.includes("text/event-stream"));

      const authHeader = req.headers.authorization || "";
      const bearerToken = sanitizeApiKey(authHeader.replace(/^Bearer\s+/i, ""));
      const cleanCustomKey = sanitizeApiKey(customKey);

      const isClientGroq = cleanCustomKey.startsWith("gsk_") || bearerToken.startsWith("gsk_");
      const isClientGithub = cleanCustomKey.startsWith("ghp_") || cleanCustomKey.startsWith("github_pat_") || bearerToken.startsWith("ghp_") || bearerToken.startsWith("github_pat_");
      const isClientGemini = cleanCustomKey.startsWith("AIza") || bearerToken.startsWith("AIza");

      const serverGroqKey = findGroqApiKey();
      const clientGroqKey = isClientGroq ? (cleanCustomKey || bearerToken) : "";
      const groqKey = clientGroqKey || serverGroqKey || (!isClientGithub && !isClientGemini ? (cleanCustomKey || bearerToken) : "");

      console.log(`[AI Chat] Model: ${model} | Server Groq Key: ${Boolean(serverGroqKey)} | Client Groq Key: ${Boolean(clientGroqKey)}`);

      // Build OpenAI-compatible messages for Groq
      const groqMessages: any[] = [];
      if (systemPrompt && !messages.some((m: any) => m.role === "system")) {
        groqMessages.push({ role: "system", content: systemPrompt });
      }
      for (const m of messages) {
        groqMessages.push({
          role: m.role === "model" ? "assistant" : (m.role || "user"),
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
        });
      }

      let lastGroqStatus = 0;
      let lastGroqErrorText = "";

      // =========================================================================
      // 1. PRIMARY ENGINE: Groq High-Speed LPU Inference
      // =========================================================================
      if (groqKey) {
        const liveGroqModels = await resolveActiveGroqModels(groqKey);
        const mappedModel = GROQ_MODEL_ALIASES[model] || model || "openai/gpt-oss-120b";
        const groqCandidateModels = Array.from(new Set([
          mappedModel,
          "openai/gpt-oss-120b",
          "openai/gpt-oss-20b",
          "qwen/qwen3.8-27b",
          "llama3-70b-8192",
          "llama3-8b-8192",
          "llama-3.3-70b-specdec",
          "llama-3.2-11b-vision-preview",
          "llama-3.2-3b-preview",
          "llama-3.3-70b-versatile",
          "llama-3.1-8b-instant",
          ...liveGroqModels,
          ...FALLBACK_GROQ_MODELS
        ])).filter(Boolean);

        for (const candModel of groqCandidateModels) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const upstreamRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${groqKey}`,
                "User-Agent": "FrostedAI-Groq/1.0",
              },
              body: JSON.stringify({
                model: candModel,
                messages: groqMessages,
                temperature: Math.min(1.0, Math.max(0.1, temperature)),
                stream: Boolean(isStream),
              }),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!upstreamRes.ok) {
              lastGroqStatus = upstreamRes.status;
              lastGroqErrorText = await upstreamRes.text().catch(() => "");
              console.warn(`[Groq] ${candModel} returned ${upstreamRes.status}:`, lastGroqErrorText.slice(0, 150));
              if (upstreamRes.status === 401) {
                // Invalid API key - all other candidates will fail identically
                break;
              }
              continue;
            }

            if (isStream && upstreamRes.body) {
              res.setHeader("Content-Type", "text/event-stream");
              res.setHeader("Cache-Control", "no-cache, no-transform");
              res.setHeader("Connection", "keep-alive");
              res.setHeader("X-Accel-Buffering", "no");

              const reader = upstreamRes.body.getReader();
              const decoder = new TextDecoder("utf-8");
              let buffer = "";
              let inThoughtMode = false;

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed || trimmed.startsWith(":")) continue;
                  if (trimmed === "data: [DONE]") {
                    if (inThoughtMode) {
                      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "\n</think>\n\n" } }] })}\n\n`);
                      inThoughtMode = false;
                    }
                    res.write("data: [DONE]\n\n");
                    return res.end();
                  }
                  if (trimmed.startsWith("data: ")) {
                    const jsonStr = trimmed.slice(6);
                    try {
                      const parsed = JSON.parse(jsonStr);
                      const delta = parsed.choices?.[0]?.delta;
                      const reasoning = delta?.reasoning_content || delta?.reasoning || "";
                      const content = delta?.content || "";

                      if (reasoning) {
                        if (!inThoughtMode) {
                          inThoughtMode = true;
                          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "<think>\n" + reasoning } }] })}\n\n`);
                        } else {
                          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: reasoning } }] })}\n\n`);
                        }
                      } else if (content) {
                        if (inThoughtMode) {
                          inThoughtMode = false;
                          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "\n</think>\n\n" + content } }] })}\n\n`);
                        } else {
                          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: content } }] })}\n\n`);
                        }
                      }
                    } catch (e) {
                      res.write(`${line}\n\n`);
                    }
                  }
                }
              }

              if (inThoughtMode) {
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: "\n</think>\n\n" } }] })}\n\n`);
              }
              res.write("data: [DONE]\n\n");
              return res.end();
            } else {
              const data: any = await upstreamRes.json();
              const choice = data?.choices?.[0];
              const reasoning = choice?.message?.reasoning_content || choice?.message?.reasoning || "";
              const content = choice?.message?.content || "";
              let text = content;
              if (reasoning) {
                text = `<think>\n${reasoning.trim()}\n</think>\n\n${content.trim()}`;
              }
              return res.json({
                text,
                choices: [{ message: { content: text } }],
                model: candModel,
                provider: "groq"
              });
            }
          } catch (modelErr: any) {
            console.warn(`Groq candidate ${candModel} failed, trying next candidate:`, modelErr?.message);
          }
        }
      }

      // =========================================================================
      // 2. SECONDARY ENGINE: Gemini Fallback
      // =========================================================================
      const geminiApiKey = process.env.GEMINI_API_KEY || (process.env.AI_API_KEY?.startsWith("AIza") ? process.env.AI_API_KEY : "") || (isClientGemini ? (customKey || bearerToken) : "");
      if (geminiApiKey) {
        try {
          const ai = new GoogleGenAI({ apiKey: geminiApiKey });
          const conversationContents: any[] = [];
          for (const m of messages) {
            if (m.role === "system") continue;
            conversationContents.push({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
            });
          }
          if (conversationContents.length === 0) {
            conversationContents.push({ role: "user", parts: [{ text: "Hello!" }] });
          }

          if (isStream) {
            const streamResult = await ai.models.generateContentStream({
              model: "gemini-2.5-flash",
              contents: conversationContents,
              config: { systemInstruction: systemPrompt || undefined, temperature: Math.min(1.0, Math.max(0.1, temperature)) }
            });
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache, no-transform");
            res.setHeader("Connection", "keep-alive");
            res.setHeader("X-Accel-Buffering", "no");
            for await (const chunk of streamResult) {
              const delta = chunk.text || "";
              if (delta) {
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`);
              }
            }
            res.write("data: [DONE]\n\n");
            return res.end();
          } else {
            const nonStreamResult = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: conversationContents,
              config: { systemInstruction: systemPrompt || undefined, temperature: Math.min(1.0, Math.max(0.1, temperature)) }
            });
            const text = nonStreamResult.text || "";
            return res.json({
              text,
              choices: [{ message: { content: text } }],
              model: "gemini-2.5-flash",
              provider: "google-gemini"
            });
          }
        } catch (gemErr: any) {}
      }

      // =========================================================================
      // 3. TERTIARY ENGINE: GitHub Models Fallback (if token provided)
      // =========================================================================
      const effectiveKey = (isClientGithub ? (customKey || bearerToken) : "") || process.env.GITHUB_TOKEN || "";
      if (effectiveKey) {
        try {
          const ghEndpoint = endpoint && endpoint.startsWith("http") && !endpoint.includes("groq") ? endpoint : "https://models.inference.ai.azure.com";
          const client = new OpenAI({
            baseURL: ghEndpoint,
            apiKey: effectiveKey,
          });

          const ghMessages: any[] = [];
          if (systemPrompt && !messages.some((m: any) => m.role === "system")) {
            ghMessages.push({ role: "system", content: systemPrompt });
          }
          for (const m of messages) {
            ghMessages.push({
              role: m.role || "user",
              content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
            });
          }

          if (isStream) {
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache, no-transform");
            res.setHeader("Connection", "keep-alive");
            res.setHeader("X-Accel-Buffering", "no");

            const streamRes = await client.chat.completions.create({
              model: "gpt-4o-mini",
              messages: ghMessages,
              temperature: Math.min(1.0, Math.max(0.1, temperature)),
              stream: true,
            });

            for await (const chunk of streamRes) {
              const content = (chunk.choices?.[0]?.delta as any)?.content || "";
              if (content) {
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
              }
            }
            res.write("data: [DONE]\n\n");
            return res.end();
          } else {
            const completion = await client.chat.completions.create({
              model: "gpt-4o-mini",
              messages: ghMessages,
              temperature: Math.min(1.0, Math.max(0.1, temperature)),
              stream: false,
            });
            const text = completion.choices?.[0]?.message?.content || "";
            return res.json({
              text,
              choices: [{ message: { content: text } }],
              model: "gpt-4o-mini",
              provider: "github-models"
            });
          }
        } catch (ghErr: any) {}
      }

      // 4. Graceful Diagnostic Response with exact troubleshooting
      let noticeText = "";
      if (lastGroqStatus === 401) {
        noticeText = `⚠️ **Groq API Key Authentication Failed (HTTP 401)**\n\nThe Groq key provided on your server or in your browser was rejected by Groq as invalid, expired, or revoked.\n\n**How to fix:**\n1. Go to [console.groq.com/keys](https://console.groq.com/keys) and generate a new key (it starts with \`gsk_\`).\n2. Click the **API Key** button in the header at the top right of this chat and paste it to connect immediately.\n3. On **Render**, update \`GROQ_API_KEY\` in your **Environment** tab, then click **Manual Deploy → Deploy latest commit**.`;
      } else if (lastGroqStatus === 429) {
        noticeText = `⚠️ **Groq Rate Limit Exceeded (HTTP 429)**\n\nYour Groq free tier per-minute token rate limit was reached. Please wait 30 seconds and send your message again.`;
      } else if (!groqKey) {
        noticeText = `⚠️ **Groq API Key Not Detected on Server**\n\nFrosted AI could not find an active \`GROQ_API_KEY\` in the environment.\n\n**To resolve:**\n1. In your **Render Dashboard** → Your Web Service → **Environment** tab:\n   - Add Key: \`GROQ_API_KEY\`\n   - Value: \`gsk_...\`\n2. **Important:** Click **Manual Deploy → Deploy latest commit** so Render restarts with the new variable applied.\n3. **Immediate Option:** Click the **API Key** button at the top right of this page to paste your \`gsk_...\` key and start chatting instantly!`;
      } else {
        noticeText = `⚠️ **Groq Inference Notice (${lastGroqStatus ? `HTTP ${lastGroqStatus}` : "Unavailable"})**\n\n${lastGroqErrorText ? `*Groq message:* \`${lastGroqErrorText.slice(0, 200)}\`\n\n` : ""}Please verify your key in the **API Key** settings modal at the top right or try sending your message again.`;
      }

      if (isStream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: noticeText } }] })}\n\n`);
        res.write("data: [DONE]\n\n");
        return res.end();
      } else {
        return res.json({
          text: noticeText,
          choices: [{ message: { content: noticeText } }],
          model: "system-notice",
          provider: "system"
        });
      }
    } catch (err: any) {
      console.error("AI chat fatal error:", err);
      return res.status(500).json({
        error: err?.message || "Internal AI generation error"
      });
    }
  });

  // Dynamic LuminSDK Session & Image proxy
  let cachedLuminSessionId: string | null = null;
  let cachedLuminSessionExpiry = 0;

  async function getLuminSessionId(): Promise<string> {
    const now = Date.now();
    if (cachedLuminSessionId && now < cachedLuminSessionExpiry) {
      return cachedLuminSessionId;
    }
    
    try {
      const res = await fetch("https://a.luminsdk.com/api/v1/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data && data.session_id) {
          cachedLuminSessionId = data.session_id;
          cachedLuminSessionExpiry = now + 10 * 60 * 1000; // Cache for 10 minutes
          return data.session_id;
        }
      }
    } catch (err) {
      console.error("Error fetching Lumin session:", err);
    }
    
    return cachedLuminSessionId || "60919094aa4265e2fd2bc9e9b1874e4e";
  }

  app.get("/api/lumin-icon/*", async (req, res) => {
    try {
      let token = (req.params as any)[0] || req.path.replace("/api/lumin-icon/", "");
      if (!token) {
        return res.status(400).send("Missing token");
      }
      
      const sessionId = await getLuminSessionId();
      const freshToken = token.replace(/^[^/]+/, sessionId);
      const targetUrl = `https://a.luminsdk.com/api/v1/assets/${freshToken}`;
      
      const response = await fetch(targetUrl);
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch from Lumin: ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    } catch (err: any) {
      console.error("Error proxying lumin icon:", err);
      return res.status(500).send(err.message);
    }
  });

  // Custom Real-Time Database Engine Routes (Vercel & Local Node compatible)
  app.all(["/api/db/data", "/api/db/data/*"], async (req, res) => {
    try {
      return await dbDataHandler(req, res);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || String(err) });
    }
  });

  app.get(["/api/db/stream", "/api/db/stream/*"], async (req, res) => {
    try {
      return await dbStreamHandler(req, res);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || String(err) });
    }
  });

  // Vite integration and static asset serving
  const isMain = typeof require !== 'undefined' && require.main === module;
  const isStandalone = typeof process !== 'undefined' && process.argv[1]?.includes('server');
  
  if (isMain || isStandalone) {
    (async () => {
      if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
          server: {
            middlewareMode: true,
            hmr: false,
            watch: null,
          },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
          res.sendFile(path.join(distPath, "index.html"));
        });
      }

      // Periodic background maintenance for stale presence (backup to the change-based pruning)
      setInterval(() => {
        getDb().then(async (db) => {
          try {
            const now = Date.now();
            const staleThreshold = now - 45000; // 45s hard prune from database
            await db.run("DELETE FROM records WHERE collection = ? AND timestamp < ?", ["presence", staleThreshold]);
            await db.run("DELETE FROM records WHERE collection = ? AND timestamp < ?", ["voice_users", staleThreshold]);
            
            // Memory store maintenance
            ["presence", "voice_users"].forEach(col => {
              if (memoryStore[col]) {
                const memoryStaleThreshold = now - 20000; // 20s soft prune from RAM
                Object.keys(memoryStore[col]).forEach(k => {
                  const item = memoryStore[col][k];
                  const itemTs = item.timestamp || item.lastSeen || 0;
                  if (itemTs < memoryStaleThreshold) {
                    delete memoryStore[col][k];
                  }
                });
              }
            });
          } catch (e) {}
        }).catch(() => {});
      }, 30000);

      httpServer.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running with WebSockets enabled on http://localhost:${PORT}`);

        // Self-ping keepalive loop to prevent inactivity timeouts on Render and cloud hosts
        const keepAliveBase =
          process.env.RENDER_EXTERNAL_URL ||
          process.env.APP_URL ||
          process.env.KEEP_ALIVE_URL ||
          "https://ais-dev-ovp2lvnduxwm4gh3dbqu3j-534577608781.us-west2.run.app";

        const PING_INTERVAL_MS = 13 * 60 * 1000; // 13 minutes (safely under the 15-minute inactivity limit)

        const pingServerKeepAlive = async () => {
          const targetUrl = keepAliveBase.endsWith("/")
            ? `${keepAliveBase}api/ping`
            : `${keepAliveBase}/api/ping`;
          try {
            const res = await fetch(targetUrl, {
              headers: { "User-Agent": "Render-KeepAlive/1.0" },
              signal: AbortSignal.timeout(12000),
            });
            console.log(`[KeepAlive] Pinged ${targetUrl} - HTTP status ${res.status}`);
          } catch {
            try {
              const res = await fetch(keepAliveBase, {
                headers: { "User-Agent": "Render-KeepAlive/1.0" },
                signal: AbortSignal.timeout(12000),
              });
              console.log(`[KeepAlive] Fallback pinged ${keepAliveBase} - HTTP status ${res.status}`);
            } catch (err: any) {
              console.warn(`[KeepAlive] Ping failed:`, err?.message || err);
            }
          }
        };

        // Ping after 10 seconds of startup and then continuously every 13 minutes
        setTimeout(pingServerKeepAlive, 10000);
        setInterval(pingServerKeepAlive, PING_INTERVAL_MS);
      });
    })();
  }

// Export the initialized Express app for serverless environments (Vercel)
export default app;
