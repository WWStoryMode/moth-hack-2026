// The CHSH game (a Bell test as a cooperative game). Two players who can't talk each get a random light
// (x, y) and pick a valve (a, b). They win if (a XOR b) == (x AND y). With only a pre-agreed plan, the best
// they can do is 75%. If they share an entangled pair of qubits (the Bell state |Φ+⟩), each player measures
// their qubit at an angle that depends on their own light. The two results agree with probability
// cos²(θA − θB), which lets them reach cos²(π/8) ≈ 85.4% (the Tsirelson bound). Each player's own results
// stay a 50/50 coin flip whatever the partner does, so the shared qubits can't carry a message.
//
// Pure logic: no React, no I/O. Shared by the solo client, the server, the tests and scripts/sim.ts.
import type { Rng } from "./rng.ts";

export type Bit = 0 | 1;
/** Sensor light, the referee's input bit: 0 = GREEN, 1 = RED. */
export type Light = Bit;
/** Valve setting, the player's output bit: 0 = OPEN, 1 = CLOSED. */
export type Valve = Bit;
export type Table = "A" | "B";

export const GREEN: Light = 0;
export const RED: Light = 1;
export const OPEN: Valve = 0;
export const CLOSED: Valve = 1;

/** Best possible win rate for any classical (no entanglement) strategy. */
export const CLASSICAL_LIMIT = 0.75;
/** The station needs this much stability to survive. */
export const SURVIVAL_THRESHOLD = 0.8;
/** Best possible win rate with entanglement: cos²(π/8), the Tsirelson bound. */
export const QUANTUM_LIMIT = Math.cos(Math.PI / 8) ** 2;

/** The 8 dial positions on the Entanglement Tool, in degrees. */
export const DIAL_POSITIONS = [0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5] as const;

export function drawInputs(rng: Rng): { x: Light; y: Light } {
  return { x: bit(rng), y: bit(rng) };
}

/** The station rule: valves must match, unless both lights are RED, then they must differ. */
export function isWin(x: Light, y: Light, a: Valve, b: Valve): boolean {
  return (a ^ b) === (x & y);
}

// --- Classical ----------------------------------------------------------------------------------

/** A deterministic plan for one player: which valve to set for each light. */
export type ClassicalStrategy = { onGreen: Valve; onRed: Valve };

export function classicalValve(s: ClassicalStrategy, light: Light): Valve {
  return light === GREEN ? s.onGreen : s.onRed;
}

export function playClassical(
  sA: ClassicalStrategy,
  sB: ClassicalStrategy,
  x: Light,
  y: Light,
): { a: Valve; b: Valve } {
  return { a: classicalValve(sA, x), b: classicalValve(sB, y) };
}

/** All 4 deterministic strategies for one player. */
export const CLASSICAL_STRATEGIES: readonly ClassicalStrategy[] = [
  { onGreen: OPEN, onRed: OPEN },
  { onGreen: OPEN, onRed: CLOSED },
  { onGreen: CLOSED, onRed: OPEN },
  { onGreen: CLOSED, onRed: CLOSED },
];

/** Exact win rate of a classical pair, averaged over the 4 equally likely light combinations. */
export function classicalExpectedWinRate(sA: ClassicalStrategy, sB: ClassicalStrategy): number {
  let wins = 0;
  for (const [x, y] of LIGHT_PAIRS) {
    const { a, b } = playClassical(sA, sB, x, y);
    if (isWin(x, y, a, b)) wins++;
  }
  return wins / 4;
}

// --- Quantum ------------------------------------------------------------------------------------

/** One player's Entanglement Tool setup: the dial angle (degrees) used for each light. */
export type TuningConfig = { greenDeg: number; redDeg: number };

// The optimal setup (used for the bot, the hint and tests). Not shown to players before the debrief.
export const OPTIMAL_TUNING: Record<Table, TuningConfig> = {
  A: { greenDeg: 0, redDeg: 45 },
  B: { greenDeg: 22.5, redDeg: 157.5 }, // 157.5° is the same measurement as −22.5°
};

export function dialFor(c: TuningConfig, light: Light): number {
  return light === GREEN ? c.greenDeg : c.redDeg;
}

/** P(both valves match) when the two halves of |Φ+⟩ are measured at these angles: cos²(θ1 − θ2). */
export function matchProbability(thetaFirstDeg: number, thetaSecondDeg: number): number {
  return Math.cos(((thetaFirstDeg - thetaSecondDeg) * Math.PI) / 180) ** 2;
}

/** The first player to measure gets a fair coin flip, whatever the angle. */
export function measureFirst(rng: Rng): Valve {
  return bit(rng);
}

/**
 * The second player's result, given the first. It equals `first` with probability cos²(Δθ), and is flipped
 * otherwise. Averaged over the first player's fair coin, this is still 50/50, so no signal gets through.
 */
export function measureSecond(first: Valve, thetaFirstDeg: number, thetaSecondDeg: number, rng: Rng): Valve {
  return rng() < matchProbability(thetaFirstDeg, thetaSecondDeg) ? first : flip(first);
}

/** One quantum round. `order` says which table tapped MEASURE first. */
export function playQuantum(
  cA: TuningConfig,
  cB: TuningConfig,
  x: Light,
  y: Light,
  order: Table,
  rng: Rng,
): { a: Valve; b: Valve } {
  const thetaA = dialFor(cA, x);
  const thetaB = dialFor(cB, y);
  if (order === "A") {
    const a = measureFirst(rng);
    return { a, b: measureSecond(a, thetaA, thetaB, rng) };
  }
  const b = measureFirst(rng);
  return { a: measureSecond(b, thetaB, thetaA, rng), b };
}

/** Exact win rate of a quantum pair: the mean over the 4 light combinations of P(win | x, y). */
export function quantumExpectedWinRate(cA: TuningConfig, cB: TuningConfig): number {
  let total = 0;
  for (const [x, y] of LIGHT_PAIRS) {
    const pMatch = matchProbability(dialFor(cA, x), dialFor(cB, y));
    total += (x & y) === 0 ? pMatch : 1 - pMatch;
  }
  return total / 4;
}

// --- Stats --------------------------------------------------------------------------------------

export type RoundResult = {
  x: Light;
  y: Light;
  a: Valve | null; // null = this player timed out
  b: Valve | null;
  win: boolean;
  timedOut: boolean;
};

/** Scores a round. A timeout by either player is a loss, tracked separately via `timedOut`. */
export function scoreRound(x: Light, y: Light, a: Valve | null, b: Valve | null): RoundResult {
  const timedOut = a === null || b === null;
  return { x, y, a, b, timedOut, win: !timedOut && isWin(x, y, a, b) };
}

export function winRate(results: readonly { win: boolean }[]): number {
  if (results.length === 0) return 0;
  return results.filter((r) => r.win).length / results.length;
}

/** A pair's play for one round: given both lights, produce both valves. */
export type StrategyFn = (x: Light, y: Light, rng: Rng) => { a: Valve; b: Valve };

export type SimulationResult = {
  winRate: number;
  /** Fraction of rounds where A's valve was CLOSED. ≈ 0.5 for any quantum tuning. */
  aMarginal: number;
  /** Fraction of rounds where B's valve was CLOSED. */
  bMarginal: number;
};

/** Plays `n` rounds with random lights. */
export function simulate(strategyFn: StrategyFn, n: number, rng: Rng): SimulationResult {
  let wins = 0;
  let aClosed = 0;
  let bClosed = 0;
  for (let i = 0; i < n; i++) {
    const { x, y } = drawInputs(rng);
    const { a, b } = strategyFn(x, y, rng);
    if (isWin(x, y, a, b)) wins++;
    aClosed += a;
    bClosed += b;
  }
  return { winRate: wins / n, aMarginal: aClosed / n, bMarginal: bClosed / n };
}

export const classicalStrategyFn =
  (sA: ClassicalStrategy, sB: ClassicalStrategy): StrategyFn =>
  (x, y) =>
    playClassical(sA, sB, x, y);

// DECISION: in simulation the measuring order is a coin flip each round, as in a live round
// where either player may tap first.
export const quantumStrategyFn =
  (cA: TuningConfig, cB: TuningConfig, order?: Table): StrategyFn =>
  (x, y, rng) =>
    playQuantum(cA, cB, x, y, order ?? (rng() < 0.5 ? "A" : "B"), rng);

// --- Helpers ------------------------------------------------------------------------------------

const LIGHT_PAIRS: readonly (readonly [Light, Light])[] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

function bit(rng: Rng): Bit {
  return rng() < 0.5 ? 0 : 1;
}

function flip(v: Bit): Bit {
  return v === 0 ? 1 : 0;
}
