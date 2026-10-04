// Ageing textures for ?age=all, each rendered ONCE to a canvas: CSS uses them as data-URL custom
// properties, and the permit canvas draws the same canvases. No live SVG filters (cheap on iOS).
// All are faint and multiply-blended; lib/ageing.ts clamps text colours against the darkest
// paper they can produce.

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w: number, h: number, draw: (ctx: CanvasRenderingContext2D, rnd: () => number) => void, seed: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, mulberry32(seed));
  return c;
}

export interface AgeTextures {
  grain: HTMLCanvasElement;
  foxing: HTMLCanvasElement;
  coffee: HTMLCanvasElement;
  crease: HTMLCanvasElement;
  inkCoarse: HTMLCanvasElement;
}
let cached: AgeTextures | undefined;

export function ageTextures(): AgeTextures {
  if (cached) return cached;
  cached = {
    // Paper grain: fine mottled noise (tiles).
    grain: canvas(200, 200, (ctx, rnd) => {
      const img = ctx.createImageData(200, 200);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 200 + rnd() * 55;
        img.data[i] = v;
        img.data[i + 1] = v * 0.97;
        img.data[i + 2] = v * 0.9;
        img.data[i + 3] = 26 + rnd() * 30;
      }
      ctx.putImageData(img, 0, 0);
    }, 11),
    // Foxing: small rust-brown spots, denser toward the edges (stretched over the page).
    foxing: canvas(600, 800, (ctx, rnd) => {
      for (let i = 0; i < 140; i++) {
        const edge = rnd() < 0.7;
        const x = edge ? (rnd() < 0.5 ? rnd() * 90 : 600 - rnd() * 90) : rnd() * 600;
        const y = rnd() * 800;
        const r = 1 + rnd() * rnd() * 7;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(150, 92, 40, ${0.1 + rnd() * 0.12})`);
        g.addColorStop(1, "rgba(150, 92, 40, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }, 23),
    // Coffee ring: an uneven brown ring with a darker rim, faint fill.
    coffee: canvas(300, 300, (ctx, rnd) => {
      ctx.translate(150, 150);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const r = 112 + i * 3 + rnd() * 4;
        for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
          const rr = r + Math.sin(a * 3 + i) * 4 + (rnd() - 0.5) * 2;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.strokeStyle = `rgba(122, 78, 34, ${0.1 - i * 0.025})`;
        ctx.lineWidth = 5 - i * 1.5;
        ctx.stroke();
      }
      const fill = ctx.createRadialGradient(0, 0, 40, 0, 0, 116);
      fill.addColorStop(0, "rgba(140, 95, 45, 0.015)");
      fill.addColorStop(1, "rgba(140, 95, 45, 0.06)");
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(0, 0, 114, 0, Math.PI * 2);
      ctx.fill();
    }, 37),
    // Crease: a fold across the page (dark valley + light ridge).
    crease: canvas(600, 800, (ctx) => {
      const line = (dx: number, color: string, w: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(0, 470 + dx);
        ctx.bezierCurveTo(200, 455 + dx, 400, 485 + dx, 600, 440 + dx);
        ctx.stroke();
      };
      line(0, "rgba(90, 64, 30, 0.16)", 3);
      line(3, "rgba(255, 252, 240, 0.35)", 2);
      line(-6, "rgba(90, 64, 30, 0.05)", 10);
    }, 41),
    // Coarse ink wear for the stamp (big worn patches), combined with the fine ink texture.
    inkCoarse: canvas(160, 160, (ctx, rnd) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 160, 160);
      ctx.globalCompositeOperation = "destination-out";
      for (let i = 0; i < 18; i++) {
        const x = rnd() * 160, y = rnd() * 160, r = 6 + rnd() * 14;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(0,0,0,${0.4 + rnd() * 0.35})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }, 53),
  };
  return cached;
}

/** Expose the textures to CSS (call once at startup). */
export function installAgeTextures(): void {
  try {
    const t = ageTextures();
    const root = document.documentElement.style;
    root.setProperty("--tex-grain", `url(${t.grain.toDataURL()})`);
    root.setProperty("--tex-foxing", `url(${t.foxing.toDataURL()})`);
    root.setProperty("--tex-coffee", `url(${t.coffee.toDataURL()})`);
    root.setProperty("--tex-crease", `url(${t.crease.toDataURL()})`);
    root.setProperty("--ink-texture-coarse", `url(${t.inkCoarse.toDataURL()})`);
  } catch {
    // No canvas: the document simply doesn't age visually.
  }
}
