// The station: every room on this server, keyed by a 4-letter code, plus which connection belongs to which room.
// State is in memory only; a restart ends every session (see the spec's non-goals).
import type { ClientMsg } from "../src/shared/protocol.ts";
import { createRoom, type Conn, type Room, type RoomDeps } from "./room.ts";

// No I or O, so codes read cleanly off a TV.
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
/** Rooms with nobody connected are dropped after this long. */
export const IDLE_MS = 30 * 60_000;

export function createStation(deps: RoomDeps) {
  const rooms = new Map<string, Room>();
  const roomOf = new Map<Conn, Room>();

  function newCode(): string {
    for (;;) {
      const code = Array.from({ length: 4 }, () => LETTERS[Math.floor(deps.rng() * LETTERS.length)]).join("");
      if (!rooms.has(code)) return code;
    }
  }

  function bind(conn: Conn, room: Room) {
    const prev = roomOf.get(conn);
    if (prev && prev !== room) prev.disconnect(conn);
    roomOf.set(conn, room);
  }

  return {
    rooms,

    handle(conn: Conn, msg: ClientMsg) {
      if (msg.type === "host:create") {
        const room = createRoom(newCode(), deps);
        rooms.set(room.code, room);
        bind(conn, room);
        return room.handle(conn, msg);
      }
      if (msg.type === "host:resume" || msg.type === "player:join") {
        const room = rooms.get(msg.room.toUpperCase());
        if (!room) return deps.send(conn, { type: "error", code: "no-room", message: `No station with code ${msg.room}.` });
        bind(conn, room);
        return room.handle(conn, msg);
      }
      const room = roomOf.get(conn);
      if (!room) return deps.send(conn, { type: "error", code: "bad-request", message: "Join a room first." });
      room.handle(conn, msg);
    },

    disconnect(conn: Conn) {
      roomOf.get(conn)?.disconnect(conn);
      roomOf.delete(conn);
    },

    /** Drops rooms nobody has used for a while. Call on an interval. */
    sweep() {
      for (const [code, room] of rooms) {
        if (room.isIdle(IDLE_MS)) {
          room.dispose();
          rooms.delete(code);
        }
      }
    },
  };
}

export type Station = ReturnType<typeof createStation>;
