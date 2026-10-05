// Game tuning in one place: shared by the solo client and (from M3) the server.
import { OPEN, type ClassicalStrategy, type TuningConfig } from "./shared/chsh.ts";

/** Time a player has to set their valve or tap MEASURE. */
export const ROUND_MS = 2500;
/** Rounds per batch, followed by a stability readout. */
export const BATCH_SIZE = 12;
/** How long a round's result stays on screen before the next light. */
export const RESULT_MS = 1100;
/** Pause before the first light of a batch. */
export const LEAD_MS = 1200;
/** Rounds behind the "Run 1,000 rounds" button. */
export const SIM_ROUNDS = 1000;
/** Rounds behind the no-signalling panel in the debrief (enough that 50/50 is visible). */
export const DEBRIEF_SIM_ROUNDS = 10_000;

/** Solo: the AI crewmate's Act II plan, which the player is told. */
export const BOT_ACT2_PLAN: ClassicalStrategy = { onGreen: OPEN, onRed: OPEN };
/** Solo: the player's starting Act II plan (the same as the crewmate's). */
export const DEFAULT_PLAN: ClassicalStrategy = { onGreen: OPEN, onRed: OPEN };
// DECISION: the player's dials start at 0°/0°. Against the bot's 22.5°/157.5° that scores ≈ 68%, below the
// plan ceiling, so the tool only pays off once the player starts experimenting.
export const DEFAULT_TUNING: TuningConfig = { greenDeg: 0, redDeg: 0 };

/** Solo: Act II batches before the engineering report (the player may keep going). */
export const ACT2_BATCHES = 3;
/** Solo: Act III batches below the survival line before the hint unlocks. */
export const HINT_AFTER_FAILED_BATCHES = 3;
/** Solo: Act III batches after which the debrief unlocks even without reaching 80%. */
export const DEBRIEF_AFTER_BATCHES = 4;

// --- Event mode (multiplayer) -------------------------------------------------------------------

// DECISION: multiplayer rounds get longer than solo ones, to allow for phones and network lag.
/** Time a phone has to answer a round. */
export const MP_ROUND_MS = 3500;
/** How long the result of a round shows before the next light. */
export const MP_RESULT_MS = 1500;
/** Strategy huddle length; the batch starts automatically when it ends. */
export const STRATEGY_MS = 45_000;
/** Pooled stability on the TV is the win rate of the last this-many rounds across all pairs. */
export const ROLLING_WINDOW = 48;
/** Up to 4 pairs: at most 4 players per table. */
export const MAX_PAIRS = 4;
