import express from "express";
import SoundcloudPkg from "soundcloud.ts";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import { createHash } from "crypto";
import ytsSearch from "yt-search";

export const soundcloudRouter = express.Router();
const SoundcloudClass = (SoundcloudPkg as any)?.default || SoundcloudPkg;
const soundcloud = new SoundcloudClass();

function getYtDlpPath(): string {
  const candidates = [
    path.join(process.cwd(), "bin", "yt-dlp"),
    "/usr/local/bin/yt-dlp",
    "/bin/yt-dlp",
    path.join(process.cwd(), "x8rr-music", "services", "soundcloud-backend", "yt-dlp"),
    "/usr/bin/yt-dlp",
    path.join(process.cwd(), "yt-dlp"),
    "yt-dlp",
  ];
  return (
    candidates.find((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    }) || "yt-dlp"
  );
}

// In-memory cache for search results and streams
const scSearchCache = new Map<string, { timestamp: number; data: any[] }>();
const scStreamCache = new Map<string, { timestamp: number; streamUrl: string }>();
const scTrackUrlCache = new Map<string, { timestamp: number; trackUrl: string }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export const CURATED_SOUNDCLOUD_CATALOG: Record<string, any[]> = {
  all: [
    {
      id: "sc-chillhop-distant-days",
      title: "Kupla & DJ Nada - Distant Days",
      artist: "Chillhop Music",
      channelTitle: "Chillhop Music",
      duration: "2:32",
      thumbnail: "https://i1.sndcdn.com/artworks-5qlgESlBverPyPJR-v0DnfQ-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/chillhopdotcom/distantdays",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fchillhopdotcom%2Fdistantdays",
      descriptionSnippet: "Chillhop instrumental lo-fi & peaceful melodic chill beats on SoundCloud.",
    },
    {
      id: "sc-synthwave-drive",
      title: "80s Drive - Retrowave Synthwave",
      artist: "Synthwave Nation",
      channelTitle: "Synthwave Nation",
      duration: "3:45",
      thumbnail: "https://i1.sndcdn.com/artworks-VR1hXhUyvAgKjKBl-qnLGmQ-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/synthwavenation/80s-drive-retrowave-outrun",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fsynthwavenation%2F80s-drive-retrowave-outrun",
      descriptionSnippet: "Nostalgic 80s analog synthesizers and neon night soundscapes on SoundCloud.",
    },
    {
      id: "sc-flamingosis-mood-provider",
      title: "Mood Provider 13 (Full Mixtape)",
      artist: "Flamingosis",
      channelTitle: "Flamingosis",
      duration: "3:18",
      thumbnail: "https://i1.sndcdn.com/artworks-zlFuDNTyxBEyKIyB-KiZyMA-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/flamingosis/mood-provider-13-1",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fflamingosis%2Fmood-provider-13-1",
      descriptionSnippet: "Funky electronic beats with soulful vintage samples.",
    },
    {
      id: "sc-odesza-a-moment-apart",
      title: "A Moment Apart",
      artist: "ODESZA",
      channelTitle: "ODESZA",
      duration: "3:58",
      thumbnail: "https://i1.sndcdn.com/artworks-nU2mhziz3vmX-0-t500x500.png",
      permalinkUrl: "https://soundcloud.com/odesza/a-moment-apart",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fodesza%2Fa-moment-apart",
    },
    {
      id: "sc-san-holo-fade-away",
      title: "FADE AWAY",
      artist: "San Holo",
      channelTitle: "San Holo",
      duration: "4:02",
      thumbnail: "https://i1.sndcdn.com/artworks-UP11fGME1oVg-0-t500x500.png",
      permalinkUrl: "https://soundcloud.com/sanholobeats/fade-away",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fsanholobeats%2Ffade-away",
    },
    {
      id: "sc-kudasai-girl-havent-met",
      title: "the girl i haven't met",
      artist: "Kudasai",
      channelTitle: "Kudasai",
      duration: "2:54",
      thumbnail: "https://i1.sndcdn.com/artworks-000272418779-wh8mre-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/kudasaibeats/the-girl-i-havent-met",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fkudasaibeats%2Fthe-girl-i-havent-met",
    },
    {
      id: "sc-idealism-winter-bokeh",
      title: "winter bokeh w/ jinsang",
      artist: "idealism",
      channelTitle: "idealism",
      duration: "3:05",
      thumbnail: "https://i1.sndcdn.com/artworks-000197315319-gb35ph-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/idealismus/idealism-x-jinsang-winter-bokeh",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fidealismus%2Fidealism-x-jinsang-winter-bokeh",
    },
    {
      id: "sc-swum-fiji",
      title: "Fiji Water & Late Night Drives",
      artist: "SwuM",
      channelTitle: "SwuM",
      duration: "2:48",
      thumbnail: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&q=80",
      permalinkUrl: "https://soundcloud.com/swumbeats/fiji",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fswumbeats%2Ffiji",
    },
    {
      id: "sc-mrsuicidesheep-chill",
      title: "Taking Flight & Starry Nights",
      artist: "MrSuicideSheep",
      channelTitle: "MrSuicideSheep",
      duration: "3:42",
      thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
      permalinkUrl: "https://soundcloud.com/mrsuicidesheep/taking-flight",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fmrsuicidesheep%2Ftaking-flight",
    },
    {
      id: "sc-purity-ring-bodyache",
      title: "bodyache (Lofi Rework)",
      artist: "Purity Ring",
      channelTitle: "Purity Ring",
      duration: "2:52",
      thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80",
      permalinkUrl: "https://soundcloud.com/purity-ring/bodyache",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fpurity-ring%2Fbodyache",
    },
    {
      id: "sc-tycho-a-walk",
      title: "A Walk (Analog Synth Version)",
      artist: "Tycho",
      channelTitle: "Tycho",
      duration: "5:17",
      thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=80",
      permalinkUrl: "https://soundcloud.com/tycho/a-walk",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Ftycho%2Fa-walk",
    },
    {
      id: "sc-bonobo-cirrus",
      title: "Cirrus",
      artist: "Bonobo",
      channelTitle: "Bonobo",
      duration: "5:52",
      thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80",
      permalinkUrl: "https://soundcloud.com/bonobo/cirrus",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fbonobo%2Fcirrus",
    },
    {
      id: "sc-petit-biscuit-sunset-lover",
      title: "Sunset Lover",
      artist: "Petit Biscuit",
      channelTitle: "Petit Biscuit",
      duration: "3:57",
      thumbnail: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80",
      permalinkUrl: "https://soundcloud.com/petitbiscuit/sunset-lover",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fpetitbiscuit%2Fsunset-lover",
    },
    {
      id: "sc-jakeneutron-play-my-way",
      title: "Play My Way (feat. Blair Greene)",
      artist: "JakeNeutron",
      channelTitle: "JakeNeutron",
      duration: "3:24",
      thumbnail: "https://i1.sndcdn.com/artworks-5qlgESlBverPyPJR-v0DnfQ-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/jakeneutron-sc/play-my-way-feat-blair-greene",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fjakeneutron-sc%2Fplay-my-way-feat-blair-greene",
    },
  ],
  study: [
    {
      id: "sc-chillhop-distant-days",
      title: "Kupla & DJ Nada - Distant Days",
      artist: "Chillhop Music",
      channelTitle: "Chillhop Music",
      duration: "2:32",
      thumbnail: "https://i1.sndcdn.com/artworks-5qlgESlBverPyPJR-v0DnfQ-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/chillhopdotcom/distantdays",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fchillhopdotcom%2Fdistantdays",
    },
    {
      id: "sc-idealism-winter-bokeh",
      title: "winter bokeh w/ jinsang",
      artist: "idealism",
      channelTitle: "idealism",
      duration: "3:05",
      thumbnail: "https://i1.sndcdn.com/artworks-000197315319-gb35ph-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/idealismus/idealism-x-jinsang-winter-bokeh",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fidealismus%2Fidealism-x-jinsang-winter-bokeh",
    },
    {
      id: "sc-kudasai-girl-havent-met",
      title: "the girl i haven't met",
      artist: "Kudasai",
      channelTitle: "Kudasai",
      duration: "2:54",
      thumbnail: "https://i1.sndcdn.com/artworks-000272418779-wh8mre-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/kudasaibeats/the-girl-i-havent-met",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fkudasaibeats%2Fthe-girl-i-havent-met",
    },
  ],
  electronic: [
    {
      id: "sc-odesza-a-moment-apart",
      title: "A Moment Apart",
      artist: "ODESZA",
      channelTitle: "ODESZA",
      duration: "3:58",
      thumbnail: "https://i1.sndcdn.com/artworks-nU2mhziz3vmX-0-t500x500.png",
      permalinkUrl: "https://soundcloud.com/odesza/a-moment-apart",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fodesza%2Fa-moment-apart",
    },
    {
      id: "sc-san-holo-fade-away",
      title: "FADE AWAY",
      artist: "San Holo",
      channelTitle: "San Holo",
      duration: "4:02",
      thumbnail: "https://i1.sndcdn.com/artworks-UP11fGME1oVg-0-t500x500.png",
      permalinkUrl: "https://soundcloud.com/sanholobeats/fade-away",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fsanholobeats%2Ffade-away",
    },
  ],
  hiphop: [
    {
      id: "sc-flamingosis-mood-provider",
      title: "Mood Provider 13 (Full Mixtape)",
      artist: "Flamingosis",
      channelTitle: "Flamingosis",
      duration: "3:18",
      thumbnail: "https://i1.sndcdn.com/artworks-zlFuDNTyxBEyKIyB-KiZyMA-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/flamingosis/mood-provider-13-1",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fflamingosis%2Fmood-provider-13-1",
    },
  ],
};

function formatDuration(msOrSec: number | undefined): string {
  if (!msOrSec || isNaN(msOrSec)) return "3:30";
  const sec = msOrSec > 10000 ? Math.floor(msOrSec / 1000) : Math.floor(msOrSec);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function getBestArtwork(track: any): string {
  if (track.artwork_url) {
    return track.artwork_url.replace("-large.jpg", "-t500x500.jpg");
  }
  if (track.user?.avatar_url) {
    return track.user.avatar_url.replace("-large.jpg", "-t500x500.jpg");
  }
  return "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80";
}

async function resolveToPlayableTrackUrl(rawUrl: string): Promise<string> {
  const clean = rawUrl.trim();
  const cached = scTrackUrlCache.get(clean);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.trackUrl;
  }

  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    try {
      const search = await soundcloud.tracks.search({ q: clean, limit: 1 });
      if (search?.collection && search.collection[0]?.permalink_url) {
        const found = search.collection[0].permalink_url;
        scTrackUrlCache.set(clean, { timestamp: Date.now(), trackUrl: found });
        return found;
      }
    } catch {}
    return clean;
  }

  try {
    const parsed = new URL(clean);
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (segments.length === 1 && !segments[0].includes(".")) {
      const username = segments[0];
      const search = await soundcloud.tracks.search({ q: username, limit: 1 });
      if (search?.collection && search.collection[0]?.permalink_url) {
        const found = search.collection[0].permalink_url;
        scTrackUrlCache.set(clean, { timestamp: Date.now(), trackUrl: found });
        return found;
      }
    }
  } catch {}

  scTrackUrlCache.set(clean, { timestamp: Date.now(), trackUrl: clean });
  return clean;
}

// 1. GET /api/soundcloud/search?q=<query>
soundcloudRouter.get("/search", async (req, res) => {
  const query = ((req.query.q as string) || "").trim();
  if (!query) {
    return res.json({ success: true, tracks: CURATED_SOUNDCLOUD_CATALOG.all });
  }

  const cacheKey = `sc_search_${query.toLowerCase()}`;
  const cached = scSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ success: true, query, tracks: cached.data });
  }

  try {
    const searchRes = await soundcloud.tracks.search({ q: query, limit: 50 });
    const collection = searchRes?.collection || [];

    if (collection.length > 0) {
      // Filter out 30-second preview snippets (duration < 45000ms)
      const fullLengthCollection = collection.filter((t: any) => !t.duration || t.duration >= 45000);
      const targetCollection = fullLengthCollection.length > 0 ? fullLengthCollection : collection;

      const mappedTracks = targetCollection.map((t: any) => {
        const trackUrl = t.permalink_url || `https://soundcloud.com/${t.user?.permalink || "track"}/${t.permalink}`;
        return {
          id: `sc-${t.id || createHash("md5").update(trackUrl).digest("hex").slice(0, 10)}`,
          title: t.title || "SoundCloud Track",
          artist: t.user?.username || "SoundCloud Artist",
          channelTitle: t.user?.username || "SoundCloud Artist",
          duration: formatDuration(t.duration),
          thumbnail: getBestArtwork(t),
          permalinkUrl: trackUrl,
          sourceType: "soundcloud",
          mediaType: "audio",
          isMusic: true,
          mediaUrl: `/api/soundcloud/stream?url=${encodeURIComponent(trackUrl)}`,
        };
      });

      if (mappedTracks.length > 0) {
        scSearchCache.set(cacheKey, { timestamp: Date.now(), data: mappedTracks });
        return res.json({ success: true, query, tracks: mappedTracks });
      }
    }
  } catch (err: any) {
    console.warn("soundcloud.ts search error, attempting fallback:", err?.message);
  }

  // Fallback: yt-dlp
  try {
    const binPath = getYtDlpPath();
    execFile(
      binPath,
      [`scsearch24:${query}`, "--dump-json", "--flat-playlist", "--no-warnings", "--no-playlist"],
      { timeout: 8000 },
      (err, stdout) => {
        if (!err && stdout && stdout.trim()) {
          const lines = stdout.trim().split("\n").filter(Boolean);
          const tracks: any[] = [];
          for (const line of lines) {
            try {
              const item = JSON.parse(line);
              const trackUrl = item.webpage_url || item.url;
              if (!trackUrl) continue;
              tracks.push({
                id: `sc-${createHash("md5").update(trackUrl).digest("hex").slice(0, 10)}`,
                title: item.title || "SoundCloud Track",
                artist: item.uploader || item.channel || "SoundCloud Artist",
                channelTitle: item.uploader || item.channel || "SoundCloud Artist",
                duration: formatDuration(item.duration),
                thumbnail: item.thumbnail || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
                permalinkUrl: trackUrl,
                sourceType: "soundcloud",
                mediaType: "audio",
                isMusic: true,
                mediaUrl: `/api/soundcloud/stream?url=${encodeURIComponent(trackUrl)}`,
              });
            } catch {}
          }
          if (tracks.length > 0) {
            scSearchCache.set(cacheKey, { timestamp: Date.now(), data: tracks });
            return res.json({ success: true, query, tracks });
          }
        }

        const qLower = query.toLowerCase();
        const all = Object.values(CURATED_SOUNDCLOUD_CATALOG).flat();
        const matched = all.filter(
          (t) => t.title.toLowerCase().includes(qLower) || t.artist.toLowerCase().includes(qLower)
        );
        return res.json({ success: true, query, tracks: matched.length > 0 ? matched : CURATED_SOUNDCLOUD_CATALOG.all });
      }
    );
  } catch {
    return res.json({ success: true, query, tracks: CURATED_SOUNDCLOUD_CATALOG.all });
  }
});

// 2. GET /api/soundcloud/trending?category=<category>
// Automatically loads rich 24-track collection from SoundCloud when home opens without a search query
soundcloudRouter.get("/trending", async (req, res) => {
  const cat = (req.query.category as string) || "all";
  const searchQueries: Record<string, string[]> = {
    all: ["chillhop", "lofi", "synthwave", "remix", "electronic"],
    study: ["lofi study", "chillhop beats", "relaxing lofi"],
    electronic: ["synthwave", "edm house", "electronic beats"],
    hiphop: ["hip hop instrumental", "lofi rap beats"],
  };

  const queries = searchQueries[cat] || searchQueries.all;
  const cacheKey = `sc_trending_v3_${cat}`;
  const cached = scSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ success: true, category: cat, tracks: cached.data });
  }

  try {
    const combinedTracks: any[] = [];
    const seenIds = new Set<string>();

    for (const q of queries) {
      try {
        const searchRes = await soundcloud.tracks.search({ q, limit: 20 });
        const collection = searchRes?.collection || [];

        for (const t of collection) {
          if (!t || !t.id) continue;
          const trackId = String(t.id);
          if (seenIds.has(trackId)) continue;
          seenIds.add(trackId);

          const trackUrl =
            t.permalink_url ||
            `https://soundcloud.com/${t.user?.permalink || "track"}/${t.permalink}`;

          combinedTracks.push({
            id: `sc-${t.id}`,
            title: t.title || "SoundCloud Track",
            artist: t.user?.username || "SoundCloud Artist",
            channelTitle: t.user?.username || "SoundCloud Artist",
            duration: formatDuration(t.duration),
            thumbnail: getBestArtwork(t),
            permalinkUrl: trackUrl,
            sourceType: "soundcloud",
            mediaType: "audio",
            isMusic: true,
            mediaUrl: `/api/soundcloud/stream?url=${encodeURIComponent(trackUrl)}`,
          });
        }
      } catch (err) {}
    }

    if (combinedTracks.length > 0) {
      scSearchCache.set(cacheKey, { timestamp: Date.now(), data: combinedTracks });
      return res.json({ success: true, category: cat, tracks: combinedTracks });
    }
  } catch (e) {}

  const fallback =
    CURATED_SOUNDCLOUD_CATALOG[cat] && CURATED_SOUNDCLOUD_CATALOG[cat].length >= 10
      ? CURATED_SOUNDCLOUD_CATALOG[cat]
      : CURATED_SOUNDCLOUD_CATALOG.all;
  return res.json({ success: true, category: cat, tracks: fallback });
});

// 3. GET /api/soundcloud/resolve?url=<soundcloud_url_or_youtube_url>
soundcloudRouter.get("/resolve", async (req, res) => {
  const rawUrl = ((req.query.url as string) || "").trim();
  if (!rawUrl) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  // Handle YouTube / YouTube Music URLs passed to SoundCloud resolver
  if (
    rawUrl.includes("youtube.com") ||
    rawUrl.includes("music.youtube.com") ||
    rawUrl.includes("youtu.be")
  ) {
    let videoId = "";
    if (rawUrl.includes("v=")) {
      videoId = rawUrl.split("v=")[1]?.split("&")[0] || "";
    } else if (rawUrl.includes("youtu.be/")) {
      videoId = rawUrl.split("youtu.be/")[1]?.split("?")[0] || "";
    }

    const binPath = getYtDlpPath();
    return execFile(
      binPath,
      ["-j", "--no-warnings", "--no-playlist", rawUrl],
      { timeout: 8000 },
      (err, stdout) => {
        if (!err && stdout) {
          try {
            const data = JSON.parse(stdout);
            const vId = data.id || videoId || createHash("md5").update(rawUrl).digest("hex").slice(0, 10);
            return res.json({
              id: `yt-${vId}`,
              title: data.title || "YouTube Track",
              artist: data.uploader || data.channel || "YouTube Artist",
              channelTitle: data.uploader || data.channel || "YouTube Artist",
              duration: formatDuration(data.duration),
              thumbnail:
                data.thumbnail ||
                `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
              permalinkUrl: rawUrl,
              sourceType: "youtube",
              mediaType: "audio",
              isMusic: true,
              mediaUrl: `/api/youtube/stream?v=${vId}`,
            });
          } catch {}
        }

        const fallbackId = videoId || createHash("md5").update(rawUrl).digest("hex").slice(0, 10);
        return res.json({
          id: `yt-${fallbackId}`,
          title: "YouTube Music Track",
          artist: "YouTube Artist",
          duration: "3:30",
          thumbnail: `https://i.ytimg.com/vi/${fallbackId}/hqdefault.jpg`,
          permalinkUrl: rawUrl,
          sourceType: "youtube",
          mediaType: "audio",
          isMusic: true,
          mediaUrl: `/api/youtube/stream?v=${fallbackId}`,
        });
      }
    );
  }

  const url = await resolveToPlayableTrackUrl(rawUrl);

  try {
    const track = await soundcloud.tracks.get(url);
    if (track && track.title) {
      return res.json({
        id: `sc-${track.id || createHash("md5").update(url).digest("hex").slice(0, 10)}`,
        title: track.title,
        artist: track.user?.username || "SoundCloud Artist",
        channelTitle: track.user?.username || "SoundCloud Artist",
        duration: formatDuration(track.duration),
        thumbnail: getBestArtwork(track),
        permalinkUrl: track.permalink_url || url,
        sourceType: "soundcloud",
        mediaType: "audio",
        isMusic: true,
        mediaUrl: `/api/soundcloud/stream?url=${encodeURIComponent(track.permalink_url || url)}`,
      });
    }
  } catch (err: any) {
    console.warn("soundcloud.ts resolve error, trying yt-dlp:", err?.message);
  }

  // Fallback: yt-dlp
  const binPath = getYtDlpPath();
  execFile(binPath, ["-j", "--no-warnings", "--no-playlist", url], { timeout: 8000 }, (err, stdout) => {
    if (!err && stdout) {
      try {
        const data = JSON.parse(stdout);
        return res.json({
          id: `sc-${data.id || createHash("md5").update(url).digest("hex").slice(0, 10)}`,
          title: data.title || "SoundCloud Track",
          artist: data.uploader || data.artist || "SoundCloud Artist",
          channelTitle: data.uploader || data.artist || "SoundCloud Artist",
          duration: formatDuration(data.duration),
          thumbnail: data.thumbnail || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
          permalinkUrl: url,
          sourceType: "soundcloud",
          mediaType: "audio",
          isMusic: true,
          mediaUrl: `/api/soundcloud/stream?url=${encodeURIComponent(url)}`,
        });
      } catch {}
    }

    return res.json({
      id: `sc-${createHash("md5").update(url).digest("hex").slice(0, 10)}`,
      title: "SoundCloud Audio Track",
      artist: "SoundCloud Artist",
      duration: "3:30",
      thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
      permalinkUrl: url,
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: `/api/soundcloud/stream?url=${encodeURIComponent(url)}`,
    });
  });
});

const downloadsDir = path.join(process.cwd(), "downloads");
const archiveFile = path.join(downloadsDir, "archive.txt");

try {
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }
  if (!fs.existsSync(archiveFile)) {
    fs.writeFileSync(archiveFile, "", "utf-8");
  }
} catch (e) {}

function streamLocalAudioFile(req: express.Request, res: express.Response, filePath: string) {
  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.setHeader("Content-Range", `bytes */${fileSize}`);
        return res.status(416).send("Requested Range Not Satisfiable");
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": chunksize,
        "Content-Type": "audio/mpeg",
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "audio/mpeg",
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).send("Error reading cached audio file");
    }
  }
}

// Fallback public SoundCloud API client IDs
const FALLBACK_CLIENT_IDS = [
  "iZ8A8L23380vIinO64Ue0A4v3n6p7a9Q",
  "bbf9303c6218e77a16f554bb7ff83a00",
  "2t9Nm3qM0nyaw0A8B435520a0586e247",
];

// 4. GET /api/soundcloud/stream?url=<soundcloud_or_youtube_url>
soundcloudRouter.get("/stream", async (req, res) => {
  const rawUrl = ((req.query.url as string) || "").trim();
  if (!rawUrl) {
    return res.status(400).send("Missing url parameter");
  }

  // Handle YouTube or YouTube Music links passed to SoundCloud stream route
  if (
    rawUrl.includes("youtube.com") ||
    rawUrl.includes("music.youtube.com") ||
    rawUrl.includes("youtu.be")
  ) {
    let videoId = "";
    if (rawUrl.includes("v=")) {
      videoId = rawUrl.split("v=")[1]?.split("&")[0] || "";
    } else if (rawUrl.includes("youtu.be/")) {
      videoId = rawUrl.split("youtu.be/")[1]?.split("?")[0] || "";
    }
    if (videoId) {
      return res.redirect(302, `/api/youtube/stream?v=${videoId}`);
    }
  }

  const url = await resolveToPlayableTrackUrl(rawUrl);
  const trackHash = createHash("md5").update(url).digest("hex").slice(0, 12);
  const mp3Path = path.join(downloadsDir, `${trackHash}.mp3`);

  // Check if track is already extracted and archived locally
  if (fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 1000) {
    return streamLocalAudioFile(req, res, mp3Path);
  }

  // 1. Try SoundCloud Direct API Transcoding Stream first for fast non-blocking streaming
  try {
    const track = await soundcloud.tracks.get(url);
    if (track) {
      // If SoundCloud returns a 30-second preview snippet (duration < 45000ms), fallback to full-length audio search
      if (track.duration && track.duration < 45000) {
        try {
          const searchTitle = `${track.title || ""} ${track.user?.username || ""}`.trim();
          if (searchTitle) {
            const ytsRes = await ytsSearch(searchTitle);
            if (ytsRes?.videos?.[0]?.videoId) {
              return res.redirect(302, `/api/youtube/stream?v=${ytsRes.videos[0].videoId}`);
            }
          }
        } catch (e) {}
      }

      if (track.media && track.media.transcodings) {
        let client_id = "";
        try {
          client_id = await soundcloud.api.getClientId();
        } catch {
          client_id = FALLBACK_CLIENT_IDS[0];
        }

        const clientIdsToTry = [client_id, ...FALLBACK_CLIENT_IDS].filter(Boolean);

        for (const t of track.media.transcodings) {
          if (!t.url) continue;
          for (const cid of clientIdsToTry) {
            try {
              const resApi = await fetch(`${t.url}?client_id=${cid}`);
              if (!resApi.ok) continue;
              const dataApi = await resApi.json();
              if (dataApi && dataApi.url) {
                return res.redirect(302, dataApi.url);
              }
            } catch (e) {}
          }
        }
      }
    }
  } catch (e) {}

  // 2. Fast direct stream URL extraction via yt-dlp (-g -f bestaudio/best)
  const binPath = getYtDlpPath();
  try {
    const directStreamUrl = await new Promise<string>((resolve, reject) => {
      execFile(
        binPath,
        ["-g", "-f", "bestaudio/best", "--no-warnings", "--no-playlist", url],
        { timeout: 5000 },
        (err, stdout) => {
          if (!err && stdout && stdout.trim().startsWith("http")) {
            resolve(stdout.trim().split("\n")[0]);
          } else {
            reject(err || new Error("No stream URL extracted"));
          }
        }
      );
    });

    if (directStreamUrl) {
      return res.redirect(302, directStreamUrl);
    }
  } catch (e) {}

  // 3. Fallback: Direct SoundCloud SDK stream
  try {
    const audioStream = await soundcloud.util.streamTrack(url);
    if (audioStream && typeof audioStream.pipe === "function") {
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=3600");
      audioStream.pipe(res);
      return;
    }
  } catch (e) {}

  // 4. Fallback 2: SoundCloud streamLink
  try {
    const streamLink = await soundcloud.util.streamLink(url);
    if (streamLink && typeof streamLink === "string" && streamLink.startsWith("http")) {
      return res.redirect(302, streamLink);
    }
  } catch (e) {}

  if (!res.headersSent) {
    res.status(502).send("SoundCloud streaming unavailable");
  }
});
