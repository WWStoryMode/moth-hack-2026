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
  classicalValve,
  drawInputs,
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

/** One pair's part of the live round. A null valve = not answered yet. */
type PairRound = { x: Light; y: Light; a: Valve | null; b: Valve | null };

type LiveRound = { id: string; deadline: number; byPair: Map<number, PairRound> };

const emptyRate = (): RateSummary => ({ rounds: 0, wins: 0, timeouts: 0 });
const addResult = (r: RateSummary, o: RoundOutcome) => {
  r.rounds++;
  if (o.win) r.wins++;
  if (o.timedOut) r.timeouts++;
};

export const BOT_NAME = "AI crewmate";

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

  /** The AI crewmate's valve for a light. Act III bots arrive in M4. */
  const botValve = (light: Light): Valve => classicalValve(BOT_ACT2_PLAN, light);

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
      byPair.set(pair.id, { x, y, a: pair.a ? null : botValve(x), b: pair.b ? null : botValve(y) });
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
    if (pair.a && (!only || only === pair.a) && pr.a === null) toPlayer(pair.a, { ...base, light: pr.x });
    if (pair.b && (!only || only === pair.b) && pr.b === null) toPlayer(pair.b, { ...base, light: pr.y });
  }

  function answer(player: Player, roundId: string, valve: Valve) {
    if (phase !== "round" || !live || live.id !== roundId || deps.now() > live.deadline) return;
    const pair = pairs.find((p) => p.a === player || p.b === player);
    const pr = pair && live.byPair.get(pair.id);
    if (!pair || !pr) return;
    if (pair.a === player && pr.a === null) pr.a = valve;
    else if (pair.b === player && pr.b === null) pr.b = valve;
    else return;
    const done = [...live.byPair.values()].every((r) => r.a !== null && r.b !== null);
    if (done) resolveRound();
    else broadcast();
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
      case "debrief":
        // The Entanglement Tool and the TV debrief arrive in M4.
        return error(conn, "not-now", "Act III and the debrief arrive in the next build.");
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
          if (msg.tuning) player.tuning = msg.tuning;
          return;
        case "player:valve":
          if (!player || act !== 2) return;
          return answer(player, msg.roundId, msg.valve);
        case "player:measure":
          return; // Act III, M4
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
