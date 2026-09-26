// The entry document: the Challenge 01 image. Everything is drawn on one canvas so the
// download is a single PNG carrying the morph AND the exact TeleBlur parameters used.
import { ENGINE, type TelablurParams } from "../config.ts";
import { S } from "../strings.ts";
import { loadImage, toBlob } from "./image.ts";

export interface DocumentInput {
  morphUrl: string;
  homeUrl: string;
  years: number;
  reason: string;
  jobId: string;
  params: TelablurParams;
  date?: Date;
}

const W = 1240;
const H = 1754; // ≈ A4 ratio
const INK = "#2b2a28";
const FAINT = "#8a8272";
const PAPER = "#efe6d2";
const RED = "#b3261e";
const SERIF = 'Georgia, "Times New Roman", serif';
const MONO = '"Courier New", Courier, monospace';

export async function composeDocument(d: DocumentInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const [morph, home] = await Promise.all([loadImage(d.morphUrl), loadImage(d.homeUrl)]);
  const date = d.date ?? new Date();

  // Paper: flat colour, faint fibres, guilloche-ish border lines.
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(90,70,40,${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1);
  }
  ctx.strokeStyle = FAINT;
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  ctx.lineWidth = 1;
  ctx.strokeRect(52, 52, W - 104, H - 104);

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
  photo(ctx, morph, 90, 340, ph, S.document.bearer);
  photo(ctx, home, W - 90 - ph, 340, ph, S.document.destination);

  // Fields.
  ctx.textAlign = "left";
  let y = 980;
  const field = (label: string, value: string) => {
    ctx.fillStyle = FAINT;
    ctx.font = `20px ${MONO}`;
    ctx.fillText(label.toUpperCase(), 110, y);
    ctx.fillStyle = INK;
    ctx.font = `32px ${SERIF}`;
    wrap(ctx, value, 110, y + 42, W - 220, 40);
    y += 118;
  };
  field(S.document.yearsAbsent, S.intro.years(d.years));
  field(S.document.date, date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }));
  field(S.document.decision, S.document.stamp);
  field(S.document.reason, d.reason);

  stamp(ctx, W - 330, 1140, d.years);

  // Parameter strip: human-readable line + machine-readable (MRZ-style) zone.
  rule(ctx, 1480);
  const p = d.params;
  ctx.fillStyle = FAINT;
  ctx.font = `18px ${MONO}`;
  ctx.fillText(
    `${S.document.processedBy} · ${ENGINE} · strength ${p.strength} · size ${p.size} · direction ${p.direction}`,
    90,
    1515,
  );
  ctx.fillText(
    `downscale ${p.downscale} · mask_bin_size ${p.mask_bin_size} · mask_min_region ${p.mask_min_region} · simulator · job ${d.jobId}`,
    90,
    1542,
  );
  ctx.fillStyle = "#f6f1e4";
  ctx.fillRect(70, 1570, W - 140, 130);
  ctx.fillStyle = INK;
  ctx.font = `bold 30px ${MONO}`;
  const mrz = (s: string) => s.toUpperCase().replace(/[^A-Z0-9.]/g, "<").padEnd(58, "<").slice(0, 58);
  ctx.fillText(mrz(`P<${ENGINE}<<STRENGTH<${p.strength}<SIZE<${p.size}<DIR<${p.direction}`), 90, 1622);
  ctx.fillText(mrz(`DS<${p.downscale ? 1 : 0}<MB<${p.mask_bin_size}<MR<${p.mask_min_region}<Y<${d.years}<JOB<${d.jobId.replace(/-/g, "")}`), 90, 1672);

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

function photo(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number, label: string) {
  ctx.fillStyle = "#fff";
  ctx.fillRect(x - 10, y - 10, size + 20, size + 20);
  ctx.drawImage(img, x, y, size, size);
  ctx.strokeStyle = FAINT;
  ctx.strokeRect(x - 10, y - 10, size + 20, size + 20);
  ctx.fillStyle = FAINT;
  ctx.font = `20px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillText(label.toUpperCase(), x + size / 2, y + size + 46);
}

function stamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, years: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.21);
  ctx.globalAlpha = 0.82;
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
  ctx.restore();
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
