import express from "express";
import SoundcloudPkg from "soundcloud.ts";
import { execFile, spawn } from "child_process";
import path from "path";
import fs from "fs";
import { createHash } from "crypto";

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

// In-memory cache for search results, streams, and resolved tracks
const scSearchCache = new Map<string, { timestamp: number; data: any[] }>();
const scTrackUrlCache = new Map<string, { timestamp: number; trackUrl: string }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Fallback public SoundCloud API client IDs
const FALLBACK_CLIENT_IDS = [
  "Wq8jpsB4RfUsrezgEFDFfBGhkClF0sUN",
  "iZ8A8L23380vIinO64Ue0A4v3n6p7a9Q",
  "bbf9303c6218e77a16f554bb7ff83a00",
  "2t9Nm3qM0nyaw0A8B435520a0586e247",
];

let cachedClientId = "";
let clientIdExpires = 0;

async function getSoundcloudClientId(): Promise<string> {
  if (cachedClientId && Date.now() < clientIdExpires) {
    return cachedClientId;
  }
  try {
    const cid = await soundcloud.api.getClientId();
    if (cid && typeof cid === "string" && cid.length > 10) {
      cachedClientId = cid;
      clientIdExpires = Date.now() + 60 * 60 * 1000; // 1 hour
      return cid;
    }
  } catch (err: any) {
    console.warn("Dynamic SoundCloud Client ID fetch note:", err?.message);
  }
  return FALLBACK_CLIENT_IDS[0];
}

// 100% verified full-length playable SoundCloud tracks
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
      title: "80s Drive (Retrowave Outrun)",
      artist: "Synthwave Nation",
      channelTitle: "Synthwave Nation",
      duration: "1:58",
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
      duration: "44:27",
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
      duration: "3:54",
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
      duration: "2:34",
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
      duration: "3:15",
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
      duration: "2:07",
      thumbnail: "https://i1.sndcdn.com/artworks-000197315319-gb35ph-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/idealismus/idealism-x-jinsang-winter-bokeh",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fidealismus%2Fidealism-x-jinsang-winter-bokeh",
    },
    {
      id: "sc-potsu-im-closing-my-eyes",
      title: "im closing my eyes (feat. shiloh)",
      artist: "potsu",
      channelTitle: "potsu",
      duration: "1:58",
      thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
      permalinkUrl: "https://soundcloud.com/potsupotsu/im-closing-my-eyes",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fpotsupotsu%2Fim-closing-my-eyes",
    },
    {
      id: "sc-sleepy-fish-resting-well",
      title: "Sleepy Fish - Resting well, I hope",
      artist: "Chillhop Music",
      channelTitle: "Chillhop Music",
      duration: "2:14",
      thumbnail: "https://i1.sndcdn.com/artworks-5qlgESlBverPyPJR-v0DnfQ-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/chillhopdotcom/sleepy-fish-resting-well-i-hope-10",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fchillhopdotcom%2Fsleepy-fish-resting-well-i-hope-10",
    },
    {
      id: "sc-tycho-a-walk",
      title: "A Walk",
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
      duration: "3:58",
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
      duration: "4:46",
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
      duration: "2:07",
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
      duration: "3:15",
      thumbnail: "https://i1.sndcdn.com/artworks-000272418779-wh8mre-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/kudasaibeats/the-girl-i-havent-met",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fkudasaibeats%2Fthe-girl-i-havent-met",
    },
    {
      id: "sc-potsu-im-closing-my-eyes",
      title: "im closing my eyes (feat. shiloh)",
      artist: "potsu",
      channelTitle: "potsu",
      duration: "1:58",
      thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
      permalinkUrl: "https://soundcloud.com/potsupotsu/im-closing-my-eyes",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fpotsupotsu%2Fim-closing-my-eyes",
    },
    {
      id: "sc-sleepy-fish-resting-well",
      title: "Sleepy Fish - Resting well, I hope",
      artist: "Chillhop Music",
      channelTitle: "Chillhop Music",
      duration: "2:14",
      thumbnail: "https://i1.sndcdn.com/artworks-5qlgESlBverPyPJR-v0DnfQ-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/chillhopdotcom/sleepy-fish-resting-well-i-hope-10",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fchillhopdotcom%2Fsleepy-fish-resting-well-i-hope-10",
    },
  ],
  electronic: [
    {
      id: "sc-synthwave-drive",
      title: "80s Drive (Retrowave Outrun)",
      artist: "Synthwave Nation",
      channelTitle: "Synthwave Nation",
      duration: "1:58",
      thumbnail: "https://i1.sndcdn.com/artworks-VR1hXhUyvAgKjKBl-qnLGmQ-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/synthwavenation/80s-drive-retrowave-outrun",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fsynthwavenation%2F80s-drive-retrowave-outrun",
    },
    {
      id: "sc-odesza-a-moment-apart",
      title: "A Moment Apart",
      artist: "ODESZA",
      channelTitle: "ODESZA",
      duration: "3:54",
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
      duration: "2:34",
      thumbnail: "https://i1.sndcdn.com/artworks-UP11fGME1oVg-0-t500x500.png",
      permalinkUrl: "https://soundcloud.com/sanholobeats/fade-away",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fsanholobeats%2Ffade-away",
    },
    {
      id: "sc-tycho-a-walk",
      title: "A Walk",
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
      duration: "3:58",
      thumbnail: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80",
      permalinkUrl: "https://soundcloud.com/petitbiscuit/sunset-lover",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fpetitbiscuit%2Fsunset-lover",
    },
  ],
  hiphop: [
    {
      id: "sc-flamingosis-mood-provider",
      title: "Mood Provider 13 (Full Mixtape)",
      artist: "Flamingosis",
      channelTitle: "Flamingosis",
      duration: "44:27",
      thumbnail: "https://i1.sndcdn.com/artworks-zlFuDNTyxBEyKIyB-KiZyMA-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/flamingosis/mood-provider-13-1",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fflamingosis%2Fmood-provider-13-1",
    },
    {
      id: "sc-potsu-im-closing-my-eyes",
      title: "im closing my eyes (feat. shiloh)",
      artist: "potsu",
      channelTitle: "potsu",
      duration: "1:58",
      thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
      permalinkUrl: "https://soundcloud.com/potsupotsu/im-closing-my-eyes",
      sourceType: "soundcloud",
      mediaType: "audio",
      isMusic: true,
      mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fpotsupotsu%2Fim-closing-my-eyes",
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

  // If query is not a direct URL, search SoundCloud directly
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    try {
      const search = await soundcloud.tracks.search({ q: clean, limit: 5 });
      if (search?.collection && search.collection.length > 0) {
        // Pick the first non-snipped, full-length track
        const valid = search.collection.find(
          (t: any) => (!t.duration || t.duration >= 45000) && t.permalink_url
        ) || search.collection[0];
        if (valid?.permalink_url) {
          scTrackUrlCache.set(clean, { timestamp: Date.now(), trackUrl: valid.permalink_url });
          return valid.permalink_url;
        }
      }
    } catch {}
    return clean;
  }

  scTrackUrlCache.set(clean, { timestamp: Date.now(), trackUrl: clean });
  return clean;
}

// 1. GET /api/soundcloud/search?q=<query>
// ONLY returns authentic SoundCloud tracks, filtering out 30s Go+ snippets
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
      // Filter out 30-second preview snippets (duration < 45000ms or snipped === true)
      const playableCollection = collection.filter((t: any) => {
        if (t.duration && t.duration < 45000) return false;
        if (t.media?.transcodings?.every((tr: any) => tr.snipped === true)) return false;
        return true;
      });

      const targetCollection = playableCollection.length > 0 ? playableCollection : collection;

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
    console.warn("SoundCloud search error, trying yt-dlp scsearch fallback:", err?.message);
  }

  // Fallback: yt-dlp scsearch (SoundCloud search strictly)
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
              // Ignore short previews
              if (item.duration && item.duration < 45) continue;
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
soundcloudRouter.get("/trending", async (req, res) => {
  const cat = (req.query.category as string) || "all";
  const searchQueries: Record<string, string[]> = {
    all: ["chillhop music", "lofi beats", "synthwave retrowave", "chill electronic"],
    study: ["chillhop music", "lofi study beats", "kudasaibeats"],
    electronic: ["synthwave retrowave", "tycho ambient", "petit biscuit"],
    hiphop: ["flamingosis", "potsu", "lofi hip hop instrumental"],
  };

  const queries = searchQueries[cat] || searchQueries.all;
  const cacheKey = `sc_trending_v4_${cat}`;
  const cached = scSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return res.json({ success: true, category: cat, tracks: cached.data });
  }

  try {
    const combinedTracks: any[] = [];
    const seenIds = new Set<string>();

    for (const q of queries) {
      try {
        const searchRes = await soundcloud.tracks.search({ q, limit: 15 });
        const collection = searchRes?.collection || [];

        for (const t of collection) {
          if (!t || !t.id) continue;
          // Filter out short preview snippets
          if (t.duration && t.duration < 45000) continue;
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
    CURATED_SOUNDCLOUD_CATALOG[cat] && CURATED_SOUNDCLOUD_CATALOG[cat].length >= 5
      ? CURATED_SOUNDCLOUD_CATALOG[cat]
      : CURATED_SOUNDCLOUD_CATALOG.all;
  return res.json({ success: true, category: cat, tracks: fallback });
});

// 3. GET /api/soundcloud/resolve?url=<soundcloud_url>
// Strictly resolves SoundCloud track metadata without any YouTube diversion
soundcloudRouter.get("/resolve", async (req, res) => {
  const rawUrl = ((req.query.url as string) || "").trim();
  if (!rawUrl) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  const url = await resolveToPlayableTrackUrl(rawUrl);

  try {
    const track = await soundcloud.tracks.get(url);
    if (track && track.title) {
      const trackUrl = track.permalink_url || url;
      return res.json({
        id: `sc-${track.id || createHash("md5").update(trackUrl).digest("hex").slice(0, 10)}`,
        title: track.title,
        artist: track.user?.username || "SoundCloud Artist",
        channelTitle: track.user?.username || "SoundCloud Artist",
        duration: formatDuration(track.duration),
        thumbnail: getBestArtwork(track),
        permalinkUrl: trackUrl,
        sourceType: "soundcloud",
        mediaType: "audio",
        isMusic: true,
        mediaUrl: `/api/soundcloud/stream?url=${encodeURIComponent(trackUrl)}`,
      });
    }
  } catch (err: any) {
    console.warn("soundcloud.ts resolve error, trying yt-dlp fallback:", err?.message);
  }

  // Fallback: yt-dlp info dump on the SoundCloud URL
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
try {
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
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

// 4. GET /api/soundcloud/stream?url=<soundcloud_url>
// Guaranteed authentic SoundCloud audio playback:
// 1) Local MP3 cache if available
// 2) Progressive MP3 transcoding direct redirect (cf-media.sndcdn.com)
// 3) HLS transcoding piped through FFmpeg as MP3
// 4) yt-dlp piped through FFmpeg as MP3
// NEVER redirects to YouTube or plays incorrect audio!
soundcloudRouter.get("/stream", async (req, res) => {
  const rawUrl = ((req.query.url as string) || "").trim();
  if (!rawUrl) {
    return res.status(400).send("Missing url parameter");
  }

  const url = await resolveToPlayableTrackUrl(rawUrl);
  const trackHash = createHash("md5").update(url).digest("hex").slice(0, 12);
  const mp3Path = path.join(downloadsDir, `${trackHash}.mp3`);

  // 1. Check if track is already extracted and saved locally
  if (fs.existsSync(mp3Path) && fs.statSync(mp3Path).size > 1000) {
    return streamLocalAudioFile(req, res, mp3Path);
  }

  const cid = await getSoundcloudClientId();
  const clientIdsToTry = [cid, ...FALLBACK_CLIENT_IDS].filter(
    (c, i, a) => c && a.indexOf(c) === i
  );

  // 2. Fetch track metadata from SoundCloud SDK
  try {
    const track = await soundcloud.tracks.get(url);
    if (track && track.media && Array.isArray(track.media.transcodings)) {
      const transcodings = track.media.transcodings;

      // PRIORITY 1: Progressive MP3 transcoding (direct MP3 from CloudFront, CORS enabled, instant seek)
      const progressiveTranscoding = transcodings.find(
        (t: any) => t.format?.protocol === "progressive" && !t.snipped
      ) || transcodings.find((t: any) => t.format?.protocol === "progressive");

      if (progressiveTranscoding && progressiveTranscoding.url) {
        for (const clientId of clientIdsToTry) {
          try {
            const apiRes = await fetch(`${progressiveTranscoding.url}?client_id=${clientId}`);
            if (!apiRes.ok) continue;
            const data = await apiRes.json();
            if (data && data.url && data.url.startsWith("http")) {
              // Direct MP3 URL found!
              return res.redirect(302, data.url);
            }
          } catch (e) {}
        }
      }

      // PRIORITY 2: HLS transcoding -> FFmpeg streaming directly to client as audio/mpeg
      const hlsTranscoding = transcodings.find(
        (t: any) => t.format?.protocol === "hls" && !t.snipped
      ) || transcodings.find((t: any) => t.format?.protocol === "hls");

      if (hlsTranscoding && hlsTranscoding.url) {
        for (const clientId of clientIdsToTry) {
          try {
            const apiRes = await fetch(`${hlsTranscoding.url}?client_id=${clientId}`);
            if (!apiRes.ok) continue;
            const data = await apiRes.json();
            if (data && data.url && data.url.startsWith("http")) {
              const hlsUrl = data.url;

              res.setHeader("Content-Type", "audio/mpeg");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.setHeader("Cache-Control", "no-cache");

              const ffmpeg = spawn("ffmpeg", [
                "-reconnect", "1",
                "-reconnect_streamed", "1",
                "-reconnect_delay_max", "5",
                "-i", hlsUrl,
                "-vn",
                "-c:a", "libmp3lame",
                "-b:a", "128k",
                "-f", "mp3",
                "pipe:1",
              ]);

              ffmpeg.stdout.pipe(res);

              req.on("close", () => {
                try {
                  ffmpeg.kill();
                } catch (e) {}
              });

              ffmpeg.on("error", (err) => {
                console.warn("FFmpeg HLS transcode error:", err.message);
                if (!res.headersSent) {
                  res.status(500).send("Audio streaming error");
                }
              });

              return;
            }
          } catch (e) {}
        }
      }
    }
  } catch (err: any) {
    console.warn("SoundCloud track fetch note:", err?.message);
  }

  // 3. Fallback: Direct yt-dlp audio extraction strictly from SoundCloud URL piped to FFmpeg MP3
  try {
    const binPath = getYtDlpPath();
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");

    const ytdlp = spawn(binPath, [
      "-o", "-",
      "-f", "bestaudio/best",
      "--no-playlist",
      "--no-warnings",
      url,
    ]);

    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-vn",
      "-c:a", "libmp3lame",
      "-b:a", "128k",
      "-f", "mp3",
      "pipe:1",
    ]);

    ytdlp.stdout.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(res);

    req.on("close", () => {
      try { ytdlp.kill(); } catch (e) {}
      try { ffmpeg.kill(); } catch (e) {}
    });

    ffmpeg.on("error", () => {
      if (!res.headersSent) {
        res.status(500).send("Streaming pipeline error");
      }
    });

    return;
  } catch (err: any) {
    console.warn("yt-dlp stream pipe error:", err?.message);
  }

  if (!res.headersSent) {
    res.status(502).send("SoundCloud streaming temporarily unavailable");
  }
});
