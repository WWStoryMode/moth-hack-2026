// pnpm --filter @moth-hack/quantum-crew bake-shader
// Turns the Atlas Entanglement Shader output (atlas-src/entanglement-shader/<job>/, from entanglement-shader-v1) into
// src/assets/atlas/entanglement-lut.json, which the browser renders with a WebGL port of the engine's own GLSL.
// The engine bakes its quantum simulation into two lookup tables, R_lut and T_lut (reflectance and transmittance of a
// stack of thin conducting layers, by light phase × incident angle). We only decode them; no values are changed.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../atlas-src/entanglement-shader/", import.meta.url));
const OUT = fileURLToPath(new URL("../src/assets/atlas/entanglement-lut.json", import.meta.url));

const jobs = existsSync(SRC) ? readdirSync(SRC).filter((d) => existsSync(join(SRC, d, "R_lut.hdr"))) : [];
if (jobs.length !== 1) {
  console.error(`Expected one engine output folder with R_lut.hdr in atlas-src/entanglement-shader/, found ${jobs.length}.`);
  process.exit(1);
}
const job = jobs[0]!;

/** Decodes a Radiance .hdr (RGBE, new-style RLE) into rows of the red channel. The LUTs are grey (R = G = B). */
function readHdr(path: string): { width: number; height: number; rows: number[][] } {
  const b = readFileSync(path);
  let i = b.indexOf("\n\n") + 2;
  const j = b.indexOf("\n", i);
  const [yAxis, h, xAxis, w] = b.subarray(i, j).toString().split(" ");
  if (yAxis !== "-Y" || xAxis !== "+X") throw new Error(`Unexpected HDR orientation in ${path}`);
  const width = Number(w);
  const height = Number(h);
  i = j + 1;
  const rows: number[][] = [];
  for (let y = 0; y < height; y++) {
    const ch = [0, 1, 2, 3].map(() => new Array<number>(width).fill(0));
    if (b[i] === 2 && b[i + 1] === 2) {
      i += 4;
      for (let c = 0; c < 4; c++) {
        for (let x = 0; x < width; ) {
          let n = b[i++]!;
          if (n > 128) {
            n -= 128;
            const v = b[i++]!;
            while (n--) ch[c]![x++] = v;
          } else {
            while (n--) ch[c]![x++] = b[i++]!;
          }
        }
      }
    } else {
      for (let x = 0; x < width; x++) for (let c = 0; c < 4; c++) ch[c]![x] = b[i++]!;
    }
    rows.push(ch[0]!.map((r, x) => (ch[3]![x] === 0 ? 0 : r * 2 ** (ch[3]![x]! - 136))));
  }
  return { width, height, rows };
}

const r = readHdr(join(SRC, job, "R_lut.hdr"));
const t = readHdr(join(SRC, job, "T_lut.hdr"));
// Row 0 is θ = 0 (normal incidence) and the last row θ = π/2, as the engine's shader expects (no vertical flip).
const flat = (rows: number[][]) => rows.flat().map((v) => Math.round(v * 1e5) / 1e5);
writeFileSync(
  OUT,
  JSON.stringify({ engine: "entanglement-shader-v1", job, width: r.width, height: r.height, R: flat(r.rows), T: flat(t.rows) }) + "\n",
);
console.log(`Baked ${job}: ${r.width}×${r.height} R and T lookup tables → src/assets/atlas/entanglement-lut.json`);
