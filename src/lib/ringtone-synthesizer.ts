// Phone App Ringtone Manager with Default MP3s & Custom Upload Persistence
// Supports default MP3 ringtones, custom MP3 uploads with localStorage persistence, and seamless looping.

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
    name: "Frosted Ringtone",
    description: "Default chime melody",
    url: "/ringtones/chime_default.mp3",
  },
  {
    id: "marimba",
    name: "Classic Marimba",
    description: "The original 7-second marimba melody",
    url: "/ringtones/marimba.mp3",
  },
  {
    id: "reflection",
    name: "Modern Reflection",
    description: "The 30-second modern reflection chime",
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
    description: "Big boy come pick up your phone",
    url: "/ringtones/big_boy.mp3",
  },
  {
    id: "chimpanzini",
    name: "Chimpanzini Bananini",
    description: "Chimpanzini bananini ringtone",
    url: "/ringtones/chimpanzini.mp3",
  },
];

export const AVAILABLE_RINGTONES = DEFAULT_RINGTONES;

const STORAGE_KEY = "frosted_call_ringtone_id";
const UPLOADED_STORAGE_KEY = "frosted_custom_uploaded_ringtones";
export const DEFAULT_RINGTONE = "default_chime";

/**
 * Returns all custom uploaded ringtones saved in localStorage.
 */
export function getUploadedRingtones(): RingtoneDefinition[] {
  try {
    const raw = localStorage.getItem(UPLOADED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && item.id && item.url);
      }
    }
  } catch (e) {
    console.error("Error reading uploaded ringtones:", e);
  }
  return [];
}

/**
 * Returns all ringtones (built-in default MP3s + user's uploaded custom MP3s).
 */
export function getAllRingtones(): RingtoneDefinition[] {
  const uploaded = getUploadedRingtones();
  return [...DEFAULT_RINGTONES, ...uploaded];
}

/**
 * Saves a new custom MP3 file as an uploaded ringtone.
 */
export async function saveUploadedRingtone(file: File): Promise<RingtoneDefinition> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("audio/") && !file.name.match(/\.(mp3|wav|ogg|m4a|aac)$/i)) {
      reject(new Error("Please select a valid audio file (.mp3, .wav, .ogg, .m4a)"));
      return;
    }

    // Limit to 8MB to prevent exceeding localStorage quota
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Audio file must be smaller than 8MB"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = reader.result as string;
        const cleanName = file.name.replace(/\.[^/.]+$/, "").trim() || "Custom Ringtone";
        const newRingtone: RingtoneDefinition = {
          id: `custom_ringtone_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: cleanName,
          description: "Custom uploaded MP3",
          url: dataUrl,
          isCustom: true,
        };

        const existing = getUploadedRingtones();
        const updated = [newRingtone, ...existing];
        localStorage.setItem(UPLOADED_STORAGE_KEY, JSON.stringify(updated));

        // Trigger an event so components can update live
        window.dispatchEvent(new Event("ringtone_list_updated"));

        resolve(newRingtone);
      } catch (err: any) {
        if (err?.name === "QuotaExceededError" || err?.message?.includes("quota")) {
          reject(new Error("Browser storage full. Try a smaller MP3 or delete an older uploaded ringtone."));
        } else {
          reject(new Error("Failed to save ringtone to storage"));
        }
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Removes an uploaded custom ringtone from storage.
 */
export function deleteUploadedRingtone(id: string): void {
  try {
    const existing = getUploadedRingtones();
    const filtered = existing.filter((r) => r.id !== id);
    localStorage.setItem(UPLOADED_STORAGE_KEY, JSON.stringify(filtered));

    // If active ringtone was this one, reset to default
    if (getSavedRingtone() === id) {
      setSavedRingtone(DEFAULT_RINGTONE);
    }

    window.dispatchEvent(new Event("ringtone_list_updated"));
  } catch (e) {
    console.error("Error deleting ringtone:", e);
  }
}

/**
 * Returns active selected ringtone ID (defaults to first MP3).
 */
export function getSavedRingtone(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const all = getAllRingtones();
      if (all.some((r) => r.id === saved)) {
        return saved;
      }
    }
  } catch {}
  return DEFAULT_RINGTONE;
}

/**
 * Sets active selected ringtone ID.
 */
export function setSavedRingtone(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
    window.dispatchEvent(new Event("ringtone_changed"));
  } catch {}
}

let activePreviewAudio: HTMLAudioElement | null = null;

/**
 * Previews a ringtone once (or while toggled on in settings).
 * Returns a cleanup function to immediately stop playback.
 */
export function previewRingtone(ringtoneId: string): () => void {
  // Stop existing preview
  if (activePreviewAudio) {
    activePreviewAudio.pause();
    activePreviewAudio.currentTime = 0;
    activePreviewAudio = null;
  }

  const all = getAllRingtones();
  const target = all.find((r) => r.id === ringtoneId) || DEFAULT_RINGTONES[0];

  try {
    const audio = new Audio(target.url);
    audio.volume = 0.85;
    activePreviewAudio = audio;

    audio.play().catch((err) => {
      console.warn("Ringtone preview play prevented by browser policy:", err);
    });

    audio.onended = () => {
      if (activePreviewAudio === audio) {
        activePreviewAudio = null;
      }
    };

    return () => {
      audio.pause();
      audio.currentTime = 0;
      if (activePreviewAudio === audio) {
        activePreviewAudio = null;
      }
    };
  } catch (err) {
    console.error("Failed to play preview ringtone:", err);
    return () => {};
  }
}

/**
 * Starts a continuous audio loop for incoming calls.
 * Loops gracefully until the returned stop function is called.
 */
export function startRingtoneLoop(ringtoneId?: string): () => void {
  const id = ringtoneId || getSavedRingtone();
  const all = getAllRingtones();
  const target = all.find((r) => r.id === id) || DEFAULT_RINGTONES[0];

  try {
    const audio = new Audio(target.url);
    audio.loop = true;
    audio.volume = 0.9;

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

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.9);
        gain.gain.linearRampToValueAtTime(0, now + 1.0);

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
      gain.gain.linearRampToValueAtTime(0, now + 0.35);
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
      gain.gain.linearRampToValueAtTime(0, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }

    setTimeout(() => ctx.close().catch(() => {}), 1000);
    return () => {};
  } catch {
    return () => {};
  }
}
