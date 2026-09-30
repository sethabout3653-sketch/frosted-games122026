import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { YouTubeVideo } from "../types";
import { addToWatchHistory, isVideoSaved, toggleSaveVideo } from "../lib/youtubeStorage";
import Hls from "hls.js";

export interface AudioTrack extends YouTubeVideo {
  sourceType?: "yt-dlp" | "soundcloud" | "youtube" | "local" | "stream" | "radio";
  localFile?: File;
  streamBitrate?: string;
  format?: string;
  permalinkUrl?: string;
}

export interface EqualizerBand {
  freq: number;
  label: string;
  gain: number; // -12 to +12 dB
}

export const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass Boost": [7, 6, 5, 3, 1, 0, 0, 0, 1, 1],
  "Treble Boost": [0, 0, 0, 0, 1, 2, 4, 6, 7, 8],
  "Electronic / EDM": [6, 5, 2, 0, -1, 1, 3, 5, 6, 5],
  "Rock & Metal": [5, 4, 3, 1, -1, 1, 3, 4, 5, 5],
  "Vocal Clarity": [-2, -1, 0, 1, 3, 4, 4, 3, 1, 0],
  "Lofi Chill": [4, 5, 3, 1, 0, 0, -1, -2, -3, -4],
  "Hip Hop": [6, 6, 4, 2, 0, 1, 2, 3, 2, 1],
  Acoustic: [3, 2, 1, 1, 2, 2, 3, 3, 2, 1],
  "8D Spatial": [4, 3, 1, 0, 2, 3, 4, 3, 4, 5],
};

export const CURATED_RADIO_STATIONS: AudioTrack[] = [
  {
    id: "sc-chillhop-distant-days",
    title: "Kupla & DJ Nada - Distant Days",
    channelTitle: "Chillhop Music",
    artist: "Chillhop Music",
    views: "2.4M plays",
    duration: "2:32",
    thumbnail: "https://i1.sndcdn.com/artworks-5qlgESlBverPyPJR-v0DnfQ-t500x500.jpg",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/chillhopdotcom/distantdays",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fchillhopdotcom%2Fdistantdays",
    descriptionSnippet: "Chillhop instrumental lo-fi & peaceful melodic chill beats on SoundCloud.",
  },
  {
    id: "sc-synthwave-drive",
    title: "80s Drive - Retrowave Synthwave",
    channelTitle: "Synthwave Nation",
    artist: "Synthwave Nation",
    views: "1.8M plays",
    duration: "3:45",
    thumbnail: "https://i1.sndcdn.com/artworks-VR1hXhUyvAgKjKBl-qnLGmQ-t500x500.jpg",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/synthwavenation/80s-drive-retrowave-outrun",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fsynthwavenation%2F80s-drive-retrowave-outrun",
    descriptionSnippet: "Nostalgic 80s analog synthesizers and neon night soundscapes on SoundCloud.",
  },
  {
    id: "sc-flamingosis-mood-provider",
    title: "Mood Provider 13 (Full Mixtape)",
    channelTitle: "Flamingosis",
    artist: "Flamingosis",
    views: "980K plays",
    duration: "3:18",
    thumbnail: "https://i1.sndcdn.com/artworks-zlFuDNTyxBEyKIyB-KiZyMA-t500x500.jpg",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/flamingosis/mood-provider-13-1",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fflamingosis%2Fmood-provider-13-1",
    descriptionSnippet: "Funky electronic beats with soulful vintage samples.",
  },
  {
    id: "sc-odesza-a-moment-apart",
    title: "A Moment Apart",
    channelTitle: "ODESZA",
    artist: "ODESZA",
    views: "4.1M plays",
    duration: "3:58",
    thumbnail: "https://i1.sndcdn.com/artworks-nU2mhziz3vmX-0-t500x500.png",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/odesza/a-moment-apart",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fodesza%2Fa-moment-apart",
  },
  {
    id: "sc-san-holo-fade-away",
    title: "FADE AWAY",
    channelTitle: "San Holo",
    artist: "San Holo",
    views: "3.2M plays",
    duration: "4:02",
    thumbnail: "https://i1.sndcdn.com/artworks-UP11fGME1oVg-0-t500x500.png",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/sanholobeats/fade-away",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fsanholobeats%2Ffade-away",
  },
  {
    id: "sc-kudasai-girl-havent-met",
    title: "the girl i haven't met",
    channelTitle: "Kudasai",
    artist: "Kudasai",
    views: "1.5M plays",
    duration: "2:54",
    thumbnail: "https://i1.sndcdn.com/artworks-000272418779-wh8mre-t500x500.jpg",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/kudasaibeats/the-girl-i-havent-met",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fkudasaibeats%2Fthe-girl-i-havent-met",
  },
  {
    id: "sc-idealism-winter-bokeh",
    title: "winter bokeh w/ jinsang",
    channelTitle: "idealism",
    artist: "idealism",
    views: "890K plays",
    duration: "3:05",
    thumbnail: "https://i1.sndcdn.com/artworks-000197315319-gb35ph-t500x500.jpg",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/idealismus/idealism-x-jinsang-winter-bokeh",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fidealismus%2Fidealism-x-jinsang-winter-bokeh",
  },
  {
    id: "sc-swum-fiji",
    title: "Fiji Water & Late Night Drives",
    channelTitle: "SwuM",
    artist: "SwuM",
    views: "1.2M plays",
    duration: "2:48",
    thumbnail: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=500&q=80",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/swumbeats/fiji",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fswumbeats%2Ffiji",
  },
  {
    id: "sc-mrsuicidesheep-chill",
    title: "Taking Flight & Starry Nights",
    channelTitle: "MrSuicideSheep",
    artist: "MrSuicideSheep",
    views: "3.5M plays",
    duration: "3:42",
    thumbnail: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/mrsuicidesheep/taking-flight",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fmrsuicidesheep%2Ftaking-flight",
  },
  {
    id: "sc-purity-ring-bodyache",
    title: "bodyache (Lofi Rework)",
    channelTitle: "Purity Ring",
    artist: "Purity Ring",
    views: "2.1M plays",
    duration: "2:52",
    thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/purity-ring/bodyache",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fpurity-ring%2Fbodyache",
  },
  {
    id: "sc-tycho-a-walk",
    title: "A Walk (Analog Synth Version)",
    channelTitle: "Tycho",
    artist: "Tycho",
    views: "5.0M plays",
    duration: "5:17",
    thumbnail: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=80",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/tycho/a-walk",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Ftycho%2Fa-walk",
  },
  {
    id: "sc-bonobo-cirrus",
    title: "Cirrus",
    channelTitle: "Bonobo",
    artist: "Bonobo",
    views: "4.8M plays",
    duration: "5:52",
    thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&q=80",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/bonobo/cirrus",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fbonobo%2Fcirrus",
  },
  {
    id: "sc-petit-biscuit-sunset-lover",
    title: "Sunset Lover",
    channelTitle: "Petit Biscuit",
    artist: "Petit Biscuit",
    views: "12M plays",
    duration: "3:57",
    thumbnail: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=500&q=80",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/petitbiscuit/sunset-lover",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fpetitbiscuit%2Fsunset-lover",
  },
  {
    id: "sc-jakeneutron-play-my-way",
    title: "Play My Way (feat. Blair Greene)",
    channelTitle: "JakeNeutron",
    artist: "JakeNeutron",
    views: "640K plays",
    duration: "3:24",
    thumbnail: "https://i1.sndcdn.com/artworks-5qlgESlBverPyPJR-v0DnfQ-t500x500.jpg",
    mediaType: "audio",
    isMusic: true,
    sourceType: "soundcloud",
    permalinkUrl: "https://soundcloud.com/jakeneutron-sc/play-my-way-feat-blair-greene",
    mediaUrl: "/api/soundcloud/stream?url=https%3A%2F%2Fsoundcloud.com%2Fjakeneutron-sc%2Fplay-my-way-feat-blair-greene",
  },
];

interface CustomPlaylist {
  id: string;
  name: string;
  createdAt: number;
  tracks: AudioTrack[];
}

interface MusicPlayerContextType {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  repeatMode: "off" | "all" | "one";
  isShuffle: boolean;
  queue: AudioTrack[];
  queueIndex: number;
  analyserNode: AnalyserNode | null;
  audioContext: AudioContext | null;
  equalizerBands: EqualizerBand[];
  activePreset: string;
  bassBoost: number; // 0 to 10
  stereoWidth: number; // -1 (left) to +1 (right), or spatial width
  sleepTimerMinutes: number | null;
  sleepTimerRemaining: number | null;
  isPlayerExpanded: boolean;
  isYtDlpDrawerOpen: boolean;
  customPlaylists: CustomPlaylist[];
  isResolvingUrl: boolean;
  
  // Actions
  playTrack: (track: AudioTrack, newQueue?: AudioTrack[]) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  addToQueue: (track: AudioTrack) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;
  setEqualizerGain: (bandIndex: number, gain: number) => void;
  applyEqualizerPreset: (presetName: string) => void;
  setBassBoost: (val: number) => void;
  setStereoWidth: (val: number) => void;
  setSleepTimer: (minutes: number | null) => void;
  setIsPlayerExpanded: (expanded: boolean) => void;
  setIsYtDlpDrawerOpen: (open: boolean) => void;
  resolveAndPlayUrl: (url: string) => Promise<{ success: boolean; error?: string; track?: AudioTrack }>;
  importLocalFiles: (files: FileList | File[]) => Promise<void>;
  createCustomPlaylist: (name: string, tracks?: AudioTrack[]) => void;
  deleteCustomPlaylist: (playlistId: string) => void;
  addTrackToPlaylist: (playlistId: string, track: AudioTrack) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

function parseDurationToSeconds(duration: string | number | undefined): number {
  if (duration === undefined || duration === null) return 0;
  if (typeof duration === "number") return duration;
  const durationStr = String(duration).trim();
  if (!durationStr || durationStr.toLowerCase().includes("live")) return 0;
  if (/^\d+$/.test(durationStr)) return parseInt(durationStr, 10);
  const parts = durationStr.split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<AudioTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(90);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [isShuffle, setIsShuffle] = useState(false);
  const [queue, setQueue] = useState<AudioTrack[]>(CURATED_RADIO_STATIONS);
  const [queueIndex, setQueueIndex] = useState(0);
  const [activePreset, setActivePreset] = useState<string>("Flat");
  const [bassBoost, setBassBoostState] = useState<number>(0);
  const [stereoWidth, setStereoWidthState] = useState<number>(0);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [isYtDlpDrawerOpen, setIsYtDlpDrawerOpen] = useState(false);
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);

  // Equalizer 10 bands
  const [equalizerBands, setEqualizerBands] = useState<EqualizerBand[]>(() =>
    EQ_FREQUENCIES.map((freq) => ({
      freq,
      label: freq >= 1000 ? `${freq / 1000}kHz` : `${freq}Hz`,
      gain: 0,
    }))
  );

  // Custom playlists stored in localStorage
  const [customPlaylists, setCustomPlaylists] = useState<CustomPlaylist[]>(() => {
    try {
      const saved = localStorage.getItem("frosted_custom_playlists");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("frosted_custom_playlists", JSON.stringify(customPlaylists));
    } catch {}
  }, [customPlaylists]);

  // Web Audio API and HTML5 audio element references
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const biquadFiltersRef = useRef<BiquadFilterNode[]>([]);
  const bassBoostNodeRef = useRef<BiquadFilterNode | null>(null);
  const pannerNodeRef = useRef<StereoPannerNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // State refs for event handlers
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const queueIndexRef = useRef(queueIndex);
  queueIndexRef.current = queueIndex;
  const repeatModeRef = useRef(repeatMode);
  repeatModeRef.current = repeatMode;
  const isShuffleRef = useRef(isShuffle);
  isShuffleRef.current = isShuffle;

  // Initialize Web Audio API nodes lazily on first user interaction
  const initAudioGraph = useCallback(() => {
    if (audioContextRef.current) {
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx || !audioElementRef.current) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaElementSource(audioElementRef.current);
      sourceNodeRef.current = source;

      // Create 10 Equalizer Peaking/Shelf filters
      const filters: BiquadFilterNode[] = EQ_FREQUENCIES.map((freq, idx) => {
        const filter = ctx.createBiquadFilter();
        if (idx === 0) {
          filter.type = "lowshelf";
        } else if (idx === EQ_FREQUENCIES.length - 1) {
          filter.type = "highshelf";
        } else {
          filter.type = "peaking";
          filter.Q.value = 1.4;
        }
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });
      biquadFiltersRef.current = filters;

      // Bass Boost filter (low shelf @ 80Hz)
      const bassNode = ctx.createBiquadFilter();
      bassNode.type = "lowshelf";
      bassNode.frequency.value = 80;
      bassNode.gain.value = 0;
      bassBoostNodeRef.current = bassNode;

      // Stereo Panner
      let panner: StereoPannerNode | null = null;
      if (ctx.createStereoPanner) {
        panner = ctx.createStereoPanner();
        panner.pan.value = 0;
        pannerNodeRef.current = panner;
      }

      // Analyser Node for visualizers
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.82;
      analyserNodeRef.current = analyser;

      // Master Gain
      const masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      gainNodeRef.current = masterGain;

      // Connect graph: Source -> Filter 0 -> Filter 1 ... -> Bass -> Panner -> Analyser -> MasterGain -> Destination
      let lastNode: AudioNode = source;
      filters.forEach((filter) => {
        lastNode.connect(filter);
        lastNode = filter;
      });
      lastNode.connect(bassNode);
      lastNode = bassNode;

      if (panner) {
        lastNode.connect(panner);
        lastNode = panner;
      }

      lastNode.connect(analyser);
      analyser.connect(masterGain);
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn("Web Audio API initialization note:", e);
    }
  }, []);

  // Update EQ bands on AudioNode
  const setEqualizerGain = useCallback((bandIndex: number, gain: number) => {
    setEqualizerBands((prev) => {
      const next = [...prev];
      if (next[bandIndex]) {
        next[bandIndex] = { ...next[bandIndex], gain };
      }
      return next;
    });

    if (biquadFiltersRef.current[bandIndex]) {
      biquadFiltersRef.current[bandIndex].gain.value = gain;
    }
    setActivePreset("Custom");
  }, []);

  const applyEqualizerPreset = useCallback((presetName: string) => {
    const preset = EQ_PRESETS[presetName];
    if (!preset) return;
    setActivePreset(presetName);
    setEqualizerBands((prev) =>
      prev.map((band, idx) => {
        const gain = preset[idx] !== undefined ? preset[idx] : 0;
        if (biquadFiltersRef.current[idx]) {
          biquadFiltersRef.current[idx].gain.value = gain;
        }
        return { ...band, gain };
      })
    );
  }, []);

  const setBassBoost = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(10, val));
    setBassBoostState(clamped);
    if (bassBoostNodeRef.current) {
      // Map 0-10 to 0-12 dB
      bassBoostNodeRef.current.gain.value = (clamped / 10) * 12;
    }
  }, []);

  const setStereoWidth = useCallback((val: number) => {
    const clamped = Math.max(-1, Math.min(1, val));
    setStereoWidthState(clamped);
    if (pannerNodeRef.current) {
      pannerNodeRef.current.pan.value = clamped;
    }
  }, []);

  // Sleep Timer interval handler
  useEffect(() => {
    if (sleepTimerMinutes === null) {
      setSleepTimerRemaining(null);
      return;
    }

    setSleepTimerRemaining(sleepTimerMinutes * 60);

    const interval = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          setSleepTimerMinutes(null);
          // Gracefully pause audio
          if (audioElementRef.current) {
            audioElementRef.current.pause();
          }
          setIsPlaying(false);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [sleepTimerMinutes]);

  // Audio track change handler
  const loadAndPlayTrack = useCallback(
    async (track: AudioTrack) => {
      initAudioGraph();
      setCurrentTrack(track);
      addToWatchHistory(track, 0, 0);
      setIsBuffering(true);
      setCurrentTime(0);
      
      const parsedSecs = parseDurationToSeconds(track.duration);
      if (parsedSecs > 0) {
        setDuration(parsedSecs);
      }

      const audio = audioElementRef.current;
      if (!audio) return;

      let directStream = "";

      if (track.localFile) {
        directStream = URL.createObjectURL(track.localFile);
      } else if (track.mediaUrl) {
        directStream = track.mediaUrl;
      } else if (track.permalinkUrl) {
        directStream = `/api/soundcloud/stream?url=${encodeURIComponent(track.permalinkUrl)}`;
      } else if (track.id) {
        directStream = `/api/soundcloud/stream?url=${encodeURIComponent(track.id)}`;
      }

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (
        Hls.isSupported() &&
        (directStream.includes(".m3u8") || directStream.includes("mpegurl"))
      ) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;
        hls.loadSource(directStream);
        hls.attachMedia(audio);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          audio
            .play()
            .then(() => {
              setIsPlaying(true);
              setIsBuffering(false);
            })
            .catch(() => {
              setIsBuffering(false);
            });
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            setIsBuffering(false);
          }
        });
      } else {
        audio.src = directStream;
        audio.load();

        try {
          await audio.play();
          setIsPlaying(true);
          setIsBuffering(false);
        } catch (err: any) {
          setIsBuffering(false);
        }
      }
    },
    [initAudioGraph]
  );

  const playTrack = useCallback(
    (track: AudioTrack, newQueue?: AudioTrack[]) => {
      // If same track is already loaded, toggle or resume instead of reloading/restarting!
      if (currentTrack?.id === track.id) {
        if (audioElementRef.current) {
          if (audioElementRef.current.paused) {
            audioElementRef.current.play().catch(() => {});
            setIsPlaying(true);
          }
        }
        return;
      }

      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
        const idx = newQueue.findIndex((t) => t.id === track.id);
        setQueueIndex(idx !== -1 ? idx : 0);
      } else {
        const idx = queueRef.current.findIndex((t) => t.id === track.id);
        if (idx !== -1) {
          setQueueIndex(idx);
        } else {
          setQueue((prev) => [track, ...prev]);
          setQueueIndex(0);
        }
      }
      loadAndPlayTrack(track);
    },
    [currentTrack?.id, loadAndPlayTrack]
  );

  const nextTrack = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) return;

    if (isShuffleRef.current) {
      const nextIdx = Math.floor(Math.random() * q.length);
      setQueueIndex(nextIdx);
      loadAndPlayTrack(q[nextIdx]);
      return;
    }

    const currentIdx = queueIndexRef.current;
    if (currentIdx < q.length - 1) {
      setQueueIndex(currentIdx + 1);
      loadAndPlayTrack(q[currentIdx + 1]);
    } else if (repeatModeRef.current === "all") {
      setQueueIndex(0);
      loadAndPlayTrack(q[0]);
    } else {
      setIsPlaying(false);
    }
  }, [loadAndPlayTrack]);

  const prevTrack = useCallback(() => {
    const q = queueRef.current;
    if (q.length === 0) return;

    const audio = audioElementRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    const currentIdx = queueIndexRef.current;
    if (currentIdx > 0) {
      setQueueIndex(currentIdx - 1);
      loadAndPlayTrack(q[currentIdx - 1]);
    } else {
      setQueueIndex(q.length - 1);
      loadAndPlayTrack(q[q.length - 1]);
    }
  }, [loadAndPlayTrack]);

  const togglePlay = useCallback(() => {
    initAudioGraph();
    const audio = audioElementRef.current;
    if (!audio) return;

    if (audio.paused) {
      if (!currentTrack && queueRef.current.length > 0) {
        playTrack(queueRef.current[0]);
        return;
      }
      audio.play().catch(() => {});
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [currentTrack, initAudioGraph, playTrack]);

  const pause = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resume = useCallback(() => {
    initAudioGraph();
    if (audioElementRef.current) {
      audioElementRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [initAudioGraph]);

  const seek = useCallback((seconds: number) => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  }, []);

  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setVolumeState(clamped);
    if (audioElementRef.current) {
      audioElementRef.current.volume = clamped / 100;
    }
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioElementRef.current) {
        audioElementRef.current.muted = next;
      }
      return next;
    });
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(rate);
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = rate;
    }
  }, []);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      if (prev === "off") return "all";
      if (prev === "all") return "one";
      return "off";
    });
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => !prev);
  }, []);

  const addToQueue = useCallback((track: AudioTrack) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setQueueIndex(0);
  }, []);

  // URL Stream Resolver (SoundCloud / Direct Audio URL)
  const resolveAndPlayUrl = useCallback(
    async (url: string): Promise<{ success: boolean; error?: string; track?: AudioTrack }> => {
      setIsResolvingUrl(true);
      try {
        const cleanUrl = url.trim();
        const res = await fetch(`/api/soundcloud/resolve?url=${encodeURIComponent(cleanUrl)}`);
        if (!res.ok) {
          throw new Error("Unable to extract SoundCloud stream");
        }
        const data = await res.json();
        const isYt = cleanUrl.includes("youtube.com") || cleanUrl.includes("music.youtube.com") || cleanUrl.includes("youtu.be");
        const track: AudioTrack = {
          id: data.id || `track-${Date.now()}`,
          title: data.title || (isYt ? "YouTube Track" : "SoundCloud Track"),
          channelTitle: data.artist || data.channelTitle || (isYt ? "YouTube Artist" : "SoundCloud Artist"),
          artist: data.artist || (isYt ? "YouTube Artist" : "SoundCloud Artist"),
          duration: data.duration || "3:30",
          thumbnail: data.thumbnail || "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
          mediaType: "audio",
          isMusic: true,
          permalinkUrl: data.permalinkUrl || cleanUrl,
          mediaUrl: data.mediaUrl || `/api/soundcloud/stream?url=${encodeURIComponent(cleanUrl)}`,
          sourceType: data.sourceType || (isYt ? "youtube" : "soundcloud"),
        };

        playTrack(track);
        setIsResolvingUrl(false);
        return { success: true, track };
      } catch (err: any) {
        setIsResolvingUrl(false);
        return { success: false, error: err?.message || "Failed to resolve SoundCloud stream" };
      }
    },
    [playTrack]
  );

  // Local Audio File Drag & Drop Importer
  const importLocalFiles = useCallback(
    async (files: FileList | File[]) => {
      const imported: AudioTrack[] = [];
      const fileArray = Array.from(files);

      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|ogg|flac|m4a|aac)$/i)) {
          continue;
        }

        const fileName = file.name.replace(/\.[^/.]+$/, "");
        let artist = "Local File";
        let title = fileName;

        if (fileName.includes(" - ")) {
          const parts = fileName.split(" - ");
          artist = parts[0].trim();
          title = parts.slice(1).join(" - ").trim();
        }

        imported.push({
          id: `local-${Date.now()}-${i}`,
          title,
          channelTitle: artist,
          artist,
          duration: "Local",
          thumbnail: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400",
          mediaType: "audio",
          isMusic: true,
          localFile: file,
          sourceType: "local",
        });
      }

      if (imported.length > 0) {
        setQueue((prev) => [...imported, ...prev]);
        playTrack(imported[0]);
      }
    },
    [playTrack]
  );

  // Custom Playlist operations
  const createCustomPlaylist = useCallback((name: string, tracks: AudioTrack[] = []) => {
    const newPl: CustomPlaylist = {
      id: `pl-${Date.now()}`,
      name: name.trim() || "Untitled Playlist",
      createdAt: Date.now(),
      tracks,
    };
    setCustomPlaylists((prev) => [newPl, ...prev]);
  }, []);

  const deleteCustomPlaylist = useCallback((playlistId: string) => {
    setCustomPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
  }, []);

  const addTrackToPlaylist = useCallback((playlistId: string, track: AudioTrack) => {
    setCustomPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id === playlistId && !pl.tracks.some((t) => t.id === track.id)) {
          return { ...pl, tracks: [...pl.tracks, track] };
        }
        return pl;
      })
    );
  }, []);

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setCustomPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id === playlistId) {
          return { ...pl, tracks: pl.tracks.filter((t) => t.id !== trackId) };
        }
        return pl;
      })
    );
  }, []);

  return (
    <MusicPlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        isBuffering,
        currentTime,
        duration,
        volume,
        isMuted,
        playbackRate,
        repeatMode,
        isShuffle,
        queue,
        queueIndex,
        analyserNode: analyserNodeRef.current,
        audioContext: audioContextRef.current,
        equalizerBands,
        activePreset,
        bassBoost,
        stereoWidth,
        sleepTimerMinutes,
        sleepTimerRemaining,
        isPlayerExpanded,
        isYtDlpDrawerOpen,
        customPlaylists,
        isResolvingUrl,
        playTrack,
        togglePlay,
        pause,
        resume,
        seek,
        setVolume,
        toggleMute,
        setPlaybackRate,
        toggleRepeat,
        toggleShuffle,
        nextTrack,
        prevTrack,
        addToQueue,
        removeFromQueue,
        reorderQueue,
        clearQueue,
        setEqualizerGain,
        applyEqualizerPreset,
        setBassBoost,
        setStereoWidth,
        setSleepTimer: setSleepTimerMinutes,
        setIsPlayerExpanded,
        setIsYtDlpDrawerOpen,
        resolveAndPlayUrl,
        importLocalFiles,
        createCustomPlaylist,
        deleteCustomPlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
      }}
    >
      {/* Hidden Global Audio Element configured for Web Audio API */}
      <audio
        ref={audioElementRef}
        crossOrigin="anonymous"
        preload="auto"
        onTimeUpdate={() => {
          if (audioElementRef.current) {
            setCurrentTime(audioElementRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioElementRef.current) {
            const d = audioElementRef.current.duration;
            if (isFinite(d) && d > 0) {
              setDuration(d);
            }
          }
        }}
        onDurationChange={() => {
          if (audioElementRef.current) {
            const d = audioElementRef.current.duration;
            if (isFinite(d) && d > 0) {
              setDuration(d);
            }
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          if (repeatModeRef.current === "one" && audioElementRef.current) {
            audioElementRef.current.currentTime = 0;
            audioElementRef.current.play().catch(() => {});
            setIsPlaying(true);
            return;
          }
          // No auto-advancing queue: reset time to 0 and pause when track finishes
          if (audioElementRef.current) {
            audioElementRef.current.currentTime = 0;
          }
          setCurrentTime(0);
          setIsPlaying(false);
        }}
        onError={(e) => {
          const err = e.currentTarget.error;
          // Ignore normal source swapping or abort error codes (code 1 = ABORTED, null/empty)
          if (!err || err.code === 1) return;
          setIsBuffering(false);
          setIsPlaying(false);
        }}
      />
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error("useMusicPlayer must be used within a MusicPlayerProvider");
  }
  return context;
}
