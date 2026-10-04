// Tunables for Faded Passport. Shared by the browser (display) and the server (the values
// actually sent to Teleblur), so the document's parameter strip always matches the job.

export const ENGINE = "telablur-v1" as const;

/**
 * Both images and the mask are cropped to SIZE×SIZE pixels. (Teleblur's own `size` param is separate:
 * it comes from the years, see yearsToTelablurSize.)
 */
export const SIZE = 512;

/** Documented enum: "full" | "vertical" | "horizontal". */
export const DIRECTION = "full" as const;

/** Fixed Teleblur params (documented defaults). */
export const FIXED_PARAMS = { downscale: true, mask_bin_size: 4, mask_min_region: 16 } as const;

/**
 * The mask sent to Teleblur. "portrait": the portrait's own luminance, adjusted by the drawn outline
 * (outside → range.black, inside → range.white, feathered edge in between), clamped to 0–1.
 * `blend` "multiply": luminance × factor · "add": luminance + offset.
 * Bright areas morph into home; dark features resist. "outline": just the drawn outline.
 */
export const MASK = {
  mode: "portrait" as "portrait" | "outline",
  blend: "multiply" as "multiply" | "add",
  range: { black: 0.5, white: 1.5 },
  /** Feather width of the drawn outline, px. */
  feather: 16,
};

export const YEARS = { min: 1, max: 40, initial: 10 } as const;

/** 0 at YEARS.min → 1 at YEARS.max on a log curve (used by size). */
function yearsCurve(years: number): number {
  const y = Math.min(YEARS.max, Math.max(YEARS.min, Math.round(years)));
  return Math.log(y) / Math.log(YEARS.max);
}

/** strength range (Teleblur schema: 0–1). */
/**
 * Years → strength anchor points (piecewise linear between them; Teleblur's schema allows 0–1).
 * Shaped from the 1–40 year sweeps: strengths 0.13–0.36 and 0.61–0.85 give a muddy mosaic, so the
 * curve crosses them in ~1 year each and spends the years on the ranges that read well:
 * gentle softening (0–0.08), the banded interference (0.36–0.61) and home coming through (0.85–1).
 */
export const STRENGTH_CURVE: readonly (readonly [years: number, strength: number])[] = [
  [1, 0],
  [9, 0.08], // below ~0.10, where the mosaic starts at these years' sizes
  [11, 0.36],
  [25, 0.61],
  [27, 0.85],
  [40, 1],
];

/**
 * Years away → Teleblur strength: how far the selector qubit rotates from "you" toward "home".
 * Follows STRENGTH_CURVE: 0.000 @1y · 0.040 @5y · 0.220 @10y · 0.450 @16y · 0.574 @23y · 0.730 @26y
 * · 0.919 @33y · 1.000 @40y. Rounded so the strip shows the exact value sent.
 */
export function yearsToStrength(years: number): number {
  const y = Math.min(YEARS.max, Math.max(YEARS.min, Math.round(years)));
  const i = Math.max(1, STRENGTH_CURVE.findIndex(([py]) => py >= y));
  const [y0, s0] = STRENGTH_CURVE[i - 1]!;
  const [y1, s1] = STRENGTH_CURVE[i]!;
  const s = s0 + ((s1 - s0) * (y - y0)) / (y1 - y0);
  return Math.round(s * 1000) / 1000;
}

/** Teleblur `size` range (schema: 8–1024). */
export const TELABLUR_SIZE = { atMinYears: 8, atMaxYears: 128 } as const;

/**
 * Years away → Teleblur `size`, its pixel budget per pass. Our 512² region is larger, so with
 * downscale=true Teleblur shrinks it to size×size, morphs it, and scales it back up: small size =
 * blocky morph on few qubits (8 → 8×8 grid, ~7 qubits), 128 → 128×128 grid (~15 qubits).
 * 8 @1y · 60 @5y · 83 @10y · 105 @20y · 128 @40y (log curve).
 */
export function yearsToTelablurSize(years: number): number {
  const { atMinYears: a, atMaxYears: b } = TELABLUR_SIZE;
  return Math.round(a + (b - a) * yearsCurve(years));
}

export function telablurParams(years: number) {
  return { ...FIXED_PARAMS, direction: DIRECTION, size: yearsToTelablurSize(years), strength: yearsToStrength(years) };
}
export type TelablurParams = ReturnType<typeof telablurParams>;

/**
 * Verdict: mean |morphed − portrait| inside the mask, 0–1. Below `medium` → low line, etc.
 * Provisional: the first synthetic test (strength 0.599) measured 0.245. Tune on real photos
 * (the value is logged in the browser console in dev).
 */
export const VERDICT_THRESHOLDS = { medium: 0.1, high: 0.2 } as const;

/** Client polling: docs recommend every 2–5 s. */
export const POLL = { intervalMs: 2000, timeoutMs: 180_000 } as const;

/** Per-file upload cap for the proxy (512² PNG ≈ 0.3–0.6 MB). Vercel's body limit is 4.5 MB total. */
export const MAX_FILE_BYTES = 1_500_000;
