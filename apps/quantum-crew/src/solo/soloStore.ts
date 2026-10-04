// Solo mode as a state machine: the player is Table A, an AI crewmate is Table B. No server, no I/O.
// Act II: the crewmate always OPENs, so no plan beats 75%. Act III: both share the Entanglement Tool, and the
// crewmate's dials sit at the optimal Table B setting, so the player can reach ≈ 85% by finding their own.
// Actions take `now` (ms) so tests can drive the clock; the Batch screen calls them from timers.
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
import {
  ACT2_BATCHES,
  BATCH_SIZE,
  BOT_ACT2_PLAN,
  DEBRIEF_AFTER_BATCHES,
  DEFAULT_PLAN,
  DEFAULT_TUNING,
  HINT_AFTER_FAILED_BATCHES,
  ROUND_MS,
  SIM_ROUNDS,
} from "../config.ts";
import {
  OPTIMAL_TUNING,
  SURVIVAL_THRESHOLD,
  classicalStrategyFn,
  classicalValve,
  dialFor,
  drawInputs,
  measureFirst,
  measureSecond,
  quantumStrategyFn,
  scoreRound,
  simulate,
  winRate,
  type ClassicalStrategy,
  type Light,
  type RoundResult,
  type SimulationResult,
  type TuningConfig,
  type Valve,
} from "../shared/chsh.ts";
import { mulberry32, randomSeed, type Rng } from "../shared/rng.ts";

export type Phase =
  | "intro"
  | "act2Plan"
  | "act2Batch"
  | "act2Readout"
  | "ceiling"
  | "toolReveal"
  | "act3Plan"
  | "act3Batch"
  | "act3Readout"
  | "debrief";

export type Act = 2 | 3;

export type LiveRound = {
  /** 1-based round number within the batch. */
  n: number;
  x: Light;
  y: Light;
  deadline: number;
  /** Set once the player answers or times out; the screen shows it, then calls `advance`. */
  result: RoundResult | null;
};

export type SimRun = SimulationResult & { act: Act; rounds: number };

export type SoloData = {
  phase: Phase;
  debriefStep: number;
  plan: ClassicalStrategy;
  tuning: TuningConfig;
  round: LiveRound | null;
  /** Rounds of the current (or last) batch. */
  batch: RoundResult[];
  act2: RoundResult[];
  act3: RoundResult[];
  act2Batches: number;
  act3Batches: number;
  act3FailedBatches: number;
  /** Best Act III 1,000-round run so far. */
  bestAct3Sim: number;
  lastSim: SimRun | null;
  hintShown: boolean;
};

export type SoloActions = {
  start(): void;
  setPlan(light: Light, valve: Valve): void;
  setDial(light: Light, deg: number): void;
  beginBatch(): void;
  /** Starts the next round, or ends the batch after the last one. */
  advance(now: number): void;
  /** Act II: the player sets their valve. */
  answer(valve: Valve, now: number): void;
  /** Act III: the player taps MEASURE. */
  measure(now: number): void;
  timeout(now: number): void;
  runSimulation(): void;
  nextBatch(): void;
  reportCeiling(): void;
  revealTool(): void;
  openTool(): void;
  showHint(): void;
  startDebrief(): void;
  setDebriefStep(step: number): void;
  reset(): void;
};

export type SoloState = SoloData & SoloActions;

const initialData = (): SoloData => ({
  phase: "intro",
  debriefStep: 0,
  plan: DEFAULT_PLAN,
  tuning: DEFAULT_TUNING,
  round: null,
  batch: [],
  act2: [],
  act3: [],
  act2Batches: 0,
  act3Batches: 0,
  act3FailedBatches: 0,
  bestAct3Sim: 0,
  lastSim: null,
  hintShown: false,
});

/** Which act a phase belongs to (the intro and the ceiling reveal count as Act II). */
export const actOf = (phase: Phase): Act =>
  phase.startsWith("act2") || phase === "intro" || phase === "ceiling" ? 2 : 3;

export function createSoloStore(seed: number = randomSeed()) {
  const rng: Rng = mulberry32(seed);

  return createStore<SoloState>()((set, get) => {
    const resolve = (result: RoundResult) => {
      const s = get();
      if (!s.round || s.round.result) return;
      const act = actOf(s.phase);
      set({
        round: { ...s.round, result },
        batch: [...s.batch, result],
        ...(act === 2 ? { act2: [...s.act2, result] } : { act3: [...s.act3, result] }),
      });
    };

    const finishBatch = () => {
      const s = get();
      if (s.phase === "act2Batch") {
        set({ phase: "act2Readout", round: null, act2Batches: s.act2Batches + 1, lastSim: null });
      } else {
        const failed = winRate(s.batch) < SURVIVAL_THRESHOLD;
        set({
          phase: "act3Readout",
          round: null,
          act3Batches: s.act3Batches + 1,
          act3FailedBatches: s.act3FailedBatches + (failed ? 1 : 0),
          lastSim: null,
        });
      }
    };

    return {
      ...initialData(),

      start: () => set({ phase: "act2Plan" }),

      setPlan: (light, valve) =>
        set((s) => ({ plan: light === 0 ? { ...s.plan, onGreen: valve } : { ...s.plan, onRed: valve } })),

      setDial: (light, deg) =>
        set((s) => ({ tuning: light === 0 ? { ...s.tuning, greenDeg: deg } : { ...s.tuning, redDeg: deg } })),

      beginBatch: () => {
        const { phase } = get();
        if (phase === "act2Plan") set({ phase: "act2Batch", batch: [], round: null, lastSim: null });
        else if (phase === "act3Plan") set({ phase: "act3Batch", batch: [], round: null, lastSim: null });
      },

      advance: (now) => {
        const s = get();
        if (s.phase !== "act2Batch" && s.phase !== "act3Batch") return;
        if (s.round && !s.round.result) return; // still waiting for the player
        if (s.batch.length >= BATCH_SIZE) return finishBatch();
        const { x, y } = drawInputs(rng);
        set({ round: { n: s.batch.length + 1, x, y, deadline: now + ROUND_MS, result: null } });
      },

      answer: (valve, now) => {
        const { phase, round } = get();
        if (phase !== "act2Batch" || !round || round.result || now > round.deadline) return;
        resolve(scoreRound(round.x, round.y, valve, classicalValve(BOT_ACT2_PLAN, round.y)));
      },

      measure: (now) => {
        const { phase, round, tuning } = get();
        if (phase !== "act3Batch" || !round || round.result || now > round.deadline) return;
        // DECISION: in solo the player always measures first; the crewmate's result is conditioned on it.
        const a = measureFirst(rng);
        const b = measureSecond(a, dialFor(tuning, round.x), dialFor(OPTIMAL_TUNING.B, round.y), rng);
        resolve(scoreRound(round.x, round.y, a, b));
      },

      timeout: (now) => {
        const { phase, round } = get();
        if (!round || round.result || now < round.deadline) return;
        // The crewmate still acts; the player's missing valve makes it a loss.
        const b = phase === "act2Batch" ? classicalValve(BOT_ACT2_PLAN, round.y) : measureFirst(rng);
        resolve(scoreRound(round.x, round.y, null, b));
      },

      runSimulation: () => {
        const s = get();
        const act = actOf(s.phase);
        const strategy =
          act === 2
            ? classicalStrategyFn(s.plan, BOT_ACT2_PLAN)
            : quantumStrategyFn(s.tuning, OPTIMAL_TUNING.B, "A");
        const result = simulate(strategy, SIM_ROUNDS, rng);
        set({
          lastSim: { ...result, act, rounds: SIM_ROUNDS },
          ...(act === 3 ? { bestAct3Sim: Math.max(s.bestAct3Sim, result.winRate) } : {}),
        });
      },

      nextBatch: () => {
        const { phase } = get();
        if (phase === "act2Readout") set({ phase: "act2Plan" });
        else if (phase === "act3Readout") set({ phase: "act3Plan" });
      },

      reportCeiling: () => {
        if (get().phase === "act2Readout") set({ phase: "ceiling" });
      },
      revealTool: () => {
        if (get().phase === "ceiling") set({ phase: "toolReveal" });
      },
      openTool: () => {
        if (get().phase === "toolReveal") set({ phase: "act3Plan", lastSim: null });
      },
      showHint: () => {
        if (hintAvailable(get())) set({ hintShown: true });
      },
      startDebrief: () => {
        if (debriefAvailable(get())) set({ phase: "debrief", debriefStep: 0 });
      },
      setDebriefStep: (step) => set({ debriefStep: step }),

      reset: () => set(initialData()),
    };
  });
}

// --- Derived ------------------------------------------------------------------------------------

export const canReportCeiling = (s: SoloData) => s.act2Batches >= ACT2_BATCHES;

export const hintAvailable = (s: SoloData) => s.act3FailedBatches >= HINT_AFTER_FAILED_BATCHES;

/** The debrief opens once the station survives a 1,000-round test, or after enough Act III batches. */
export const debriefAvailable = (s: SoloData) =>
  s.bestAct3Sim >= SURVIVAL_THRESHOLD || s.act3Batches >= DEBRIEF_AFTER_BATCHES;

/** What the stability meter shows: the latest 1,000-round test, else the current act's rounds so far. */
export function displayedStability(s: SoloData): number | null {
  if (s.lastSim) return s.lastSim.winRate;
  const rounds = actOf(s.phase) === 2 ? s.act2 : s.act3;
  return rounds.length ? winRate(rounds) : null;
}

// --- React binding ------------------------------------------------------------------------------

export const soloStore = createSoloStore();

export function useSolo<T>(selector: (s: SoloState) => T): T {
  return useStore(soloStore, selector);
}
