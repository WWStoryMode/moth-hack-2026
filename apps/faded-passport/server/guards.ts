// Input checks for the public proxy: every play spends real credits, so only accept exactly
// what the app produces — three SIZE×SIZE PNG/JPEG files and an integer year count.
import { MAX_FILE_BYTES, SIZE, YEARS } from "../src/config.ts";
import { HttpError } from "./http.ts";

type FormValue = ReturnType<FormData["get"]>;

export interface CheckedFile {
  bytes: Uint8Array;
  contentType: "image/png" | "image/jpeg";
}

export function assertOpen(): void {
  if (process.env.SUBMISSIONS_OPEN === "false") {
    throw new HttpError(503, "closed", "The border is closed for now");
  }
}

export function checkYears(value: FormValue): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < YEARS.min || n > YEARS.max) {
    throw new HttpError(422, "invalid", `years must be an integer ${YEARS.min}–${YEARS.max}`);
  }
  return n;
}

export async function checkImage(
  value: FormValue,
  field: string,
  opts: { pngOnly?: boolean } = {},
): Promise<CheckedFile> {
  if (!(value instanceof Blob)) throw new HttpError(422, "invalid", `${field} is missing`);
  if (value.size > MAX_FILE_BYTES) throw new HttpError(422, "invalid", `${field} is too large`);
  const bytes = new Uint8Array(await value.arrayBuffer());
  const info = sniff(bytes);
  if (!info || (opts.pngOnly && info.type !== "image/png")) {
    throw new HttpError(422, "invalid", `${field} must be ${opts.pngOnly ? "PNG" : "PNG or JPEG"}`);
  }
  if (info.w !== SIZE || info.h !== SIZE) {
    throw new HttpError(422, "invalid", `${field} must be ${SIZE}×${SIZE} (got ${info.w}×${info.h})`);
  }
  return { bytes, contentType: info.type };
}

/** Type and pixel size from the PNG/JPEG header (the declared MIME type is not trusted). */
function sniff(b: Uint8Array): { type: CheckedFile["contentType"]; w: number; h: number } | null {
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length > 24 && view.getUint32(0) === 0x89504e47) {
    return { type: "image/png", w: view.getUint32(16), h: view.getUint32(20) };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1]!;
      // SOF0–SOF15 carry the frame size (C4/C8/CC are other markers).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { type: "image/jpeg", h: view.getUint16(i + 5), w: view.getUint16(i + 7) };
      }
      i += 2 + view.getUint16(i + 2);
    }
  }
  return null;
}
