import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * Local dev only: serve /api/* from the same api/*.ts handlers Vercel runs, so `pnpm dev`
 * works without a Vercel login. The handlers load MOTH_API_KEY from the repo-root .env.
 */
function devApi(): Plugin {
  return {
    name: "faded-passport-dev-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        const route = /^\/api\/(submit|status|result)$/.exec(url.pathname)?.[1];
        if (!route) return next();
        try {
          const mod = (await server.ssrLoadModule(`/api/${route}.ts`)) as Record<string, unknown>;
          const handler = mod[req.method ?? "GET"];
          if (typeof handler !== "function") {
            res.statusCode = 405;
            return res.end();
          }
          const chunks: Buffer[] = [];
          for await (const c of req) chunks.push(c as Buffer);
          const hasBody = req.method !== "GET" && req.method !== "HEAD";
          const request = new Request(url, {
            method: req.method ?? "GET",
            headers: req.headers as Record<string, string>,
            ...(hasBody ? { body: Buffer.concat(chunks) } : {}),
          });
          const response = (await handler(request)) as Response;
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApi()],
});
