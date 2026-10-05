// pnpm --filter @moth-hack/quantum-crew gen-assets (tsx: the atlas-client uses syntax Node can't strip)
// [--dry-run] [--only key,key] [--force] [--machine fake_fez] [--blur-source drawn]
//
// Makes the station and crew art with Atlas engines (1 credit per job, 7 jobs for everything):
//  - Tessa (tessa-image-v1) encodes our 64×64-max pixel art onto quantum circuits and measures it back. On a
//    `fake_<chip>` machine the circuits run on a simulator with a real IBM chip's noise, so the art comes back with
//    genuine quantum-hardware wear.
//  - Quantum Blur (blur-v1) puts the Tessa station's pixel brightness into a quantum state and rotates every qubit.
//    More rotation = the picture smears into interference echoes = a station losing stability (levels 4 → 0).
// Inputs are drawn in code (scripts/lib/inputs.ts) and saved to atlas-src/inputs/. Each result lands in
// src/assets/atlas/<key>.png with <key>.png.provenance.json (engine, job id, params) for the credits screen; raw
// downloads stay in output/ (gitignored). Existing assets are skipped (no credits spent) unless --force.
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { MothApiError, MothJobError, createClient, loadEnv, writeProvenance } from "@moth-hack/atlas-client";
import { crewInput, stationInput } from "./lib/inputs.ts";

const APP = fileURLToPath(new URL("../", import.meta.url));
const ASSETS = join(APP, "src/assets/atlas");
const INPUTS = join(APP, "atlas-src/inputs");
const OUTPUT = join(APP, "output/atlas");

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const dryRun = flag("dry-run");
const force = flag("force");
const only = value("only")?.split(",");
const machine = (value("machine") ?? "fake_fez") as "fake_fez";
// --blur-source drawn: blur our drawn station directly (e.g. when Tessa is unavailable) instead of the Tessa output.
const blurFromDrawn = value("blur-source") === "drawn";

type Job = {
  key: string;
  engine: "tessa-image-v1" | "blur-v1";
  /** Path of the input image (may be produced by an earlier job). */
  input: string;
  params: Record<string, unknown>;
};

// Stability level → blur strength (0 = unchanged, 1 = maximum blur, per the engine docs).
const BLUR: [level: number, strength: number][] = [
  [4, 0.05],
  [3, 0.25],
  [2, 0.45],
  [1, 0.7],
  [0, 1.0],
];

const JOBS: Job[] = [
  { key: "station-base", engine: "tessa-image-v1", input: join(INPUTS, "station.png"), params: { machine, shots: 4096 } },
  { key: "crew-icons", engine: "tessa-image-v1", input: join(INPUTS, "crew.png"), params: { machine, shots: 4096 } },
  ...BLUR.map(
    ([level, strength]): Job => ({
      key: `station-stability-${level}`,
      engine: "blur-v1",
      // Blur the quantum-encoded station, or the drawn one with --blur-source drawn.
      input: blurFromDrawn ? join(INPUTS, "station.png") : join(ASSETS, "station-base.png"),
      params: { strength, reach: 0, style: "rx" },
    }),
  ),
];

mkdirSync(INPUTS, { recursive: true });
writeFileSync(join(INPUTS, "station.png"), stationInput());
writeFileSync(join(INPUTS, "crew.png"), crewInput());

const todo = JOBS.filter((j) => (!only || only.includes(j.key)) && (force || !existsSync(join(ASSETS, `${j.key}.png`))));
const skipped = JOBS.filter((j) => (!only || only.includes(j.key)) && !todo.includes(j));
for (const j of skipped) console.log(`skip  ${j.key} (already in src/assets/atlas; --force to redo)`);
for (const j of todo) console.log(`${dryRun ? "plan" : "run "}  ${j.key.padEnd(20)} ${j.engine.padEnd(15)} ${JSON.stringify(j.params)}`);
console.log(`${todo.length} job(s), ≈ ${todo.length} credit(s).`);
if (dryRun || todo.length === 0) process.exit(0);

loadEnv(APP);
const moth = createClient();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

for (const job of todo) {
  if (!existsSync(job.input)) {
    console.error(`✗ ${job.key}: input ${job.input} missing (run station-base first).`);
    process.exitCode = 1;
    continue;
  }
  const t0 = Date.now();
  try {
    const upload = await moth.uploadAsset(job.input, { contentType: "image/png" });
    const run = await moth.run(job.engine, job.params as never, {
      submit: { input_files: { image: upload.asset_id } } as never,
      wait: {
        timeoutMs: 30 * 60_000,
        intervalMs: 3000,
        onStatus: (s) => console.log(`      ${job.key}: ${s.status}`),
      },
    });
    const dir = join(OUTPUT, stamp, job.key);
    const files = await moth.downloadOutputs(run.provenance.jobId, dir, run.provenance);
    const png = files.find((f) => !f.endsWith(".provenance.json"));
    if (!png) throw new Error("job finished without an output file");
    const dest = join(ASSETS, `${job.key}.png`);
    copyFileSync(png, dest);
    await writeProvenance(dest, run.provenance);
    await moth.deleteAsset(upload.asset_id).catch(() => {}); // tidy the input upload; the output stays
    console.log(`✓ ${job.key}  job ${run.provenance.jobId}  ${((Date.now() - t0) / 1000).toFixed(0)} s → src/assets/atlas/${job.key}.png`);
  } catch (e) {
    process.exitCode = 1;
    const why = e instanceof MothJobError || e instanceof MothApiError ? e.message : String(e);
    console.error(`✗ ${job.key}: ${why}`);
    // Blur levels need the station; stop rather than spend credits on jobs that will fail.
    if (job.key === "station-base") break;
  }
}
