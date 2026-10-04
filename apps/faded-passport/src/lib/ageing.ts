// Document ageing for the ?age=all playtest variant (and the faded YEARS ABSENT ink for ?age=hint).
//
// --age (0–1) is the same Teleblur strength computed from the years, so the paper ages exactly as
// much as the photo is morphed. Stages switch textures on at fixed years. Aged colours are computed
// here (not with CSS color-mix) so that (1) every text colour is clamped to WCAG AA against the
// darkest paper it can sit on, and (2) the permit canvas can read plain hex values via cssVar().
import { yearsToStrength } from "../config.ts";
import { FLAGS } from "./flags.ts";

export type Stage = "fresh" | "foxed" | "stained" | "creased";

export function stageFor(years: number): Stage {
  return years >= 25 ? "creased" : years >= 15 ? "stained" : years >= 5 ? "foxed" : "fresh";
}

// ─── colour maths (sRGB hex, WCAG relative luminance) ────────────────────────────────
type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as RGB;
};
const toHex = (c: RGB) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
const mix = (a: RGB, b: RGB, t: number): RGB => [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as RGB;
const lum = (c: RGB) => {
  const l = c.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * l[0]! + 0.7152 * l[1]! + 0.0722 * l[2]!;
};
export const contrast = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

/** Largest t ≤ want (mixing `from` toward `to`) that keeps contrast ≥ min against `bg`. */
function clampMix(from: RGB, to: RGB, want: number, bg: RGB, min: number): number {
  if (contrast(mix(from, to, want), bg) >= min) return want;
  let lo = 0, hi = want;
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2;
    if (contrast(mix(from, to, m), bg) >= min) lo = m;
    else hi = m;
  }
  return lo;
}

// Base tokens (src/tokens.css) and where they drift with age.
const BASE = {
  paper: hex("#e9e7df"),
  ink: hex("#26292a"),
  muted: hex("#575b58"),
  mat: hex("#fbfbf8"),
  mrz: hex("#f3f2ed"),
  desk: hex("#2c3431"),
  glow: hex("#3c4743"),
};
const AGED = {
  paper: hex("#dccb9c"), // yellowed
  ink: hex("#4b3524"), // faded brown
  mat: hex("#efe4c4"),
  desk: hex("#131918"), // darker, colder
  glow: hex("#1f2827"),
};
/** Worst case under text: the edge shading and a stain darken the paper by up to this much. */
const WORST_DARKENING = 0.16;
const AA = 4.5;
const MARGIN = 0.15; // stay a little above the line

export interface AgedPalette {
  age: number;
  stage: Stage;
  paper: string;
  ink: string;
  muted: string;
  mat: string;
  mrz: string;
  desk: string;
  glow: string;
  stampOpacity: number;
  photoTreatment: string;
  /** Contrast of ink / muted text on the darkest paper they can sit on (for the debug label + tests). */
  inkContrast: number;
  mutedContrast: number;
}

export function agedPalette(years: number): AgedPalette {
  const age = yearsToStrength(years);
  const paper = mix(BASE.paper, AGED.paper, 0.6 * age);
  const worst = mix(paper, [0, 0, 0], WORST_DARKENING * age);
  const inkT = clampMix(BASE.ink, AGED.ink, age, worst, AA + MARGIN + 1); // body ink keeps extra headroom
  const ink = mix(BASE.ink, AGED.ink, inkT);
  // Muted text: same brown drift, then darkened toward the ink if the paper got too dark for it.
  let muted = mix(BASE.muted, AGED.ink, 0.35 * age);
  if (contrast(muted, worst) < AA + MARGIN) muted = mix(muted, ink, 1 - clampMix(ink, muted, 1, worst, AA + MARGIN));
  // Stamp ink fades (more patchiness comes from the coarse texture), but its lettering is large text:
  // keep the blended ink ≥ 3:1 (plus margin) against the darkest paper.
  // Both stamp inks: red ENTRY DENIED and green ENTRY GRANTED.
  const INKS = [hex("#a8231c"), hex("#1f5e3a")];
  let stampOpacity = 0.88 - 0.26 * age;
  const weakest = () => Math.min(...INKS.map((c) => contrast(mix(paper, c, stampOpacity), worst)));
  for (let i = 0; i < 40 && weakest() < 3 + MARGIN + 0.05; i++) stampOpacity += 0.01;
  stampOpacity = Math.min(1, stampOpacity);
  return {
    age,
    stage: stageFor(years),
    paper: toHex(paper),
    ink: toHex(ink),
    muted: toHex(muted),
    mat: toHex(mix(BASE.mat, AGED.mat, 0.7 * age)),
    mrz: toHex(mix(BASE.mrz, AGED.paper, 0.45 * age)),
    desk: toHex(mix(BASE.desk, AGED.desk, 0.8 * age)),
    glow: toHex(mix(BASE.glow, AGED.glow, 0.8 * age)),
    stampOpacity: Math.round(stampOpacity * 1000) / 1000,
    photoTreatment: `sepia(${(0.45 + 0.45 * age).toFixed(3)}) saturate(${(0.7 - 0.3 * age).toFixed(3)}) contrast(0.95) brightness(${(1.03 - 0.07 * age).toFixed(3)})`,
    inkContrast: contrast(ink, worst),
    mutedContrast: contrast(muted, worst),
  };
}

/** ?age=hint: YEARS ABSENT on the permit in ink that fades toward the paper, never below AA. */
export function hintInk(years: number): string {
  const age = yearsToStrength(years);
  return toHex(mix(BASE.ink, BASE.paper, clampMix(BASE.ink, BASE.paper, 0.85 * age, BASE.paper, AA + MARGIN)));
}

const VARS = ["--paper", "--ink", "--ink-muted", "--photo-mat", "--mrz-bg", "--desk", "--desk-glow", "--stamp-opacity", "--stamp-backing", "--photo-treatment", "--age"] as const;

/**
 * Apply (or clear, with null) the ageing for the current years. Only ?age=all changes the look;
 * other modes just record --age and the stage (used by the permit for ?age=hint).
 */
export function applyAge(years: number | null): void {
  const root = document.documentElement;
  root.dataset.ageMode = FLAGS.age;
  if (years === null) {
    for (const v of VARS) root.style.removeProperty(v);
    root.dataset.stage = "fresh";
    return;
  }
  root.dataset.stage = stageFor(years);
  root.style.setProperty("--age", String(yearsToStrength(years)));
  if (FLAGS.age !== "all") return;
  const p = agedPalette(years);
  const [r, g, b] = hex(p.paper);
  root.style.setProperty("--paper", p.paper);
  root.style.setProperty("--ink", p.ink);
  root.style.setProperty("--ink-muted", p.muted);
  root.style.setProperty("--photo-mat", p.mat);
  root.style.setProperty("--mrz-bg", p.mrz);
  root.style.setProperty("--desk", p.desk);
  root.style.setProperty("--desk-glow", p.glow);
  root.style.setProperty("--stamp-opacity", String(p.stampOpacity));
  root.style.setProperty("--stamp-backing", `rgba(${r}, ${g}, ${b}, 0.625)`);
  root.style.setProperty("--photo-treatment", p.photoTreatment);
}
