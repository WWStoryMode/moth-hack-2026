// Pure pixel maths for the verdict: no DOM, so the sweep script (Node) uses the exact same code.
// All inputs are RGBA pixel arrays of SIZE×SIZE: the portrait sent, the morph that came back,
// the home photo sent, and the drawn face outline (white = face).
import { SIZE, VERDICT } from "../config.ts";

export type ReasonKey = "granted" | "place" | "address" | "noMatch";

export interface Verdict {
  accepted: boolean;
  reason: ReasonKey;
  /** 0–1: does the face still have the portrait's structure? (outline-weighted SSIM) */
  likeness: number;
  /** 0 = closer to the portrait, 1 = closer to the home photo (inside the outline) */
  homeness: number;
}

/**
 * Entry is granted while the face is still recognisable; otherwise the refusal reason says how
 * far it has gone toward home. Thresholds: VERDICT in config.ts (from the 1–40 year sweeps).
 */
export function verdict(portrait: ArrayLike<number>, morph: ArrayLike<number>, home: ArrayLike<number>, outline: ArrayLike<number>): Verdict {
  const l = likeness(portrait, morph, outline);
  const h = homeness(portrait, morph, home, outline);
  const reason: ReasonKey =
    l >= VERDICT.acceptLikeness ? "granted" : h >= VERDICT.placeHomeness ? "place" : h >= VERDICT.addressHomeness ? "address" : "noMatch";
  return { accepted: reason === "granted", reason, likeness: l, homeness: h };
}

const F = 4; // SSIM on a 4× downsampled (128×128) luminance image
const M = SIZE / F;
const R = 4; // 9×9 window

function luma(px: ArrayLike<number>): Float64Array {
  const out = new Float64Array(M * M);
  for (let y = 0; y < M; y++)
    for (let x = 0; x < M; x++) {
      let s = 0;
      for (let dy = 0; dy < F; dy++)
        for (let dx = 0; dx < F; dx++) {
          const i = ((y * F + dy) * SIZE + x * F + dx) * 4;
          s += 0.2126 * px[i]! + 0.7152 * px[i + 1]! + 0.0722 * px[i + 2]!;
        }
      out[y * M + x] = s / (F * F);
    }
  return out;
}

/** Structural similarity (SSIM) of the face region: high while eyes, nose, mouth keep their shape. */
export function likeness(portrait: ArrayLike<number>, morph: ArrayLike<number>, outline: ArrayLike<number>): number {
  const a = luma(portrait);
  const b = luma(morph);
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  let sum = 0;
  let wsum = 0;
  for (let y = R; y < M - R; y += 2)
    for (let x = R; x < M - R; x += 2) {
      const w = outline[(y * F * SIZE + x * F) * 4]! / 255;
      if (w < 0.5) continue;
      let ma = 0, mb = 0;
      const n = (2 * R + 1) ** 2;
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) { ma += a[(y + j) * M + x + i]!; mb += b[(y + j) * M + x + i]!; }
      ma /= n;
      mb /= n;
      let va = 0, vb = 0, cov = 0;
      for (let j = -R; j <= R; j++)
        for (let i = -R; i <= R; i++) {
          const da = a[(y + j) * M + x + i]! - ma;
          const db = b[(y + j) * M + x + i]! - mb;
          va += da * da;
          vb += db * db;
          cov += da * db;
        }
      va /= n;
      vb /= n;
      cov /= n;
      sum += (w * ((2 * ma * mb + C1) * (2 * cov + C2))) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      wsum += w;
    }
  return wsum ? sum / wsum : 1;
}

/** Inside the outline: distance to the portrait ÷ (distance to the portrait + distance to home). */
export function homeness(portrait: ArrayLike<number>, morph: ArrayLike<number>, home: ArrayLike<number>, outline: ArrayLike<number>): number {
  let dp = 0, dh = 0;
  for (let i = 0; i < portrait.length; i += 4) {
    const w = outline[i]! / 255;
    if (!w) continue;
    let a = 0, b = 0;
    for (let c = 0; c < 3; c++) {
      a += (morph[i + c]! - portrait[i + c]!) ** 2;
      b += (morph[i + c]! - home[i + c]!) ** 2;
    }
    dp += w * Math.sqrt(a);
    dh += w * Math.sqrt(b);
  }
  return dp + dh ? dp / (dp + dh) : 0;
}
