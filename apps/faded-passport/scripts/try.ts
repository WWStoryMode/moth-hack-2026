// pnpm --filter @moth-hack/faded-passport try [--years 10] [portrait.png home.png mask.png]
//
// One live TeleBlur run (1 credit) through the SAME server code the app uses
// (submit → status → result → cleanup), without a browser. With no files given it
// generates synthetic 512² test images. Saves the morph + provenance to output/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import { MothApiError, buildProvenance, createClient, writeProvenance } from "@moth-hack/atlas-client";
import { SIZE } from "../src/config.ts";
import type { SubmitResponse } from "../server/telablur.ts";
import { result, status, submit } from "../server/telablur.ts";
import { handle } from "../server/http.ts";
import { readTicket } from "../server/ticket.ts";

const OUT = fileURLToPath(new URL("../output/", import.meta.url));
const args = process.argv.slice(2);
const yi = args.indexOf("--years");
const years = yi >= 0 ? Number(args[yi + 1]) : 10;
const files = args.filter((a, i) => !a.startsWith("--") && i !== yi + 1);

// ─── synthetic inputs: warm "face" disc on grey, cool striped "home", soft disc mask ───
function png(w: number, h: number, px: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) raw.set(px(x, y), y * (w * 3 + 1) + 1 + x * 3);
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(t));
    return Buffer.concat([len, t, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const c = SIZE / 2;
const dist = (x: number, y: number) => Math.hypot(x - c, y - c * 0.9);
const inputs = files.length === 3
  ? files.map((f) => ({ name: basename(f), bytes: readFileSync(f) }))
  : [
      { name: "portrait.png", bytes: png(SIZE, SIZE, (x, y) => (dist(x, y) < 150 ? [225, 170, 130] : [90, 90, 100])) },
      { name: "home.png", bytes: png(SIZE, SIZE, (x, y) => (Math.floor(y / 32) % 2 ? [40, 110, 170] : [230, 220, 190])) },
      { name: "mask.png", bytes: png(SIZE, SIZE, (x, y) => { const v = Math.round(255 * Math.min(1, Math.max(0, (170 - dist(x, y)) / 20))); return [v, v, v]; }) },
    ];

mkdirSync(OUT, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
if (files.length !== 3) for (const i of inputs) writeFileSync(join(OUT, `${stamp}-input-${i.name}`), i.bytes);

// ─── run through the real handlers ───
const form = new FormData();
form.set("years", String(years));
form.set("image1", new Blob([inputs[0]!.bytes], { type: "image/png" }), inputs[0]!.name);
form.set("image2", new Blob([inputs[1]!.bytes], { type: "image/png" }), inputs[1]!.name);
form.set("mask", new Blob([inputs[2]!.bytes], { type: "image/png" }), inputs[2]!.name);

const t0 = Date.now();
const sub = await handle(() => submit(new Request("http://local/api/submit", { method: "POST", body: form })));
if (sub.status !== 202) throw new Error(`submit → ${sub.status} ${await sub.text()}`);
const { ticket, jobId, params } = (await sub.json()) as SubmitResponse;
console.log(`job ${jobId}  params`, params);

for (;;) {
  const r = await handle(() => status(new Request(`http://local/api/status?ticket=${ticket}`)));
  const s = (await r.json()) as { status: string; failure?: string };
  process.stdout.write(`  ${s.status} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  if (s.status === "completed") break;
  if (s.status === "failed" || s.status === "cancelled") throw new Error(`job ${s.status} ${s.failure ?? ""}`);
  await new Promise((r) => setTimeout(r, 2000));
}
const res = await handle(() => result(new Request(`http://local/api/result?ticket=${ticket}`)));
if (!res.ok) throw new Error(`result → ${res.status} ${await res.text()}`);
const outFile = join(OUT, `${stamp}-telablur-y${years}.png`);
writeFileSync(outFile, Buffer.from(await res.arrayBuffer()));
const t = readTicket(ticket);
await writeProvenance(
  outFile,
  buildProvenance({
    engineId: "telablur-v1",
    jobId,
    params,
    options: { input_files: { image1: t.assets[0], image2: t.assets[1], mask: t.assets[2] } },
    submittedAt: new Date(t.iat).toISOString(),
    completedAt: new Date().toISOString(),
  }),
);
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${outFile}`);

// Privacy check: every input asset should now be gone from Moth (GET → 404).
const moth = createClient();
for (const id of t.assets) {
  const gone = await moth.request("GET", `/assets/${id}`).then(
    () => false,
    (e) => e instanceof MothApiError && e.status === 404,
  );
  console.log(`  asset ${id.slice(0, 8)}… deleted: ${gone ? "yes" : "NO"}`);
}
