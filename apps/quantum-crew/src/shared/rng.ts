// Seedable RNG so tests, the sim script and server rounds can be replayed exactly.

/** Returns a float in [0, 1). */
export type Rng = () => number;

/** mulberry32: a tiny, fast 32-bit PRNG. Good enough for a game, not for cryptography. */
export function mulberry32(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Unseeded RNG for live play. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}
