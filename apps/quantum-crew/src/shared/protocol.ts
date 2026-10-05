// WebSocket messages between phones / the TV and the station server. JSON with a `type` field.
// The server is authoritative: clients only send intents. Each phone only ever receives its own light.
import type { ClassicalStrategy, Light, Table, TuningConfig, Valve } from "./chsh.ts";

export type Act = 2 | 3;

/**
 * lobby → strategy (huddle, timed) → round ⇄ roundResult (× batch size) → batchDone → … → ceiling (Act II ends)
 * → tool (Entanglement Tool unlocked, Act III) → strategy → round … → debrief.
 */
export type RoomPhase = "lobby" | "strategy" | "round" | "roundResult" | "batchDone" | "ceiling" | "tool" | "debrief";

export type HostCommand = "startStrategy" | "startBatch" | "revealCeiling" | "unlockTool" | "debrief" | "reset";

export type RateSummary = { rounds: number; wins: number; timeouts: number };

/** A seat in a pair: a player id, or null for the AI crewmate that fills an empty seat. */
export type Seat = { playerId: string | null; name: string };

export type PlayerInfo = { id: string; name: string; table: Table; connected: boolean; pairId: number | null };

export type PairInfo = {
  id: number;
  a: Seat;
  b: Seat;
  act2: RateSummary;
  act3: RateSummary;
  /** Whether each seat has answered the live round (no values, so nothing leaks). */
  answered: { a: boolean; b: boolean };
};

export type RoomState = {
  room: string;
  phase: RoomPhase;
  act: Act;
  batchNo: number;
  roundNo: number;
  batchSize: number;
  /** Server clock (ms) when the round or the strategy huddle ends. Compare with `serverNow`. */
  deadline: number | null;
  serverNow: number;
  players: PlayerInfo[];
  pairs: PairInfo[];
  stability: {
    /** Win rate of the last ROLLING_WINDOW rounds across all pairs (null before any round). */
    rolling: number | null;
    act2: RateSummary;
    act3: RateSummary;
  };
  lastBatch: RateSummary | null;
  ceilingRevealed: boolean;
  toolUnlocked: boolean;
  /** Act III no-signalling data, sent only during the debrief. `crew` pools every seat (bigger sample, closer to 50%). */
  marginals: { rows: MarginalRow[]; crew: Omit<MarginalRow, "name" | "table"> } | null;
};

/** One seat's Act III valves: how often it came out OPEN, split by the partner's light. ≈ 0.5 both ways. */
export type MarginalRow = {
  name: string;
  table: Table;
  partnerGreen: number | null;
  partnerRed: number | null;
  rounds: number;
};

export type ClientMsg =
  | { type: "host:create" }
  | { type: "host:resume"; room: string; token: string }
  | { type: "player:join"; room: string; name: string; table: Table }
  | { type: "player:strategy"; act: Act; classical?: ClassicalStrategy; tuning?: TuningConfig }
  | { type: "player:valve"; roundId: string; valve: Valve }
  | { type: "player:measure"; roundId: string }
  | { type: "host:command"; cmd: HostCommand };

export type RoundOutcome = { pairId: number; win: boolean; timedOut: boolean };

export type ServerMsg =
  | { type: "host:created"; room: string; token: string }
  | { type: "player:joined"; room: string; playerId: string; name: string; table: Table }
  | { type: "room:state"; state: RoomState }
  /** To one phone: its own light only. */
  | { type: "round:start"; roundId: string; act: Act; light: Light; deadline: number; serverNow: number; dialDeg?: number }
  /** Act III, to the measuring phone only. */
  | { type: "round:measured"; roundId: string; valve: Valve }
  /** To the two phones of a pair. */
  | ({ type: "round:result"; roundId: string } & RoundOutcome)
  /** To the TV: every pair's outcome. */
  | { type: "round:results"; roundId: string; results: RoundOutcome[] }
  | { type: "error"; code: ErrorCode; message: string };

export type ErrorCode = "no-room" | "table-full" | "bad-request" | "not-host" | "not-now";

export const ROOM_CODE = /^[A-Z]{4}$/;
export const NAME_MAX = 16;
export const WS_PATH = "/ws";
export const HEALTH_PATH = "/healthz";

/** Parses and checks a client message; returns null if it is malformed. */
export function parseClientMsg(raw: string): ClientMsg | null {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!m || typeof m !== "object") return null;
  const o = m as Record<string, unknown>;
  const bit = (v: unknown) => v === 0 || v === 1;
  const str = (v: unknown) => typeof v === "string";
  switch (o.type) {
    case "host:create":
      return { type: "host:create" };
    case "host:resume":
      return str(o.room) && str(o.token) ? { type: "host:resume", room: o.room as string, token: o.token as string } : null;
    case "player:join": {
      const name = str(o.name) ? (o.name as string).trim().slice(0, NAME_MAX) : "";
      if (!str(o.room) || !name || (o.table !== "A" && o.table !== "B")) return null;
      return { type: "player:join", room: (o.room as string).toUpperCase(), name, table: o.table };
    }
    case "player:strategy": {
      if (o.act !== 2 && o.act !== 3) return null;
      const c = o.classical as Record<string, unknown> | undefined;
      const t = o.tuning as Record<string, unknown> | undefined;
      const classical = c && bit(c.onGreen) && bit(c.onRed) ? { onGreen: c.onGreen as Valve, onRed: c.onRed as Valve } : undefined;
      const deg = (v: unknown) => typeof v === "number" && Number.isFinite(v);
      const tuning = t && deg(t.greenDeg) && deg(t.redDeg) ? { greenDeg: t.greenDeg as number, redDeg: t.redDeg as number } : undefined;
      return { type: "player:strategy", act: o.act, ...(classical && { classical }), ...(tuning && { tuning }) };
    }
    case "player:valve":
      return str(o.roundId) && bit(o.valve) ? { type: "player:valve", roundId: o.roundId as string, valve: o.valve as Valve } : null;
    case "player:measure":
      return str(o.roundId) ? { type: "player:measure", roundId: o.roundId as string } : null;
    case "host:command": {
      const cmds: HostCommand[] = ["startStrategy", "startBatch", "revealCeiling", "unlockTool", "debrief", "reset"];
      return cmds.includes(o.cmd as HostCommand) ? { type: "host:command", cmd: o.cmd as HostCommand } : null;
    }
    default:
      return null;
  }
}
