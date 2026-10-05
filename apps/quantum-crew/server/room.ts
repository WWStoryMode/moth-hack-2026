// One event room: players at two tables, paired A₁↔B₁, A₂↔B₂…, with an AI crewmate in any empty seat.
// The room is authoritative: it draws every light, runs the clocks, scores rounds and broadcasts state.
// Each phone only ever receives its own light. Clock, randomness, timers and sending are injected, so
// tests can drive a whole session without sockets or real time.
import {
  BATCH_SIZE,
  BOT_ACT2_PLAN,
  DEFAULT_PLAN,
  DEFAULT_TUNING,
  MAX_PAIRS,
  MP_RESULT_MS,
  MP_ROUND_MS,
  ROLLING_WINDOW,
  STRATEGY_MS,
} from "../src/config.ts";
import {
  DIAL_POSITIONS,
  OPTIMAL_TUNING,
  classicalValve,
  dialFor,
  drawInputs,
  measureFirst,
  measureSecond,
  scoreRound,
  type ClassicalStrategy,
  type Light,
  type Table,
  type TuningConfig,
  type Valve,
} from "../src/shared/chsh.ts";
import type {
  Act,
  ClientMsg,
  ErrorCode,
  HostCommand,
  PairInfo,
  RateSummary,
  RoomPhase,
  RoomState,
  RoundOutcome,
  ServerMsg,
} from "../src/shared/protocol.ts";
import type { Rng } from "../src/shared/rng.ts";

export type Conn = string;

export type RoomDeps = {
  now: () => number;
  rng: Rng;
  /** Runs `fn` after `ms`; returns a cancel function. */
  schedule: (fn: () => void, ms: number) => () => void;
  send: (conn: Conn, msg: ServerMsg) => void;
  newId: () => string;
};

type Player = {
  id: string;
  name: string;
  table: Table;
  conn: Conn | null;
  joinOrder: number;
  classical: ClassicalStrategy;
  tuning: TuningConfig;
};

type Pair = { id: number; a: Player | null; b: Player | null };
type Side = "a" | "b";

/**
 * One pair's part of the live round. A null valve = not answered yet. In Act III, `theta` records the dial angle
 * each side measured at, so the second measurement can be conditioned on the first.
 */
type PairRound = { x: Light; y: Light; a: Valve | null; b: Valve | null; theta: { a: number | null; b: number | null } };

/** Act III no-signalling record for one seat: its OPEN count split by the partner's light. */
type SeatMarginal = { name: string; table: Table; green: { open: number; n: number }; red: { open: number; n: number } };

type LiveRound = { id: string; deadline: number; byPair: Map<number, PairRound> };

const emptyRate = (): RateSummary => ({ rounds: 0, wins: 0, timeouts: 0 });
const addResult = (r: RateSummary, o: RoundOutcome) => {
  r.rounds++;
  if (o.win) r.wins++;
  if (o.timedOut) r.timeouts++;
};

export const BOT_NAME = "AI crewmate";

/** Snaps any angle to the nearest of the tool's 8 dial positions (mod 180°). */
export function snapDial(deg: number): number {
  const i = Math.round((((deg % 180) + 180) % 180) / 22.5) % DIAL_POSITIONS.length;
  return DIAL_POSITIONS[i]!;
}

export function createRoom(code: string, deps: RoomDeps) {
  const token = deps.newId();
  let hostConn: Conn | null = null;
  let lastActivity = deps.now();
  let joinCounter = 0;

  const players: Player[] = [];
  let pairs: Pair[] = [];

  let phase: RoomPhase = "lobby";
  let act: Act = 2;
  let batchNo = 0;
  let roundNo = 0;
  let deadline: number | null = null;
  let live: LiveRound | null = null;
  let cancelTimer: (() => void) | null = null;
  let ceilingRevealed = false;
  let toolUnlocked = false;

  // Stats
  let rolling: boolean[] = [];
  let actStats: Record<Act, RateSummary> = { 2: emptyRate(), 3: emptyRate() };
  let pairStats = new Map<number, Record<Act, RateSummary>>();
  let batchStats: RateSummary | null = null;
  let lastBatch: RateSummary | null = null;
  /** Keyed by player id, or `bot-<pair>-<side>` for an AI crewmate. */
  let marginals = new Map<string, SeatMarginal>();

  // --- Sending ----------------------------------------------------------------------------------

  const toHost = (msg: ServerMsg) => hostConn && deps.send(hostConn, msg);
  const toPlayer = (p: Player | null, msg: ServerMsg) => p?.conn && deps.send(p.conn, msg);
  const error = (conn: Conn, code: ErrorCode, message: string) => deps.send(conn, { type: "error", code, message });

  function state(): RoomState {
    const seat = (p: Player | null) => ({ playerId: p?.id ?? null, name: p?.name ?? BOT_NAME });
    const pairInfo = (pair: Pair): PairInfo => {
      const pr = live?.byPair.get(pair.id);
      const stats = pairStats.get(pair.id) ?? { 2: emptyRate(), 3: emptyRate() };
      return {
        id: pair.id,
        a: seat(pair.a),
        b: seat(pair.b),
        act2: stats[2],
        act3: stats[3],
        answered: { a: !!pr && pr.a !== null, b: !!pr && pr.b !== null },
      };
    };
    return {
      room: code,
      phase,
      act,
      batchNo,
      roundNo,
      batchSize: BATCH_SIZE,
      deadline,
      serverNow: deps.now(),
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        table: p.table,
        connected: p.conn !== null,
        pairId: pairs.find((pair) => pair.a === p || pair.b === p)?.id ?? null,
      })),
      pairs: pairs.map(pairInfo),
      stability: {
        rolling: rolling.length ? rolling.filter(Boolean).length / rolling.length : null,
        act2: actStats[2],
        act3: actStats[3],
      },
      lastBatch,
      ceilingRevealed,
      toolUnlocked,
      // Only in the debrief: per-light counts could otherwise hint at a partner's past lights mid-game.
      marginals: phase === "debrief" ? marginalRows() : null,
    };
  }

  function marginalRows(): NonNullable<RoomState["marginals"]> {
    const rate = (c: { open: number; n: number }) => (c.n ? c.open / c.n : null);
    const all = [...marginals.values()];
    const sum = (pick: (m: SeatMarginal) => { open: number; n: number }) =>
      all.reduce((acc, m) => ({ open: acc.open + pick(m).open, n: acc.n + pick(m).n }), { open: 0, n: 0 });
    const green = sum((m) => m.green);
    const red = sum((m) => m.red);
    return {
      rows: all.map((m) => ({
        name: m.name,
        table: m.table,
        partnerGreen: rate(m.green),
        partnerRed: rate(m.red),
        rounds: m.green.n + m.red.n,
      })),
      crew: { partnerGreen: rate(green), partnerRed: rate(red), rounds: green.n + red.n },
    };
  }

  function broadcast() {
    const msg: ServerMsg = { type: "room:state", state: state() };
    toHost(msg);
    for (const p of players) toPlayer(p, msg);
  }

  // --- Pairing ----------------------------------------------------------------------------------

  /** Pairs the i-th player at Table A with the i-th at Table B; a bot fills any empty seat. */
  function repair() {
    const byTable = (t: Table) => players.filter((p) => p.table === t).sort((p, q) => p.joinOrder - q.joinOrder);
    const as = byTable("A");
    const bs = byTable("B");
    const n = Math.max(as.length, bs.length);
    pairs = Array.from({ length: n }, (_, i) => ({ id: i + 1, a: as[i] ?? null, b: bs[i] ?? null }));
    for (const pair of pairs) if (!pairStats.has(pair.id)) pairStats.set(pair.id, { 2: emptyRate(), 3: emptyRate() });
  }

  const inBatch = () => phase === "round" || phase === "roundResult";

  // --- Timers -----------------------------------------------------------------------------------

  function setTimer(fn: () => void, ms: number) {
    cancelTimer?.();
    cancelTimer = deps.schedule(() => {
      cancelTimer = null;
      fn();
    }, ms);
  }

  function clearTimer() {
    cancelTimer?.();
    cancelTimer = null;
  }

  // --- Rounds -----------------------------------------------------------------------------------

  /** The AI crewmate's Act II valve for a light. */
  const botValve = (light: Light): Valve => classicalValve(BOT_ACT2_PLAN, light);

  /** The dial a seat uses for a light: the player's own tuning, or the optimal one for an AI crewmate. */
  const seatDial = (pair: Pair, side: Side, light: Light) =>
    dialFor(pair[side]?.tuning ?? OPTIMAL_TUNING[side === "a" ? "A" : "B"], light);

  /**
   * Act III: one side taps MEASURE. Whoever measures first gets a fair coin; the second result is conditioned on it
   * (equal with probability cos²(Δθ)). Either way each side's own result stays 50/50: no signalling.
   */
  function measureSide(pair: Pair, pr: PairRound, side: Side): Valve {
    const other: Side = side === "a" ? "b" : "a";
    const theta = seatDial(pair, side, side === "a" ? pr.x : pr.y);
    const partner = pr[other];
    const partnerTheta = pr.theta[other];
    const valve =
      partner === null || partnerTheta === null ? measureFirst(deps.rng) : measureSecond(partner, partnerTheta, theta, deps.rng);
    pr[side] = valve;
    pr.theta[side] = theta;
    return valve;
  }

  function startBatch() {
    clearTimer();
    if (players.length === 0) {
      phase = "lobby";
      deadline = null;
      return broadcast();
    }
    repair();
    batchNo++;
    roundNo = 0;
    batchStats = emptyRate();
    nextRound();
  }

  function nextRound() {
    roundNo++;
    const id = `${batchNo}-${roundNo}`;
    const now = deps.now();
    const byPair = new Map<number, PairRound>();
    for (const pair of pairs) {
      const { x, y } = drawInputs(deps.rng);
      const pr: PairRound = { x, y, a: null, b: null, theta: { a: null, b: null } };
      // AI crewmates answer at once. DECISION: in Act III the bot measures at the start of the round, so it is
      // always first and its human partner's result is the conditioned one.
      for (const side of ["a", "b"] as const) {
        if (pair[side]) continue;
        if (act === 2) pr[side] = botValve(side === "a" ? x : y);
        else measureSide(pair, pr, side);
      }
      byPair.set(pair.id, pr);
    }
    live = { id, deadline: now + MP_ROUND_MS, byPair };
    phase = "round";
    deadline = live.deadline;
    for (const pair of pairs) sendRoundStart(pair);
    setTimer(resolveRound, MP_ROUND_MS);
    broadcast();
  }

  function sendRoundStart(pair: Pair, only?: Player) {
    if (!live) return;
    const pr = live.byPair.get(pair.id);
    if (!pr) return;
    const base = { type: "round:start" as const, roundId: live.id, act, deadline: live.deadline, serverNow: deps.now() };
    for (const side of ["a", "b"] as const) {
      const p = pair[side];
      if (!p || (only && only !== p) || pr[side] !== null) continue;
      const light = side === "a" ? pr.x : pr.y;
      toPlayer(p, { ...base, light, ...(act === 3 ? { dialDeg: seatDial(pair, side, light) } : {}) });
    }
  }

  /** Act II: a valve tap. Act III: a MEASURE tap (`valve` undefined). */
  function answer(player: Player, roundId: string, valve?: Valve) {
    if (phase !== "round" || !live || live.id !== roundId || deps.now() > live.deadline) return;
    const pair = pairs.find((p) => p.a === player || p.b === player);
    const pr = pair && live.byPair.get(pair.id);
    if (!pair || !pr) return;
    const side: Side = pair.a === player ? "a" : "b";
    if (pr[side] !== null) return;
    if (act === 2) {
      if (valve === undefined) return;
      pr[side] = valve;
    } else {
      toPlayer(player, { type: "round:measured", roundId, valve: measureSide(pair, pr, side) });
    }
    const done = [...live.byPair.values()].every((r) => r.a !== null && r.b !== null);
    if (done) resolveRound();
    else broadcast();
  }

  function recordMarginal(pair: Pair, side: Side, valve: Valve | null, partnerLight: Light) {
    if (act !== 3 || valve === null) return;
    const p = pair[side];
    const key = p?.id ?? `bot-${pair.id}-${side}`;
    const m = marginals.get(key) ?? {
      name: p?.name ?? `${BOT_NAME} (pair ${pair.id})`,
      table: side === "a" ? "A" : "B",
      green: { open: 0, n: 0 },
      red: { open: 0, n: 0 },
    };
    const bucket = partnerLight === 0 ? m.green : m.red;
    bucket.n++;
    if (valve === 0) bucket.open++;
    marginals.set(key, m);
  }

  function resolveRound() {
    if (!live) return;
    clearTimer();
    const results: RoundOutcome[] = [];
    for (const pair of pairs) {
      const pr = live.byPair.get(pair.id);
      if (!pr) continue;
      const r = scoreRound(pr.x, pr.y, pr.a, pr.b);
      const outcome = { pairId: pair.id, win: r.win, timedOut: r.timedOut };
      results.push(outcome);
      addResult(actStats[act], outcome);
      addResult(pairStats.get(pair.id)![act], outcome);
      if (batchStats) addResult(batchStats, outcome);
      rolling.push(r.win);
      recordMarginal(pair, "a", pr.a, pr.y);
      recordMarginal(pair, "b", pr.b, pr.x);
      const msg: ServerMsg = { type: "round:result", roundId: live.id, ...outcome };
      toPlayer(pair.a, msg);
      toPlayer(pair.b, msg);
    }
    rolling = rolling.slice(-ROLLING_WINDOW);
    toHost({ type: "round:results", roundId: live.id, results });
    phase = "roundResult";
    deadline = null;
    setTimer(roundNo < BATCH_SIZE ? nextRound : endBatch, MP_RESULT_MS);
    broadcast();
  }

  function endBatch() {
    live = null;
    phase = "batchDone";
    deadline = null;
    lastBatch = batchStats;
    batchStats = null;
    broadcast();
  }

  // --- Host commands ----------------------------------------------------------------------------

  function command(conn: Conn, cmd: HostCommand) {
    const notNow = () => error(conn, "not-now", `Can't ${cmd} during ${phase}.`);
    switch (cmd) {
      case "startStrategy":
        if (inBatch() || phase === "debrief") return notNow();
        if (phase === "lobby") act = 2;
        phase = "strategy";
        deadline = deps.now() + STRATEGY_MS;
        // DECISION: when the huddle ends, the comms blackout starts with the batch, no extra host tap.
        setTimer(startBatch, STRATEGY_MS);
        return broadcast();
      case "startBatch":
        if (inBatch() || phase === "debrief" || players.length === 0) return notNow();
        if (phase === "ceiling" && !toolUnlocked) return notNow();
        return startBatch();
      case "revealCeiling":
        if (inBatch() || act !== 2) return notNow();
        clearTimer();
        phase = "ceiling";
        deadline = null;
        ceilingRevealed = true;
        return broadcast();
      case "unlockTool":
        if (inBatch() || toolUnlocked) return notNow();
        clearTimer();
        act = 3;
        toolUnlocked = true;
        phase = "tool";
        deadline = null;
        return broadcast();
      case "debrief":
        if (inBatch()) return notNow();
        clearTimer();
        phase = "debrief";
        deadline = null;
        return broadcast();
      case "reset":
        clearTimer();
        phase = "lobby";
        act = 2;
        batchNo = roundNo = 0;
        deadline = null;
        live = null;
        ceilingRevealed = toolUnlocked = false;
        rolling = [];
        actStats = { 2: emptyRate(), 3: emptyRate() };
        pairStats = new Map();
        marginals = new Map();
        batchStats = lastBatch = null;
        for (const p of players) {
          p.classical = DEFAULT_PLAN;
          p.tuning = DEFAULT_TUNING;
        }
        repair();
        return broadcast();
    }
  }

  // --- Connections ------------------------------------------------------------------------------

  function join(conn: Conn, name: string, table: Table) {
    // Reconnect: the same name at the same table takes its seat back.
    const existing = players.find((p) => p.table === table && p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.conn = conn;
      deps.send(conn, { type: "player:joined", room: code, playerId: existing.id, name: existing.name, table });
      broadcast();
      const pair = pairs.find((p) => p.a === existing || p.b === existing);
      if (pair && phase === "round") sendRoundStart(pair, existing);
      return;
    }
    if (players.filter((p) => p.table === table).length >= MAX_PAIRS) {
      return error(conn, "table-full", `Table ${table} is full.`);
    }
    const player: Player = {
      id: deps.newId(),
      name,
      table,
      conn,
      joinOrder: joinCounter++,
      classical: DEFAULT_PLAN,
      tuning: DEFAULT_TUNING,
    };
    players.push(player);
    // DECISION: players who join mid-batch are seated when the batch ends.
    if (!inBatch()) repair();
    deps.send(conn, { type: "player:joined", room: code, playerId: player.id, name, table });
    broadcast();
  }

  return {
    code,
    token,

    /** Messages for this room; `host:create` is handled by the station. */
    handle(conn: Conn, msg: ClientMsg) {
      lastActivity = deps.now();
      const player = players.find((p) => p.conn === conn);
      switch (msg.type) {
        case "host:create":
          hostConn = conn;
          deps.send(conn, { type: "host:created", room: code, token });
          return broadcast();
        case "host:resume":
          if (msg.token !== token) return error(conn, "not-host", "That host link has expired.");
          hostConn = conn;
          deps.send(conn, { type: "host:created", room: code, token });
          return broadcast();
        case "host:command":
          if (conn !== hostConn) return error(conn, "not-host", "Only the TV can run the session.");
          return command(conn, msg.cmd);
        case "player:join":
          return join(conn, msg.name, msg.table);
        case "player:strategy":
          if (!player) return;
          if (msg.classical) player.classical = msg.classical;
          if (msg.tuning) player.tuning = { greenDeg: snapDial(msg.tuning.greenDeg), redDeg: snapDial(msg.tuning.redDeg) };
          return;
        case "player:valve":
          if (!player || act !== 2) return;
          return answer(player, msg.roundId, msg.valve);
        case "player:measure":
          if (!player || act !== 3) return;
          return answer(player, msg.roundId);
      }
    },

    disconnect(conn: Conn) {
      if (conn === hostConn) hostConn = null;
      const player = players.find((p) => p.conn === conn);
      if (player) {
        player.conn = null;
        broadcast();
      }
    },

    /** Nobody connected and quiet for `ms`. */
    isIdle(ms: number) {
      return hostConn === null && players.every((p) => p.conn === null) && deps.now() - lastActivity > ms;
    },

    dispose() {
      clearTimer();
    },

    state,
  };
}

export type Room = ReturnType<typeof createRoom>;
