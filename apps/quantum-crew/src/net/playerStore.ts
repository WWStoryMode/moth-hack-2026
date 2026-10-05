// A phone's connection: joins a room at a table, receives only its own light, and sends valve intents.
import { create } from "zustand";
import type { ClassicalStrategy, Light, Table, TuningConfig, Valve } from "../shared/chsh.ts";
import type { Act, RoomState } from "../shared/protocol.ts";
import { DEFAULT_PLAN, DEFAULT_TUNING } from "../config.ts";
import { toLocalDeadline } from "./useCountdown.ts";
import { connectStation, session, type SocketStatus, type Station } from "./socket.ts";

const KEY = "qc-player";

export type Seat = { room: string; name: string; table: Table };

/**
 * `answered`: the valve this phone set (Act II) or got back from MEASURE (Act III). `measuring`: MEASURE was tapped
 * and the result hasn't arrived yet.
 */
type LiveRound = {
  roundId: string;
  act: Act;
  light: Light;
  ms: number;
  dialDeg: number | null;
  answered: Valve | null;
  measuring: boolean;
};

type PlayerStore = {
  status: SocketStatus | "idle";
  seat: Seat | null;
  playerId: string | null;
  state: RoomState | null;
  localDeadline: number | null;
  round: LiveRound | null;
  flash: { roundId: string; win: boolean; timedOut: boolean } | null;
  plan: ClassicalStrategy;
  tuning: TuningConfig;
  error: string | null;
  join(seat: Seat): void;
  resume(): boolean;
  answer(valve: Valve): void;
  measure(): void;
  setPlan(plan: ClassicalStrategy): void;
  setTuning(tuning: TuningConfig): void;
  leave(): void;
};

let station: Station | null = null;

export const usePlayer = create<PlayerStore>()((set, get) => ({
  status: "idle",
  seat: null,
  playerId: null,
  state: null,
  localDeadline: null,
  round: null,
  flash: null,
  plan: DEFAULT_PLAN,
  tuning: DEFAULT_TUNING,
  error: null,

  join(seat) {
    station?.close();
    set({ seat, error: null, status: "connecting" });
    station = connectStation({
      onStatus: (status) => set({ status }),
      hello: (send) => {
        send({ type: "player:join", ...seat });
        // Re-send this phone's choices so a reconnect (or a server restart mid-session) keeps them.
        const { plan, tuning } = get();
        send({ type: "player:strategy", act: 2, classical: plan });
        send({ type: "player:strategy", act: 3, tuning });
      },
      onMessage: (msg) => {
        switch (msg.type) {
          case "player:joined":
            session.set(KEY, seat);
            return set({ playerId: msg.playerId, seat: { ...seat, name: msg.name } });
          case "room:state": {
            const inRound = msg.state.phase === "round" || msg.state.phase === "roundResult";
            // After a host reset the server forgets plans and dials; forget them here too.
            const fresh = msg.state.phase === "lobby" && msg.state.batchNo === 0;
            return set({
              ...(fresh ? { plan: DEFAULT_PLAN, tuning: DEFAULT_TUNING } : {}),
              state: msg.state,
              localDeadline: toLocalDeadline(msg.state.deadline, msg.state.serverNow),
              ...(inRound ? {} : { round: null }),
            });
          }
          case "round:start":
            return set({
              round: {
                roundId: msg.roundId,
                act: msg.act,
                light: msg.light,
                ms: Math.max(0, msg.deadline - msg.serverNow),
                dialDeg: msg.dialDeg ?? null,
                answered: null,
                measuring: false,
              },
              flash: null,
            });
          case "round:measured": {
            const { round } = get();
            if (round?.roundId === msg.roundId) set({ round: { ...round, answered: msg.valve, measuring: false } });
            return;
          }
          case "round:result":
            return set({ round: null, flash: { roundId: msg.roundId, win: msg.win, timedOut: msg.timedOut } });
          case "error":
            if (msg.code === "no-room" || msg.code === "table-full") {
              station?.close();
              station = null;
              session.remove(KEY);
              return set({ error: msg.message, seat: null, status: "idle", playerId: null });
            }
            return set({ error: msg.message });
        }
      },
    });
  },

  /** Rejoins the seat saved in this tab (after a reload). */
  resume() {
    const saved = session.get<Seat>(KEY);
    if (!saved) return false;
    get().join(saved);
    return true;
  },

  answer(valve) {
    const { round } = get();
    if (!round || round.act !== 2 || round.answered !== null) return;
    station?.send({ type: "player:valve", roundId: round.roundId, valve });
    set({ round: { ...round, answered: valve } });
  },

  measure() {
    const { round } = get();
    if (!round || round.act !== 3 || round.answered !== null || round.measuring) return;
    station?.send({ type: "player:measure", roundId: round.roundId });
    set({ round: { ...round, measuring: true } });
  },

  setTuning(tuning) {
    set({ tuning });
    station?.send({ type: "player:strategy", act: 3, tuning });
  },

  setPlan(plan) {
    set({ plan });
    station?.send({ type: "player:strategy", act: 2, classical: plan });
  },

  leave() {
    station?.close();
    station = null;
    session.remove(KEY);
    set({ status: "idle", seat: null, playerId: null, state: null, round: null, flash: null });
  },
}));
