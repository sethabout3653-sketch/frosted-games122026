import express from "express";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import { Readable } from "stream";

export const youtubeRouter = express.Router();

// Memory cache for stream URLs to avoid re-running yt-dlp repeatedly
const streamCache = new Map<string, { audioUrl: string; videoUrl: string; duration: number; timestamp: number }>();
const CACHE_TTL_MS = 20 * 60 * 1000; // 20 minutes

// Curated verified high quality music catalog by category for instantaneous zero-failure fallback
const CURATED_MUSIC_CATALOG: Record<string, VideoItem[]> = {
  all: [
    {
      id: "jfKfPfyJRdk",
      title: "lofi hip hop radio 📚 - beats to relax/study to",
      channelTitle: "Lofi Girl",
      artist: "Lofi Girl",
      views: "Live • 45K watching",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg",
      mediaType: "audio",
      isMusic: true,
      descriptionSnippet: "Chill study beats and instrumental lo-fi hip hop.",
    },
    {
      id: "4xDzrJKXOOY",
      title: "synthwave radio 🌌 - chill synth / retro beats",
      channelTitle: "Lofi Girl",
      artist: "Lofi Girl",
      views: "Live • 12K watching",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg",
      mediaType: "audio",
      isMusic: true,
      descriptionSnippet: "Chill synthwave and retrowave beats for coding and gaming.",
    },
    {
      id: "fJ9rUzIMcZQ",
      title: "Bohemian Rhapsody",
      channelTitle: "Queen",
      artist: "Queen",
      views: "1.7B views",
      duration: "5:59",
      thumbnail: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
      descriptionSnippet: "Queen - Bohemian Rhapsody (Official Video Remastered)",
    },
    {
      id: "dQw4w9WgXcQ",
      title: "Never Gonna Give You Up",
      channelTitle: "Rick Astley",
      artist: "Rick Astley",
      views: "1.5B views",
      duration: "3:33",
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
      descriptionSnippet: "Rick Astley - Never Gonna Give You Up (Official Music Video)",
    },
    {
      id: "JGwWNGJdvx8",
      title: "Shape of You",
      channelTitle: "Ed Sheeran",
      artist: "Ed Sheeran",
      views: "6.2B views",
      duration: "4:23",
      thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
      descriptionSnippet: "Ed Sheeran - Shape of You (Official Music Video)",
    },
    {
      id: "09R8_2nJtjg",
      title: "Sugar",
      channelTitle: "Maroon 5",
      artist: "Maroon 5",
      views: "4.0B views",
      duration: "5:01",
      thumbnail: "https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
      descriptionSnippet: "Maroon 5 - Sugar (Official Music Video)",
    },
    {
      id: "kXYiU_JCYtU",
      title: "Numb",
      channelTitle: "Linkin Park",
      artist: "Linkin Park",
      views: "2.2B views",
      duration: "3:07",
      thumbnail: "https://i.ytimg.com/vi/kXYiU_JCYtU/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
      descriptionSnippet: "Linkin Park - Numb (Official Music Video)",
    },
    {
      id: "OPf0YbXqDm0",
      title: "Uptown Funk ft. Bruno Mars",
      channelTitle: "Mark Ronson",
      artist: "Mark Ronson",
      views: "5.1B views",
      duration: "4:30",
      thumbnail: "https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
      descriptionSnippet: "Mark Ronson - Uptown Funk ft. Bruno Mars",
    },
    {
      id: "CevxZvSJLk8",
      title: "Roar",
      channelTitle: "Katy Perry",
      artist: "Katy Perry",
      views: "3.9B views",
      duration: "4:30",
      thumbnail: "https://i.ytimg.com/vi/CevxZvSJLk8/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
      descriptionSnippet: "Katy Perry - Roar (Official Video)",
    },
  ],
  study: [
    {
      id: "jfKfPfyJRdk",
      title: "lofi hip hop radio - beats to relax/study to",
      channelTitle: "Lofi Girl",
      artist: "Lofi Girl",
      views: "Live • 45K watching",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg",
      mediaType: "audio",
      isMusic: true,
      descriptionSnippet: "Peaceful lofi beats for deep study & focus.",
    },
    {
      id: "4xDzrJKXOOY",
      title: "synthwave radio - chill synth / retro beats",
      channelTitle: "Lofi Girl",
      artist: "Lofi Girl",
      views: "Live • 12K watching",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg",
      mediaType: "audio",
      isMusic: true,
      descriptionSnippet: "Retro synth chillout beats for coding sessions.",
    },
    {
      id: "5qap5aO4i9A",
      title: "Lofi Hip Hop Radio 24/7 - Chill Study Beats",
      channelTitle: "ChilledCow",
      artist: "Chillhop Music",
      views: "2.1M views",
      duration: "Live",
      thumbnail: "https://i.ytimg.com/vi/5qap5aO4i9A/hqdefault.jpg",
      mediaType: "audio",
      isMusic: true,
      descriptionSnippet: "Smooth ambient piano & jazz hop beats for deep reading.",
    },
    {
      id: "DWcJFNfaw9c",
      title: "Coffee Shop Ambience & Soft Piano Jazz",
      channelTitle: "Calm Cafe",
      artist: "Calm Cafe Studio",
      views: "18M views",
      duration: "3:30:00",
      thumbnail: "https://i.ytimg.com/vi/DWcJFNfaw9c/hqdefault.jpg",
      mediaType: "audio",
      isMusic: true,
      descriptionSnippet: "Rainy day coffee shop jazz & mellow study ambiance.",
    },
  ],
  pop: [
    {
      id: "JGwWNGJdvx8",
      title: "Shape of You",
      channelTitle: "Ed Sheeran",
      artist: "Ed Sheeran",
      views: "6.2B views",
      duration: "4:23",
      thumbnail: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "09R8_2nJtjg",
      title: "Sugar",
      channelTitle: "Maroon 5",
      artist: "Maroon 5",
      views: "4.0B views",
      duration: "5:01",
      thumbnail: "https://i.ytimg.com/vi/09R8_2nJtjg/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "hT_nvWreIhg",
      title: "Counting Stars",
      channelTitle: "OneRepublic",
      artist: "OneRepublic",
      views: "3.9B views",
      duration: "4:43",
      thumbnail: "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "nfWlot6h_JM",
      title: "Shake It Off",
      channelTitle: "Taylor Swift",
      artist: "Taylor Swift",
      views: "3.3B views",
      duration: "4:01",
      thumbnail: "https://i.ytimg.com/vi/nfWlot6h_JM/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
  ],
  hiphop: [
    {
      id: "tvTRZJ-4EyI",
      title: "HUMBLE.",
      channelTitle: "Kendrick Lamar",
      artist: "Kendrick Lamar",
      views: "950M views",
      duration: "3:03",
      thumbnail: "https://i.ytimg.com/vi/tvTRZJ-4EyI/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "YykjpeuMNEk",
      title: "God's Plan",
      channelTitle: "Drake",
      artist: "Drake",
      views: "1.5B views",
      duration: "5:56",
      thumbnail: "https://i.ytimg.com/vi/YykjpeuMNEk/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "uelHwf8o7_U",
      title: "Love The Way You Lie ft. Rihanna",
      channelTitle: "Eminem",
      artist: "Eminem",
      views: "2.7B views",
      duration: "4:27",
      thumbnail: "https://i.ytimg.com/vi/uelHwf8o7_U/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "astISOttCQ0",
      title: "Congratulations ft. Quavo",
      channelTitle: "Post Malone",
      artist: "Post Malone",
      views: "1.5B views",
      duration: "3:47",
      thumbnail: "https://i.ytimg.com/vi/astISOttCQ0/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
  ],
  electronic: [
    {
      id: "60ItHLz5WEA",
      title: "Faded",
      channelTitle: "Alan Walker",
      artist: "Alan Walker",
      views: "3.6B views",
      duration: "3:32",
      thumbnail: "https://i.ytimg.com/vi/60ItHLz5WEA/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "IcrbM1l_BoI",
      title: "Wake Me Up",
      channelTitle: "Avicii",
      artist: "Avicii",
      views: "2.3B views",
      duration: "4:32",
      thumbnail: "https://i.ytimg.com/vi/IcrbM1l_BoI/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "ALZHF5UqnU4",
      title: "Alone",
      channelTitle: "Marshmello",
      artist: "Marshmello",
      views: "2.4B views",
      duration: "3:19",
      thumbnail: "https://i.ytimg.com/vi/ALZHF5UqnU4/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "kOkQ4T5WO9E",
      title: "This Is What You Came For ft. Rihanna",
      channelTitle: "Calvin Harris",
      artist: "Calvin Harris",
      views: "2.7B views",
      duration: "4:00",
      thumbnail: "https://i.ytimg.com/vi/kOkQ4T5WO9E/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
  ],
  rock: [
    {
      id: "fJ9rUzIMcZQ",
      title: "Bohemian Rhapsody",
      channelTitle: "Queen",
      artist: "Queen",
      views: "1.7B views",
      duration: "5:59",
      thumbnail: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "kXYiU_JCYtU",
      title: "Numb",
      channelTitle: "Linkin Park",
      artist: "Linkin Park",
      views: "2.2B views",
      duration: "3:07",
      thumbnail: "https://i.ytimg.com/vi/kXYiU_JCYtU/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "hTWKbfoikeg",
      title: "Smells Like Teen Spirit",
      channelTitle: "Nirvana",
      artist: "Nirvana",
      views: "1.8B views",
      duration: "4:38",
      thumbnail: "https://i.ytimg.com/vi/hTWKbfoikeg/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
    {
      id: "1w7OgIMMRc4",
      title: "Sweet Child O' Mine",
      channelTitle: "Guns N' Roses",
      artist: "Guns N' Roses",
      views: "1.6B views",
      duration: "5:03",
      thumbnail: "https://i.ytimg.com/vi/1w7OgIMMRc4/hqdefault.jpg",
      mediaType: "video",
      isMusic: true,
    },
  ],
};

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

// Extract direct audio & video streams via Invidious public APIs as fallback
async function extractInvidiousStreams(videoId: string): Promise<{ audioUrl: string; videoUrl: string; duration: number; title: string; uploader: string } | null> {
  const instances = [
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://invidious.jing.rocks",
    "https://invidious.private.coffee",
  ];

  for (const inst of instances) {
    try {
      const res = await fetch(`${inst}/api/v1/videos/${videoId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;
      const data: any = await res.json();
      const formatStreams = data.formatStreams || [];
      const adaptiveFormats = data.adaptiveFormats || [];

      let videoUrl = "";
      let audioUrl = "";

      const bestVideo = formatStreams.slice(-1)[0];
      if (bestVideo?.url) videoUrl = bestVideo.url;

      const audioStreams = adaptiveFormats.filter((f: any) => f.type?.includes("audio"));
      const bestAudio = audioStreams.slice(-1)[0];
      if (bestAudio?.url) audioUrl = bestAudio.url;
      else if (videoUrl) audioUrl = videoUrl;

      if (audioUrl || videoUrl) {
        return {
          audioUrl: audioUrl || videoUrl,
          videoUrl: videoUrl || audioUrl,
          duration: data.lengthSeconds || 0,
          title: data.title || "",
          uploader: data.author || "",
        };
      }
    } catch {}
  }

  return null;
}

// Extract direct audio & video stream URLs using yt-dlp with Invidious fallback
async function extractDirectStreams(videoId: string): Promise<{ audioUrl: string; videoUrl: string; duration: number; title: string; uploader: string; source: string } | null> {
  const cached = streamCache.get(videoId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      audioUrl: cached.audioUrl,
      videoUrl: cached.videoUrl,
      duration: cached.duration,
      title: "",
      uploader: "",
      source: "cache",
    };
  }

  // 1. Try yt-dlp first
  const ytdl = await extractYtDlpStreams(videoId);
  if (ytdl && ytdl.audioUrl) {
    return { ...ytdl, source: "yt-dlp" };
  }

  // 2. Try Invidious
  const inv = await extractInvidiousStreams(videoId);
  if (inv && (inv.audioUrl || inv.videoUrl)) {
    streamCache.set(videoId, {
      audioUrl: inv.audioUrl,
      videoUrl: inv.videoUrl,
      duration: inv.duration,
      timestamp: Date.now(),
    });
    return { ...inv, source: "invidious-piped" };
  }

  return null;
}

export interface VideoItem {
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
      signal: AbortSignal.timeout(4000),
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
    return [];
  }
}

// Fallback search via Invidious public instances
async function searchInvidiousMusic(query: string): Promise<VideoItem[]> {
  const instances = [
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://invidious.jing.rocks",
  ];

  for (const inst of instances) {
    try {
      const res = await fetch(`${inst}/api/v1/search?q=${encodeURIComponent(query)}&type=video`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) continue;
      const data: any = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.slice(0, 16).map((v: any) => ({
          id: v.videoId,
          title: v.title,
          channelTitle: v.author || "Artist",
          artist: v.author || "Artist",
          views: v.viewCount ? `${(v.viewCount / 1000000).toFixed(1)}M views` : "",
          duration: v.lengthSeconds ? `${Math.floor(v.lengthSeconds / 60)}:${(v.lengthSeconds % 60).toString().padStart(2, "0")}` : "",
          thumbnail: v.videoThumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
          mediaType: "video",
          isMusic: true,
        }));
      }
    } catch {}
  }
  return [];
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
      signal: AbortSignal.timeout(4000),
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
    return [];
  }
}

// In-memory feed cache
interface FeedCache {
  timestamp: number;
  data: VideoItem[];
}
const cacheMap = new Map<string, FeedCache>();
const FEED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// 1. GET /api/youtube/trending
youtubeRouter.get("/trending", async (req, res) => {
  const category = (req.query.category as string) || "all";
  const filter = (req.query.filter as string) || "";
  const cacheKey = `ytmusic_trending_${category}_${filter}`;

  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FEED_CACHE_TTL) {
    return res.json({ success: true, category, videos: cached.data, cached: true });
  }

  let videos: VideoItem[] = [];

  try {
    if (category === "all" || category === "charts") {
      const exploreItems = await browseYouTubeMusicInnertube("FEmusic_explore");
      if (exploreItems.length > 0) {
        videos = exploreItems;
      }
    }

    if (videos.length < 6) {
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
  } catch (err) {
    console.warn("Innertube trending fetch error:", err);
  }

  // Fallback to curated catalog if needed
  if (videos.length === 0) {
    const fallbackList = CURATED_MUSIC_CATALOG[category] || CURATED_MUSIC_CATALOG.all || [];
    videos = [...fallbackList];
  }

  if (filter === "songs" || filter === "audio") {
    const audioOnly = videos.filter((v) => v.mediaType === "audio");
    if (audioOnly.length > 0) videos = audioOnly;
  } else if (filter === "videos") {
    const videoOnly = videos.filter((v) => v.mediaType === "video");
    if (videoOnly.length > 0) videos = videoOnly;
  }

  cacheMap.set(cacheKey, { timestamp: Date.now(), data: videos });
  return res.json({ success: true, category, videos });
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

  let musicVideos: VideoItem[] = [];

  try {
    musicVideos = await searchYouTubeMusicInnertube(
      query,
      filter === "songs" ? "songs" : (filter === "videos" ? "videos" : undefined)
    );

    if (musicVideos.length === 0) {
      // Invidious fallback
      musicVideos = await searchInvidiousMusic(query);
    }
  } catch (err) {
    console.warn(`YouTube Music search error for ${query}:`, err);
  }

  // Fallback matching curated list if still empty
  if (musicVideos.length === 0) {
    const qLower = query.toLowerCase();
    const allCurated = Object.values(CURATED_MUSIC_CATALOG).flat();
    const matches = allCurated.filter(
      (v) =>
        v.title.toLowerCase().includes(qLower) ||
        (v.artist && v.artist.toLowerCase().includes(qLower)) ||
        (v.channelTitle && v.channelTitle.toLowerCase().includes(qLower))
    );
    musicVideos = matches.length > 0 ? matches : allCurated.slice(0, 8);
  }

  if (filter === "songs" || filter === "audio") {
    const filtered = musicVideos.filter((v) => v.mediaType === "audio");
    if (filtered.length > 0) musicVideos = filtered;
  } else if (filter === "videos") {
    const filtered = musicVideos.filter((v) => v.mediaType === "video");
    if (filtered.length > 0) musicVideos = filtered;
  }

  cacheMap.set(cacheKey, { timestamp: Date.now(), data: musicVideos });
  return res.json({ success: true, query, videos: musicVideos });
});

// 3. GET /api/youtube/stream/:videoId - Stream resolution via yt-dlp / Invidious / Piped
youtubeRouter.get("/stream/:videoId", async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) return res.status(400).json({ success: false, error: "Missing videoId" });

  try {
    const streamData = await extractDirectStreams(videoId);
    if (streamData && (streamData.audioUrl || streamData.videoUrl)) {
      const audioProxy = streamData.audioUrl
        ? `/api/youtube/proxy-stream?url=${encodeURIComponent(streamData.audioUrl)}`
        : "";
      const videoProxy = streamData.videoUrl
        ? `/api/youtube/proxy-stream?url=${encodeURIComponent(streamData.videoUrl)}`
        : audioProxy;

      return res.json({
        success: true,
        source: streamData.source,
        videoId,
        title: streamData.title,
        uploader: streamData.uploader,
        duration: streamData.duration,
        audioStreamUrl: audioProxy || videoProxy,
        videoStreamUrl: videoProxy || audioProxy,
        directAudioUrl: streamData.audioUrl,
        directVideoUrl: streamData.videoUrl,
      });
    }
  } catch (e: any) {
    console.warn(`Stream extraction error for ${videoId}:`, e?.message || e);
  }

  // Fallback endpoint (safe)
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
  if (!targetUrl || !targetUrl.startsWith("http")) {
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

    const videoRes = await fetch(targetUrl, { headers: fetchHeaders, signal: AbortSignal.timeout(12000) });
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
    if (!res.headersSent) {
      res.status(500).send("Stream error");
    }
  }
});
