let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

const msgAudioCache: HTMLAudioElement[] = [];

export function playMessageSound() {
  try {
    const audio = new Audio("/audio/discord_sound.mp3");
    audio.volume = 0.8;
    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch(() => {
        // Fallback to Web Audio synth if HTML5 play() is blocked
        playSynthMessageSound();
      });
    }
  } catch (e) {
    playSynthMessageSound();
  }
}

export function playJoinSound() {
  try {
    const audio = new Audio("/audio/discord-join.mp3");
    audio.volume = 0.8;
    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch(() => {
        playSynthJoinSound();
      });
    }
  } catch (e) {
    playSynthJoinSound();
  }
}

export function playLeaveSound() {
  try {
    const audio = new Audio("/audio/LockChime.mp3");
    audio.volume = 0.8;
    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch(() => {
        playSynthLeaveSound();
      });
    }
  } catch (e) {
    playSynthLeaveSound();
  }
}

function playSynthJoinSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(783.99, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.5);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (e) {}
}

function playSynthLeaveSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.17);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.5);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (e) {}
}

function playSynthMessageSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.4);
  } catch (e) {}
}
