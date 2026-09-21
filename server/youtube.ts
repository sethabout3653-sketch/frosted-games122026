import express from "express";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import { Readable } from "stream";

export const youtubeRouter = express.Router();

// Helper to run yt-dlp command and extract direct googlevideo.com CDN formats
function getYtDlpFormats(videoId: string): Promise<any> {
  return new Promise((resolve) => {
    const possiblePaths = [
      path.join(process.cwd(), "bin", "yt-dlp"),
      path.join(process.cwd(), "yt-dlp"),
      "/tmp/yt-dlp",
      "yt-dlp",
    ];

    const binPath = possiblePaths.find((p) => fs.existsSync(p)) || "yt-dlp";

    const args = [
      "--dump-json",
      "--no-warnings",
      "--no-playlist",
      "--force-ipv4",
      "--extractor-args", "youtube:player_client=mweb,android",
      `https://www.youtube.com/watch?v=${videoId}`,
    ];

    execFile(binPath, args, { maxBuffer: 15 * 1024 * 1024, timeout: 10000 }, (error, stdout) => {
      if (error || !stdout) {
        return resolve(null);
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch {
        resolve(null);
      }
    });
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
}

// Popular curated channels for instant fallback and high quality study / gaming / entertainment feeds
const CURATED_CHANNELS = [
  { id: "UCSJ4gkVC6NrvII8umztf0Ow", name: "Lofi Girl", category: "study" },
  { id: "UCX6OQ3DkcsbYNE6H8uQQuVA", name: "MrBeast", category: "entertainment" },
  { id: "UCKy1dAqELo0zrOtPkf0eTMw", name: "IGN", category: "gaming" },
  { id: "UCsXVk37bltHxD1rDPwtNM8Q", name: "Kurzgesagt", category: "tech" },
  { id: "UCsBjURrPoezykLs9EqgamOA", name: "Fireship", category: "tech" },
  { id: "UC7_YxT-KID8PEw5XA066Nuw", name: "FreeCodeCamp", category: "tech" },
  { id: "UC-lHJZR3Gqxm24_Vd_AJ5Yw", name: "PewDiePie", category: "gaming" },
  { id: "UCuAXFkgsw1L7xaCfnd5JJOw", name: "Rick Astley", category: "music" },
  { id: "UCsooa4yRKGN_zEE8iknghZA", name: "TED-Ed", category: "tech" },
  { id: "UC0vBXGSyV14uvJ4hECDOl0Q", name: "TechLinked", category: "tech" },
  { id: "UC9CuvdOVfMPvKCiWD4QSNLA", name: "GameSpot", category: "gaming" },
  { id: "UCWzS3Z3R4U2x5z3t0yF-l9w", name: "Monstercat", category: "music" },
];

// Helper to parse XML feeds from YouTube RSS
function parseXmlFeed(xml: string, defaultCategory: string = "general"): VideoItem[] {
  const items: VideoItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];

    const videoIdMatch = entryXml.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
    const titleMatch = entryXml.match(/<title>(.*?)<\/title>/);
    const authorMatch = entryXml.match(/<author>[\s\S]*?<name>(.*?)<\/name>/);
    const channelIdMatch = entryXml.match(/<yt:channelId>(.*?)<\/yt:channelId>/);
    const publishedMatch = entryXml.match(/<published>(.*?)<\/published>/);
    const viewsMatch = entryXml.match(/<media:statistics views="(\d+)"/);
    const likesMatch = entryXml.match(/<media:starRating count="(\d+)"/);
    const thumbnailMatch = entryXml.match(/<media:thumbnail url="([^"]+)"/);
    const descMatch = entryXml.match(/<media:description>([\s\S]*?)<\/media:description>/);

    const id = videoIdMatch ? videoIdMatch[1].trim() : "";
    if (!id) continue;

    const title = titleMatch ? titleMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim() : "Untitled Video";
    const channelTitle = authorMatch ? authorMatch[1].trim() : "YouTube Creator";
    const channelId = channelIdMatch ? channelIdMatch[1].trim() : "";
    const publishedTime = publishedMatch ? formatRelativeTime(publishedMatch[1]) : "Recently";
    const views = viewsMatch ? formatViews(parseInt(viewsMatch[1], 10)) : "";
    const likes = likesMatch ? formatViews(parseInt(likesMatch[1], 10)) : "";
    const thumbnail = thumbnailMatch ? thumbnailMatch[1] : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    const description = descMatch ? descMatch[1].trim() : "";

    items.push({
      id,
      title,
      channelTitle,
      channelId,
      publishedTime,
      views,
      likes,
      thumbnail,
      description,
      descriptionSnippet: description.slice(0, 140),
    });
  }

  return items;
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffDays > 365) return `${Math.floor(diffDays / 365)}y ago`;
    if (diffDays > 30) return `${Math.floor(diffDays / 30)}mo ago`;
    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHr > 0) return `${diffHr}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return "Just now";
  } catch {
    return "Recently";
  }
}

function formatViews(num: number): string {
  if (isNaN(num)) return "";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M views`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K views`;
  return `${num} views`;
}

// In-memory feed cache to ensure fast sub-50ms responses
interface FeedCache {
  timestamp: number;
  data: VideoItem[];
}
const cacheMap = new Map<string, FeedCache>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache

// Search YouTube by scraping search results HTML with robust, concurrent, multi-endpoint API fallbacks
async function scrapeYouTubeSearch(query: string): Promise<VideoItem[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  
  const seenIds = new Set<string>();
  const mergedVideos: VideoItem[] = [];
  const addVideos = (list: VideoItem[]) => {
    for (const v of list) {
      if (v.id && !seenIds.has(v.id)) {
        seenIds.add(v.id);
        mergedVideos.push(v);
      }
    }
  };

  // 1. Primary Scrape: YouTube Desktop HTML
  const scrapePrimary = async (): Promise<VideoItem[]> => {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        const html = await res.text();
        const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[1]);
          const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents;
          const itemSection = contents?.find((c: any) => c.itemSectionRenderer)?.itemSectionRenderer?.contents || [];

          const list: VideoItem[] = [];
          for (const item of itemSection) {
            const v = item.videoRenderer;
            if (v && v.videoId) {
              const channelThumbnail = v.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url || "";
              list.push({
                id: v.videoId,
                title: v.title?.runs?.[0]?.text || "Untitled Video",
                channelTitle: v.ownerText?.runs?.[0]?.text || "YouTube Creator",
                channelId: v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || "",
                channelThumbnail,
                views: v.viewCountText?.simpleText || v.shortViewCountText?.simpleText || "",
                publishedTime: v.publishedTimeText?.simpleText || "Recently",
                duration: v.lengthText?.simpleText || "",
                thumbnail: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                descriptionSnippet: v.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: any) => r.text).join("") || "",
              });
            }
          }
          return list;
        }
      }
    } catch (e) {
      console.warn("YouTube primary scrape failed or timed out:", e);
    }
    return [];
  };

  // 2. Fallback Scrapes: Invidious and Piped mirrors
  const scrapeFallback = async (endpointUrl: string, type: "invidious" | "piped"): Promise<VideoItem[]> => {
    try {
      const response = await fetch(endpointUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return [];

      if (type === "invidious") {
        const items = await response.json();
        if (Array.isArray(items)) {
          const list: VideoItem[] = [];
          for (const item of items) {
            if (item.type === "video" && item.videoId) {
              const sec = parseInt(item.lengthSeconds, 10) || 0;
              const formattedDuration = sec > 0
                ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`
                : "";

              list.push({
                id: item.videoId,
                title: item.title || "Untitled Video",
                channelTitle: item.author || "YouTube Creator",
                channelId: item.authorId || "",
                views: item.viewCountText || (item.viewCount ? `${item.viewCount.toLocaleString()} views` : ""),
                publishedTime: item.publishedText || "Recently",
                duration: formattedDuration,
                thumbnail: item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
                descriptionSnippet: item.description || "",
              });
            }
          }
          return list;
        }
      } else {
        const data = await response.json();
        const items = data.items || data.relatedStreams || [];
        if (Array.isArray(items)) {
          const list: VideoItem[] = [];
          for (const item of items) {
            if (item.type === "stream" || item.type === "video") {
              let vId = item.videoId;
              if (!vId && item.url) {
                const parts = item.url.split("v=");
                if (parts[1]) vId = parts[1].split("&")[0];
              }
              if (!vId && item.url && item.url.includes("/watch/")) {
                const parts = item.url.split("/watch/");
                if (parts[1]) vId = parts[1].split("?")[0];
              }

              if (vId) {
                const sec = parseInt(item.duration, 10) || 0;
                const formattedDuration = sec > 0
                  ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`
                  : "";

                list.push({
                  id: vId,
                  title: item.title || "Untitled Video",
                  channelTitle: item.uploaderName || "YouTube Creator",
                  channelId: item.uploaderUrl ? item.uploaderUrl.split("/").pop() : "",
                  views: item.views ? `${item.views.toLocaleString()} views` : "",
                  publishedTime: item.uploadedDate || "Recently",
                  duration: formattedDuration,
                  thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
                  descriptionSnippet: item.shortDescription || "",
                });
              }
            }
          }
          return list;
        }
      }
    } catch (err) {
      console.warn(`Fallback search endpoint failed (${endpointUrl}):`, err);
    }
    return [];
  };

  // Run primary and top mirrors in parallel to merge all videos into one high-density feed with 0ms extra lag!
  const results = await Promise.allSettled([
    scrapePrimary(),
    scrapeFallback(`https://invidious.f5.si/api/v1/search?q=${encodeURIComponent(query)}`, "invidious"),
    scrapeFallback(`https://api.piped.private.coffee/search?q=${encodeURIComponent(query)}`, "piped"),
    scrapeFallback(`https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(query)}`, "invidious"),
  ]);

  results.forEach((res) => {
    if (res.status === "fulfilled" && Array.isArray(res.value)) {
      addVideos(res.value);
    }
  });

  return mergedVideos;
}

// Fetch RSS feed for a channel
async function fetchChannelFeed(channelId: string): Promise<VideoItem[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`Channel feed HTTP ${res.status}`);
  const xml = await res.text();
  return parseXmlFeed(xml);
}

// 1. GET /api/youtube/trending - Get category feeds or all latest videos
youtubeRouter.get("/trending", async (req, res) => {
  const category = (req.query.category as string) || "all";
  const cacheKey = `trending_${category}`;

  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ success: true, category, videos: cached.data, cached: true });
  }

  try {
    let videos: VideoItem[] = [];

    // Map categories to search queries or channel groups
    if (category === "gaming") {
      const searchResults = await scrapeYouTubeSearch("gaming trailers gameplay highlights 2026");
      videos = searchResults.length > 0 ? searchResults : await fetchChannelFeed("UCKy1dAqELo0zrOtPkf0eTMw"); // IGN fallback
    } else if (category === "music") {
      const searchResults = await scrapeYouTubeSearch("official music video trending");
      videos = searchResults;
    } else if (category === "study" || category === "lofi") {
      const lofiVideos = await fetchChannelFeed("UCSJ4gkVC6NrvII8umztf0Ow"); // Lofi Girl
      videos = lofiVideos;
    } else if (category === "tech") {
      const techVideos = await scrapeYouTubeSearch("technology science breakdown documentary");
      videos = techVideos;
    } else if (category === "entertainment") {
      const mrbeast = await fetchChannelFeed("UCX6OQ3DkcsbYNE6H8uQQuVA"); // MrBeast
      videos = mrbeast;
    } else {
      // "all" - Combined search of top latest videos + curated channels
      const searchVideos = await scrapeYouTubeSearch("trending new videos today");
      if (searchVideos.length > 0) {
        videos = searchVideos;
      } else {
        // Fallback: merge 3 top channels
        const [lofi, beast, ign] = await Promise.allSettled([
          fetchChannelFeed("UCSJ4gkVC6NrvII8umztf0Ow"),
          fetchChannelFeed("UCX6OQ3DkcsbYNE6H8uQQuVA"),
          fetchChannelFeed("UCKy1dAqELo0zrOtPkf0eTMw"),
        ]);
        if (lofi.status === "fulfilled") videos.push(...lofi.value.slice(0, 5));
        if (beast.status === "fulfilled") videos.push(...beast.value.slice(0, 5));
        if (ign.status === "fulfilled") videos.push(...ign.value.slice(0, 5));
      }
    }

    cacheMap.set(cacheKey, { timestamp: Date.now(), data: videos });
    return res.json({ success: true, category, videos });
  } catch (error: any) {
    console.error("Error fetching trending YouTube videos:", error);
    // Fallback: Return cached if available even if stale
    if (cached) {
      return res.json({ success: true, category, videos: cached.data, stale: true });
    }
    return res.status(500).json({ success: false, error: error.message, videos: [] });
  }
});

// 2. GET /api/youtube/search - Search any topic, video, or channel
youtubeRouter.get("/search", async (req, res) => {
  const query = (req.query.q as string || "").trim();
  if (!query) {
    return res.json({ success: true, videos: [] });
  }

  const cacheKey = `search_${query.toLowerCase()}`;
  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ success: true, query, videos: cached.data, cached: true });
  }

  try {
    const videos = await scrapeYouTubeSearch(query);
    cacheMap.set(cacheKey, { timestamp: Date.now(), data: videos });
    return res.json({ success: true, query, videos });
  } catch (error: any) {
    console.error(`Error searching YouTube for "${query}":`, error);
    return res.status(500).json({ success: false, error: error.message, videos: [] });
  }
});

// Live search autocomplete suggestions (e.g. for music query suggestions)
youtubeRouter.get("/suggest", async (req, res) => {
  const query = (req.query.q as string || "").trim();
  if (!query) {
    return res.json({ success: true, suggestions: [] });
  }
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(2500),
    });
    if (response.ok) {
      const data = await response.json();
      const suggestions = Array.isArray(data[1]) ? data[1] : [];
      return res.json({ success: true, suggestions: suggestions.slice(0, 8) });
    }
  } catch (e) {
    // Non-fatal
  }
  return res.json({ success: true, suggestions: [] });
});

// Music Trending / Genre tracks for warm non-robotic discovery
youtubeRouter.get("/music/trending", async (req, res) => {
  const genre = (req.query.genre as string || "all").toLowerCase();
  const cacheKey = `music_trending_${genre}`;
  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return res.json({ success: true, genre, videos: cached.data, cached: true });
  }

  const genreQueries: Record<string, string> = {
    all: "top hits 2026 music official audio",
    trending: "billboard hot 100 songs 2026 official music video",
    lofi: "lofi hip hop radio beats to relax study to",
    hiphop: "top rap hip hop hits 2026 official audio",
    pop: "pop hits 2026 official video",
    rnb: "r&b chill soul music 2026",
    edm: "edm electronic dance festival music 2026",
    rock: "modern rock indie alternative 2026",
    gaming: "gaming soundtrack chill ost synthwave",
    acoustic: "cozy acoustic coffee house songs guitar",
    ambient: "ambient relaxing soundscapes focus deep sleep",
  };

  const searchQuery = genreQueries[genre] || `${genre} music official audio`;
  try {
    const videos = await scrapeYouTubeSearch(searchQuery);
    const musicVideos = videos.map((v) => ({ ...v, isMusic: true }));
    cacheMap.set(cacheKey, { timestamp: Date.now(), data: musicVideos });
    return res.json({ success: true, genre, videos: musicVideos });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message, videos: [] });
  }
});

// 3. GET /api/youtube/channel/:channelId - Channel latest uploads
youtubeRouter.get("/channel/:channelId", async (req, res) => {
  const { channelId } = req.params;
  try {
    const videos = await fetchChannelFeed(channelId);
    return res.json({ success: true, channelId, videos });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message, videos: [] });
  }
});

// 4. GET /api/youtube/curated - Returns curated popular channels
youtubeRouter.get("/curated", (req, res) => {
  res.json({ success: true, channels: CURATED_CHANNELS });
});

// 5. GET /api/youtube/stream/:videoId - Stream and media format resolution
youtubeRouter.get("/stream/:videoId", async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) {
    return res.status(400).json({ success: false, error: "Missing videoId" });
  }

  // 1. Primary: Use yt-dlp tool to extract direct googlevideo.com CDN stream URLs (up to 4K 2160p)
  try {
    const rawData = await getYtDlpFormats(videoId);
    if (rawData && rawData.formats && Array.isArray(rawData.formats)) {
      const rawFormats = rawData.formats;
      const parsedFormats: any[] = [];

      for (const f of rawFormats) {
        if (!f.url) continue;
        const isGooglevideo = f.url.includes("googlevideo.com");
        const hasVideo = f.vcodec && f.vcodec !== "none";
        const hasAudio = f.acodec && f.acodec !== "none";

        const qualityLabel = f.height
          ? `${f.height}p`
          : f.format_note || (hasAudio && !hasVideo ? "Audio Only" : "Adaptive");

        parsedFormats.push({
          formatId: f.format_id,
          url: f.url,
          proxyUrl: isGooglevideo
            ? `/api/youtube/proxy-stream?url=${encodeURIComponent(f.url)}`
            : f.url,
          quality: qualityLabel,
          height: f.height || 0,
          width: f.width || 0,
          resolution: f.resolution || (f.height ? `${f.width || ""}x${f.height}` : undefined),
          mimeType: f.ext ? `video/${f.ext}` : "video/mp4",
          container: f.container || f.ext || "mp4",
          hasAudio,
          hasVideo,
          fps: f.fps || null,
          vcodec: f.vcodec,
          acodec: f.acodec,
          filesize: f.filesize || f.filesize_approx || null,
          tbr: f.tbr || null,
          isDirectGooglevideo: isGooglevideo,
        });
      }

      // Sort formats by height descending (2160p 4K -> 1440p 2K -> 1080p -> 720p -> 480p -> 360p)
      parsedFormats.sort((a, b) => (b.height || 0) - (a.height || 0));

      // Find the best combined stream (hasAudio && hasVideo e.g. format 22 (720p) or 18 (360p))
      const combinedStream =
        parsedFormats.find((f) => f.hasAudio && f.hasVideo && f.container === "mp4") ||
        parsedFormats.find((f) => f.hasAudio && f.hasVideo) ||
        parsedFormats.find((f) => f.hasVideo);

      const maxQuality = parsedFormats.some((f) => f.height >= 2160)
        ? "2160p (4K Ultra HD)"
        : parsedFormats.some((f) => f.height >= 1440)
        ? "1440p (2K Quad HD)"
        : parsedFormats.some((f) => f.height >= 1080)
        ? "1080p (Full HD)"
        : "720p (HD)";

      return res.json({
        success: true,
        source: "yt-dlp (googlevideo.com CDN)",
        videoId,
        title: rawData.title || rawData.fulltitle || "YouTube Video",
        description: rawData.description || "",
        uploader: rawData.uploader || rawData.channel || "",
        thumbnail: rawData.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        duration:
          rawData.duration_string ||
          (rawData.duration
            ? `${Math.floor(rawData.duration / 60)}:${String(Math.floor(rawData.duration % 60)).padStart(2, "0")}`
            : undefined),
        streamUrl: combinedStream?.proxyUrl || combinedStream?.url || null,
        formats: parsedFormats,
        maxQuality,
      });
    }
  } catch {
    // Silently fall through to fast mirror endpoints
  }

  // Fast Invidious / Piped mirror endpoints to check for streams fallback
  const streamResolvers = [
    `https://api.piped.private.coffee/streams/${videoId}`,
    `https://pipedapi.ducks.party/streams/${videoId}`,
    `https://piped-api.lunar.icu/streams/${videoId}`,
    `https://invidious.f5.si/api/v1/videos/${videoId}`,
    `https://inv.nadeko.net/api/v1/videos/${videoId}`,
  ];

  for (const url of streamResolvers) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) {
        const data = await response.json();
        const formats: any[] = [];

        // Format streams (progressive MP4 with video + audio)
        const formatStreams = data.formatStreams || data.videoStreams || [];
        for (const s of formatStreams) {
          if (s.url) {
            const isGooglevideo = s.url.includes("googlevideo.com");
            const proxyUrl = isGooglevideo
              ? `/api/youtube/proxy-stream?url=${encodeURIComponent(s.url)}`
              : s.url;
            formats.push({
              url: s.url,
              proxyUrl,
              quality: s.quality || s.resolution || "720p",
              resolution: s.resolution || s.quality,
              mimeType: s.type || s.mimeType || "video/mp4",
              container: s.container || "mp4",
              hasAudio: true,
              hasVideo: true,
              fps: s.fps,
              bitrate: s.bitrate,
            });
          }
        }

        // Adaptive formats (separate video and audio streams)
        const adaptiveFormats = data.adaptiveFormats || [];
        for (const s of adaptiveFormats) {
          if (s.url) {
            const isGooglevideo = s.url.includes("googlevideo.com");
            const proxyUrl = isGooglevideo
              ? `/api/youtube/proxy-stream?url=${encodeURIComponent(s.url)}`
              : s.url;
            formats.push({
              url: s.url,
              proxyUrl,
              quality: s.qualityLabel || s.resolution || s.audioQuality || "adaptive",
              resolution: s.qualityLabel || s.resolution,
              mimeType: s.type || s.mimeType,
              container: s.container,
              hasAudio: !!s.audioQuality,
              hasVideo: !s.audioQuality,
              bitrate: s.bitrate,
            });
          }
        }

        const bestStream = formats.find((f) => f.hasAudio && f.hasVideo && f.container === "mp4") || formats[0];

        return res.json({
          success: true,
          videoId,
          title: data.title,
          description: data.description,
          thumbnail: data.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          duration: data.lengthSeconds ? `${Math.floor(data.lengthSeconds / 60)}:${String(data.lengthSeconds % 60).padStart(2, "0")}` : undefined,
          hlsUrl: data.hls || null,
          streamUrl: bestStream?.proxyUrl || bestStream?.url || null,
          formats,
        });
      }
    } catch {
      // Continue to next resolver
    }
  }

  // Fallback if public mirrors are busy or blocked
  return res.json({
    success: true,
    videoId,
    title: "YouTube Video",
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    streamUrl: null,
    formats: [],
    fallbackEmbedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`,
  });
});

// 6. GET /api/youtube/proxy-stream - Stream forwarding for direct googlevideo playback
youtubeRouter.get("/proxy-stream", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || !targetUrl.includes("googlevideo.com")) {
    return res.status(400).send("Invalid stream URL");
  }

  try {
    const range = req.headers.range;
    const fetchHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    };
    if (range) {
      fetchHeaders["Range"] = range;
    }

    const videoRes = await fetch(targetUrl, {
      headers: fetchHeaders,
    });

    const status = videoRes.status;
    res.status(status);

    // Forward headers
    const contentType = videoRes.headers.get("content-type") || "video/mp4";
    const contentLength = videoRes.headers.get("content-length");
    const contentRange = videoRes.headers.get("content-range");
    const acceptRanges = videoRes.headers.get("accept-ranges");

    res.setHeader("Content-Type", contentType);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);
    if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
    res.setHeader("Access-Control-Allow-Origin", "*");

    if (!videoRes.body) {
      return res.end();
    }

    // Pipe response stream
    Readable.fromWeb(videoRes.body as any).pipe(res);
  } catch (err: any) {
    console.error("Stream proxy error:", err);
    if (!res.headersSent) {
      res.status(500).send("Stream error");
    }
  }
});
