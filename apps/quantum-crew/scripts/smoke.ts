// pnpm --filter @moth-hack/quantum-crew smoke
// End-to-end check of the real WebSocket stack: starts a station on a free port, connects one TV and four phones
// (two pairs), plays one Act II batch with every phone always choosing OPEN, and checks that:
// - each phone receives exactly one light per round (its own), and
// - the batch is scored and pooled on the TV.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { BATCH_SIZE } from "../src/config.ts";
import type { ClientMsg, RoomState, ServerMsg } from "../src/shared/protocol.ts";
import { attachStation } from "../server/attach.ts";

const server = createServer();
attachStation(server);
await new Promise<void>((r) => server.listen(0, r));
const url = `ws://localhost:${(server.address() as AddressInfo).port}/ws`;

type Client = { ws: WebSocket; msgs: ServerMsg[]; send: (m: ClientMsg) => void; wait: <T extends ServerMsg>(f: (m: ServerMsg) => m is T) => Promise<T> };

async function client(): Promise<Client> {
  const ws = new WebSocket(url);
  const msgs: ServerMsg[] = [];
  const waiters: ((m: ServerMsg) => boolean)[] = [];
  ws.on("message", (d) => {
    const m = JSON.parse(String(d)) as ServerMsg;
    msgs.push(m);
    for (const w of [...waiters]) if (w(m)) waiters.splice(waiters.indexOf(w), 1);
  });
  await new Promise((r) => ws.once("open", r));
  return {
    ws,
    msgs,
    send: (m) => ws.send(JSON.stringify(m)),
    wait: (f) =>
      new Promise((resolve) => {
        const existing = msgs.find(f);
        if (existing) return resolve(existing);
        waiters.push((m) => (f(m) ? (resolve(m), true) : false));
      }),
  };
}

const is =
  <T extends ServerMsg["type"]>(type: T) =>
  (m: ServerMsg): m is Extract<ServerMsg, { type: T }> =>
    m.type === type;

const tv = await client();
tv.send({ type: "host:create" });
const { room } = await tv.wait(is("host:created"));
console.log(`Room ${room}`);

const seats = [
  ["Ada", "A"],
  ["Bo", "B"],
  ["Cy", "A"],
  ["Di", "B"],
] as const;
const phones = await Promise.all(seats.map(() => client()));
for (const [i, phone] of phones.entries()) {
  const [name, table] = seats[i]!;
  phone.send({ type: "player:join", room, name, table });
  await phone.wait(is("player:joined"));
  // Answer every round after a human-ish delay.
  phone.ws.on("message", (d) => {
    const m = JSON.parse(String(d)) as ServerMsg;
    if (m.type === "round:start") setTimeout(() => phone.send({ type: "player:valve", roundId: m.roundId, valve: 0 }), 50 + Math.random() * 250);
  });
}

const pairsReady = (m: ServerMsg): m is Extract<ServerMsg, { type: "room:state" }> => m.type === "room:state" && m.state.players.length === 4;
const lobby = (await tv.wait(pairsReady)).state;
console.log(`Pairs: ${lobby.pairs.map((p) => `${p.a.name}+${p.b.name}`).join(", ")}`);

tv.send({ type: "host:command", cmd: "startBatch" });
const t0 = Date.now();
const done = await tv.wait(
  (m): m is Extract<ServerMsg, { type: "room:state" }> => m.type === "room:state" && m.state.phase === "batchDone",
);
const s: RoomState = done.state;

let ok = true;
const check = (cond: boolean, what: string) => {
  console.log(`${cond ? "✓" : "✗"} ${what}`);
  ok &&= cond;
};

for (const [i, phone] of phones.entries()) {
  const starts = phone.msgs.filter(is("round:start"));
  const ids = new Set(starts.map((m) => m.roundId));
  check(starts.length === BATCH_SIZE && ids.size === BATCH_SIZE, `${seats[i]![0]} got one light per round (${starts.length})`);
  const leaks = phone.msgs.filter((m) => m.type !== "round:start" && /"light"/.test(JSON.stringify(m)));
  check(leaks.length === 0, `${seats[i]![0]} never saw anyone else's light`);
}
check(s.lastBatch?.rounds === 2 * BATCH_SIZE, `batch scored ${s.lastBatch?.rounds} pair-rounds`);
check(s.stability.act2.timeouts === 0, `no timeouts`);
const r = s.stability.rolling ?? 0;
check(r <= 1 && r >= 0, `pooled stability ${(r * 100).toFixed(1)}% (always-OPEN expects ≈ 75%)`);
console.log(`Batch took ${((Date.now() - t0) / 1000).toFixed(1)} s`);

for (const c of [tv, ...phones]) c.ws.close();
server.close();
process.exit(ok ? 0 : 1);
