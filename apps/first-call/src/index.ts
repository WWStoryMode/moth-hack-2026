// First call: flip a quantum coin with the coin-toss-v1 engine.
//
// ─── The quantum idea ────────────────────────────────────────────────────────────────
// A qubit starts in state |0⟩ (think "tails"). The engine's circuit applies one gate,
// the Hadamard (H), which turns |0⟩ into an equal superposition:
//
//     H|0⟩ = (|0⟩ + |1⟩) / √2
//
// The qubit isn't secretly 0 or 1 at that point: both outcomes have amplitude 1/√2.
// Measuring it forces a definite answer, and the probability of each outcome is the
// amplitude squared: (1/√2)² = ½. So each measurement is a fair coin flip.
//
// Why it's random: unlike Math.random(), there is no hidden seed or state that decides
// the outcome — quantum mechanics says the result is fundamentally unpredictable until
// measured. (On the emulator a classical computer simulates this with its own RNG; with
// mode "qpu" it runs on real IBM hardware, where the randomness is physical — plus a bit
// of hardware noise, so real devices may lean slightly away from 50/50.)
//
// "shots" = how many times the circuit is prepared and measured. Each shot is one flip;
// with more shots, heads/tails approaches 50/50 (the law of large numbers).
// ─────────────────────────────────────────────────────────────────────────────────────
import { fileURLToPath } from "node:url";
import { createClient, loadEnv, saveRun, type CoinTossResult, type EngineParams } from "@moth-hack/atlas-client";

const ENGINE = "coin-toss-v1";
// Emulator for speed (seconds, 2 credits). Switch to "qpu" for real hardware (minutes of queue).
const params: EngineParams<typeof ENGINE> = { mode: "emu", shots: 20 };
const OUTPUT_DIR = fileURLToPath(new URL("../output/", import.meta.url));

loadEnv();
const moth = createClient();

console.log(`Submitting ${ENGINE} with`, params);
const run = await moth.run<typeof ENGINE, CoinTossResult>(ENGINE, params, {
  wait: { onStatus: (s) => console.log(`  status: ${s.status}`) },
});

// Save first: inline results expire on the server.
const file = await saveRun(OUTPUT_DIR, run);

const r = run.result;
if (!r) throw new Error(`Job ${run.provenance.jobId} completed without an inline result`);
console.log(`\nJob ${run.provenance.jobId}`);
console.log(`  heads: ${r.heads}  tails: ${r.tails}  (shots: ${r.shots})`);
console.log(`  winner: ${r.output}`);
console.log(`\nSaved to ${file}`);
