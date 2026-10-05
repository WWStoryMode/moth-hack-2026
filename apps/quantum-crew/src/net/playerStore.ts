// A phone's connection: joins a room at a table, receives only its own light, and sends valve intents.
import { create } from "zustand";
import type { ClassicalStrategy, Light, Table, Valve } from "../shared/chsh.ts";
import type { Act, RoomState } from "../shared/protocol.ts";
import { DEFAULT_PLAN } from "../config.ts";
import { toLocalDeadline } from "./useCountdown.ts";
import { connectStation, session, type SocketStatus, type Station } from "./socket.ts";

const KEY = "qc-player";

export type Seat = { room: string; name: string; table: Table };

type LiveRound = { roundId: string; act: Act; light: Light; ms: number; answered: Valve | null };

type PlayerStore = {
  status: SocketStatus | "idle";
  seat: Seat | null;
  playerId: string | null;
  state: RoomState | null;
  localDeadline: number | null;
  round: LiveRound | null;
  flash: { roundId: string; win: boolean; timedOut: boolean } | null;
  plan: ClassicalStrategy;
  error: string | null;
  join(seat: Seat): void;
  resume(): boolean;
  answer(valve: Valve): void;
  setPlan(plan: ClassicalStrategy): void;
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
  error: null,

  join(seat) {
    station?.close();
    set({ seat, error: null, status: "connecting" });
    station = connectStation({
      onStatus: (status) => set({ status }),
      hello: (send) => send({ type: "player:join", ...seat }),
      onMessage: (msg) => {
        switch (msg.type) {
          case "player:joined":
            session.set(KEY, seat);
            return set({ playerId: msg.playerId, seat: { ...seat, name: msg.name } });
          case "room:state": {
            const inRound = msg.state.phase === "round" || msg.state.phase === "roundResult";
            return set({
              state: msg.state,
              localDeadline: toLocalDeadline(msg.state.deadline, msg.state.serverNow),
              ...(inRound ? {} : { round: null }),
            });
          }
          case "round:start":
            return set({
              round: { roundId: msg.roundId, act: msg.act, light: msg.light, ms: Math.max(0, msg.deadline - msg.serverNow), answered: null },
              flash: null,
            });
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
    if (!round || round.answered !== null) return;
    station?.send({ type: "player:valve", roundId: round.roundId, valve });
    set({ round: { ...round, answered: valve } });
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
