import { describe, expect, it } from "vitest";
import { BATCH_SIZE, MP_RESULT_MS, MP_ROUND_MS, ROLLING_WINDOW, STRATEGY_MS } from "../src/config.ts";
import type { ClientMsg, RoomState, ServerMsg } from "../src/shared/protocol.ts";
import { OPTIMAL_TUNING, QUANTUM_LIMIT } from "../src/shared/chsh.ts";
import { mulberry32 } from "../src/shared/rng.ts";
import { BOT_NAME } from "./room.ts";
import { createStation } from "./station.ts";

/** A station with a fake clock and timers, recording every message per connection. */
function setup(seed = 1) {
  let now = 0;
  let timers: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 0;
  const inbox = new Map<string, ServerMsg[]>();
  const station = createStation({
    now: () => now,
    rng: mulberry32(seed),
    schedule: (fn, ms) => {
      const id = nextId++;
      timers.push({ at: now + ms, fn, id });
      return () => (timers = timers.filter((t) => t.id !== id));
    },
    send: (conn, msg) => inbox.set(conn, [...(inbox.get(conn) ?? []), msg]),
    newId: () => `id${nextId++}`,
  });

  const send = (conn: string, msg: ClientMsg) => station.handle(conn, msg);
  const msgs = (conn: string) => inbox.get(conn) ?? [];
  const last = <T extends ServerMsg["type"]>(conn: string, type: T) =>
    msgs(conn).filter((m): m is Extract<ServerMsg, { type: T }> => m.type === type).at(-1);
  const roomState = (conn: string): RoomState => last(conn, "room:state")!.state;
  /** Moves the clock forward, firing due timers in order. */
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      const due = timers.filter((t) => t.at <= end).sort((p, q) => p.at - q.at)[0];
      if (!due) break;
      timers = timers.filter((t) => t !== due);
      now = due.at;
      due.fn();
    }
    now = end;
  };
  const clear = (conn: string) => inbox.set(conn, []);

  send("tv", { type: "host:create" });
  const room = last("tv", "host:created")!.room;
  const join = (conn: string, name: string, table: "A" | "B") => send(conn, { type: "player:join", room, name, table });
  const host = (cmd: Extract<ClientMsg, { type: "host:command" }>["cmd"]) => send("tv", { type: "host:command", cmd });

  return { station, send, msgs, last, roomState, advance, clear, room, join, host };
}

describe("rooms and pairing", () => {
  it("creates a 4-letter room and pairs A_i with B_i, with a bot in empty seats", () => {
    const t = setup();
    expect(t.room).toMatch(/^[A-Z]{4}$/);
    t.join("p1", "Ada", "A");
    t.join("p2", "Bo", "B");
    t.join("p3", "Cy", "A");
    const { pairs, players } = t.roomState("tv");
    expect(players).toHaveLength(3);
    expect(pairs).toHaveLength(2);
    expect(pairs[0]!.a.name).toBe("Ada");
    expect(pairs[0]!.b.name).toBe("Bo");
    expect(pairs[1]!.a.name).toBe("Cy");
    expect(pairs[1]!.b).toEqual({ playerId: null, name: BOT_NAME });
  });

  it("rejects unknown rooms and full tables", () => {
    const t = setup();
    t.send("x", { type: "player:join", room: "ZZZZ", name: "Q", table: "A" });
    expect(t.last("x", "error")!.code).toBe("no-room");
    for (let i = 0; i < 4; i++) t.join(`a${i}`, `A${i}`, "A");
    t.join("a4", "A4", "A");
    expect(t.last("a4", "error")!.code).toBe("table-full");
  });

  it("only the host can run the session", () => {
    const t = setup();
    t.join("p1", "Ada", "A");
    t.send("p1", { type: "host:command", cmd: "startBatch" });
    expect(t.last("p1", "error")!.code).toBe("not-host");
    expect(t.roomState("tv").phase).toBe("lobby");
  });

  it("a player who reconnects with the same name and table gets their seat and live light back", () => {
    const t = setup();
    t.join("p1", "Ada", "A");
    t.join("p2", "Bo", "B");
    const id = t.last("p1", "player:joined")!.playerId;
    t.host("startBatch");
    const light = t.last("p1", "round:start")!.light;
    t.station.disconnect("p1");
    expect(t.roomState("tv").players.find((p) => p.id === id)!.connected).toBe(false);
    t.join("p1b", "ada", "A");
    expect(t.last("p1b", "player:joined")!.playerId).toBe(id);
    expect(t.last("p1b", "round:start")!.light).toBe(light);
    expect(t.roomState("tv").players).toHaveLength(2);
  });

  it("the host can resume with its token, not without", () => {
    const t = setup();
    const token = t.last("tv", "host:created")!.token;
    t.send("tv2", { type: "host:resume", room: t.room, token: "nope" });
    expect(t.last("tv2", "error")!.code).toBe("not-host");
    t.send("tv3", { type: "host:resume", room: t.room, token });
    expect(t.last("tv3", "host:created")!.room).toBe(t.room);
  });
});

describe("Act II rounds", () => {
  it("each phone gets only its own light, and a full batch scores every pair", () => {
    const t = setup(7);
    t.join("a1", "Ada", "A");
    t.join("b1", "Bo", "B");
    t.join("a2", "Cy", "A");
    t.host("startStrategy");
    expect(t.roomState("tv").phase).toBe("strategy");
    t.advance(STRATEGY_MS); // the huddle ends and the batch starts by itself
    for (let r = 1; r <= BATCH_SIZE; r++) {
      expect(t.roomState("tv")).toMatchObject({ phase: "round", roundNo: r });
      for (const conn of ["a1", "b1", "a2"]) {
        const start = t.last(conn, "round:start")!;
        expect(start.roundId).toBe(`1-${r}`);
        expect(Object.keys(start).sort()).toEqual(["act", "deadline", "light", "roundId", "serverNow", "type"]);
        // Everyone always OPENs; round:start never carries anyone else's light.
        t.send(conn, { type: "player:valve", roundId: start.roundId, valve: 0 });
      }
      // All answered: resolved at once, without waiting for the deadline.
      expect(t.roomState("tv").phase).toBe("roundResult");
      expect(t.last("tv", "round:results")!.results).toHaveLength(2);
      expect(t.last("a1", "round:result")!.pairId).toBe(1);
      t.advance(MP_RESULT_MS);
    }
    const s = t.roomState("tv");
    expect(s.phase).toBe("batchDone");
    expect(s.lastBatch!.rounds).toBe(2 * BATCH_SIZE);
    expect(s.stability.act2.rounds).toBe(2 * BATCH_SIZE);
    expect(s.pairs[0]!.act2.rounds).toBe(BATCH_SIZE);
    // Always-OPEN loses exactly the both-RED rounds.
    expect(s.stability.act2.timeouts).toBe(0);
    expect(s.stability.rolling).toBeCloseTo(s.stability.act2.wins / s.stability.act2.rounds, 10);
    // No state message ever reveals a light.
    for (const conn of ["a1", "b1", "a2", "tv"])
      for (const m of t.msgs(conn)) if (m.type === "room:state") expect(JSON.stringify(m)).not.toMatch(/"light"|"x"|"y"/);
  });

  it("a missing answer times out as a loss at the deadline", () => {
    const t = setup();
    t.join("a1", "Ada", "A");
    t.join("b1", "Bo", "B");
    t.host("startBatch");
    const id = t.last("a1", "round:start")!.roundId;
    t.send("a1", { type: "player:valve", roundId: id, valve: 0 });
    expect(t.roomState("tv").pairs[0]!.answered).toEqual({ a: true, b: false });
    t.advance(MP_ROUND_MS);
    expect(t.last("a1", "round:result")).toMatchObject({ win: false, timedOut: true });
    // A late answer is ignored.
    t.send("b1", { type: "player:valve", roundId: id, valve: 0 });
    expect(t.roomState("tv").stability.act2).toEqual({ rounds: 1, wins: 0, timeouts: 1 });
  });

  it("pooled stability is a rolling window; ceiling and reset work", () => {
    const t = setup();
    t.join("a1", "Ada", "A");
    for (let b = 0; b < 5; b++) {
      t.host("startBatch");
      t.advance((MP_ROUND_MS + MP_RESULT_MS) * BATCH_SIZE);
    }
    const s = t.roomState("tv");
    expect(s.stability.act2.rounds).toBe(5 * BATCH_SIZE);
    expect(s.stability.rolling).toBe(0); // Ada never answered
    expect(s.batchNo).toBe(5);
    expect(5 * BATCH_SIZE).toBeGreaterThan(ROLLING_WINDOW);
    t.host("revealCeiling");
    expect(t.roomState("tv")).toMatchObject({ phase: "ceiling", ceilingRevealed: true });
    t.host("startBatch");
    expect(t.last("tv", "error")!.code).toBe("not-now");
    t.host("reset");
    expect(t.roomState("tv")).toMatchObject({ phase: "lobby", batchNo: 0, ceilingRevealed: false });
    expect(t.roomState("tv").stability.act2.rounds).toBe(0);
    expect(t.roomState("tv").players).toHaveLength(1);
  });

  it("players joining mid-batch are seated after it", () => {
    const t = setup();
    t.join("a1", "Ada", "A");
    t.host("startBatch");
    t.join("b1", "Bo", "B");
    expect(t.roomState("tv").pairs[0]!.b.playerId).toBeNull();
    expect(t.last("b1", "round:start")).toBeUndefined();
    t.advance((MP_ROUND_MS + MP_RESULT_MS) * BATCH_SIZE);
    t.host("startBatch");
    expect(t.roomState("tv").pairs[0]!.b.name).toBe("Bo");
    expect(t.last("b1", "round:start")).toBeDefined();
  });
});

describe("Act III rounds", () => {
  /** Two human pairs (tuned optimally) plus one human with an AI crewmate. */
  function act3Room(seed: number) {
    const t = setup(seed);
    const seats = [
      ["a1", "Ada", "A"],
      ["b1", "Bo", "B"],
      ["a2", "Cy", "A"],
      ["b2", "Di", "B"],
      ["a3", "Ed", "A"],
    ] as const;
    for (const [conn, name, table] of seats) t.join(conn, name, table);
    t.host("startBatch");
    t.advance((MP_ROUND_MS + MP_RESULT_MS) * BATCH_SIZE);
    t.host("revealCeiling");
    t.host("unlockTool");
    for (const [conn, , table] of seats) t.send(conn, { type: "player:strategy", act: 3, tuning: OPTIMAL_TUNING[table] });
    return { t, conns: seats.map((s) => s[0]) };
  }

  /** Plays `batches` batches; `order` picks which phones tap MEASURE first in each round. */
  function play(t: ReturnType<typeof setup>, conns: readonly string[], batches: number, order: (round: number) => string[]) {
    for (let b = 0; b < batches; b++) {
      t.host("startBatch");
      for (let r = 0; r < BATCH_SIZE; r++) {
        for (const conn of order(r).filter((c) => conns.includes(c))) {
          const start = t.last(conn, "round:start")!;
          t.send(conn, { type: "player:measure", roundId: start.roundId });
        }
        t.advance(MP_RESULT_MS + 1);
      }
      t.advance(MP_RESULT_MS);
    }
  }

  it("unlocks the tool into Act III; valve taps no longer count", () => {
    const { t } = act3Room(1);
    expect(t.roomState("tv")).toMatchObject({ phase: "tool", act: 3, toolUnlocked: true });
    t.host("startBatch");
    const start = t.last("a1", "round:start")!;
    expect(start).toMatchObject({ act: 3, dialDeg: OPTIMAL_TUNING.A[start.light === 0 ? "greenDeg" : "redDeg"] });
    t.send("a1", { type: "player:valve", roundId: start.roundId, valve: 0 });
    expect(t.roomState("tv").pairs[0]!.answered.a).toBe(false);
  });

  it("sends the measured valve only to the phone that measured", () => {
    const { t } = act3Room(2);
    t.host("startBatch");
    t.clear("b1");
    t.send("a1", { type: "player:measure", roundId: t.last("a1", "round:start")!.roundId });
    expect(t.last("a1", "round:measured")).toBeDefined();
    expect(t.last("b1", "round:measured")).toBeUndefined();
  });

  it.each([
    ["A first", () => ["a1", "a2", "a3", "b1", "b2"]],
    ["B first", () => ["b1", "b2", "a1", "a2", "a3"]],
    ["alternating", (r: number) => (r % 2 ? ["a1", "a2", "a3", "b1", "b2"] : ["b2", "b1", "a3", "a2", "a1"])],
  ])("optimal dials beat the classical limit, whoever measures first (%s)", (_, order) => {
    const { t, conns } = act3Room(3);
    play(t, conns, 80, order);
    const { act3 } = t.roomState("tv").stability;
    expect(act3.rounds).toBe(80 * BATCH_SIZE * 3);
    expect(act3.timeouts).toBe(0);
    expect(Math.abs(act3.wins / act3.rounds - QUANTUM_LIMIT)).toBeLessThan(0.025);
  });

  it("no-signalling: every seat's OPEN rate is ≈ 50% whatever its partner saw (debrief only)", () => {
    const { t, conns } = act3Room(4);
    play(t, conns, 80, (r) => (r % 2 ? ["a1", "a2", "a3", "b1", "b2"] : ["b1", "b2", "a1", "a2", "a3"]));
    expect(t.roomState("tv").marginals).toBeNull();
    t.host("debrief");
    const { rows, crew } = t.roomState("tv").marginals!;
    expect(crew.rounds).toBe(6 * 80 * BATCH_SIZE);
    expect(Math.abs(crew.partnerGreen! - 0.5)).toBeLessThan(0.03);
    expect(Math.abs(crew.partnerRed! - 0.5)).toBeLessThan(0.03);
    expect(rows.map((r) => r.name).sort()).toEqual(["AI crewmate (pair 3)", "Ada", "Bo", "Cy", "Di", "Ed"]);
    for (const row of rows) {
      expect(row.rounds).toBe(80 * BATCH_SIZE);
      expect(Math.abs(row.partnerGreen! - 0.5)).toBeLessThan(0.07);
      expect(Math.abs(row.partnerRed! - 0.5)).toBeLessThan(0.07);
    }
  });

  it("a timeout in Act III is a loss; tunings snap to the dial", () => {
    const { t } = act3Room(5);
    t.send("a1", { type: "player:strategy", act: 3, tuning: { greenDeg: 46, redDeg: -22 } });
    t.host("startBatch");
    const start = t.last("a1", "round:start")!;
    expect(start.dialDeg).toBe(start.light === 0 ? 45 : 157.5);
    t.advance(MP_ROUND_MS);
    expect(t.last("a1", "round:result")).toMatchObject({ win: false, timedOut: true });
  });
});
