import { SIZE } from "../config.ts";

export interface Prepared {
  blob: Blob;
  url: string;
}

/**
 * Photo → SIZE×SIZE centre-cropped square, re-encoded through a canvas. That fixes EXIF rotation
 * (createImageBitmap applies it), turns HEIC/WebP into PNG/JPEG (Moth assets accept only those),
 * and makes portrait, home and mask the same size, as Teleblur requires.
 */
export async function prepareSquare(file: Blob, type: "image/png" | "image/jpeg"): Promise<Prepared> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("unreadable");
  }
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bmp.close();
  const blob = await toBlob(canvas, type, 0.9);
  return { blob, url: URL.createObjectURL(blob) };
}

export function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), type, quality),
  );
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  await img.decode();
  return img;
}

/** Pixels of an image at SIZE×SIZE. */
export async function pixels(src: string): Promise<Uint8ClampedArray> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  return ctx.getImageData(0, 0, SIZE, SIZE).data;
}
