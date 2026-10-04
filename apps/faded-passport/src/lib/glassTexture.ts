// Scratched booth glass: fine light scratches rendered ONCE to a small transparent canvas and
// exposed to CSS as --glass-scratch (no live SVG filters).
let cached: string | undefined;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function installGlassTexture(): void {
  try {
    if (!cached) {
      const size = 320;
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const ctx = c.getContext("2d")!;
      const rnd = mulberry32(7);
      ctx.lineCap = "round";
      // Many fine hairline scratches, mostly in one wiping direction.
      for (let i = 0; i < 70; i++) {
        const x = rnd() * size, y = rnd() * size, len = 8 + rnd() * 50, a = -0.5 + rnd() * 0.5;
        ctx.strokeStyle = `rgba(230,240,235,${0.06 + rnd() * 0.12})`;
        ctx.lineWidth = 0.4 + rnd() * 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 + (rnd() - 0.5) * 6, x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }
      // A few longer, deeper scratches.
      for (let i = 0; i < 5; i++) {
        const x = rnd() * size, y = rnd() * size;
        ctx.strokeStyle = `rgba(240,248,244,${0.16 + rnd() * 0.12})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 60 + rnd() * 90, y - 10 + rnd() * 20);
        ctx.stroke();
      }
      cached = c.toDataURL("image/png");
    }
    document.documentElement.style.setProperty("--glass-scratch", `url(${cached})`);
  } catch {
    // No canvas: plain glass.
  }
}
