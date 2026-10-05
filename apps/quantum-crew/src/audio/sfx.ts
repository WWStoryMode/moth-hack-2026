// Sound effects: the Atlas sound files when present (sfx-alarm / sfx-win / sfx-reveal in src/assets/atlas/),
// else a short Web Audio stand-in. Muting is remembered per device and per context (solo, TV, phone).
import { create } from "zustand";
import { atlasUrl } from "../assets/atlas/manifest.ts";

export type Sfx = "alarm" | "win" | "reveal";
/** Where the sound plays. Defaults: on for solo and the TV (spec), off on event phones so a room isn't a chorus. */
export type SoundContext = "solo" | "tv" | "phone";

const DEFAULT_ON: Record<SoundContext, boolean> = { solo: true, tv: true, phone: false };
const key = (c: SoundContext) => `qc-sound-${c}`;

function load(c: SoundContext): boolean {
  try {
    const v = localStorage.getItem(key(c));
    return v === null ? DEFAULT_ON[c] : v === "on";
  } catch {
    return DEFAULT_ON[c];
  }
}

type SoundStore = {
  on: Record<SoundContext, boolean>;
  toggle(c: SoundContext): void;
};

export const useSound = create<SoundStore>()((set, get) => ({
  on: { solo: load("solo"), tv: load("tv"), phone: load("phone") },
  toggle(c) {
    const next = !get().on[c];
    try {
      localStorage.setItem(key(c), next ? "on" : "off");
    } catch {
      // not remembered; fine
    }
    set({ on: { ...get().on, [c]: next } });
    if (next) unlockAudio();
  },
}));

let ctx: AudioContext | null = null;

/** Browsers only allow audio after a user gesture; call this from one (any tap does it, see installAudioUnlock). */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function installAudioUnlock() {
  const once = () => unlockAudio();
  window.addEventListener("pointerdown", once, { passive: true });
  window.addEventListener("keydown", once);
}

export function playSfx(name: Sfx, where: SoundContext) {
  if (!useSound.getState().on[where]) return;
  const url = atlasUrl(`sfx-${name}`);
  if (url) {
    const audio = new Audio(url);
    audio.volume = name === "alarm" ? 0.6 : 0.8;
    void audio.play().catch(() => {});
    return;
  }
  synth(name);
}

// --- Stand-ins until the Atlas sounds exist ------------------------------------------------------

function tone(c: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, gain: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(c.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function synth(name: Sfx) {
  unlockAudio();
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime;
  if (name === "win") {
    tone(ctx, 660, t, 0.12, "sine", 0.18);
    tone(ctx, 990, t + 0.09, 0.2, "sine", 0.18);
  } else if (name === "alarm") {
    for (let i = 0; i < 3; i++) {
      tone(ctx, 880, t + i * 0.3, 0.14, "square", 0.06);
      tone(ctx, 620, t + i * 0.3 + 0.15, 0.14, "square", 0.06);
    }
  } else {
    // reveal: a rising shimmer of two slightly detuned voices
    [523, 659, 784, 1047, 1319].forEach((f, i) => {
      tone(ctx!, f, t + i * 0.11, 0.9, "sine", 0.09);
      tone(ctx!, f * 1.006, t + i * 0.11, 0.9, "triangle", 0.05);
    });
  }
}
