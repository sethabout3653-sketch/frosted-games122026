import express from "express";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import { Readable } from "stream";

export const youtubeRouter = express.Router();

// Memory cache for stream URLs to avoid re-running yt-dlp repeatedly
const streamCache = new Map<string, { audioUrl: string; videoUrl: string; duration: number; timestamp: number }>();
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

// Helper to find yt-dlp binary
function getYtDlpPath(): string {
  const candidates = [
    "/usr/local/bin/yt-dlp",
    "/usr/bin/yt-dlp",
    path.join(process.cwd(), "bin", "yt-dlp"),
    path.join(process.cwd(), "yt-dlp"),
    "yt-dlp",
  ];
  return candidates.find((p) => fs.existsSync(p)) || "yt-dlp";
}

// Extract direct audio & video stream URLs using yt-dlp
function extractYtDlpStreams(videoId: string): Promise<{ audioUrl: string; videoUrl: string; duration: number; title: string; uploader: string } | null> {
  const cached = streamCache.get(videoId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return Promise.resolve({
      audioUrl: cached.audioUrl,
      videoUrl: cached.videoUrl,
      duration: cached.duration,
      title: "",
      uploader: "",
    });
  }

  return new Promise((resolve) => {
    const binPath = getYtDlpPath();
    const args = [
      "-g",
      "--no-warnings",
      "--no-playlist",
      "--force-ipv4",
      "--no-check-certificates",
      "-f", "bestaudio[ext=m4a]/bestaudio/best",
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    try {
      execFile(binPath, args, { timeout: 6000 }, (err, stdout) => {
        if (err || !stdout || !stdout.trim()) {
          return resolve(null);
        }

        const lines = stdout.trim().split("\n").filter(Boolean);
        const audioUrl = lines[0] || "";

        if (!audioUrl || !audioUrl.startsWith("http")) {
          return resolve(null);
        }

        // Background dump metadata if available
        execFile(binPath, ["--dump-json", "--no-warnings", "--no-playlist", `https://www.youtube.com/watch?v=${videoId}`], { timeout: 6000 }, (jErr, jStdout) => {
          let duration = 0;
          let title = "";
          let uploader = "";
          let videoUrl = audioUrl;

          if (!jErr && jStdout) {
            try {
              const data = JSON.parse(jStdout);
              duration = data.duration || 0;
              title = data.title || "";
              uploader = data.uploader || data.channel || "";

              const fmts = data.formats || [];
              const prog = fmts.find((f: any) => f.vcodec !== "none" && f.acodec !== "none" && f.url);
              const bestVid = fmts.filter((f: any) => f.vcodec !== "none" && f.url).slice(-1)[0];
              if (prog?.url) videoUrl = prog.url;
              else if (bestVid?.url) videoUrl = bestVid.url;
            } catch {}
          }

          streamCache.set(videoId, {
            audioUrl,
            videoUrl,
            duration,
            timestamp: Date.now(),
          });

          resolve({
            audioUrl,
            videoUrl,
            duration,
            title,
            uploader,
          });
        });
      });
    } catch {
      resolve(null);
    }
  });
}

interface VideoItem {
  id: string;
  title: string;
  channelTitle: string;
  channelId?: string;
  channelThumbnail?: string;
  views?: string;
  likes?: string;
  publishedTime?: string;
  duration?: string;
  thumbnail: string;
  description?: string;
  descriptionSnippet?: string;
  streamUrl?: string;
  mediaType?: "audio" | "video";
  artist?: string;
  album?: string;
  isMusic?: boolean;
}

// Upscale YouTube Music thumbnails to crisp 544x544
function upscaleMusicThumbnail(url: string, videoId?: string): string {
  if (!url) {
    return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";
  }
  if (url.includes("googleusercontent.com")) {
    return url.replace(/=w\d+-h\d+[^=]*$/, "=w544-h544-l90-rj").replace(/=s\d+[^=]*$/, "=w544-h544-l90-rj");
  }
  return url;
}

// Query music.youtube.com official Innertube API (WEB_REMIX)
async function searchYouTubeMusicInnertube(query: string, filter?: "songs" | "videos"): Promise<VideoItem[]> {
  try {
    const res = await fetch("https://music.youtube.com/youtubei/v1/search?alt=json", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Referer": "https://music.youtube.com/",
        "Origin": "https://music.youtube.com",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB_REMIX",
            clientVersion: "1.20240318.01.00",
            hl: "en",
            gl: "US",
          },
        },
        query,
        params: filter === "songs" ? "Eg-KAQwIABAAGAEgASgBMAA%3D" : (filter === "videos" ? "Eg-KAQwIABABGAEgASgBMAA%3D" : undefined),
      }),
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) return [];

    const data: any = await res.json();
    const contents = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    const items: VideoItem[] = [];
    const seenIds = new Set<string>();

    for (const sec of contents) {
      if (sec.musicCardShelfRenderer) {
        const card = sec.musicCardShelfRenderer;
        const title = card.title?.runs?.map((r: any) => r.text).join("") || "Untitled Track";
        const subtitle = card.subtitle?.runs?.map((r: any) => r.text).join("") || "";
        const ep = card.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint
          || card.buttons?.[0]?.buttonRenderer?.navigationEndpoint?.watchEndpoint
          || card.onTap?.watchEndpoint;
        const vId = ep?.videoId;
        const rawThumb = card.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || "";

        if (vId && !seenIds.has(vId)) {
          seenIds.add(vId);
          const musicVideoType = ep?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;
          const isSong = subtitle.toLowerCase().startsWith("song") || musicVideoType === "MUSIC_VIDEO_TYPE_ATV";
          const isVideo = subtitle.toLowerCase().startsWith("video") || musicVideoType === "MUSIC_VIDEO_TYPE_OMV" || musicVideoType === "MUSIC_VIDEO_TYPE_UGC";
          const mediaType: "audio" | "video" = isSong ? "audio" : (isVideo ? "video" : (subtitle.includes("views") ? "video" : "audio"));

          const subParts = subtitle.split("•").map((s: string) => s.trim());
          const artist = subParts[1] || subParts[0] || "Artist";
          const views = subParts.find((s: string) => s.includes("views") || s.includes("audience")) || "";
          const duration = subParts.find((s: string) => /^\d+:\d+$/.test(s)) || "";

          items.push({
            id: vId,
            title,
            channelTitle: artist,
            artist,
            views,
            duration,
            thumbnail: upscaleMusicThumbnail(rawThumb, vId),
            mediaType,
            isMusic: true,
            descriptionSnippet: subtitle,
          });
        }
      }

      const listRows = sec.itemSectionRenderer?.contents || sec.musicShelfRenderer?.contents || [];
      for (const item of listRows) {
        const row = item.musicResponsiveListItemRenderer;
        if (!row) continue;

        const titleRuns = row.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
        const subtitleRuns = row.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
        const title = titleRuns?.map((r: any) => r.text).join("") || "";
        const subtitle = subtitleRuns?.map((r: any) => r.text).join("") || "";

        const ep = row.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
          || row.navigationEndpoint?.watchEndpoint
          || titleRuns?.[0]?.navigationEndpoint?.watchEndpoint;
        const vId = ep?.videoId;

        if (!vId || seenIds.has(vId)) continue;
        seenIds.add(vId);

        const rawThumb = row.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url || "";
        const musicVideoType = ep?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;

        const isSong = subtitle.toLowerCase().startsWith("song") || musicVideoType === "MUSIC_VIDEO_TYPE_ATV";
        const isVideo = subtitle.toLowerCase().startsWith("video") || musicVideoType === "MUSIC_VIDEO_TYPE_OMV" || musicVideoType === "MUSIC_VIDEO_TYPE_UGC";
        const mediaType: "audio" | "video" = isSong ? "audio" : (isVideo ? "video" : (subtitle.includes("views") ? "video" : "audio"));

        const subParts = subtitle.split("•").map((s: string) => s.trim());
        const artist = subParts[1] || subParts[0] || "Artist";
        const views = subParts.find((s: string) => s.includes("views") || s.includes("audience")) || "";
        const duration = subParts.find((s: string) => /^\d+:\d+$/.test(s)) || "";

        items.push({
          id: vId,
          title,
          channelTitle: artist,
          artist,
          views,
          duration,
          thumbnail: upscaleMusicThumbnail(rawThumb, vId),
          mediaType,
          isMusic: true,
          descriptionSnippet: subtitle,
        });
      }
    }

    return items;
  } catch (err) {
    console.warn("YouTube Music search error:", err);
    return [];
  }
}

// Browse music.youtube.com Explore / Charts / Trending
async function browseYouTubeMusicInnertube(browseId: string): Promise<VideoItem[]> {
  try {
    const res = await fetch("https://music.youtube.com/youtubei/v1/browse?alt=json", {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        "Referer": "https://music.youtube.com/",
        "Origin": "https://music.youtube.com",
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: "WEB_REMIX",
            clientVersion: "1.20240318.01.00",
            hl: "en",
            gl: "US",
          },
        },
        browseId,
      }),
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) return [];

    const data: any = await res.json();
    const sections = data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
    const items: VideoItem[] = [];
    const seenIds = new Set<string>();

    for (const sec of sections) {
      const carouselItems = sec.musicCarouselShelfRenderer?.contents || sec.musicShelfRenderer?.contents || [];
      for (const item of carouselItems) {
        const row = item.musicResponsiveListItemRenderer || item.musicTwoRowItemRenderer;
        if (!row) continue;

        const title = row.title?.runs?.map((r: any) => r.text).join("")
          || row.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((r: any) => r.text).join("")
          || "";
        const subtitle = row.subtitle?.runs?.map((r: any) => r.text).join("")
          || row.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((r: any) => r.text).join("")
          || "";

        const ep = row.navigationEndpoint?.watchEndpoint
          || row.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint
          || row.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint;
        const vId = ep?.videoId;

        if (!vId || seenIds.has(vId)) continue;
        seenIds.add(vId);

        const rawThumb = row.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url
          || row.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)[0]?.url
          || "";

        const musicVideoType = ep?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType;
        const isSong = subtitle.toLowerCase().startsWith("song") || musicVideoType === "MUSIC_VIDEO_TYPE_ATV";
        const isVideo = subtitle.toLowerCase().startsWith("video") || musicVideoType === "MUSIC_VIDEO_TYPE_OMV" || musicVideoType === "MUSIC_VIDEO_TYPE_UGC";
        const mediaType: "audio" | "video" = isSong ? "audio" : (isVideo ? "video" : (subtitle.includes("views") ? "video" : "audio"));

        const subParts = subtitle.split("•").map((s: string) => s.trim());
        const artist = subParts[1] || subParts[0] || "Artist";
        const views = subParts.find((s: string) => s.includes("views") || s.includes("audience")) || "";

        items.push({
          id: vId,
          title,
          channelTitle: artist,
          artist,
          views,
          thumbnail: upscaleMusicThumbnail(rawThumb, vId),
          mediaType,
          isMusic: true,
          descriptionSnippet: subtitle,
        });
      }
    }

    return items;
  } catch (err) {
    console.warn(`YouTube Music browse error (${browseId}):`, err);
    return [];
  }
}

// In-memory feed cache
interface FeedCache {
  timestamp: number;
  data: VideoItem[];
}
const cacheMap = new Map<string, FeedCache>();
const FEED_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

// 1. GET /api/youtube/trending
youtubeRouter.get("/trending", async (req, res) => {
  const category = (req.query.category as string) || "all";
  const filter = (req.query.filter as string) || "";
  const cacheKey = `ytmusic_trending_${category}_${filter}`;

  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FEED_CACHE_TTL) {
    return res.json({ success: true, category, videos: cached.data, cached: true });
  }

  try {
    let videos: VideoItem[] = [];

    if (category === "all" || category === "charts") {
      const exploreItems = await browseYouTubeMusicInnertube("FEmusic_explore");
      if (exploreItems.length > 0) {
        videos = exploreItems;
      }
    }

    if (videos.length < 8) {
      let searchQuery = "trending music hits top charts";
      if (category === "study" || category === "lofi") searchQuery = "lofi study beats chillhop";
      else if (category === "pop") searchQuery = "pop music hits";
      else if (category === "hiphop") searchQuery = "hip hop rap hits";
      else if (category === "electronic" || category === "edm") searchQuery = "electronic edm dance";
      else if (category === "rock") searchQuery = "rock alternative indie";
      else if (category === "rnb") searchQuery = "r&b soul hits";

      const musicItems = await searchYouTubeMusicInnertube(
        searchQuery,
        filter === "songs" ? "songs" : (filter === "videos" ? "videos" : undefined)
      );
      if (musicItems.length > 0) {
        const seen = new Set(videos.map((v) => v.id));
        for (const item of musicItems) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            videos.push(item);
          }
        }
      }
    }

    if (filter === "songs" || filter === "audio") {
      videos = videos.filter((v) => v.mediaType === "audio");
    } else if (filter === "videos") {
      videos = videos.filter((v) => v.mediaType === "video");
    }

    cacheMap.set(cacheKey, { timestamp: Date.now(), data: videos });
    return res.json({ success: true, category, videos });
  } catch (error: any) {
    console.error("Error fetching trending YouTube Music videos:", error);
    if (cached) return res.json({ success: true, category, videos: cached.data, stale: true });
    return res.status(500).json({ success: false, error: error.message, videos: [] });
  }
});

// 2. GET /api/youtube/search
youtubeRouter.get("/search", async (req, res) => {
  const query = (req.query.q as string || "").trim();
  const filter = (req.query.filter as string) || "";
  if (!query) return res.json({ success: true, videos: [] });

  const cacheKey = `ytmusic_search_${query.toLowerCase()}_${filter}`;
  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FEED_CACHE_TTL) {
    return res.json({ success: true, query, videos: cached.data, cached: true });
  }

  try {
    let musicVideos = await searchYouTubeMusicInnertube(
      query,
      filter === "songs" ? "songs" : (filter === "videos" ? "videos" : undefined)
    );

    if (filter === "songs" || filter === "audio") {
      musicVideos = musicVideos.filter((v) => v.mediaType === "audio");
    } else if (filter === "videos") {
      musicVideos = musicVideos.filter((v) => v.mediaType === "video");
    }

    cacheMap.set(cacheKey, { timestamp: Date.now(), data: musicVideos });
    return res.json({ success: true, query, videos: musicVideos });
  } catch (error: any) {
    console.error(`Error searching YouTube Music for "${query}":`, error);
    return res.status(500).json({ success: false, error: error.message, videos: [] });
  }
});

// 3. GET /api/youtube/stream/:videoId - Stream resolution via yt-dlp
youtubeRouter.get("/stream/:videoId", async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) return res.status(400).json({ success: false, error: "Missing videoId" });

  try {
    const streamData = await extractYtDlpStreams(videoId);
    if (streamData && streamData.audioUrl) {
      const audioProxy = `/api/youtube/proxy-stream?url=${encodeURIComponent(streamData.audioUrl)}`;
      const videoProxy = streamData.videoUrl
        ? `/api/youtube/proxy-stream?url=${encodeURIComponent(streamData.videoUrl)}`
        : audioProxy;

      return res.json({
        success: true,
        source: "yt-dlp",
        videoId,
        title: streamData.title,
        uploader: streamData.uploader,
        duration: streamData.duration,
        audioStreamUrl: audioProxy,
        videoStreamUrl: videoProxy,
        directAudioUrl: streamData.audioUrl,
        directVideoUrl: streamData.videoUrl,
      });
    }
  } catch {}

  // Fallback endpoint
  return res.json({
    success: true,
    videoId,
    audioStreamUrl: null,
    videoStreamUrl: null,
    fallbackIframe: true,
  });
});

// 4. GET /api/youtube/proxy-stream - High performance HTTP 206 Partial Content byte streamer for HTML5 video & audio
youtubeRouter.get("/proxy-stream", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || !targetUrl.includes("googlevideo.com")) {
    return res.status(400).send("Invalid stream URL");
  }

  try {
    const range = req.headers.range;
    const fetchHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Referer": "https://music.youtube.com/",
      "Origin": "https://music.youtube.com",
    };
    if (range) {
      fetchHeaders["Range"] = range;
    }

    const videoRes = await fetch(targetUrl, { headers: fetchHeaders });
    const status = videoRes.status;
    res.status(status);

    const contentType = videoRes.headers.get("content-type") || "video/mp4";
    const contentLength = videoRes.headers.get("content-length");
    const contentRange = videoRes.headers.get("content-range");
    const acceptRanges = videoRes.headers.get("accept-ranges") || "bytes";

    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);
    res.setHeader("Accept-Ranges", acceptRanges);
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!videoRes.body) {
      return res.end();
    }

    Readable.fromWeb(videoRes.body as any).pipe(res);
  } catch (err: any) {
    console.error("Proxy stream error:", err);
    if (!res.headersSent) {
      res.status(500).send("Stream error");
    }
  }
});
