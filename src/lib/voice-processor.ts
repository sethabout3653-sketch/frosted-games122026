/**
 * Voice Effects, Filters & Background Sound Engine
 * Supports "Nervous" expressive voice modulation, pitch/tonal filters,
 * procedural background ambient audio, and custom audio track uploads.
 */

export type VoiceFilterId =
  | "none"
  | "nervous"
  | "goof"
  | "warm"
  | "helium"
  | "deep"
  | "radio"
  | "cosmic"
  | "echo";

export type CameraEffectId =
  | "none"
  | "blur"
  | "goof"
  | "space"
  | "cozy"
  | "beach"
  | "studio";

export type CallAnimMode = "nervous" | "goof" | "pulse" | "none";

export function getSavedCallAnimMode(): CallAnimMode {
  try {
    const saved = localStorage.getItem("frosted_call_anim_mode");
    if (saved === "nervous" || saved === "goof" || saved === "pulse" || saved === "none") {
      return saved;
    }
  } catch {}
  return "nervous";
}

export function saveCallAnimMode(mode: CallAnimMode) {
  try {
    localStorage.setItem("frosted_call_anim_mode", mode);
  } catch {}
}

export type BackgroundSoundId =
  | "none"
  | "rain"
  | "cafe"
  | "lofi"
  | "forest"
  | "city"
  | "cosmic"
  | "custom";

export interface VoiceFilterOption {
  id: VoiceFilterId;
  name: string;
  badge?: string;
  description: string;
  icon: string;
  color: string;
}

export interface BackgroundSoundOption {
  id: BackgroundSoundId;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const VOICE_FILTERS: VoiceFilterOption[] = [
  {
    id: "none",
    name: "Normal Voice",
    description: "Clean, unmodded studio microphone feed",
    icon: "🎙️",
    color: "#a3a3a3",
  },
  {
    id: "nervous",
    name: "Nervous",
    badge: "Popular",
    description: "Expressive micro-tremor & vocal flutter for anxious flutter effect",
    icon: "😨",
    color: "#f59e0b",
  },
  {
    id: "goof",
    name: "Goof Wobbler",
    badge: "Fun",
    description: "Elastic, bouncy cartoon pitch wobble & rubbery resonance",
    icon: "🤪",
    color: "#f43f5e",
  },
  {
    id: "warm",
    name: "Warm Broadcaster",
    badge: "Studio",
    description: "Rich low-end warmth, presence boost & smooth clarity",
    icon: "🎧",
    color: "#10b981",
  },
  {
    id: "helium",
    name: "High Pitch",
    description: "Bright, playful high-pitched voice shift",
    icon: "🐿️",
    color: "#ec4899",
  },
  {
    id: "deep",
    name: "Deep Voice",
    description: "Resonant, low-frequency sub-pitch modulation",
    icon: "🤖",
    color: "#8b5cf6",
  },
  {
    id: "radio",
    name: "Vintage Radio",
    description: "Bandpass filtered comms & walkie-talkie aesthetic",
    icon: "📻",
    color: "#06b6d4",
  },
  {
    id: "cosmic",
    name: "Cosmic Space",
    description: "Spacious shimmer with soft chorus depth",
    icon: "🪐",
    color: "#3b82f6",
  },
  {
    id: "echo",
    name: "Studio Echo",
    description: "Smooth acoustic room reflection & soft delay",
    icon: "🎭",
    color: "#6366f1",
  },
];

export const BACKGROUND_SOUNDS: BackgroundSoundOption[] = [
  {
    id: "none",
    name: "Off",
    description: "No background audio ambience",
    icon: "🔇",
    color: "#737373",
  },
  {
    id: "rain",
    name: "Gentle Rain",
    description: "Relaxing rainfall & soft ambient storm droplets",
    icon: "🌧️",
    color: "#38bdf8",
  },
  {
    id: "cafe",
    name: "Cozy Cafe",
    description: "Warm coffee shop ambiance & subtle background chatter",
    icon: "☕",
    color: "#f97316",
  },
  {
    id: "lofi",
    name: "Lo-Fi Beats",
    description: "Smooth chillout chords & vinyl crackle texture",
    icon: "🎵",
    color: "#a855f7",
  },
  {
    id: "forest",
    name: "Forest Breeze",
    description: "Gentle nature wind & distant songbirds",
    icon: "🍃",
    color: "#22c55e",
  },
  {
    id: "city",
    name: "City Night",
    description: "Subtle street traffic & urban atmospheric hum",
    icon: "🚗",
    color: "#eab308",
  },
  {
    id: "cosmic",
    name: "Deep Space",
    description: "Ambient cosmic pad & synth drone",
    icon: "🪐",
    color: "#6366f1",
  },
  {
    id: "custom",
    name: "Custom Audio Track",
    description: "Upload your own MP3 / WAV audio file or link",
    icon: "📂",
    color: "#06b6d4",
  },
];

export interface CameraEffectOption {
  id: CameraEffectId;
  name: string;
  badge?: string;
  description: string;
  icon: string;
  color: string;
  bgStyle?: string;
  filterStyle?: string;
  isCustomBg?: boolean;
}

export const CAMERA_EFFECTS: CameraEffectOption[] = [
  {
    id: "none",
    name: "Original Camera",
    description: "Unfiltered live camera feed",
    icon: "📷",
    color: "#a3a3a3",
  },
  {
    id: "blur",
    name: "Background Blur",
    badge: "Popular",
    description: "Soft focus depth blur around subject",
    icon: "🌫️",
    color: "#38bdf8",
    filterStyle: "blur(8px)",
  },
  {
    id: "goof",
    name: "Goof Funhouse",
    badge: "Fun",
    description: "Rubbery cartoon distortion & elastic sway FX",
    icon: "🤪",
    color: "#f43f5e",
  },
  {
    id: "space",
    name: "Deep Space",
    description: "Cosmic nebula background backdrop",
    icon: "🌌",
    color: "#8b5cf6",
    bgStyle: "radial-gradient(circle at 50% 50%, #2e1065, #090514)",
  },
  {
    id: "cozy",
    name: "Cozy Room",
    description: "Warm atmospheric interior lighting",
    icon: "☕",
    color: "#f97316",
    bgStyle: "linear-gradient(135deg, #451a03, #1c0d02)",
  },
  {
    id: "beach",
    name: "Tropical Beach",
    description: "Sunny ocean breeze backdrop",
    icon: "🏖️",
    color: "#06b6d4",
    bgStyle: "linear-gradient(180deg, #0e7490, #164e63)",
  },
  {
    id: "studio",
    name: "Modern Studio",
    description: "Crisp gradient studio backdrop",
    icon: "🏢",
    color: "#10b981",
    bgStyle: "linear-gradient(135deg, #064e3b, #022c22)",
  },
];

export function getSavedCameraEffect(): CameraEffectId {
  try {
    const saved = localStorage.getItem("frosted_camera_effect");
    if (saved && CAMERA_EFFECTS.some((c) => c.id === saved)) {
      return saved as CameraEffectId;
    }
  } catch {}
  return "none";
}

export function saveCameraEffect(effect: CameraEffectId) {
  try {
    localStorage.setItem("frosted_camera_effect", effect);
  } catch {}
}
export function getSavedVoiceFilter(): VoiceFilterId {
  try {
    const filter = localStorage.getItem("frosted_voice_filter");
    if (filter && VOICE_FILTERS.some((f) => f.id === filter)) {
      return filter as VoiceFilterId;
    }
  } catch {}
  return "none";
}

export function saveVoiceFilter(filter: VoiceFilterId) {
  try {
    localStorage.setItem("frosted_voice_filter", filter);
  } catch {}
}

export function getSavedBackgroundSound(): BackgroundSoundId {
  try {
    const bg = localStorage.getItem("frosted_bg_sound");
    if (bg && BACKGROUND_SOUNDS.some((b) => b.id === bg)) {
      return bg as BackgroundSoundId;
    }
  } catch {}
  return "none";
}

export function saveBackgroundSound(bg: BackgroundSoundId) {
  try {
    localStorage.setItem("frosted_bg_sound", bg);
  } catch {}
}

export function getSavedBackgroundVolume(): number {
  try {
    const vol = localStorage.getItem("frosted_bg_volume");
    if (vol !== null) {
      const parsed = parseFloat(vol);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        return parsed;
      }
    }
  } catch {}
  return 0.25;
}

export function saveBackgroundVolume(vol: number) {
  try {
    localStorage.setItem("frosted_bg_volume", vol.toString());
  } catch {}
}

export function getSavedCustomBackgroundData(): { url: string; name: string } {
  try {
    const url = localStorage.getItem("frosted_custom_bg_url") || "";
    const name = localStorage.getItem("frosted_custom_bg_name") || "";
    return { url, name };
  } catch {}
  return { url: "", name: "" };
}

export function saveCustomBackgroundData(url: string, name: string) {
  try {
    localStorage.setItem("frosted_custom_bg_url", url);
    localStorage.setItem("frosted_custom_bg_name", name);
  } catch {}
}

/**
 * Class managing Web Audio API graph for processing microphone input with
 * voice filters, background sound synthesis, and real-time WebRTC destination routing.
 */
export class VoiceProcessorEngine {
  private audioCtx: AudioContext | null = null;
  private rawStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private outputStream: MediaStream | null = null;

  private currentFilter: VoiceFilterId = "none";
  private currentBgSound: BackgroundSoundId = "none";
  private bgVolume: number = 0.25;
  private customBgUrl: string = "";

  // Nodes for filter graph
  private filterNodes: {
    oscillators?: OscillatorNode[];
    gains?: GainNode[];
    filters?: BiquadFilterNode[];
    delays?: DelayNode[];
  } = {};

  // Background audio engine elements
  private bgAudioEl: HTMLAudioElement | null = null;
  private bgSourceNode: MediaElementAudioSourceNode | null = null;
  private bgGainNode: GainNode | null = null;
  private bgProceduralNodes: {
    sources?: (AudioBufferSourceNode | OscillatorNode)[];
    filters?: BiquadFilterNode[];
    gains?: GainNode[];
    intervalId?: any;
  } = {};

  // Mic Gain control node
  private micGainNode: GainNode | null = null;

  // Monitor node for local user preview ("Test My Voice")
  private monitorGainNode: GainNode | null = null;
  private isMonitoring: boolean = false;

  constructor() {
    this.currentFilter = getSavedVoiceFilter();
    this.currentBgSound = getSavedBackgroundSound();
    this.bgVolume = getSavedBackgroundVolume();
    const custom = getSavedCustomBackgroundData();
    this.customBgUrl = custom.url;
  }

  /**
   * Process a raw mic MediaStream and return a processed MediaStream
   */
  public async processStream(micStream: MediaStream): Promise<MediaStream> {
    this.cleanupNodes();

    this.rawStream = micStream;
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioCtxClass();

    if (this.audioCtx.state === "suspended") {
      await this.audioCtx.resume();
    }

    this.sourceNode = this.audioCtx.createMediaStreamSource(micStream);
    this.micGainNode = this.audioCtx.createGain();
    this.micGainNode.gain.value = 1.0;

    this.destinationNode = this.audioCtx.createMediaStreamDestination();

    // Create monitor gain node for local listening
    this.monitorGainNode = this.audioCtx.createGain();
    this.monitorGainNode.gain.value = this.isMonitoring ? 1.0 : 0;
    this.monitorGainNode.connect(this.audioCtx.destination);

    // Apply voice filter chain
    this.rebuildFilterChain();

    // Apply background audio chain
    this.rebuildBackgroundChain();

    // The output stream contains processed mic + background audio
    this.outputStream = this.destinationNode.stream;

    // Ensure video tracks (if any) are carried over cleanly
    const videoTracks = micStream.getVideoTracks();
    videoTracks.forEach((vt) => this.outputStream?.addTrack(vt));

    return this.outputStream;
  }

  public setFilter(filter: VoiceFilterId) {
    this.currentFilter = filter;
    saveVoiceFilter(filter);
    if (this.audioCtx && this.sourceNode) {
      this.rebuildFilterChain();
    }
  }

  public setBackgroundSound(bg: BackgroundSoundId, customUrl?: string) {
    this.currentBgSound = bg;
    saveBackgroundSound(bg);
    if (customUrl !== undefined) {
      this.customBgUrl = customUrl;
    }
    if (this.audioCtx && this.destinationNode) {
      this.rebuildBackgroundChain();
    }
  }

  public setBackgroundVolume(volume: number) {
    this.bgVolume = Math.max(0, Math.min(1, volume));
    saveBackgroundVolume(this.bgVolume);
    if (this.bgGainNode) {
      this.bgGainNode.gain.value = this.bgVolume;
    }
  }

  public setMonitoring(enabled: boolean) {
    this.isMonitoring = enabled;
    if (this.monitorGainNode) {
      this.monitorGainNode.gain.value = enabled ? 1.0 : 0;
    }
  }

  public setCustomBackgroundTrack(url: string, name: string) {
    this.customBgUrl = url;
    saveCustomBackgroundData(url, name);
    this.setBackgroundSound("custom", url);
  }

  public getOutputStream(): MediaStream | null {
    return this.outputStream;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  public getFilter(): VoiceFilterId {
    return this.currentFilter;
  }

  public getBackgroundSound(): BackgroundSoundId {
    return this.currentBgSound;
  }

  public getBackgroundVolume(): number {
    return this.bgVolume;
  }

  public isVoiceMonitoring(): boolean {
    return this.isMonitoring;
  }

  /**
   * Rebuilds the voice filter node chain between sourceNode -> destinationNode & monitor
   */
  private rebuildFilterChain() {
    if (!this.audioCtx || !this.sourceNode || !this.destinationNode || !this.micGainNode) return;

    // Clear old filter nodes
    this.clearFilterNodes();

    // Disconnect source
    try {
      this.sourceNode.disconnect();
      this.micGainNode.disconnect();
    } catch (e) {}

    // First connect source to mic gain node
    this.sourceNode.connect(this.micGainNode);

    let lastNode: AudioNode = this.micGainNode;

    switch (this.currentFilter) {
      case "nervous": {
        // "Nervous" Voice Filter DSP:
        // Expressive vocal micro-tremor LFOs + subtle pitch delay flutter + tight formant resonance.
        // Sounds like authentic anxious human vocal cord vibration without being robotic.

        const formant = this.audioCtx.createBiquadFilter();
        formant.type = "peaking";
        formant.frequency.value = 2200; // Anxious vocal tract resonance
        formant.Q.value = 1.6;
        formant.gain.value = 3.5;

        const delay = this.audioCtx.createDelay(0.1);
        delay.delayTime.value = 0.022; // 22ms base delay

        // Micro-tremor LFO (~8.2Hz)
        const tremorLfo = this.audioCtx.createOscillator();
        tremorLfo.type = "sine";
        tremorLfo.frequency.value = 8.2;

        const tremorGain = this.audioCtx.createGain();
        tremorGain.gain.value = 0.0024; // ~2.4ms wobble depth

        // Humanizing jitter LFO (~1.3Hz) to prevent static/repetitive modulation
        const jitterLfo = this.audioCtx.createOscillator();
        jitterLfo.type = "triangle";
        jitterLfo.frequency.value = 1.3;

        const jitterGain = this.audioCtx.createGain();
        jitterGain.gain.value = 0.0012;

        jitterLfo.connect(jitterGain);
        jitterGain.connect(delay.delayTime);

        tremorLfo.connect(tremorGain);
        tremorGain.connect(delay.delayTime);

        // Amplitude tremolo (flutter gain)
        const ampGain = this.audioCtx.createGain();
        ampGain.gain.value = 0.92;

        const ampLfo = this.audioCtx.createOscillator();
        ampLfo.type = "sine";
        ampLfo.frequency.value = 8.8;

        const ampLfoGain = this.audioCtx.createGain();
        ampLfoGain.gain.value = 0.12; // 12% amplitude tremolo

        ampLfo.connect(ampLfoGain);
        ampLfoGain.connect(ampGain.gain);

        // Connect chain: Mic -> Formant -> Delay -> AmpGain
        lastNode.connect(formant);
        formant.connect(delay);
        delay.connect(ampGain);

        tremorLfo.start();
        jitterLfo.start();
        ampLfo.start();

        this.filterNodes = {
          oscillators: [tremorLfo, jitterLfo, ampLfo],
          gains: [tremorGain, jitterGain, ampLfoGain, ampGain],
          filters: [formant],
          delays: [delay],
        };

        lastNode = ampGain;
        break;
      }

      case "goof": {
        // "Goof Wobbler" Voice Filter DSP:
        // Bouncy cartoon pitch wobbler with elastic delay sway and rubbery gain modulation.
        const formant = this.audioCtx.createBiquadFilter();
        formant.type = "peaking";
        formant.frequency.value = 1200;
        formant.Q.value = 3.0;
        formant.gain.value = 6.0;

        const delay = this.audioCtx.createDelay(0.1);
        delay.delayTime.value = 0.035;

        // Rubbery slow pitch sway LFO (2.2Hz)
        const swayLfo = this.audioCtx.createOscillator();
        swayLfo.type = "sine";
        swayLfo.frequency.value = 2.2;

        const swayGain = this.audioCtx.createGain();
        swayGain.gain.value = 0.009; // 9ms rubbery pitch sweep

        swayLfo.connect(swayGain);
        swayGain.connect(delay.delayTime);

        // Bounce gain modulation
        const bounceGain = this.audioCtx.createGain();
        bounceGain.gain.value = 0.95;

        const bounceLfo = this.audioCtx.createOscillator();
        bounceLfo.type = "triangle";
        bounceLfo.frequency.value = 4.4;

        const bounceLfoGain = this.audioCtx.createGain();
        bounceLfoGain.gain.value = 0.18;

        bounceLfo.connect(bounceLfoGain);
        bounceLfoGain.connect(bounceGain.gain);

        lastNode.connect(formant);
        formant.connect(delay);
        delay.connect(bounceGain);

        swayLfo.start();
        bounceLfo.start();

        this.filterNodes = {
          oscillators: [swayLfo, bounceLfo],
          gains: [swayGain, bounceLfoGain, bounceGain],
          filters: [formant],
          delays: [delay],
        };

        lastNode = bounceGain;
        break;
      }

      case "warm": {
        // Warm Studio Broadcaster: Low boost at 120Hz, presence warmth at 3kHz
        const bass = this.audioCtx.createBiquadFilter();
        bass.type = "lowshelf";
        bass.frequency.value = 140;
        bass.gain.value = 4.5;

        const presence = this.audioCtx.createBiquadFilter();
        presence.type = "peaking";
        presence.frequency.value = 3200;
        presence.Q.value = 1.0;
        presence.gain.value = 2.0;

        const highCut = this.audioCtx.createBiquadFilter();
        highCut.type = "lowpass";
        highCut.frequency.value = 12000;

        lastNode.connect(bass);
        bass.connect(presence);
        presence.connect(highCut);

        this.filterNodes = {
          filters: [bass, presence, highCut],
        };

        lastNode = highCut;
        break;
      }

      case "helium": {
        // High pitch shift using fast modulated pitch delay line
        const delay = this.audioCtx.createDelay(0.1);
        delay.delayTime.value = 0.012;

        const lfo = this.audioCtx.createOscillator();
        lfo.type = "sawtooth";
        lfo.frequency.value = 45.0; // Fast pitch shift sweep

        const lfoGain = this.audioCtx.createGain();
        lfoGain.gain.value = 0.008;

        lfo.connect(lfoGain);
        lfoGain.connect(delay.delayTime);

        const highPass = this.audioCtx.createBiquadFilter();
        highPass.type = "highpass";
        highPass.frequency.value = 350;

        lastNode.connect(delay);
        delay.connect(highPass);

        lfo.start();

        this.filterNodes = {
          oscillators: [lfo],
          gains: [lfoGain],
          delays: [delay],
          filters: [highPass],
        };

        lastNode = highPass;
        break;
      }

      case "deep": {
        // Deep Voice: Lowpass filter + subtle sub pitch modulation
        const lowPass = this.audioCtx.createBiquadFilter();
        lowPass.type = "lowpass";
        lowPass.frequency.value = 1100;

        const subBoost = this.audioCtx.createBiquadFilter();
        subBoost.type = "lowshelf";
        subBoost.frequency.value = 180;
        subBoost.gain.value = 6.0;

        const delay = this.audioCtx.createDelay(0.1);
        delay.delayTime.value = 0.028;

        const lfo = this.audioCtx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 3.5;

        const lfoGain = this.audioCtx.createGain();
        lfoGain.gain.value = 0.003;

        lfo.connect(lfoGain);
        lfoGain.connect(delay.delayTime);

        lastNode.connect(lowPass);
        lowPass.connect(subBoost);
        subBoost.connect(delay);

        lfo.start();

        this.filterNodes = {
          oscillators: [lfo],
          gains: [lfoGain],
          delays: [delay],
          filters: [lowPass, subBoost],
        };

        lastNode = delay;
        break;
      }

      case "radio": {
        // Vintage Radio / Walkie-Talkie: Narrow bandpass (400Hz - 3200Hz)
        const hp = this.audioCtx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 450;

        const lp = this.audioCtx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 3100;

        const peak = this.audioCtx.createBiquadFilter();
        peak.type = "peaking";
        peak.frequency.value = 1800;
        peak.Q.value = 2.5;
        peak.gain.value = 4.0;

        lastNode.connect(hp);
        hp.connect(lp);
        lp.connect(peak);

        this.filterNodes = {
          filters: [hp, lp, peak],
        };

        lastNode = peak;
        break;
      }

      case "cosmic": {
        // Cosmic Shimmer: Chorus delay + pitch modulation
        const delay1 = this.audioCtx.createDelay(0.1);
        delay1.delayTime.value = 0.035;

        const delay2 = this.audioCtx.createDelay(0.1);
        delay2.delayTime.value = 0.048;

        const lfo1 = this.audioCtx.createOscillator();
        lfo1.frequency.value = 0.8;
        const lfoGain1 = this.audioCtx.createGain();
        lfoGain1.gain.value = 0.004;

        lfo1.connect(lfoGain1);
        lfoGain1.connect(delay1.delayTime);

        const lfo2 = this.audioCtx.createOscillator();
        lfo2.frequency.value = 1.3;
        const lfoGain2 = this.audioCtx.createGain();
        lfoGain2.gain.value = 0.003;

        lfo2.connect(lfoGain2);
        lfoGain2.connect(delay2.delayTime);

        const wetGain = this.audioCtx.createGain();
        wetGain.gain.value = 0.7;

        lastNode.connect(delay1);
        lastNode.connect(delay2);
        delay1.connect(wetGain);
        delay2.connect(wetGain);
        lastNode.connect(wetGain);

        lfo1.start();
        lfo2.start();

        this.filterNodes = {
          oscillators: [lfo1, lfo2],
          gains: [lfoGain1, lfoGain2, wetGain],
          delays: [delay1, delay2],
        };

        lastNode = wetGain;
        break;
      }

      case "echo": {
        // Studio Room Echo: Delay loop with feedback
        const delay = this.audioCtx.createDelay(0.5);
        delay.delayTime.value = 0.16; // 160ms delay

        const feedback = this.audioCtx.createGain();
        feedback.gain.value = 0.35; // 35% feedback decay

        const wetMix = this.audioCtx.createGain();
        wetMix.gain.value = 0.45;

        lastNode.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);

        delay.connect(wetMix);
        lastNode.connect(wetMix);

        this.filterNodes = {
          gains: [feedback, wetMix],
          delays: [delay],
        };

        lastNode = wetMix;
        break;
      }

      default:
        // "none": direct connection
        break;
    }

    // Connect processed voice node to destination (WebRTC output) and monitor
    lastNode.connect(this.destinationNode);

    if (this.monitorGainNode) {
      lastNode.connect(this.monitorGainNode);
    }
  }

  /**
   * Rebuilds the background audio generation or playback chain
   */
  private rebuildBackgroundChain() {
    if (!this.audioCtx || !this.destinationNode) return;

    this.clearBackgroundNodes();

    if (this.currentBgSound === "none") return;

    this.bgGainNode = this.audioCtx.createGain();
    this.bgGainNode.gain.value = this.bgVolume;

    // Connect background gain directly into WebRTC destination stream & monitor
    this.bgGainNode.connect(this.destinationNode);
    if (this.monitorGainNode) {
      this.bgGainNode.connect(this.monitorGainNode);
    }

    if (this.currentBgSound === "custom") {
      if (this.customBgUrl) {
        this.startCustomAudioTrack(this.customBgUrl);
      }
      return;
    }

    // Procedural ambient noise synthesis for zero-latency background soundscapes
    this.startProceduralAmbiance(this.currentBgSound);
  }

  private startCustomAudioTrack(url: string) {
    if (!this.audioCtx || !this.bgGainNode) return;

    try {
      this.bgAudioEl = new Audio(url);
      this.bgAudioEl.loop = true;
      this.bgAudioEl.crossOrigin = "anonymous";

      this.bgSourceNode = this.audioCtx.createMediaElementSource(this.bgAudioEl);
      this.bgSourceNode.connect(this.bgGainNode);

      this.bgAudioEl.play().catch((e) => {
        console.warn("Custom background track playback notice:", e);
      });
    } catch (err) {
      console.warn("Failed to initialize custom audio track:", err);
    }
  }

  private startProceduralAmbiance(bg: BackgroundSoundId) {
    if (!this.audioCtx || !this.bgGainNode) return;

    const ctx = this.audioCtx;

    // Generate 5-second buffer of colored noise
    const bufferSize = ctx.sampleRate * 5;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink noise filter approximation
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    switch (bg) {
      case "rain": {
        // Rain: Pink noise through lowpass + random droplet bursts
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 1200;

        const highDropFilter = ctx.createBiquadFilter();
        highDropFilter.type = "peaking";
        highDropFilter.frequency.value = 3400;
        highDropFilter.gain.value = 3.0;

        noiseSource.connect(filter);
        filter.connect(highDropFilter);
        highDropFilter.connect(this.bgGainNode);

        noiseSource.start();

        this.bgProceduralNodes = {
          sources: [noiseSource],
          filters: [filter, highDropFilter],
        };
        break;
      }

      case "cafe": {
        // Cafe: Filtered warm rumble + low frequency hum
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 650;
        filter.Q.value = 0.8;

        const subOsc = ctx.createOscillator();
        subOsc.type = "sine";
        subOsc.frequency.value = 110;
        const subGain = ctx.createGain();
        subGain.gain.value = 0.08;

        subOsc.connect(subGain);
        subGain.connect(this.bgGainNode);

        noiseSource.connect(filter);
        filter.connect(this.bgGainNode);

        noiseSource.start();
        subOsc.start();

        this.bgProceduralNodes = {
          sources: [noiseSource, subOsc],
          filters: [filter],
          gains: [subGain],
        };
        break;
      }

      case "lofi": {
        // Lo-Fi Chill: Soft synth chord drone + vinyl noise
        const osc1 = ctx.createOscillator();
        osc1.type = "triangle";
        osc1.frequency.value = 220; // A3

        const osc2 = ctx.createOscillator();
        osc2.type = "sine";
        osc2.frequency.value = 277.18; // C#4

        const osc3 = ctx.createOscillator();
        osc3.type = "sine";
        osc3.frequency.value = 329.63; // E4

        const lofiFilter = ctx.createBiquadFilter();
        lofiFilter.type = "lowpass";
        lofiFilter.frequency.value = 850;

        const chordGain = ctx.createGain();
        chordGain.gain.value = 0.12;

        osc1.connect(chordGain);
        osc2.connect(chordGain);
        osc3.connect(chordGain);
        chordGain.connect(lofiFilter);
        lofiFilter.connect(this.bgGainNode);

        // Vinyl crackle noise
        const vinylFilter = ctx.createBiquadFilter();
        vinylFilter.type = "highpass";
        vinylFilter.frequency.value = 3000;

        const vinylGain = ctx.createGain();
        vinylGain.gain.value = 0.03;

        noiseSource.connect(vinylFilter);
        vinylFilter.connect(vinylGain);
        vinylGain.connect(this.bgGainNode);

        osc1.start();
        osc2.start();
        osc3.start();
        noiseSource.start();

        this.bgProceduralNodes = {
          sources: [noiseSource, osc1, osc2, osc3],
          filters: [lofiFilter, vinylFilter],
          gains: [chordGain, vinylGain],
        };
        break;
      }

      case "forest": {
        // Forest: Wind noise sweep + periodic gentle bird chirp
        const windFilter = ctx.createBiquadFilter();
        windFilter.type = "bandpass";
        windFilter.frequency.value = 400;
        windFilter.Q.value = 1.2;

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.2;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 200;

        lfo.connect(lfoGain);
        lfoGain.connect(windFilter.frequency);

        noiseSource.connect(windFilter);
        windFilter.connect(this.bgGainNode);

        noiseSource.start();
        lfo.start();

        this.bgProceduralNodes = {
          sources: [noiseSource, lfo],
          filters: [windFilter],
          gains: [lfoGain],
        };
        break;
      }

      case "city": {
        // City Night: Sub bass traffic rumble + lowpass noise
        const cityFilter = ctx.createBiquadFilter();
        cityFilter.type = "lowpass";
        cityFilter.frequency.value = 280;

        const rumbleOsc = ctx.createOscillator();
        rumbleOsc.type = "sine";
        rumbleOsc.frequency.value = 55;

        const rumbleGain = ctx.createGain();
        rumbleGain.gain.value = 0.15;

        rumbleOsc.connect(rumbleGain);
        rumbleGain.connect(this.bgGainNode);

        noiseSource.connect(cityFilter);
        cityFilter.connect(this.bgGainNode);

        noiseSource.start();
        rumbleOsc.start();

        this.bgProceduralNodes = {
          sources: [noiseSource, rumbleOsc],
          filters: [cityFilter],
          gains: [rumbleGain],
        };
        break;
      }

      case "cosmic": {
        // Cosmic Space: Sine pad chord + chorus slow sweeps
        const pad1 = ctx.createOscillator();
        pad1.type = "sine";
        pad1.frequency.value = 146.83; // D3

        const pad2 = ctx.createOscillator();
        pad2.type = "sine";
        pad2.frequency.value = 220.0; // A3

        const cosmicFilter = ctx.createBiquadFilter();
        cosmicFilter.type = "lowpass";
        cosmicFilter.frequency.value = 600;

        const padGain = ctx.createGain();
        padGain.gain.value = 0.18;

        pad1.connect(padGain);
        pad2.connect(padGain);
        padGain.connect(cosmicFilter);
        cosmicFilter.connect(this.bgGainNode);

        pad1.start();
        pad2.start();

        this.bgProceduralNodes = {
          sources: [pad1, pad2],
          filters: [cosmicFilter],
          gains: [padGain],
        };
        break;
      }
    }
  }

  private clearFilterNodes() {
    if (this.filterNodes.oscillators) {
      this.filterNodes.oscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      });
    }

    if (this.filterNodes.gains) {
      this.filterNodes.gains.forEach((g) => {
        try {
          g.disconnect();
        } catch (e) {}
      });
    }

    if (this.filterNodes.filters) {
      this.filterNodes.filters.forEach((f) => {
        try {
          f.disconnect();
        } catch (e) {}
      });
    }

    if (this.filterNodes.delays) {
      this.filterNodes.delays.forEach((d) => {
        try {
          d.disconnect();
        } catch (e) {}
      });
    }

    this.filterNodes = {};
  }

  private clearBackgroundNodes() {
    if (this.bgAudioEl) {
      try {
        this.bgAudioEl.pause();
        this.bgAudioEl.src = "";
      } catch (e) {}
      this.bgAudioEl = null;
    }

    if (this.bgSourceNode) {
      try {
        this.bgSourceNode.disconnect();
      } catch (e) {}
      this.bgSourceNode = null;
    }

    if (this.bgProceduralNodes.sources) {
      this.bgProceduralNodes.sources.forEach((s) => {
        try {
          if ("stop" in s) s.stop();
          s.disconnect();
        } catch (e) {}
      });
    }

    if (this.bgProceduralNodes.filters) {
      this.bgProceduralNodes.filters.forEach((f) => {
        try {
          f.disconnect();
        } catch (e) {}
      });
    }

    if (this.bgProceduralNodes.gains) {
      this.bgProceduralNodes.gains.forEach((g) => {
        try {
          g.disconnect();
        } catch (e) {}
      });
    }

    if (this.bgGainNode) {
      try {
        this.bgGainNode.disconnect();
      } catch (e) {}
      this.bgGainNode = null;
    }

    this.bgProceduralNodes = {};
  }

  private cleanupNodes() {
    this.clearFilterNodes();
    this.clearBackgroundNodes();

    if (this.monitorGainNode) {
      try {
        this.monitorGainNode.disconnect();
      } catch (e) {}
      this.monitorGainNode = null;
    }

    if (this.micGainNode) {
      try {
        this.micGainNode.disconnect();
      } catch (e) {}
      this.micGainNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch (e) {}
      this.sourceNode = null;
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }

    this.rawStream = null;
    this.outputStream = null;
    this.destinationNode = null;
  }

  public destroy() {
    this.cleanupNodes();
  }
}

// Global singleton instance for app-wide voice effects manager
export const globalVoiceProcessor = new VoiceProcessorEngine();
