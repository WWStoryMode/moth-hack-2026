// Pure pixel maths for the verdict: no DOM, so the sweep script (Node) uses the exact same code.
import { VERDICT_THRESHOLDS } from "../config.ts";

export type ReasonKey = "low" | "medium" | "high";

/**
 * Mean |morphed − portrait| over RGB, weighted by the outline's intensity (so only the drawn face
 * counts), normalised to 0–1. All three are RGBA pixel arrays of the same size.
 */
export function maskedChangeFromPixels(portrait: ArrayLike<number>, morph: ArrayLike<number>, outline: ArrayLike<number>): number {
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < portrait.length; i += 4) {
    const w = outline[i]! / 255;
    if (w === 0) continue;
    const d =
      Math.abs(portrait[i]! - morph[i]!) + Math.abs(portrait[i + 1]! - morph[i + 1]!) + Math.abs(portrait[i + 2]! - morph[i + 2]!);
    sum += (w * d) / 765;
    weight += w;
  }
  return weight ? sum / weight : 0;
}

export function reasonFor(change: number): ReasonKey {
  return change >= VERDICT_THRESHOLDS.high ? "high" : change >= VERDICT_THRESHOLDS.medium ? "medium" : "low";
}
