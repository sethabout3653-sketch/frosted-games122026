import express from "express";
import { execFile, spawn } from "child_process";
import path from "path";
import fs from "fs";
import yts from "yt-search";

export const musicRouter = express.Router();

const YT_DLP_BIN = fs.existsSync("/usr/local/bin/yt-dlp")
  ? "/usr/local/bin/yt-dlp"
  : path.join(process.cwd(), "bin", "yt-dlp");

const YTMDL_BIN = "/usr/local/bin/ytmdl";

const UPLOADS_DIR = fs.existsSync(path.join(process.cwd(), "uploads"))
  ? path.join(process.cwd(), "uploads")
  : "/tmp/uploads";

if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (e) {}
}

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface MusicTrack {
  id: string;
  youtubeId: string;
  title: string;
  artist: string;
  duration: string;
  durationSec: number;
  thumbnail: string;
  permalinkUrl: string;
  source: "youtube_music" | "soundcloud" | "direct";
  genre?: string;
}

// In-memory cache for ultra-fast response times (0ms delay)
const trendingCache = new Map<string, { tracks: MusicTrack[]; timestamp: number }>();
const searchCache = new Map<string, { tracks: MusicTrack[]; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Curated YouTube Music tracks for instant startup & guaranteed fallback
export const CURATED_YOUTUBE_TRACKS: MusicTrack[] = [
  {
    id: "5yx6BWlEVcY",
    youtubeId: "5yx6BWlEVcY",
    title: "Chillhop Radio - Jazzy & Lo-Fi Beats",
    artist: "Chillhop Music",
    duration: "Live",
    durationSec: 0,
    thumbnail: "https://i.ytimg.com/vi/5yx6BWlEVcY/hqdefault.jpg",
    permalinkUrl: "https://music.youtube.com/watch?v=5yx6BWlEVcY",
    source: "youtube_music",
    genre: "chillhop",
  },
  {
    id: "4xDzrJKXOOY",
    youtubeId: "4xDzrJKXOOY",
    title: "Synthwave Radio - Chill Synth / Retro Beats",
    artist: "Lofi Girl",
    duration: "Live",
    durationSec: 0,
    thumbnail: "https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg",
    permalinkUrl: "https://music.youtube.com/watch?v=4xDzrJKXOOY",
    source: "youtube_music",
    genre: "synthwave",
  },
  {
    id: "jfKfPfyJRdk",
    youtubeId: "jfKfPfyJRdk",
    title: "Lofi Hip Hop Radio - Beats to Relax/Study to",
    artist: "Lofi Girl",
    duration: "Live",
    durationSec: 0,
    thumbnail: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg",
    permalinkUrl: "https://music.youtube.com/watch?v=jfKfPfyJRdk",
    source: "youtube_music",
    genre: "chillhop",
  },
  {
    id: "x3bfa3DZ8JM",
    youtubeId: "x3bfa3DZ8JM",
    title: "A Moment Apart",
    artist: "ODESZA",
    duration: "3:54",
    durationSec: 234,
    thumbnail: "https://i.ytimg.com/vi/x3bfa3DZ8JM/hqdefault.jpg",
    permalinkUrl: "https://music.youtube.com/watch?v=x3bfa3DZ8JM",
    source: "youtube_music",
    genre: "electronic",
  },
  {
    id: "z3wAjJXbYzA",
    youtubeId: "z3wAjJXbYzA",
    title: "A Walk",
    artist: "Tycho",
    duration: "5:17",
    durationSec: 317,
    thumbnail: "https://i.ytimg.com/vi/z3wAjJXbYzA/hqdefault.jpg",
    permalinkUrl: "https://music.youtube.com/watch?v=z3wAjJXbYzA",
    source: "youtube_music",
    genre: "synthwave",
  },
  {
    id: "n61ULEU7CO0",
    youtubeId: "n61ULEU7CO0",
    title: "Best of Lofi Hip Hop Study Mix",
    artist: "Lofi Girl",
    duration: "1:24:15",
    durationSec: 5055,
    thumbnail: "https://i.ytimg.com/vi/n61ULEU7CO0/hqdefault.jpg",
    permalinkUrl: "https://music.youtube.com/watch?v=n61ULEU7CO0",
    source: "youtube_music",
    genre: "chillhop",
  },
  {
    id: "oxqnFj_q-wI",
    youtubeId: "oxqnFj_q-wI",
    title: "Sunset Lover",
    artist: "Petit Biscuit",
    duration: "3:58",
    durationSec: 238,
    thumbnail: "https://i.ytimg.com/vi/oxqnFj_q-wI/hqdefault.jpg",
    permalinkUrl: "https://music.youtube.com/watch?v=oxqnFj_q-wI",
    source: "youtube_music",
    genre: "electronic",
  },
  {
    id: "7NOSDKb0HlU",
    youtubeId: "7NOSDKb0HlU",
    title: "Feel It Still",
    artist: "Portugal. The Man",
    duration: "2:43",
    durationSec: 163,
    thumbnail: "https://i.ytimg.com/vi/7NOSDKb0HlU/hqdefault.jpg",
    permalinkUrl: "https://music.youtube.com/watch?v=7NOSDKb0HlU",
    source: "youtube_music",
    genre: "chillout",
  },
];

// Universal YouTube / YouTube Music video ID extractor
export function extractYoutubeId(input: string): string | null {
  if (!input) return null;
  const clean = input.trim();

  // 1. Direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;

  // 2. Parse URL standard & mobile query parameters
  try {
    const raw = clean.startsWith("http") ? clean : "https://" + clean;
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();

    if (host.includes("youtube.com") || host.includes("youtube-nocookie.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

      const parts = url.pathname.split("/").filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        if (["shorts", "embed", "v", "e", "watch"].includes(parts[i]) && parts[i + 1]) {
          const cand = parts[i + 1].split("?")[0].split("&")[0];
          if (/^[a-zA-Z0-9_-]{11}$/.test(cand)) return cand;
        }
      }
    } else if (host === "youtu.be" || host.endsWith(".youtu.be")) {
      const cand = url.pathname.replace(/^\/+/, "").split("/")[0].split("?")[0];
      if (cand && /^[a-zA-Z0-9_-]{11}$/.test(cand)) return cand;
    }
  } catch (e) {}

  // 3. Fallback regex matching
  const m = clean.match(/(?:[?&]v=|\/embed\/|\/shorts\/|\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (m && m[1]) return m[1];

  return null;
}

function parseDurationSeconds(dur: string): number {
  if (!dur || typeof dur !== "string") return 210;
  const parts = dur.split(":").map(Number);
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0);
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  return 210;
}

// Native YouTube Innertube API Search (works from any server/datacenter without scraping or CAPTCHAs)
async function searchYouTubeInnertube(query: string, limit: number = 24): Promise<MusicTrack[]> {
  try {
    const body = {
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20240101.00.00",
          hl: "en",
          gl: "US",
        },
      },
      query,
    };

    const res = await fetch("https://www.youtube.com/youtubei/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": BROWSER_USER_AGENT,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];

    const data: any = await res.json();
    const sectionList =
      data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

    const tracks: MusicTrack[] = [];
    for (const section of sectionList) {
      const itemContents = section?.itemSectionRenderer?.contents || [];
      for (const item of itemContents) {
        const vr = item.videoRenderer;
        if (vr && vr.videoId && /^[a-zA-Z0-9_-]{11}$/.test(vr.videoId)) {
          const title = vr.title?.runs?.map((r: any) => r.text).join("") || "YouTube Track";
          const artist =
            vr.ownerText?.runs?.map((r: any) => r.text).join("") ||
            vr.longBylineText?.runs?.map((r: any) => r.text).join("") ||
            "Artist";
          const duration = vr.lengthText?.simpleText || "3:30";
          const durationSec = parseDurationSeconds(duration);
          const thumbs = vr.thumbnail?.thumbnails || [];
          const thumbnail =
            thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;

          tracks.push({
            id: vr.videoId,
            youtubeId: vr.videoId,
            title,
            artist,
            duration,
            durationSec,
            thumbnail,
            permalinkUrl: `https://music.youtube.com/watch?v=${vr.videoId}`,
            source: "youtube_music",
          });

          if (tracks.length >= limit) break;
        }
      }
      if (tracks.length >= limit) break;
    }
    return tracks;
  } catch (e) {
    return [];
  }
}

// Fast timeout helper to guarantee responses never hang
function withTimeout<T>(promise: Promise<any>, ms: number, fallback: any): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// 1. Search YouTube Music catalog or Resolve Link
musicRouter.get("/search", async (req, res) => {
  const query = String(req.query.q || "").trim();
  const limit = Math.min(30, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));

  if (!query) {
    return res.json({ tracks: CURATED_YOUTUBE_TRACKS });
  }

  // 1. Direct YouTube video ID or link
  const directId = extractYoutubeId(query);
  if (directId) {
    // Try Innertube search with the ID first (high accuracy)
    const directResults = await searchYouTubeInnertube(directId, 1);
    if (directResults.length > 0) {
      return res.json({ tracks: directResults });
    }

    // Try yts lookup
    try {
      const searchRes: any = await withTimeout(yts({ videoId: directId }), 3500, null);
      if (searchRes && searchRes.videoId) {
        const track: MusicTrack = {
          id: searchRes.videoId,
          youtubeId: searchRes.videoId,
          title: searchRes.title || `Track (${directId})`,
          artist: searchRes.author?.name || "YouTube Music",
          duration: searchRes.timestamp || "3:30",
          durationSec: searchRes.seconds || 210,
          thumbnail: searchRes.thumbnail || `https://i.ytimg.com/vi/${searchRes.videoId}/hqdefault.jpg`,
          permalinkUrl: `https://music.youtube.com/watch?v=${searchRes.videoId}`,
          source: "youtube_music",
        };
        return res.json({ tracks: [track] });
      }
    } catch (e) {}

    // Immediate guaranteed track from direct ID
    const reliableTrack: MusicTrack = {
      id: directId,
      youtubeId: directId,
      title: `YouTube Music Track (${directId})`,
      artist: "YouTube Music",
      duration: "3:30",
      durationSec: 210,
      thumbnail: `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`,
      permalinkUrl: `https://music.youtube.com/watch?v=${directId}`,
      source: "youtube_music",
    };
    return res.json({ tracks: [reliableTrack] });
  }

  // Check cache for keyword searches
  const cached = searchCache.get(query.toLowerCase());
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ tracks: cached.tracks.slice(0, limit) });
  }

  // Primary: Native YouTube Innertube API
  const innertubeTracks = await searchYouTubeInnertube(query, limit);
  if (innertubeTracks.length > 0) {
    searchCache.set(query.toLowerCase(), { tracks: innertubeTracks, timestamp: Date.now() });
    return res.json({ tracks: innertubeTracks });
  }

  // Secondary: yt-search fallback
  try {
    const searchRes: any = await withTimeout(yts(query), 4000, { videos: [] });
    const videos = searchRes?.videos || [];
    const tracks: MusicTrack[] = videos.slice(0, limit).map((v: any) => ({
      id: v.videoId,
      youtubeId: v.videoId,
      title: v.title,
      artist: v.author?.name || "Artist",
      duration: v.timestamp || "3:30",
      durationSec: v.seconds || 210,
      thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      permalinkUrl: `https://music.youtube.com/watch?v=${v.videoId}`,
      source: "youtube_music",
    }));

    if (tracks.length > 0) {
      searchCache.set(query.toLowerCase(), { tracks, timestamp: Date.now() });
      return res.json({ tracks });
    }
  } catch (err) {}

  // Fallback: search within curated list
  const filtered = CURATED_YOUTUBE_TRACKS.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.artist.toLowerCase().includes(query.toLowerCase())
  );
  return res.json({ tracks: filtered });
});

// 2. Trending / Genre Feeds (Instant Cached)
musicRouter.get("/trending", async (req, res) => {
  const category = String(req.query.category || "all").toLowerCase();

  // Check cache
  const cached = trendingCache.get(category);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ tracks: cached.tracks });
  }

  const genreQuery =
    category === "chillhop" || category === "study"
      ? "lofi hip hop radio study beats"
      : category === "synthwave" || category === "electronic"
      ? "synthwave retrowave chill beats"
      : category === "hiphop"
      ? "chillhop beats relaxing instrumental"
      : "trending relaxing study music";

  // Try Innertube
  const innertubeTracks = await searchYouTubeInnertube(genreQuery, 24);
  if (innertubeTracks.length > 0) {
    trendingCache.set(category, { tracks: innertubeTracks, timestamp: Date.now() });
    return res.json({ tracks: innertubeTracks });
  }

  // Fallback to yts
  try {
    const searchRes: any = await withTimeout(yts(genreQuery), 3500, { videos: [] });
    const videos = searchRes?.videos || [];
    const tracks: MusicTrack[] = videos.slice(0, 24).map((v: any) => ({
      id: v.videoId,
      youtubeId: v.videoId,
      title: v.title,
      artist: v.author?.name || "Artist",
      duration: v.timestamp || "3:30",
      durationSec: v.seconds || 210,
      thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
      permalinkUrl: `https://music.youtube.com/watch?v=${v.videoId}`,
      source: "youtube_music",
    }));

    if (tracks.length > 0) {
      trendingCache.set(category, { tracks, timestamp: Date.now() });
      return res.json({ tracks });
    }
  } catch (err) {}

  // Fallback to curated
  res.json({ tracks: CURATED_YOUTUBE_TRACKS });
});

// 3. Resolve any link using Innertube, yt-dlp & metadata
musicRouter.get("/resolve", async (req, res) => {
  const rawUrl = String(req.query.url || "").trim();
  if (!rawUrl) {
    return res.status(400).json({ error: "Missing 'url' parameter" });
  }

  // 1. YouTube & YouTube Music links
  const videoId = extractYoutubeId(rawUrl);
  if (videoId) {
    // Try Innertube lookup
    const innertubeResults = await searchYouTubeInnertube(videoId, 1);
    if (innertubeResults.length > 0) {
      return res.json(innertubeResults[0]);
    }

    try {
      const info: any = await withTimeout(yts({ videoId }), 3500, null);
      if (info && info.videoId) {
        return res.json({
          id: info.videoId,
          youtubeId: info.videoId,
          title: info.title || `Track (${info.videoId})`,
          artist: info.author?.name || "YouTube Music",
          duration: info.timestamp || "3:30",
          durationSec: info.seconds || 210,
          thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${info.videoId}/hqdefault.jpg`,
          permalinkUrl: `https://music.youtube.com/watch?v=${info.videoId}`,
          source: "youtube_music",
        });
      }
    } catch (e) {}

    // Immediate guarantee with the exact videoId
    return res.json({
      id: videoId,
      youtubeId: videoId,
      title: `YouTube Music Track (${videoId})`,
      artist: "YouTube Music",
      duration: "3:30",
      durationSec: 210,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      permalinkUrl: `https://music.youtube.com/watch?v=${videoId}`,
      source: "youtube_music",
    });
  }

  // 2. Generic media URLs or SoundCloud via yt-dlp
  if (fs.existsSync(YT_DLP_BIN)) {
    execFile(
      YT_DLP_BIN,
      ["-j", "--no-warnings", "--user-agent", BROWSER_USER_AGENT, rawUrl],
      { maxBuffer: 10 * 1024 * 1024, timeout: 8000 },
      (err, stdout) => {
        if (!err && stdout) {
          try {
            const data = JSON.parse(stdout);
            const id = data.id || "track_" + Date.now();
            return res.json({
              id,
              youtubeId: data.id || id,
              title: data.title || "Audio Track",
              artist: data.uploader || data.artist || "Artist",
              duration: data.duration_string || "3:30",
              durationSec: data.duration || 210,
              thumbnail: data.thumbnail || "https://i.ytimg.com/vi/5yx6BWlEVcY/hqdefault.jpg",
              permalinkUrl: rawUrl,
              source: rawUrl.includes("soundcloud.com") ? "soundcloud" : "youtube_music",
            });
          } catch (e) {}
        }

        // Direct audio stream fallback
        if (/\.(mp3|m4a|aac|wav|ogg|flac)($|\?)/i.test(rawUrl)) {
          const fileName = rawUrl.split("/").pop()?.split("?")[0] || "Direct Audio Stream";
          return res.json({
            id: "direct_" + Date.now(),
            youtubeId: "",
            title: decodeURIComponent(fileName),
            artist: "Audio Stream",
            duration: "3:30",
            durationSec: 210,
            thumbnail: "https://i.ytimg.com/vi/5yx6BWlEVcY/hqdefault.jpg",
            permalinkUrl: rawUrl,
            source: "direct",
          });
        }

        res.status(404).json({ error: "Could not resolve audio link" });
      }
    );
  } else {
    res.status(404).json({ error: "Extractor unavailable" });
  }
});

// 4. Artist lookup (top songs, info)
musicRouter.get("/artist", async (req, res) => {
  const name = String(req.query.name || "").trim();
  if (!name) {
    return res.status(400).json({ error: "Missing 'name' parameter" });
  }

  const query = `${name} official audio`;
  const tracks = await searchYouTubeInnertube(query, 16);
  res.json({
    artist: name,
    tracks: tracks.length > 0 ? tracks : CURATED_YOUTUBE_TRACKS.slice(0, 6),
  });
});

// In-memory stream URL cache for instant 0ms playback
const streamUrlCache = new Map<string, { url: string; timestamp: number }>();
const STREAM_CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours

// 5. High-reliability, ultra-fast ytmdl / yt-dlp Audio & Video Streaming Endpoint
musicRouter.get("/stream", async (req, res) => {
  const target = String(req.query.url || req.query.id || "").trim();
  const mode = String(req.query.mode || req.query.format || "audio").toLowerCase();
  const title = String(req.query.title || "").trim();
  const artist = String(req.query.artist || "").trim();

  if (!target) {
    return res.status(400).json({ error: "Missing 'url' or 'id' parameter" });
  }

  const cacheKey = `${target}_${mode}_${artist}_${title}`;
  const cached = streamUrlCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < STREAM_CACHE_TTL) {
    return res.redirect(302, cached.url);
  }

  const isVideo = mode === "video";
  const searchPhrase = (artist && title) ? `${artist} - ${title}` : title || target;

  // For high reliability & metadata integration, we use local file caching downloaded via ytmdl
  const cleanId = extractYoutubeId(target) || target.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `ytmdl_${cleanId}.mp3`;
  const filePath = path.join(UPLOADS_DIR, filename);

  // 1. If the file is already downloaded, redirect directly to play it instantly with 0ms latency!
  if (fs.existsSync(filePath)) {
    console.log(`[Stream Cache] Serving existing local file: ${filename}`);
    const localUrl = `/uploads/${filename}`;
    streamUrlCache.set(cacheKey, { url: localUrl, timestamp: Date.now() });
    return res.redirect(302, localUrl);
  }

  // Helper to download via ytmdl by URL
  const downloadWithYtmdl = (id: string): Promise<boolean> => {
    return new Promise((resolve) => {
      let queryUrl = id.startsWith("http") ? id : `https://www.youtube.com/watch?v=${id}`;
      console.log(`[Stream ytmdl] Attempting to download via URL: ${queryUrl}`);
      const proc = spawn(YTMDL_BIN, [
        "--url", queryUrl,
        "-q",
        "--choice", "1",
        "--filename", filename,
        "-o", UPLOADS_DIR
      ]);

      proc.on("close", (code) => {
        if (code === 0 && fs.existsSync(filePath)) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  };

  // Helper to download via ytmdl by query search
  const downloadByQueryYtmdl = (query: string): Promise<boolean> => {
    return new Promise((resolve) => {
      console.log(`[Stream ytmdl] Attempting to download via query: ${query}`);
      const proc = spawn(YTMDL_BIN, [
        "-q",
        "--choice", "1",
        "--filename", filename,
        "-o", UPLOADS_DIR,
        query
      ]);

      proc.on("close", (code) => {
        if (code === 0 && fs.existsSync(filePath)) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  };

  // Helper to extract streaming URL with yt-dlp as high-reliability fallback
  const resolveWithYtDlp = (query: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const formatArg = isVideo
        ? "18/best[height<=720][ext=mp4]/best"
        : "bestaudio[ext=m4a]/bestaudio/18/best";

      execFile(
        YT_DLP_BIN,
        ["--ffmpeg-location", "/usr/bin/ffmpeg", "-g", "-f", formatArg, "--no-warnings", "--no-check-certificates", query],
        { timeout: 3000 },
        (err, stdout) => {
          if (!err && stdout.trim()) {
            const url = stdout.trim().split("\n")[0];
            if (url && url.startsWith("http")) {
              return resolve(url);
            }
          }
          resolve(null);
        }
      );
    });
  };

  try {
    // First, try to download the song using ytmdl (by URL first, then by query)
    let ytmdlSuccess = false;
    if (!isVideo) {
      ytmdlSuccess = await downloadWithYtmdl(cleanId);
      if (!ytmdlSuccess && artist && title) {
        ytmdlSuccess = await downloadByQueryYtmdl(`${artist} - ${title}`);
      }
    }

    if (ytmdlSuccess && fs.existsSync(filePath)) {
      console.log(`[Stream ytmdl] Downloaded track successfully: ${filename}`);
      const localUrl = `/uploads/${filename}`;
      streamUrlCache.set(cacheKey, { url: localUrl, timestamp: Date.now() });
      return res.redirect(302, localUrl);
    }

    // FALLBACK 1: Try target URL via legacy yt-dlp
    console.log(`[Stream] Processing query using yt-dlp pipeline...`);
    let queryUrl = target.startsWith("http") ? target : `https://www.youtube.com/watch?v=${target}`;
    let resolvedUrl = await resolveWithYtDlp(queryUrl);

    // FALLBACK 2: If YouTube blocked or timed out, try SoundCloud search via yt-dlp
    if (!resolvedUrl) {
      resolvedUrl = await resolveWithYtDlp(`scsearch1:${searchPhrase}`);
    }

    // Cache & Redirect immediately
    if (resolvedUrl) {
      streamUrlCache.set(cacheKey, { url: resolvedUrl, timestamp: Date.now() });
      return res.redirect(302, resolvedUrl);
    }

    // FALLBACK 3: Direct stdout stream fallback using ffmpeg
    const formatArg = isVideo ? "18/best" : "bestaudio/best";
    const proc = spawn(YT_DLP_BIN, [
      "--ffmpeg-location", "/usr/bin/ffmpeg",
      "-o", "-",
      "-f", formatArg,
      "--no-warnings",
      "--no-check-certificates",
      `scsearch1:${searchPhrase}`,
    ]);

    let headersSent = false;

    proc.stdout.on("data", (chunk) => {
      if (!headersSent) {
        headersSent = true;
        res.setHeader("Content-Type", isVideo ? "video/mp4" : "audio/mp4");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.status(200);
      }
      res.write(chunk);
    });

    proc.on("close", () => {
      if (!headersSent) {
        return res.status(502).json({ error: "Stream extraction failed" });
      }
      res.end();
    });

    req.on("close", () => {
      try {
        proc.kill("SIGKILL");
      } catch (e) {}
    });
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Stream extraction error" });
    }
  }
});
