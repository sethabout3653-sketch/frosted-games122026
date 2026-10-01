import express from "express";
import { execFile, spawn } from "child_process";
import path from "path";
import fs from "fs";
import yts from "yt-search";

export const musicRouter = express.Router();

const YT_DLP_BIN = fs.existsSync("/usr/local/bin/yt-dlp")
  ? "/usr/local/bin/yt-dlp"
  : path.join(process.cwd(), "bin", "yt-dlp");

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
  source: "youtube_music";
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

function extractYoutubeId(input: string): string | null {
  const clean = input.trim();
  const match = clean.match(
    /(?:music\.youtube\.com\/watch\?v=|youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
  return null;
}

// Fast timeout helper to guarantee responses never hang
function withTimeout<T>(promise: Promise<any>, ms: number, fallback: any): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// 1. Search YouTube Music catalog
musicRouter.get("/search", async (req, res) => {
  const query = String(req.query.q || "").trim();
  const limit = Math.min(30, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));

  if (!query) {
    return res.json({ tracks: CURATED_YOUTUBE_TRACKS });
  }

  // Check cache
  const cached = searchCache.get(query.toLowerCase());
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ tracks: cached.tracks.slice(0, limit) });
  }

  // Check if query is a direct YouTube / YouTube Music URL or ID
  const directId = extractYoutubeId(query);
  if (directId) {
    try {
      const searchRes: any = await withTimeout(yts({ videoId: directId }), 3000, null);
      if (searchRes && searchRes.videoId) {
        const track: MusicTrack = {
          id: searchRes.videoId,
          youtubeId: searchRes.videoId,
          title: searchRes.title || "YouTube Music Track",
          artist: searchRes.author?.name || "Artist",
          duration: searchRes.timestamp || "3:30",
          durationSec: searchRes.seconds || 210,
          thumbnail: searchRes.thumbnail || `https://i.ytimg.com/vi/${searchRes.videoId}/hqdefault.jpg`,
          permalinkUrl: `https://music.youtube.com/watch?v=${searchRes.videoId}`,
          source: "youtube_music",
        };
        return res.json({ tracks: [track] });
      }
    } catch (e) {}
  }

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

  // Fallback to local filter
  const filtered = CURATED_YOUTUBE_TRACKS.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.artist.toLowerCase().includes(query.toLowerCase())
  );
  return res.json({ tracks: filtered.length > 0 ? filtered : CURATED_YOUTUBE_TRACKS });
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

  // Instant fallback to curated
  res.json({ tracks: CURATED_YOUTUBE_TRACKS });
});

// 3. Resolve any YouTube Music URL / ID using yt-dlp & metadata
musicRouter.get("/resolve", async (req, res) => {
  const rawUrl = String(req.query.url || "").trim();
  if (!rawUrl) {
    return res.status(400).json({ error: "Missing 'url' parameter" });
  }

  const videoId = extractYoutubeId(rawUrl);

  if (videoId) {
    try {
      const info: any = await withTimeout(yts({ videoId }), 3000, null);
      if (info && info.videoId) {
        return res.json({
          id: info.videoId,
          youtubeId: info.videoId,
          title: info.title || "YouTube Music Track",
          artist: info.author?.name || "Artist",
          duration: info.timestamp || "3:30",
          durationSec: info.seconds || 210,
          thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${info.videoId}/hqdefault.jpg`,
          permalinkUrl: `https://music.youtube.com/watch?v=${info.videoId}`,
          source: "youtube_music",
        });
      }
    } catch (e) {}
  }

  // Fallback to yt-dlp extractor for generic media URLs
  if (fs.existsSync(YT_DLP_BIN)) {
    execFile(
      YT_DLP_BIN,
      ["-j", "--no-warnings", "--user-agent", BROWSER_USER_AGENT, rawUrl],
      { maxBuffer: 10 * 1024 * 1024, timeout: 8000 },
      (err, stdout) => {
        if (!err && stdout) {
          try {
            const data = JSON.parse(stdout);
            const id = data.id || videoId || "track";
            return res.json({
              id,
              youtubeId: id,
              title: data.title || "Audio Track",
              artist: data.uploader || data.artist || "Artist",
              duration: data.duration_string || "3:30",
              durationSec: data.duration || 210,
              thumbnail: data.thumbnail || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
              permalinkUrl: `https://music.youtube.com/watch?v=${id}`,
              source: "youtube_music",
            });
          } catch (e) {}
        }

        const fallbackId = videoId || "5yx6BWlEVcY";
        return res.json({
          id: fallbackId,
          youtubeId: fallbackId,
          title: "YouTube Music Audio",
          artist: "Artist",
          duration: "3:30",
          durationSec: 210,
          thumbnail: `https://i.ytimg.com/vi/${fallbackId}/hqdefault.jpg`,
          permalinkUrl: `https://music.youtube.com/watch?v=${fallbackId}`,
          source: "youtube_music",
        });
      }
    );
  } else {
    const fallbackId = videoId || "5yx6BWlEVcY";
    res.json({
      id: fallbackId,
      youtubeId: fallbackId,
      title: "YouTube Music Audio",
      artist: "Artist",
      duration: "3:30",
      durationSec: 210,
      thumbnail: `https://i.ytimg.com/vi/${fallbackId}/hqdefault.jpg`,
      permalinkUrl: `https://music.youtube.com/watch?v=${fallbackId}`,
      source: "youtube_music",
    });
  }
});

// 4. yt-dlp Audio Streaming Endpoint (Pipes raw audio directly from yt-dlp)
musicRouter.get("/stream", (req, res) => {
  const target = String(req.query.url || req.query.id || "").trim();
  if (!target) {
    return res.status(400).json({ error: "Missing 'url' or 'id' parameter" });
  }

  let fullUrl = target;
  if (/^[a-zA-Z0-9_-]{11}$/.test(target)) {
    fullUrl = `https://music.youtube.com/watch?v=${target}`;
  }

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "no-cache");

  // Spawn yt-dlp directly streaming audio to stdout
  const proc = spawn(YT_DLP_BIN, [
    "-o", "-",
    "-f", "bestaudio[ext=m4a]/bestaudio/best",
    "--no-warnings",
    "--no-check-certificates",
    "--user-agent", BROWSER_USER_AGENT,
    fullUrl,
  ]);

  proc.stdout.pipe(res);

  let hasError = false;
  proc.stderr.on("data", (chunk) => {
    const errText = chunk.toString();
    if (errText.includes("Sign in to confirm you") || errText.includes("ERROR:")) {
      hasError = true;
    }
  });

  proc.on("close", (code) => {
    if (code !== 0 && hasError && !res.headersSent) {
      res.status(403).json({ error: "yt-dlp requires client player fallback for this track" });
    }
  });

  req.on("close", () => {
    try {
      proc.kill("SIGKILL");
    } catch (e) {}
  });
});
