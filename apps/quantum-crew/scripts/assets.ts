// pnpm --filter @moth-hack/quantum-crew assets
// Checklist for the Atlas assets: which files are in src/assets/atlas/, which are still placeholders, which have
// no params for the credits yet, and anything git would refuse (gitignored types) or that's too big for the repo.
import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ATLAS_ASSETS } from "../src/assets/atlas/list.ts";

const DIR = fileURLToPath(new URL("../src/assets/atlas/", import.meta.url));
const MEDIA = /\.(png|jpe?g|webp|gif|svg|mp4|webm|mp3|ogg|wav|m4a)$/i;
const GITIGNORED = new Set([".mp4", ".wav", ".mov", ".aiff", ".heic"]);
const MAX_BYTES = 5 * 1024 * 1024;

const files = readdirSync(DIR).filter((f) => MEDIA.test(f) || f === "entanglement-lut.json");
const byKey = new Map(files.map((f) => [f === "entanglement-lut.json" ? "entanglement-reveal" : f.replace(/\.[^.]+$/, ""), f]));
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(2)} MB`;

let present = 0;
const notes: string[] = [];
for (const a of ATLAS_ASSETS) {
  const file = byKey.get(a.key);
  const engine = `${a.engine}${a.engineId ? ` (${a.engineId})` : ""}`;
  if (!file) {
    console.log(`  ·  ${a.key.padEnd(20)} missing → ${a.placeholder} placeholder   expected e.g. ${a.file}   [${engine}]`);
    continue;
  }
  present++;
  const size = statSync(join(DIR, file)).size;
  console.log(`  ✓  ${a.key.padEnd(20)} ${file} (${mb(size)})   [${engine}]${a.params ? "" : "   ⚠ no params for credits"}`);
  if (GITIGNORED.has(extname(file).toLowerCase())) notes.push(`${file}: this type is gitignored at the repo root; convert it (png/webp/webm/mp3) or add an exception.`);
  if (size > MAX_BYTES) notes.push(`${file}: over 5 MB; keep repo assets small (compress or shorten).`);
}
for (const [key, f] of byKey) if (!ATLAS_ASSETS.some((a) => a.key === key)) notes.push(`${f}: not in the manifest (name it after a key).`);

console.log(`\n${present}/${ATLAS_ASSETS.length} Atlas assets present.`);
for (const n of notes) console.log(`⚠ ${n}`);
