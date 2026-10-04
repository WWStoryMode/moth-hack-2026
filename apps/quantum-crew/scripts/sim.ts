// pnpm --filter @moth-hack/quantum-crew sim
// Prints the best classical win rate, the quantum optimum, and the top 5 Entanglement Tool setups on the
// 22.5° dial grid. Rates are exact expectations; the 1,000-round line shows the noise players will see.
import {
  CLASSICAL_STRATEGIES,
  DIAL_POSITIONS,
  OPTIMAL_TUNING,
  QUANTUM_LIMIT,
  classicalExpectedWinRate,
  quantumExpectedWinRate,
  quantumStrategyFn,
  simulate,
  type ClassicalStrategy,
  type TuningConfig,
} from "../src/shared/chsh.ts";
import { mulberry32 } from "../src/shared/rng.ts";

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
const valve = (v: number) => (v === 0 ? "OPEN" : "CLOSED");
const plan = (s: ClassicalStrategy) => `GREEN→${valve(s.onGreen)}, RED→${valve(s.onRed)}`;
const dials = (c: TuningConfig) => `GREEN ${c.greenDeg}°, RED ${c.redDeg}°`;

let bestClassical = { rate: 0, a: CLASSICAL_STRATEGIES[0]!, b: CLASSICAL_STRATEGIES[0]! };
for (const a of CLASSICAL_STRATEGIES)
  for (const b of CLASSICAL_STRATEGIES) {
    const rate = classicalExpectedWinRate(a, b);
    if (rate > bestClassical.rate) bestClassical = { rate, a, b };
  }

const optimal = quantumExpectedWinRate(OPTIMAL_TUNING.A, OPTIMAL_TUNING.B);
const sampled = simulate(quantumStrategyFn(OPTIMAL_TUNING.A, OPTIMAL_TUNING.B), 1000, mulberry32(Date.now()));

const sweep: { rate: number; a: TuningConfig; b: TuningConfig }[] = [];
for (const ag of DIAL_POSITIONS)
  for (const ar of DIAL_POSITIONS)
    for (const bg of DIAL_POSITIONS)
      for (const br of DIAL_POSITIONS) {
        const a = { greenDeg: ag, redDeg: ar };
        const b = { greenDeg: bg, redDeg: br };
        sweep.push({ rate: quantumExpectedWinRate(a, b), a, b });
      }
sweep.sort((p, q) => q.rate - p.rate);
const atOptimum = sweep.filter((s) => Math.abs(s.rate - QUANTUM_LIMIT) < 1e-9).length;

console.log(`Classical best:  ${bestClassical.rate.toFixed(4)}  (A: ${plan(bestClassical.a)} · B: ${plan(bestClassical.b)})`);
console.log(`Quantum optimum: ${optimal.toFixed(4)}  (A: ${dials(OPTIMAL_TUNING.A)} · B: ${dials(OPTIMAL_TUNING.B)})`);
console.log(`Tsirelson bound: ${QUANTUM_LIMIT.toFixed(4)}  = cos²(π/8)`);
console.log(`1,000 sampled rounds at the optimum: ${pct(sampled.winRate)}, A CLOSED ${pct(sampled.aMarginal)}, B CLOSED ${pct(sampled.bMarginal)}`);
console.log(`\nTop 5 of ${sweep.length} dial setups (${atOptimum} reach the optimum):`);
sweep.slice(0, 5).forEach((s, i) => console.log(`  ${i + 1}. ${s.rate.toFixed(4)}  A: ${dials(s.a)} · B: ${dials(s.b)}`));
