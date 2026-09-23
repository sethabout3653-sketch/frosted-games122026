// Built-in Ringtones and Chat Sound FX Engine with Web Audio Synthesizer
// Features: Default Custom Piano Ringtone, Built-in Ringtones Only, Full Chat FX Engine

export interface RingtoneDefinition {
  id: string;
  name: string;
  description: string;
  url?: string;
  isCustom?: boolean;
}

export const BUILTIN_RINGTONES: RingtoneDefinition[] = [
  {
    id: "piano_default",
    name: "Custom Piano Melody (Default)",
    description: "Elegant custom piano arpeggio ringtone synthesized on a piano",
  },
  {
    id: "piano_nocturne",
    name: "Piano Nocturne",
    description: "Lyrical Chopin-style piano ringtone",
  },
  {
    id: "piano_chime",
    name: "Bright Piano Chimes",
    description: "Upbeat sparkling piano chord melody",
  },
  {
    id: "marimba",
    name: "Classic Marimba",
    description: "Iconic wooden marimba melody",
  },
  {
    id: "crystal_synth",
    name: "Crystal Synth Waves",
    description: "Futuristic crystal synth harmonics",
  },
  {
    id: "harmony_bell",
    name: "Harmonic Bell Chime",
    description: "Resonant bell chimes",
  },
  {
    id: "patapim",
    name: "Brr Brr Patapim",
    description: "Brr Brr Patapim ringtone",
    url: "/ringtones/patapim.mp3",
  },
];

export const AVAILABLE_RINGTONES = BUILTIN_RINGTONES;
export const DEFAULT_RINGTONES = BUILTIN_RINGTONES;
export const DEFAULT_RINGTONE = "piano_default";
const STORAGE_KEY = "frosted_call_ringtone_id";

export function getAllRingtones(): RingtoneDefinition[] {
  return BUILTIN_RINGTONES;
}

export function getUploadedRingtones(): RingtoneDefinition[] {
  return [];
}

export async function loadCustomRingtonesFromDB(): Promise<RingtoneDefinition[]> {
  return [];
}

export function getSavedRingtone(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && BUILTIN_RINGTONES.some((r) => r.id === saved)) {
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
// Web Audio API Synthesizer: Real Piano Synthesis & Sound Effects Engine
// ----------------------------------------------------------------------------

let globalAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!globalAudioCtx) {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      globalAudioCtx = new AudioCtxClass();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === "suspended") {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

/**
 * Plays a synthesized piano note with fundamental + harmonics + exponential decay curve
 */
function playPianoNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number = 1.2,
  velocity: number = 0.5
) {
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  // Fundamental note (Sine + Triangle blend)
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(freq, startTime);

  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(freq, startTime);

  // 2nd Harmonic (Warmth)
  const osc3 = ctx.createOscillator();
  osc3.type = "sine";
  osc3.frequency.setValueAtTime(freq * 2, startTime);

  // Percussive hammer click
  const clickOsc = ctx.createOscillator();
  clickOsc.type = "square";
  clickOsc.frequency.setValueAtTime(freq * 4, startTime);

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.12 * velocity, startTime);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.02);
  clickOsc.connect(clickGain);
  clickGain.connect(masterGain);
  clickOsc.start(startTime);
  clickOsc.stop(startTime + 0.02);

  // Note gain envelope
  const noteGain = ctx.createGain();
  noteGain.gain.setValueAtTime(0.0001, startTime);
  noteGain.gain.linearRampToValueAtTime(0.35 * velocity, startTime + 0.015);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc1.connect(noteGain);
  osc2.connect(noteGain);
  osc3.connect(noteGain);
  noteGain.connect(masterGain);

  osc1.start(startTime);
  osc2.start(startTime);
  osc3.start(startTime);

  osc1.stop(startTime + duration);
  osc2.stop(startTime + duration);
  osc3.stop(startTime + duration);
}

/**
 * Synthesizes a looping piano ringtone sequence
 */
function playPianoRingtoneSequence(ctx: AudioContext, patternType: string, isLoop: boolean): () => void {
  let isCancelled = false;
  let timerId: any = null;

  // Note frequencies
  const NOTES: Record<string, number> = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
    C6: 1046.50, D6: 1174.66, E6: 1318.51,
  };

  let sequence: { note: string; dur: number; vel: number }[] = [];

  if (patternType === "piano_nocturne") {
    sequence = [
      { note: "C4", dur: 0.8, vel: 0.5 }, { note: "G4", dur: 0.8, vel: 0.5 }, { note: "C5", dur: 0.8, vel: 0.6 },
      { note: "E5", dur: 0.8, vel: 0.6 }, { note: "G5", dur: 1.0, vel: 0.7 }, { note: "E5", dur: 0.8, vel: 0.5 },
      { note: "A4", dur: 0.8, vel: 0.5 }, { note: "E5", dur: 0.8, vel: 0.6 }, { note: "A5", dur: 1.0, vel: 0.7 },
      { note: "G5", dur: 0.8, vel: 0.6 }, { note: "E5", dur: 0.8, vel: 0.5 }, { note: "C5", dur: 1.2, vel: 0.6 },
    ];
  } else if (patternType === "piano_chime") {
    sequence = [
      { note: "E5", dur: 0.4, vel: 0.6 }, { note: "G5", dur: 0.4, vel: 0.6 }, { note: "B5", dur: 0.4, vel: 0.7 },
      { note: "C6", dur: 0.8, vel: 0.8 }, { note: "G5", dur: 0.4, vel: 0.6 }, { note: "E5", dur: 0.8, vel: 0.7 },
      { note: "A5", dur: 0.4, vel: 0.7 }, { note: "C6", dur: 0.8, vel: 0.8 }, { note: "B5", dur: 1.0, vel: 0.7 },
    ];
  } else if (patternType === "marimba") {
    sequence = [
      { note: "G4", dur: 0.3, vel: 0.7 }, { note: "C5", dur: 0.3, vel: 0.7 }, { note: "E5", dur: 0.3, vel: 0.8 },
      { note: "G5", dur: 0.5, vel: 0.85 }, { note: "E5", dur: 0.3, vel: 0.7 }, { note: "C5", dur: 0.3, vel: 0.7 },
      { note: "A4", dur: 0.3, vel: 0.7 }, { note: "D5", dur: 0.3, vel: 0.7 }, { note: "F5", dur: 0.3, vel: 0.8 },
      { note: "A5", dur: 0.5, vel: 0.85 },
    ];
  } else if (patternType === "crystal_synth") {
    sequence = [
      { note: "C5", dur: 0.5, vel: 0.5 }, { note: "G5", dur: 0.5, vel: 0.6 }, { note: "C6", dur: 0.8, vel: 0.7 },
      { note: "E6", dur: 0.8, vel: 0.8 }, { note: "C6", dur: 0.5, vel: 0.6 }, { note: "G5", dur: 0.8, vel: 0.6 },
    ];
  } else if (patternType === "harmony_bell") {
    sequence = [
      { note: "A4", dur: 0.6, vel: 0.6 }, { note: "E5", dur: 0.6, vel: 0.65 }, { note: "A5", dur: 0.8, vel: 0.7 },
      { note: "B5", dur: 0.8, vel: 0.75 }, { note: "E5", dur: 0.6, vel: 0.6 },
    ];
  } else {
    // "piano_default" - Custom Piano Arpeggio Ringtone
    sequence = [
      { note: "C5", dur: 0.35, vel: 0.6 }, { note: "E5", dur: 0.35, vel: 0.6 }, { note: "G5", dur: 0.35, vel: 0.7 },
      { note: "B5", dur: 0.35, vel: 0.7 }, { note: "C6", dur: 0.60, vel: 0.8 }, { note: "B5", dur: 0.35, vel: 0.65 },
      { note: "G5", dur: 0.35, vel: 0.6 }, { note: "E5", dur: 0.35, vel: 0.55 }, { note: "A4", dur: 0.35, vel: 0.6 },
      { note: "C5", dur: 0.35, vel: 0.6 }, { note: "E5", dur: 0.35, vel: 0.65 }, { note: "A5", dur: 0.60, vel: 0.8 },
      { note: "G5", dur: 0.35, vel: 0.65 }, { note: "E5", dur: 0.35, vel: 0.6 }, { note: "C5", dur: 0.80, vel: 0.7 },
    ];
  }

  const playSequenceOnce = () => {
    if (isCancelled || ctx.state !== "running") return;
    const now = ctx.currentTime;
    let timeOffset = 0;

    for (const step of sequence) {
      const freq = NOTES[step.note] || 440;
      playPianoNote(ctx, freq, now + timeOffset, step.dur, step.vel);
      timeOffset += 0.22;
    }

    if (isLoop && !isCancelled) {
      const totalTimeMs = Math.max(2500, timeOffset * 1000 + 400);
      timerId = setTimeout(playSequenceOnce, totalTimeMs);
    }
  };

  playSequenceOnce();

  return () => {
    isCancelled = true;
    if (timerId) clearTimeout(timerId);
  };
}

let activeRingtoneStopFn: (() => void) | null = null;
let activePreviewStopFn: (() => void) | null = null;

export function previewRingtone(ringtoneId: string, onEnded?: () => void): () => void {
  if (activePreviewStopFn) {
    activePreviewStopFn();
    activePreviewStopFn = null;
  }

  const id = ringtoneId || getSavedRingtone();
  const target = BUILTIN_RINGTONES.find((r) => r.id === id) || BUILTIN_RINGTONES[0];

  if (target.url) {
    try {
      const audio = new Audio(target.url);
      audio.loop = false;
      audio.volume = 0.95;
      audio.play().catch(() => {});
      const stop = () => {
        audio.pause();
        audio.currentTime = 0;
      };
      activePreviewStopFn = stop;
      if (onEnded) audio.onended = onEnded;
      return stop;
    } catch {
      if (onEnded) onEnded();
      return () => {};
    }
  }

  const ctx = getAudioContext();
  if (!ctx) {
    if (onEnded) onEnded();
    return () => {};
  }

  const stopFn = playPianoRingtoneSequence(ctx, target.id, false);
  const timeout = setTimeout(() => {
    stopFn();
    if (onEnded) onEnded();
  }, 4500);

  const cleanup = () => {
    clearTimeout(timeout);
    stopFn();
    if (activePreviewStopFn === cleanup) activePreviewStopFn = null;
  };

  activePreviewStopFn = cleanup;
  return cleanup;
}

export function startRingtoneLoop(ringtoneId?: string): () => void {
  if (activeRingtoneStopFn) {
    activeRingtoneStopFn();
    activeRingtoneStopFn = null;
  }

  const id = ringtoneId || getSavedRingtone();
  const target = BUILTIN_RINGTONES.find((r) => r.id === id) || BUILTIN_RINGTONES[0];

  if (target.url) {
    try {
      const audio = new Audio(target.url);
      audio.loop = true;
      audio.volume = 0.95;
      audio.play().catch(() => {});
      const stop = () => {
        audio.pause();
        audio.currentTime = 0;
      };
      activeRingtoneStopFn = stop;
      return stop;
    } catch {
      return () => {};
    }
  }

  const ctx = getAudioContext();
  if (!ctx) return () => {};

  const stopFn = playPianoRingtoneSequence(ctx, target.id, true);
  activeRingtoneStopFn = stopFn;
  return stopFn;
}

// ----------------------------------------------------------------------------
// Universal Chat Event Sound FX Engine
// ----------------------------------------------------------------------------

export function playChatSound(type: "send" | "receive" | "reaction" | "delete" | "join" | "leave" | "warning" | "call_connected" | "call_ended"): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === "send") {
      // Crisp, happy double pop
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.08);

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(880, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.16);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now + 0.08);
      osc1.stop(now + 0.08);
      osc2.stop(now + 0.18);
    } else if (type === "receive") {
      // Dual-note soft piano chime
      playPianoNote(ctx, 659.25, now, 0.4, 0.4);
      playPianoNote(ctx, 987.77, now + 0.09, 0.6, 0.5);
    } else if (type === "reaction") {
      // Subtle bubbly pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.06);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } else if (type === "delete") {
      // Soft descending swish
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.12);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else if (type === "join") {
      // Warm rising chord
      playPianoNote(ctx, 392.00, now, 0.5, 0.4);
      playPianoNote(ctx, 493.88, now + 0.08, 0.5, 0.45);
      playPianoNote(ctx, 587.33, now + 0.16, 0.7, 0.5);
    } else if (type === "leave") {
      // Soft falling chord
      playPianoNote(ctx, 587.33, now, 0.4, 0.4);
      playPianoNote(ctx, 493.88, now + 0.08, 0.4, 0.35);
      playPianoNote(ctx, 392.00, now + 0.16, 0.6, 0.3);
    } else if (type === "warning") {
      // Double alert chime
      playPianoNote(ctx, 880, now, 0.25, 0.5);
      playPianoNote(ctx, 880, now + 0.15, 0.4, 0.5);
    } else if (type === "call_connected") {
      playPianoNote(ctx, 523.25, now, 0.3, 0.5);
      playPianoNote(ctx, 659.25, now + 0.08, 0.3, 0.5);
      playPianoNote(ctx, 783.99, now + 0.16, 0.6, 0.6);
    } else if (type === "call_ended") {
      playPianoNote(ctx, 783.99, now, 0.3, 0.4);
      playPianoNote(ctx, 523.25, now + 0.1, 0.5, 0.35);
    }
  } catch (e) {}
}

export function playCallTone(type: "calling" | "connected" | "declined" | "switch_prompt"): () => void {
  const ctx = getAudioContext();
  if (!ctx) return () => {};

  if (type === "calling") {
    let isCancelled = false;
    let timer: any = null;

    const ringPulse = () => {
      if (isCancelled || ctx.state !== "running") return;
      playPianoNote(ctx, 440, ctx.currentTime, 0.8, 0.35);
      playPianoNote(ctx, 554.37, ctx.currentTime + 0.1, 0.8, 0.35);
    };

    ringPulse();
    timer = setInterval(ringPulse, 2800);

    return () => {
      isCancelled = true;
      if (timer) clearInterval(timer);
    };
  }

  if (type === "connected") {
    playChatSound("call_connected");
  } else if (type === "declined") {
    playChatSound("call_ended");
  } else if (type === "switch_prompt") {
    playChatSound("receive");
  }

  return () => {};
}
