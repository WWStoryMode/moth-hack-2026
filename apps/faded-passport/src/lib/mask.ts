import { SIZE } from "../config.ts";
import { toBlob } from "./image.ts";

export type Point = { x: number; y: number };
export type Stroke = Point[];

/** Moving-average smoothing of a closed loop, so a shaky finger still gives a clean outline. */
export function smooth(points: Stroke, window = 4): Stroke {
  if (points.length < window * 2 + 1) return points;
  const n = points.length;
  return points.map((_, i) => {
    let x = 0;
    let y = 0;
    for (let k = -window; k <= window; k++) {
      const p = points[(i + k + n) % n]!;
      x += p.x;
      y += p.y;
    }
    return { x: x / (window * 2 + 1), y: y / (window * 2 + 1) };
  });
}

/** Shoelace area of a closed loop, as a fraction of the image. */
export function areaFraction(points: Stroke): number {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a / 2) / (SIZE * SIZE);
}

export function tracePath(ctx: CanvasRenderingContext2D, stroke: Stroke, dx = 0): void {
  ctx.moveTo(stroke[0]!.x + dx, stroke[0]!.y);
  for (const p of stroke.slice(1)) ctx.lineTo(p.x + dx, p.y);
  ctx.closePath();
}

/**
 * White-inside / black-outside PNG at SIZE×SIZE with a feathered edge. TeleBlur treats grey as a
 * soft blend (black keeps the portrait, white is fully morphed), so the edge fades instead of cutting.
 * Feathering uses a shadow drawn from an off-canvas copy — shadowBlur works in every browser.
 */
export async function renderMask(strokes: Stroke[], feather = 8): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const off = SIZE * 2;
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = feather * 2;
  ctx.shadowOffsetX = off;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  for (const s of strokes) tracePath(ctx, s, -off);
  ctx.fill("nonzero");
  return toBlob(canvas, "image/png");
}
