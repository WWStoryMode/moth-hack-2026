import { describe, expect, it } from "vitest";
import {
  CLASSICAL_LIMIT,
  CLASSICAL_STRATEGIES,
  DIAL_POSITIONS,
  OPTIMAL_TUNING,
  QUANTUM_LIMIT,
  classicalExpectedWinRate,
  classicalStrategyFn,
  isWin,
  quantumExpectedWinRate,
  quantumStrategyFn,
  scoreRound,
  simulate,
  winRate,
  type Bit,
} from "./chsh.ts";
import { mulberry32 } from "./rng.ts";

const BITS: Bit[] = [0, 1];
const N = 200_000;

describe("isWin", () => {
  it("matches (a XOR b) == (x AND y) for all 16 cases", () => {
    const winners: string[] = [];
    for (const x of BITS)
      for (const y of BITS)
        for (const a of BITS)
          for (const b of BITS) if (isWin(x, y, a, b)) winners.push(`${x}${y}${a}${b}`);
    // Valves match unless both lights are RED, then they differ.
    expect(winners).toEqual(["0000", "0011", "0100", "0111", "1000", "1011", "1101", "1110"]);
  });
});

describe("classical strategies", () => {
  it("no deterministic pair beats 75%, and the best reaches exactly 75%", () => {
    const rates = CLASSICAL_STRATEGIES.flatMap((sA) =>
      CLASSICAL_STRATEGIES.map((sB) => classicalExpectedWinRate(sA, sB)),
    );
    expect(rates).toHaveLength(16);
    expect(Math.max(...rates)).toBe(CLASSICAL_LIMIT);
  });

  it("simulate agrees with the exact rate for always-OPEN", () => {
    const open = CLASSICAL_STRATEGIES[0]!;
    const { winRate } = simulate(classicalStrategyFn(open, open), N, mulberry32(1));
    expect(winRate).toBeCloseTo(0.75, 2);
  });
});

describe("quantum strategy", () => {
  it("the optimal tuning reaches cos²(π/8) ≈ 0.854 exactly in expectation", () => {
    expect(quantumExpectedWinRate(OPTIMAL_TUNING.A, OPTIMAL_TUNING.B)).toBeCloseTo(QUANTUM_LIMIT, 12);
    expect(QUANTUM_LIMIT).toBeCloseTo(0.8536, 4);
  });

  it.each(["A", "B", undefined] as const)("simulate gives 0.854 ± 0.005 (first measurer: %s)", (order) => {
    const { winRate } = simulate(quantumStrategyFn(OPTIMAL_TUNING.A, OPTIMAL_TUNING.B, order), N, mulberry32(2));
    expect(Math.abs(winRate - 0.854)).toBeLessThan(0.005);
  });

  it("no dial combination on the 22.5° grid beats the Tsirelson bound", () => {
    let best = 0;
    for (const ag of DIAL_POSITIONS)
      for (const ar of DIAL_POSITIONS)
        for (const bg of DIAL_POSITIONS)
          for (const br of DIAL_POSITIONS)
            best = Math.max(best, quantumExpectedWinRate({ greenDeg: ag, redDeg: ar }, { greenDeg: bg, redDeg: br }));
    expect(best).toBeCloseTo(QUANTUM_LIMIT, 12);
  });
});

describe("no-signalling", () => {
  // Whatever B dials, and whoever measures first, each player's own valve is a fair coin.
  const bTunings = [
    OPTIMAL_TUNING.B,
    { greenDeg: 0, redDeg: 0 },
    { greenDeg: 90, redDeg: 45 },
    { greenDeg: 157.5, redDeg: 67.5 },
  ];
  it.each(bTunings.flatMap((b) => (["A", "B"] as const).map((order) => [b, order] as const)))(
    "marginals stay 0.5 ± 0.005 with B tuned %o, %s first",
    (b, order) => {
      const r = simulate(quantumStrategyFn(OPTIMAL_TUNING.A, b, order), N, mulberry32(3));
      expect(Math.abs(r.aMarginal - 0.5)).toBeLessThan(0.005);
      expect(Math.abs(r.bMarginal - 0.5)).toBeLessThan(0.005);
    },
  );
});

describe("scoring", () => {
  it("a timeout is a loss and is flagged", () => {
    const r = scoreRound(0, 0, 0, null);
    expect(r).toMatchObject({ win: false, timedOut: true });
    expect(scoreRound(0, 0, 1, 1)).toMatchObject({ win: true, timedOut: false });
  });

  it("winRate is the fraction of wins, 0 for no rounds", () => {
    expect(winRate([])).toBe(0);
    expect(winRate([{ win: true }, { win: false }, { win: true }, { win: true }])).toBe(0.75);
  });
});
