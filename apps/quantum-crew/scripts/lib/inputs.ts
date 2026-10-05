// Input art for the Atlas engines, drawn in code so it's ours and reproducible: a 64×36 pixel-art station and a
// 64×32 crew sprite (Table A helmet left, Table B right). Tessa takes at most 64×64 pixels on a simulator.
import { deflateSync } from "node:zlib";

type RGB = [number, number, number];

// No parameter properties: Node runs these scripts with type stripping only.
export class Canvas {
  readonly px: RGB[];
  readonly w: number;
  readonly h: number;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = Array.from({ length: w * h }, () => [...bg] as RGB);
  }
  set(x: number, y: number, c: RGB) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: RGB) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c);
  }
  /** Ring (or disc with inner = 0) by distance from the pixel centre; `keep` can drop angles (dashes). */
  ring(cx: number, cy: number, inner: number, outer: number, c: RGB, keep: (angle: number) => boolean = () => true) {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d >= inner && d <= outer && keep(Math.atan2(y + 0.5 - cy, x + 0.5 - cx))) this.set(x, y, c);
      }
  }
  /** Encodes as an 8-bit RGB PNG. */
  png(): Buffer {
    const raw = Buffer.alloc((this.w * 3 + 1) * this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) raw.set(this.px[y * this.w + x]!, y * (this.w * 3 + 1) + 1 + x * 3);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.w, 0);
    ihdr.writeUInt32BE(this.h, 4);
    ihdr.set([8, 2, 0, 0, 0], 8);
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type: string, data: Buffer) {
  const t = Buffer.concat([Buffer.from(type), data]);
  let c = 0xffffffff;
  for (const b of t) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  t.copy(out, 4);
  out.writeUInt32BE((c ^ 0xffffffff) >>> 0, 8 + data.length);
  return out;
}

// Palette (matches src/tokens.css)
const BG: RGB = [10, 14, 19];
const STEEL: RGB = [74, 94, 116];
const STEEL_DARK: RGB = [44, 58, 74];
const PANEL: RGB = [27, 37, 49];
const AMBER: RGB = [255, 182, 39];
const GREEN: RGB = [57, 229, 140];
const CYAN: RGB = [94, 231, 255];
const STAR: RGB = [157, 176, 196];
const INK: RGB = [238, 243, 248];

// 3×5 pixel letters
const GLYPHS: Record<string, string[]> = {
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
};
function letter(c: Canvas, ch: string, x: number, y: number, col: RGB) {
  GLYPHS[ch]!.forEach((row, dy) => [...row].forEach((bit, dx) => bit === "1" && c.set(x + dx, y + dy, col)));
}

/** The station: a ring with a glowing core, spokes, and the Table A / Table B sections at either end. */
export function stationInput(): Buffer {
  const c = new Canvas(64, 36, BG);
  for (const [x, y] of [[5, 4], [58, 3], [49, 31], [12, 30], [24, 2], [40, 33], [61, 20], [2, 18]] as const) c.set(x, y, STAR);
  c.rect(14, 17, 19, 18, STEEL); // spokes to the sections
  c.rect(44, 17, 49, 18, STEEL);
  c.rect(31, 2, 32, 5, STEEL);
  c.rect(31, 30, 32, 33, STEEL);
  c.ring(32, 18, 11, 12.6, STEEL);
  c.ring(32, 18, 8.2, 9.2, STEEL_DARK, (a) => Math.floor(((a + Math.PI) / (2 * Math.PI)) * 16) % 2 === 0);
  c.ring(32, 18, 0, 4.2, AMBER);
  c.ring(32, 18, 4.2, 5.2, [140, 100, 20]);
  for (const [x0, ch] of [[3, "A"], [50, "B"]] as const) {
    c.rect(x0, 13, x0 + 10, 22, GREEN);
    c.rect(x0 + 1, 14, x0 + 9, 21, PANEL);
    letter(c, ch, x0 + 4, 15, INK);
  }
  return c.png();
}

/** Two crew helmets in a 64×32 sprite: Table A (amber) on the left, Table B (cyan) on the right. */
export function crewInput(): Buffer {
  const c = new Canvas(64, 32, BG);
  for (const [ox, col] of [[0, AMBER], [32, CYAN]] as const) {
    const cx = ox + 16;
    c.ring(cx, 26 + 9, 11, 13, col, (a) => a < 0); // shoulders
    c.ring(cx, 14, 9.5, 11.5, col); // helmet
    c.ring(cx, 14, 0, 9.5, PANEL);
    c.rect(cx - 6, 11, cx + 5, 16, col); // visor
    c.rect(cx - 4, 12, cx - 2, 13, INK); // glint
  }
  return c.png();
}
