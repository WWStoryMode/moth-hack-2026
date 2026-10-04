// The entry document: the Challenge 01 image. Everything is drawn on one canvas so the
// download is a single PNG carrying the morph AND the exact Teleblur parameters used.
import { ENGINE, type TelablurParams } from "../config.ts";
import { S } from "../strings.ts";
import { loadImage, toBlob } from "./image.ts";
import { maskLabel } from "./mask.ts";
import { ageTextures } from "./ageTextures.ts";
import { hintInk, stageFor } from "./ageing.ts";
import { FLAGS } from "./flags.ts";
import { inkTexture } from "./inkTexture.ts";
import { cssVar } from "./tokens.ts";

export interface DocumentInput {
  morphUrl: string;
  /** The drawn face outline: on the permit, only this region is left untreated (display only). */
  outlineUrl: string;
  homeUrl: string;
  years: number;
  reason: string;
  jobId: string;
  params: TelablurParams;
  date?: Date;
}

const W = 1240;
const H = 1754; // ≈ A4 ratio
// Colours and fonts come from the design tokens (src/tokens.css), read when the permit is drawn.
let INK = "", FAINT = "", PAPER = "", RED = "", MAT = "", MRZ_BG = "", FIBRE = "", SERIF = "", MONO = "", OCR = "";
let STAMP_ALPHA = 0.86, AGE = 0;
function readTokens() {
  INK = cssVar("--ink", "#2b2a28");
  FAINT = cssVar("--ink-muted", "#8a8272");
  PAPER = cssVar("--paper", "#efe6d2");
  RED = cssVar("--stamp", "#b3261e");
  MAT = cssVar("--photo-mat", "#fff");
  MRZ_BG = cssVar("--mrz-bg", "#f6f1e4");
  FIBRE = cssVar("--fibre", "90, 70, 40");
  SERIF = cssVar("--serif", "Georgia, serif");
  MONO = cssVar("--mono", "monospace");
  OCR = cssVar("--ocr", MONO);
  // ?age=all: lib/ageing.ts has already set the aged colours above; these two drive the rest.
  AGE = FLAGS.age === "all" ? Number(cssVar("--age", "0")) || 0 : 0;
  STAMP_ALPHA = FLAGS.age === "all" ? Number(cssVar("--stamp-opacity", "0.86")) || 0.86 : 0.86;
}

export async function composeDocument(d: DocumentInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  readTokens();
  // The MRZ font must be loaded before the canvas draws with it (falls back to mono if it can't load).
  await document.fonts?.load(`30px ${OCR}`).catch(() => undefined);
  const [morph, home, outline] = await Promise.all([loadImage(d.morphUrl), loadImage(d.homeUrl), loadImage(d.outlineUrl)]);
  const date = d.date ?? new Date();

  // Paper: flat colour, faint fibres, guilloche-ish border lines.
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${FIBRE},${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1);
  }
  if (FLAGS.age === "all") ageThePaper(ctx, d.years);
  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  // Header.
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.font = `600 30px ${SERIF}`;
  ctx.fillText(S.bureau.toUpperCase(), W / 2, 120);
  ctx.font = `italic 24px ${SERIF}`;
  ctx.fillStyle = FAINT;
  ctx.fillText(S.form, W / 2, 158);
  ctx.fillStyle = INK;
  ctx.font = `700 64px ${SERIF}`;
  ctx.fillText(S.document.heading.toUpperCase(), W / 2, 250);
  rule(ctx, 290);

  // Photos.
  const ph = 500;
  const pw = Math.round((ph * 35) / 45); // passport ratio 35:45
  photo(ctx, passportPhoto(morph, outline, pw, ph), 90 + (ph - pw) / 2, 340, pw, ph, S.document.bearer);
  photo(ctx, home, W - 90 - ph, 340, ph, ph, S.document.destination);

  // Fields.
  ctx.textAlign = "left";
  let y = 980;
  const field = (label: string, value: string, valueInk = INK) => {
    ctx.fillStyle = FAINT;
    ctx.font = `bold 26px ${MONO}`;
    ctx.fillText(label.toUpperCase(), 110, y);
    ctx.fillStyle = valueInk;
    ctx.font = `32px ${SERIF}`;
    wrap(ctx, value, 110, y + 44, W - 220, 40);
    y += 118;
  };
  // ?age=hint: the years are written in ink that has faded with them (clamped to stay AA-readable).
  field(S.document.yearsAbsent, S.intro.years(d.years), FLAGS.age === "hint" ? hintInk(d.years) : INK);
  field(S.document.date, date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
  field(S.document.decision, S.document.stamp);
  field(S.document.reason, d.reason);

  stamp(ctx, W - 330, 1140, d.years);

  // Parameter strip: human-readable line + machine-readable (MRZ-style) zone.
  rule(ctx, 1462);
  const p = d.params;
  ctx.fillStyle = FAINT;
  ctx.font = `19px ${MONO}`;
  const lines = wrapSegments(
    ctx,
    [S.document.processedBy, ENGINE, `strength ${p.strength}`, `size ${p.size}`, `direction ${p.direction}`,
      `downscale ${p.downscale}`, `mask_bin_size ${p.mask_bin_size}`, `mask_min_region ${p.mask_min_region}`, "simulator", maskLabel()],
    W - 180,
  );
  lines.push(`job ${d.jobId}`); // always its own line, so it can never run past the frame
  lines.slice(0, 4).forEach((l, i) => ctx.fillText(l, 90, 1490 + i * 25));
  ctx.fillStyle = MRZ_BG;
  ctx.fillRect(60, 1592, W - 120, 118);
  ctx.fillStyle = INK;
  const mrz = (s: string) => s.toUpperCase().replace(/[^A-Z0-9.]/g, "<").padEnd(58, "<").slice(0, 58);
  const mrzLines = [
    mrz(`P<${ENGINE}<<STRENGTH<${p.strength}<SIZE<${p.size}<DIR<${p.direction}`),
    mrz(`DS<${p.downscale ? 1 : 0}<MB<${p.mask_bin_size}<MR<${p.mask_min_region}<Y<${d.years}<JOB<${d.jobId.replace(/-/g, "")}`),
  ];
  // Fit the fixed-width MRZ to the band, whatever font actually loaded (OCR-B or the mono fallback).
  ctx.font = `30px ${OCR}`;
  const fit = Math.min(30, (30 * (W - 180)) / Math.max(...mrzLines.map((l) => ctx.measureText(l).width)));
  ctx.font = `${fit.toFixed(1)}px ${OCR}`;
  mrzLines.forEach((l, i) => ctx.fillText(l, 90, 1640 + i * 48));

  return toBlob(canvas, "image/png");
}

function rule(ctx: CanvasRenderingContext2D, y: number) {
  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(90, y);
  ctx.lineTo(W - 90, y);
  ctx.stroke();
}

function photo(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number, label: string) {
  ctx.fillStyle = MAT;
  ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
  ctx.drawImage(img, x, y, w, h);
  ctx.strokeStyle = FAINT;
  ctx.strokeRect(x - 10, y - 10, w + 20, h + 20);
  ctx.fillStyle = FAINT;
  ctx.font = `bold 24px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillText(label.toUpperCase(), x + w / 2, y + h + 46);
}

/** The ENTRY DENIED stamp, inked through the same speckle texture as the on-screen stamps. */
function stamp(target: CanvasRenderingContext2D, cx: number, cy: number, years: number) {
  const layer = document.createElement("canvas");
  layer.width = 560;
  layer.height = 380;
  const ctx = layer.getContext("2d")!;
  ctx.translate(layer.width / 2, layer.height / 2);
  ctx.rotate(-0.21);
  ctx.strokeStyle = RED;
  ctx.fillStyle = RED;
  ctx.lineWidth = 8;
  ctx.strokeRect(-210, -95, 420, 190);
  ctx.lineWidth = 3;
  ctx.strokeRect(-194, -79, 388, 158);
  ctx.textAlign = "center";
  ctx.font = `900 64px ${SERIF}`;
  ctx.fillText(S.document.stamp.toUpperCase(), 0, 8, 360);
  ctx.font = `bold 26px ${MONO}`;
  ctx.fillText(`${years} YR${years === 1 ? "" : "S"} ABSENT`, 0, 56);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = ctx.createPattern(inkTexture(), "repeat")!;
  ctx.fillRect(0, 0, layer.width, layer.height);
  target.save();
  target.globalAlpha = STAMP_ALPHA;
  target.drawImage(layer, cx - layer.width / 2, cy - layer.height / 2);
  target.restore();
}

/**
 * The bearer's photo as printed on the permit: centre-cropped to w×h (35:45) with a light sepia,
 * except inside the drawn outline, where the Teleblur-processed face keeps its true colour.
 * Done in pixels (not ctx.filter) so it looks the same in Safari.
 */
function passportPhoto(morph: HTMLImageElement, outline: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  const sw = (morph.naturalHeight * w) / h; // crop width in source pixels
  const sx = (morph.naturalWidth - sw) / 2;
  ctx.drawImage(outline, sx, 0, sw, outline.naturalHeight, 0, 0, w, h);
  const m = ctx.getImageData(0, 0, w, h).data;
  ctx.drawImage(morph, sx, 0, sw, morph.naturalHeight, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const p = img.data;
  const amount = 0.45 + 0.45 * AGE; // matches --photo-treatment (stronger sepia as the document ages)
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i]!, g = p[i + 1]!, b = p[i + 2]!;
    const sr = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
    const sg = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
    const sb = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
    const t = amount * (1 - m[i]! / 255); // no treatment inside the outline
    p[i] = r + (sr - r) * t;
    p[i + 1] = g + (sg - g) * t;
    p[i + 2] = b + (sb - b) * t;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * ?age=all: the same ageing as on screen, drawn under the ink. Grain and edge shading scale with
 * --age; foxing, the coffee ring and the crease switch on by stage. The text colours were already
 * clamped for AA against this darkest paper by lib/ageing.ts.
 */
function ageThePaper(ctx: CanvasRenderingContext2D, years: number) {
  const t = ageTextures();
  const stage = stageFor(years);
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.8 * AGE;
  ctx.fillStyle = ctx.createPattern(t.grain, "repeat")!;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  // Edges darken first, like the on-screen inset shadow.
  const edge = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) / 2);
  edge.addColorStop(0, "rgba(96, 66, 24, 0)");
  edge.addColorStop(1, `rgba(96, 66, 24, ${0.3 * AGE})`);
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);
  if (stage !== "fresh") ctx.drawImage(t.foxing, 0, 0, W, H);
  if (stage === "stained" || stage === "creased") ctx.drawImage(t.coffee, W - 560, 120, 520, 520);
  if (stage === "creased") ctx.drawImage(t.crease, 0, 0, W, H);
  ctx.restore();
}

/** Join segments with " · ", breaking lines only between segments so no value is split. */
function wrapSegments(ctx: CanvasRenderingContext2D, segments: string[], maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const seg of segments) {
    const test = line ? `${line} · ${seg}` : seg;
    if (line && ctx.measureText(test).width > maxW) {
      out.push(line);
      line = seg;
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number) {
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lh;
    } else line = test;
  }
  ctx.fillText(line, x, y);
}
