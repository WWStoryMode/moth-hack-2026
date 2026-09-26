import { VERDICT_THRESHOLDS } from "../config.ts";
import { pixels } from "./image.ts";

export type ReasonKey = "low" | "medium" | "high";

/**
 * How much the quantum morph changed the face: mean |morphed − portrait| over RGB, weighted by
 * the mask (so only the drawn face counts), normalised to 0–1.
 */
export async function maskedChange(portraitUrl: string, morphUrl: string, maskUrl: string): Promise<number> {
  const [a, b, m] = await Promise.all([pixels(portraitUrl), pixels(morphUrl), pixels(maskUrl)]);
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < a.length; i += 4) {
    const w = m[i]! / 255;
    if (w === 0) continue;
    sum += w * (Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!)) / 765;
    weight += w;
  }
  return weight ? sum / weight : 0;
}

export function reasonFor(change: number): ReasonKey {
  return change >= VERDICT_THRESHOLDS.high ? "high" : change >= VERDICT_THRESHOLDS.medium ? "medium" : "low";
}
