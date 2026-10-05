// Puts the station's WebSocket on an existing HTTP server at /ws. Used by the production server
// (server/index.ts) and by the Vite dev server (vite.config.ts), so dev and prod share one origin.
import type { Server } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import { WS_PATH, parseClientMsg, type ServerMsg } from "../src/shared/protocol.ts";
import { mulberry32, randomSeed } from "../src/shared/rng.ts";
import { createStation } from "./station.ts";

export function attachStation(server: Server) {
  const sockets = new Map<string, WebSocket>();
  const station = createStation({
    now: () => Date.now(),
    rng: mulberry32(randomSeed()),
    schedule: (fn, ms) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
    send: (conn, msg: ServerMsg) => {
      const ws = sockets.get(conn);
      if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    },
    newId: () => randomUUID(),
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    // Leave other upgrades (e.g. Vite's HMR socket) alone.
    if (new URL(req.url ?? "/", "http://x").pathname !== WS_PATH) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
  });

  wss.on("connection", (ws: WebSocket) => {
    const conn = randomUUID();
    sockets.set(conn, ws);
    let alive = true;
    ws.on("pong", () => (alive = true));
    const ping = setInterval(() => {
      if (!alive) return ws.terminate();
      alive = false;
      ws.ping();
    }, 15_000);
    ws.on("message", (data) => {
      const msg = parseClientMsg(String(data));
      if (msg) station.handle(conn, msg);
      else ws.send(JSON.stringify({ type: "error", code: "bad-request", message: "Bad message." } satisfies ServerMsg));
    });
    ws.on("close", () => {
      clearInterval(ping);
      sockets.delete(conn);
      station.disconnect(conn);
    });
  });

  const sweep = setInterval(() => station.sweep(), 60_000);
  sweep.unref();
  return station;
}
