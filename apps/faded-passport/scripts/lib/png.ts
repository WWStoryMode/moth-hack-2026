// Tiny PNG codec for the Node scripts (no image library): 8-bit, non-interlaced, which is what
// browsers' canvas.toBlob and Teleblur produce.
import { deflateSync, inflateSync } from "node:zlib";

export interface Rgba {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel. */
  data: Uint8Array;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function isPng(b: Uint8Array): boolean {
  return Buffer.from(b.subarray(0, 8)).equals(SIGNATURE);
}

/** Encode RGB (3 bytes/px) or RGBA (4 bytes/px). */
export function encodePng(width: number, height: number, pixels: Uint8Array, channels: 3 | 4 = 4): Buffer {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) raw.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  const chunk = (type: string, data: Buffer) => {
    const td = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    td.copy(out, 4);
    out.writeUInt32BE(crc32(td), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, channels === 4 ? 6 : 2, 0, 0, 0], 8);
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Decode to RGBA. Supports grey, grey+alpha, RGB, RGBA at 8 bits, no interlace. */
export function decodePng(file: Uint8Array): Rgba {
  const b = Buffer.from(file);
  if (!isPng(b)) throw new Error("not a PNG");
  let i = 8;
  let width = 0, height = 0, colorType = 0;
  const idat: Buffer[] = [];
  while (i < b.length) {
    const len = b.readUInt32BE(i);
    const type = b.toString("latin1", i + 4, i + 8);
    const data = b.subarray(i + 8, i + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const depth = data[8]!;
      colorType = data[9]!;
      if (depth !== 8 || data[12] !== 0) throw new Error("only 8-bit non-interlaced PNGs are supported");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    i += 12 + len;
  }
  const channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 } as Record<number, number>)[colorType];
  if (!channels) throw new Error(`unsupported PNG colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const lines = new Uint8Array(stride * height);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = lines.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[x - channels]! : 0;
      const up = prev[x]!;
      const c = x >= channels ? prev[x - channels]! : 0;
      let v = line[x]!;
      if (filter === 1) v += a;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (a + up) >> 1;
      else if (filter === 4) {
        const p = a + up - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      out[x] = v & 0xff;
    }
    prev = out;
  }
  const data = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const s = p * channels;
    const grey = channels <= 2;
    data[p * 4] = lines[s]!;
    data[p * 4 + 1] = grey ? lines[s]! : lines[s + 1]!;
    data[p * 4 + 2] = grey ? lines[s]! : lines[s + 2]!;
    data[p * 4 + 3] = channels === 4 ? lines[s + 3]! : channels === 2 ? lines[s + 1]! : 255;
  }
  return { width, height, data };
}
