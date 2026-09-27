// Tunables for Faded Passport. Shared by the browser (display) and the server (the values
// actually sent to TeleBlur), so the document's parameter strip always matches the job.

export const ENGINE = "telablur-v1" as const;

/** Both images and the mask are cropped to SIZE×SIZE; TeleBlur's `size` (pixel budget per pass) matches. */
export const SIZE = 512;

/** Documented enum: "full" | "vertical" | "horizontal". */
export const DIRECTION = "full" as const;

/** Fixed TeleBlur params (documented defaults). */
export const FIXED_PARAMS = { downscale: true, mask_bin_size: 4, mask_min_region: 16 } as const;

/**
 * The mask sent to TeleBlur. "portrait": the portrait's own luminance, shifted by the drawn outline
 * (black → offset.black, white → offset.white, grey edge in between), clamped to 0–1. So the face
 * morphs strongly but its dark features resist, and bright background areas leak a little home.
 * "outline": just the drawn outline (white face, black elsewhere).
 */
export const MASK = {
  mode: "portrait" as "portrait" | "outline",
  offset: { black: -0.25, white: 0.25 },
  /** Feather width of the drawn outline, px. */
  feather: 16,
};

export const YEARS = { min: 1, max: 40, initial: 10 } as const;

/**
 * Years away → TeleBlur strength (0–1). Log curve: memory fades fast at first, then slowly.
 * ≈ 0.10 @1y · 0.45 @5y · 0.60 @10y · 0.75 @20y · 0.90 @40y. Rounded so the strip shows the exact value sent.
 */
export function yearsToStrength(years: number): number {
  const y = Math.min(YEARS.max, Math.max(YEARS.min, Math.round(years)));
  return Math.round((0.1 + (0.8 * Math.log(y)) / Math.log(YEARS.max)) * 1000) / 1000;
}

export function telablurParams(years: number) {
  return { ...FIXED_PARAMS, direction: DIRECTION, size: SIZE, strength: yearsToStrength(years) };
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
