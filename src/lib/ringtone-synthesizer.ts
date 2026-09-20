// Phone App Ringtone Manager with Static MP3s & IndexedDB Custom Upload Persistence
// All built-in ringtones load directly from real static MP3 audio files in /public/ringtones/

export interface RingtoneDefinition {
  id: string;
  name: string;
  description: string;
  url: string;
  isCustom?: boolean;
}

export const DEFAULT_RINGTONES: RingtoneDefinition[] = [
  {
    id: "default_chime",
    name: "Frosted Ringtone (Discord)",
    description: "Discord incoming call ringtone",
    url: "/ringtones/discord_sound.mp3",
  },
  {
    id: "marimba",
    name: "Classic Marimba",
    description: "Iconic iPhone marimba ringtone",
    url: "/ringtones/marimba.mp3",
  },
  {
    id: "reflection",
    name: "Modern Reflection",
    description: "Modern iPhone reflection chime",
    url: "/ringtones/reflection.mp3",
  },
  {
    id: "patapim",
    name: "Brr Brr Patapim",
    description: "Brr Brr Patapim & Chimpanzini ringtone",
    url: "/ringtones/patapim.mp3",
  },
  {
    id: "big_boy",
    name: "Your Phone Ringing (Big Boy)",
    description: "Your phone ringing, big boy come pick up",
    url: "/ringtones/big_boy.mp3",
  },
  {
    id: "chimpanzini",
    name: "Chimpanzini Bananini",
    description: "Chimpanzini Bananini ringtone",
    url: "/ringtones/chimpanzini.mp3",
  },
];

export const AVAILABLE_RINGTONES = DEFAULT_RINGTONES;

const STORAGE_KEY = "frosted_call_ringtone_id";
const DB_NAME = "FrostedRingtonesDB_v4";
const STORE_NAME = "custom_ringtones";
const DB_VERSION = 1;
export const DEFAULT_RINGTONE = "default_chime";

// Synchronous in-memory cache populated from localStorage & IndexedDB
let customRingtonesCache: RingtoneDefinition[] = [];

// Initialize memory cache from localStorage immediately
try {
  const raw = localStorage.getItem("frosted_custom_uploaded_ringtones_v4");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      customRingtonesCache = parsed.filter((item) => item && item.id && item.url);
    }
  }
} catch {}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadCustomRingtonesFromDB(): Promise<RingtoneDefinition[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result || [];
        if (records.length > 0) {
          customRingtonesCache = records.map((rec: any) => ({
            id: rec.id,
            name: rec.name,
            description: rec.description || "Custom uploaded audio",
            url: rec.dataUrl || rec.url,
            isCustom: true,
          }));
          try {
            localStorage.setItem("frosted_custom_uploaded_ringtones_v4", JSON.stringify(customRingtonesCache));
          } catch {}
        }
        resolve(customRingtonesCache);
      };

      request.onerror = () => resolve(customRingtonesCache);
    });
  } catch (err) {
    return customRingtonesCache;
  }
}

// Auto-run in browser
if (typeof window !== "undefined") {
  loadCustomRingtonesFromDB().then(() => {
    window.dispatchEvent(new Event("ringtone_list_updated"));
  });
}

export function getUploadedRingtones(): RingtoneDefinition[] {
  return customRingtonesCache;
}

export function getAllRingtones(): RingtoneDefinition[] {
  return [...DEFAULT_RINGTONES, ...customRingtonesCache];
}

export async function saveUploadedRingtone(file: File): Promise<RingtoneDefinition> {
  if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
    throw new Error("Please select a valid audio file (.mp3, .wav, .ogg, .m4a)");
  }

  if (file.size > 25 * 1024 * 1024) {
    throw new Error("Audio file must be smaller than 25MB");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read audio file"));
    reader.readAsDataURL(file);
  });

  const cleanName = file.name.replace(/\.[^/.]+$/, "").trim() || "Custom Ringtone";
  const ringtoneId = `custom_mp3_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const newRingtone: RingtoneDefinition = {
    id: ringtoneId,
    name: cleanName,
    description: `Custom MP3 (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
    url: dataUrl,
    isCustom: true,
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const req = store.put({
        id: ringtoneId,
        name: cleanName,
        description: newRingtone.description,
        dataUrl,
        size: file.size,
        type: file.type,
        createdAt: Date.now(),
      });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("IndexedDB save error, persisting to memory cache:", err);
  }

  customRingtonesCache = [newRingtone, ...customRingtonesCache.filter((r) => r.id !== ringtoneId)];

  try {
    localStorage.setItem("frosted_custom_uploaded_ringtones_v4", JSON.stringify(customRingtonesCache));
  } catch {}

  setSavedRingtone(ringtoneId);
  window.dispatchEvent(new Event("ringtone_list_updated"));
  return newRingtone;
}

export async function deleteUploadedRingtone(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}

  customRingtonesCache = customRingtonesCache.filter((r) => r.id !== id);

  try {
    localStorage.setItem("frosted_custom_uploaded_ringtones_v4", JSON.stringify(customRingtonesCache));
  } catch {}

  if (getSavedRingtone() === id) {
    setSavedRingtone(DEFAULT_RINGTONE);
  }

  window.dispatchEvent(new Event("ringtone_list_updated"));
}

export function getSavedRingtone(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.trim()) {
      return saved;
    }
  } catch {}
  return DEFAULT_RINGTONE;
}

export function setSavedRingtone(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new Event("ringtone_changed"));
  } catch {}
}

// ----------------------------------------------------------------------------
// Audio Playback Engine: Single Preview vs Full Looping Incoming Call
// ----------------------------------------------------------------------------

let activePreviewAudio: HTMLAudioElement | null = null;
let activePreviewStopFn: (() => void) | null = null;

/**
 * Previews a ringtone in Settings.
 * - Plays the actual MP3 audio once without looping.
 * - Automatically cleans up and triggers onEnded callback when playback completes.
 * - Can be stopped manually at any time.
 */
export function previewRingtone(ringtoneId: string, onEnded?: () => void): () => void {
  // Stop existing preview immediately
  if (activePreviewStopFn) {
    activePreviewStopFn();
    activePreviewStopFn = null;
  }
  if (activePreviewAudio) {
    activePreviewAudio.pause();
    activePreviewAudio.currentTime = 0;
    activePreviewAudio = null;
  }

  const all = getAllRingtones();
  const target = all.find((r) => r.id === ringtoneId) || DEFAULT_RINGTONES.find((r) => r.id === ringtoneId) || DEFAULT_RINGTONES[0];

  try {
    const audio = new Audio(target.url);
    audio.loop = false; // NEVER loop during preview
    audio.volume = 0.95;
    audio.currentTime = 0;
    activePreviewAudio = audio;

    const finish = () => {
      if (activePreviewAudio === audio) {
        activePreviewAudio = null;
        activePreviewStopFn = null;
      }
      if (onEnded) onEnded();
    };

    audio.onended = finish;
    audio.onerror = finish;

    audio.play().catch((err) => {
      console.warn("Preview playback autoplay blocked:", err);
      finish();
    });

    const stop = () => {
      audio.pause();
      audio.currentTime = 0;
      audio.onended = null;
      audio.onerror = null;
      if (activePreviewAudio === audio) {
        activePreviewAudio = null;
        activePreviewStopFn = null;
      }
    };

    activePreviewStopFn = stop;
    return stop;
  } catch (err) {
    console.error("Preview playback error:", err);
    if (onEnded) onEnded();
    return () => {};
  }
}

/**
 * Starts full continuous ringtone audio playback for incoming calls.
 * - Plays the FULL MP3 track from beginning to end.
 * - LOOPS continuously until user answers, declines, or call ends.
 */
export function startRingtoneLoop(ringtoneId?: string): () => void {
  const id = ringtoneId || getSavedRingtone();
  const all = getAllRingtones();
  const target = all.find((r) => r.id === id) || DEFAULT_RINGTONES.find((r) => r.id === id) || DEFAULT_RINGTONES[0];

  try {
    const audio = new Audio(target.url);
    audio.loop = true; // LOOPS continuously for incoming calls!
    audio.volume = 0.95;
    audio.currentTime = 0;

    audio.play().catch((err) => {
      console.warn("Incoming call ringtone autoplay was prevented:", err);
    });

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  } catch (err) {
    console.error("Failed to start incoming ringtone loop:", err);
    return () => {};
  }
}

/**
 * Soft phone audio feedback tones for call transitions.
 */
export function playCallTone(type: "calling" | "connected" | "declined" | "switch_prompt"): () => void {
  try {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return () => {};

    const ctx = new AudioCtxClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    let isCancelled = false;
    let interval: any = null;

    if (type === "calling") {
      // Soft phone ringback tone
      const ringPulse = () => {
        if (isCancelled || ctx.state !== "running") return;
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.9);
        gain.gain.linearRampToValueAtTime(0.001, now + 1.0);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.0);
        osc2.stop(now + 1.0);
      };

      ringPulse();
      interval = setInterval(ringPulse, 3000);

      return () => {
        isCancelled = true;
        if (interval) clearInterval(interval);
        setTimeout(() => ctx.close().catch(() => {}), 500);
      };
    }

    if (type === "connected") {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }

    if (type === "declined") {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.linearRampToValueAtTime(320, now + 0.3);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }

    if (type === "switch_prompt") {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.exponentialRampToValueAtTime(987.77, now + 0.2);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    }

    setTimeout(() => ctx.close().catch(() => {}), 1000);
    return () => {};
  } catch {
    return () => {};
  }
}
