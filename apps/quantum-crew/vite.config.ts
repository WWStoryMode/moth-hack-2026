import react from "@vitejs/plugin-react";
import type { Server } from "node:http";
import { defineConfig, type Plugin } from "vite";
import { attachStation } from "./server/attach.ts";
import { HEALTH_PATH } from "./src/shared/protocol.ts";

/** Dev only: run the station WebSocket inside the Vite dev server, so `pnpm dev` covers solo and event mode. */
function station(): Plugin {
  return {
    name: "quantum-crew-station",
    apply: "serve",
    configureServer(server) {
      if (server.httpServer) attachStation(server.httpServer as Server);
      server.middlewares.use(HEALTH_PATH, (_req, res) => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), station()],
});
