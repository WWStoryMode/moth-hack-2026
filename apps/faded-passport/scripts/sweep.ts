// pnpm --filter @moth-hack/faded-passport sweep <inputs.zip | folder> [--years 1-40] [--concurrency 4] [--yes] [--dry-run]
//
// Runs TeleBlur for many "years" on the SAME portrait, home and mask: the files saved by the
// ?debug "Download inputs" button on the home step. Each year uses exactly the strength and size
// the app would send (telablurParams in src/config.ts). 1 credit per year; asks before starting.
//
// Writes output/sweep-<time>/: yNN.png (+ .provenance.json), summary.json, summary.csv,
// contact-sheet.png. Uploads the inputs once and deletes everything from Moth at the end.
//
// --years accepts ranges, steps and lists: "1-40", "5-40:5", "1,5-40:5", "1,10,20,30,40".
// --dry-run skips Moth entirely (no credits): the portrait stands in for every output.
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { buildProvenance, createClient, loadEnv, writeProvenance, type MothClient } from "../server/atlas.ts";
import { checkImage, type CheckedFile } from "../server/guards.ts";
import { ENGINE, SIZE, YEARS, telablurParams, type TelablurParams } from "../src/config.ts";
import { maskedChangeFromPixels, reasonFor } from "../src/lib/change.ts";
import { decodePng, encodePng, isPng } from "./lib/png.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const VALUE_FLAGS = new Set(["--years", "--concurrency"]);
const inputPath = args.find((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1] ?? ""));
const dryRun = args.includes("--dry-run");
if (!inputPath) {
  console.error("Usage: pnpm --filter @moth-hack/faded-passport sweep <inputs.zip | folder> [--years 1-40] [--concurrency 4] [--yes]");
  process.exit(1);
}
const years = parseYears(opt("--years") ?? `${YEARS.min}-${YEARS.max}`);
const concurrency = Math.max(1, Math.min(8, Number(opt("--concurrency") ?? 4)));

// 3×5 pixel font for tile labels.
const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "001", "001", "001"],
  "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
  ".": ["000", "000", "000", "000", "010"], Y: ["101", "101", "010", "010", "010"],
  I: ["111", "010", "010", "010", "111"], N: ["101", "111", "111", "101", "101"], " ": ["000", "000", "000", "000", "000"],
};

// ─── inputs ───────────────────────────────────────────────────────────────────────
const files = readInputs(inputPath);
const need = (re: RegExp, label: string) => {
  const hit = [...files.keys()].find((n) => re.test(n));
  if (!hit) throw new Error(`${label} not found in ${inputPath} (expected ${re})`);
  return files.get(hit)!;
};
const portraitBytes = need(/^portrait\.(png|jpe?g)$/i, "portrait");
const homeBytes = need(/^home\.(png|jpe?g)$/i, "home");
const maskBytes = need(/^mask\.png$/i, "mask");
const outlineBytes = files.get("outline.png");
const [portrait, home, mask] = await Promise.all([
  checkImage(new File([portraitBytes], "portrait"), "portrait"),
  checkImage(new File([homeBytes], "home"), "home"),
  checkImage(new File([maskBytes], "mask"), "mask", { pngOnly: true }),
]);

console.log(`Inputs: ${inputPath} (${SIZE}×${SIZE} portrait, home, mask${outlineBytes ? ", outline" : ""})`);
console.log(`Years:  ${years.join(", ")}`);
console.log(
  dryRun
    ? "Cost:   0 (dry run: no Moth calls)"
    : `Cost:   ${years.length} TeleBlur run${years.length === 1 ? "" : "s"} = ${years.length} credit${years.length === 1 ? "" : "s"}`,
);
if (!dryRun && !args.includes("--yes")) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question("Continue? [y/N] ");
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) process.exit(0);
}

// ─── run ──────────────────────────────────────────────────────────────────────────
if (!process.env.MOTH_API_KEY) loadEnv();
const moth = dryRun ? (undefined as unknown as MothClient) : createClient();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join(fileURLToPath(new URL("../output/", import.meta.url)), `sweep-${stamp}${dryRun ? "-dry" : ""}`);
mkdirSync(outDir, { recursive: true });
for (const [name, bytes] of files) writeFileSync(join(outDir, `input-${name}`), bytes);

interface Row {
  years: number;
  params: TelablurParams;
  jobId?: string;
  file?: string;
  change?: number;
  reason?: string;
  seconds?: number;
  error?: string;
}
const rows: Row[] = years.map((y) => ({ years: y, params: telablurParams(y) }));
const assetIds: string[] = [];
let cleaned = false;
async function cleanup() {
  if (cleaned || dryRun) return;
  cleaned = true;
  await Promise.allSettled(assetIds.map((id) => moth.deleteAsset(id)));
}
process.on("SIGINT", () => {
  console.log("\nInterrupted: deleting uploaded inputs from Moth…");
  cleanup().finally(() => process.exit(130));
});

const portraitPx = isPng(portraitBytes) ? decodePng(portraitBytes).data : undefined;
const outlinePx = outlineBytes && isPng(outlineBytes) ? decodePng(outlineBytes).data : undefined;
const t0 = Date.now();

try {
  const up = (f: CheckedFile, name: string) =>
    moth.uploadAssetBytes(f.bytes, { filename: `${name}.${f.contentType === "image/png" ? "png" : "jpg"}`, contentType: f.contentType });
  const [a1, a2, am] = dryRun
    ? [{ asset_id: "dry-image1" }, { asset_id: "dry-image2" }, { asset_id: "dry-mask" }]
    : await Promise.all([up(portrait, "portrait"), up(home, "home"), up(mask, "mask")]);
  if (!dryRun) assetIds.push(a1.asset_id, a2.asset_id, am.asset_id);
  const inputFiles = { image1: a1.asset_id, image2: a2.asset_id, mask: am.asset_id };
  console.log(`Uploaded inputs once (${((Date.now() - t0) / 1000).toFixed(1)}s). Running ${concurrency} at a time…\n`);

  let done = 0;
  await pool(rows, concurrency, async (row) => {
    const start = Date.now();
    try {
      await (dryRun ? dryYear(row, inputFiles) : runYear(moth, row, inputFiles));
    } catch (e) {
      row.error = e instanceof Error ? e.message.split("\n")[0] : String(e);
    }
    row.seconds = Math.round((Date.now() - start) / 100) / 10;
    done++;
    const p = row.params;
    console.log(
      `  [${String(done).padStart(2)}/${rows.length}] ${String(row.years).padStart(2)}y  strength ${p.strength.toFixed(3)}  size ${String(p.size).padStart(3)}  ` +
        (row.error ? `FAILED: ${row.error}` : `change ${row.change?.toFixed(3) ?? "—"} (${row.reason ?? "—"})  ${row.seconds}s`),
    );
  });
} finally {
  await cleanup();
}

async function dryYear(row: Row, inputFiles: Record<string, string>) {
  row.jobId = `dry-run-${row.years}`;
  const file = join(outDir, `y${String(row.years).padStart(2, "0")}.png`);
  writeFileSync(file, portraitBytes);
  row.file = basename(file);
  const now = new Date().toISOString();
  await writeProvenance(file, buildProvenance({ engineId: ENGINE, jobId: row.jobId, params: row.params, options: { input_files: inputFiles }, submittedAt: now, completedAt: now }));
  if (portraitPx && outlinePx) {
    row.change = maskedChangeFromPixels(portraitPx, portraitPx, outlinePx);
    row.reason = reasonFor(row.change);
  }
}

async function runYear(m: MothClient, row: Row, inputFiles: Record<string, string>) {
  const sub = await m.submitJob(ENGINE, row.params, { input_files: inputFiles as { image1: string; image2: string; mask: string } });
  row.jobId = sub.job_id;
  const st = await m.waitForJob(sub.job_id, { intervalMs: 3000, timeoutMs: 10 * 60_000 });
  const res = await m.getResult(sub.job_id);
  const out = res.outputs?.find((o) => o.slot === "result") ?? res.outputs?.[0];
  if (!out?.url) throw new Error("no output image");
  const img = await fetch(out.url); // presigned: no auth header
  if (!img.ok) throw new Error(`output download failed (${img.status})`);
  const bytes = new Uint8Array(await img.arrayBuffer());
  const file = join(outDir, `y${String(row.years).padStart(2, "0")}.png`);
  writeFileSync(file, bytes);
  row.file = basename(file);
  await writeProvenance(
    file,
    buildProvenance({
      engineId: ENGINE,
      jobId: sub.job_id,
      params: row.params,
      options: { input_files: inputFiles },
      submittedAt: sub.submitted_at,
      completedAt: st.updated_at,
    }),
  );
  await m.deleteAsset(out.output_asset_id).catch(() => undefined);
  if (portraitPx && outlinePx && isPng(bytes)) {
    row.change = maskedChangeFromPixels(portraitPx, decodePng(bytes).data, outlinePx);
    row.reason = reasonFor(row.change);
  }
}

// ─── summary + contact sheet ──────────────────────────────────────────────────────
writeFileSync(join(outDir, "summary.json"), JSON.stringify({ engine: ENGINE, inputs: inputPath, rows }, null, 2) + "\n");
writeFileSync(
  join(outDir, "summary.csv"),
  ["years,strength,size,change,reason,seconds,job_id,file,error"]
    .concat(rows.map((r) => [r.years, r.params.strength, r.params.size, r.change?.toFixed(4) ?? "", r.reason ?? "", r.seconds ?? "", r.jobId ?? "", r.file ?? "", r.error ?? ""].join(",")))
    .join("\n") + "\n",
);
const ok = rows.filter((r) => r.file);
if (ok.length && portraitPx) {
  const tiles = [{ label: "IN", px: portraitPx }].concat(
    ok.map((r) => ({ label: `${r.years}Y ${r.params.strength.toFixed(2)}`, px: decodePng(readFileSync(join(outDir, r.file!))).data })),
  );
  writeFileSync(join(outDir, "contact-sheet.png"), contactSheet(tiles));
}
const failed = rows.filter((r) => r.error).length;
console.log(`\nDone in ${((Date.now() - t0) / 1000).toFixed(0)}s: ${ok.length} ok${failed ? `, ${failed} failed` : ""}.${dryRun ? " (dry run)" : " Inputs deleted from Moth."}`);
console.log(`→ ${outDir}`);

// ─── helpers ──────────────────────────────────────────────────────────────────────
function parseYears(spec: string): number[] {
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const m = /^(\d+)(?:-(\d+))?(?::(\d+))?$/.exec(part.trim());
    if (!m) throw new Error(`bad --years part "${part}"`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    const step = m[3] ? Number(m[3]) : 1;
    for (let y = a; y <= b; y += step) out.add(y);
  }
  const list = [...out].sort((x, y) => x - y);
  if (!list.length || list.some((y) => y < YEARS.min || y > YEARS.max)) throw new Error(`years must be ${YEARS.min}–${YEARS.max}`);
  return list;
}

/** Folder, or a stored (uncompressed) zip as written by the debug button. */
function readInputs(path: string): Map<string, Uint8Array> {
  const map = new Map<string, Uint8Array>();
  if (!existsSync(path)) throw new Error(`${path} not found`);
  if (statSync(path).isDirectory()) {
    for (const n of readdirSync(path)) if (statSync(join(path, n)).isFile()) map.set(n, readFileSync(join(path, n)));
    return map;
  }
  const b = readFileSync(path);
  let i = 0;
  while (i + 30 <= b.length && b.readUInt32LE(i) === 0x04034b50) {
    const method = b.readUInt16LE(i + 8);
    const size = b.readUInt32LE(i + 18);
    const nameLen = b.readUInt16LE(i + 26);
    const extraLen = b.readUInt16LE(i + 28);
    const name = b.toString("utf8", i + 30, i + 30 + nameLen);
    const start = i + 30 + nameLen + extraLen;
    if (method !== 0) throw new Error(`${name} is compressed; unzip it and pass the folder instead`);
    map.set(basename(name), b.subarray(start, start + size));
    i = start + size;
  }
  if (!map.size) throw new Error(`${path} is not a folder or a zip from the debug button`);
  return map;
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]!);
    }),
  );
}

function contactSheet(tiles: { label: string; px: Uint8Array }[]): Buffer {
  const cell = 128;
  const bar = 18;
  const gap = 4;
  const cols = Math.min(8, tiles.length);
  const rowsN = Math.ceil(tiles.length / cols);
  const W = cols * cell + (cols + 1) * gap;
  const H = rowsN * (cell + bar) + (rowsN + 1) * gap;
  const out = new Uint8Array(W * H * 3).fill(0xef); // paper-ish background
  const f = SIZE / cell;
  tiles.forEach((t, k) => {
    const ox = gap + (k % cols) * (cell + gap);
    const oy = gap + Math.floor(k / cols) * (cell + bar + gap);
    for (let y = 0; y < cell; y++)
      for (let x = 0; x < cell; x++) {
        const acc = [0, 0, 0];
        for (let dy = 0; dy < f; dy++)
          for (let dx = 0; dx < f; dx++) {
            const s = ((y * f + dy) * SIZE + (x * f + dx)) * 4;
            acc[0]! += t.px[s]!; acc[1]! += t.px[s + 1]!; acc[2]! += t.px[s + 2]!;
          }
        const d = ((oy + y) * W + ox + x) * 3;
        out[d] = acc[0]! / (f * f); out[d + 1] = acc[1]! / (f * f); out[d + 2] = acc[2]! / (f * f);
      }
    let cx = ox + 2;
    for (const ch of t.label) {
      const g = GLYPHS[ch] ?? GLYPHS[" "]!;
      for (let gy = 0; gy < 5; gy++)
        for (let gx = 0; gx < 3; gx++)
          if (g[gy]![gx] === "1")
            for (let sy = 0; sy < 2; sy++)
              for (let sx = 0; sx < 2; sx++) {
                const d = ((oy + cell + 4 + gy * 2 + sy) * W + cx + gx * 2 + sx) * 3;
                out[d] = 0x2b; out[d + 1] = 0x2a; out[d + 2] = 0x28;
              }
      cx += 8;
    }
  });
  return encodePng(W, H, out, 3);
}
