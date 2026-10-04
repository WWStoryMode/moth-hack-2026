// Rubber-stamp ink: a seeded speckle texture rendered ONCE to a small canvas, then reused as a CSS
// mask (--ink-texture) and as a canvas pattern on the permit. No live SVG filters (cheap on iOS).
// Opaque = ink lands; transparent = gaps where the rubber didn't touch the paper.

const SIZE = 256;
let cached: HTMLCanvasElement | undefined;

/** Small deterministic PRNG so every stamp has the same, believable wear. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function inkTexture(): HTMLCanvasElement {
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const ctx = c.getContext("2d")!;
  const rnd = mulberry32(40);
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.globalCompositeOperation = "destination-out";
  // Uneven coverage: soft, faint blotches where less ink transferred.
  for (let i = 0; i < 26; i++) {
    const x = rnd() * SIZE, y = rnd() * SIZE, r = 6 + rnd() * 16;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(0,0,0,${0.25 + rnd() * 0.3})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Small gaps and pinholes.
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.55 + rnd() * 0.45})`;
    ctx.beginPath();
    ctx.arc(rnd() * SIZE, rnd() * SIZE, 0.4 + rnd() * rnd() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // A few dry streaks along the stroke direction.
  ctx.lineCap = "round";
  for (let i = 0; i < 9; i++) {
    const x = rnd() * SIZE, y = rnd() * SIZE, len = 10 + rnd() * 26, a = -0.25 + rnd() * 0.5;
    ctx.strokeStyle = `rgba(0,0,0,${0.35 + rnd() * 0.4})`;
    ctx.lineWidth = 0.6 + rnd() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  return (cached = c);
}

/** Expose the texture to CSS as --ink-texture (call once at startup). */
export function installInkTexture(): void {
  try {
    document.documentElement.style.setProperty("--ink-texture", `url(${inkTexture().toDataURL("image/png")})`);
  } catch {
    // No canvas (very old browser): stamps simply render as solid ink.
  }
}
