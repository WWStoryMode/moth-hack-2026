# quantum-crew

Working notes for Claude (not exported). The spec is `~/Downloads/SPEC.md` (not in the repo); the plan is milestones
M0–M6. See the root CLAUDE.md for repo rules.

- **Challenge:** 11 FQxI Challenge (Guest): an educational app teaching a general audience about quantum, ≥ 1 Atlas engine.
- **Goal:** a Spaceteam-style co-op party game (two tables, phones + a shared TV) plus a solo mode for judges. Players
  feel the 75% classical ceiling of the CHSH game, then beat it (≈ 85.4%) with a shared "Entanglement Tool".
  Physics words appear only in the debrief.
- **Engines used:** Atlas assets made by William on platform.mothquantum.com (tessa-image-v1 station art, blur-v1
  degradation levels, entanglement-shader-v1 tool reveal, a sound engine for sfx). The in-game entanglement is a
  classical simulation of |Φ+⟩ in `src/shared/chsh.ts`; say so honestly in the README and credits.
- **Layout:** `src/shared/` is pure logic shared by client, server, tests and scripts (`rng.ts` mulberry32,
  `chsh.ts`). `src/config.ts` holds the game tuning (timers, batch size, bot plan, unlock thresholds). All copy is in
  `src/strings.ts` (physics words only under `debrief`). Solo = `src/solo/` (`soloStore.ts` is a zustand vanilla
  store; actions take `now` so tests drive the clock; `Batch.tsx` owns the timers). Router = `lib/router.ts`
  (pathname + history, no library). Colours etc. in `tokens.css`; Act III screens use the `.quantum` theme.
  `tsconfig.json` = Node side, `tsconfig.app.json` = browser.
- **Event mode (M3):** `src/shared/protocol.ts` = message types + `parseClientMsg`. `server/room.ts` = one
  authoritative room (pairing, rounds, timers, scoring; deps injected → `server/room.test.ts` drives it with a fake
  clock). `server/station.ts` = rooms by code + conn routing. `server/attach.ts` puts the WS on any http server
  (used by `server/index.ts` in prod and by the Vite plugin in dev, so `pnpm dev` runs everything).
  Client: `net/socket.ts` (auto-reconnect, `hello` re-identifies), `net/hostStore.ts`, `net/playerStore.ts`
  (sessionStorage keeps the seat across reloads), `screens/Screen.tsx` (TV), `screens/Play.tsx` (phone).
  `pnpm start` = `node server/index.ts` (Node type stripping, no tsx). `pnpm smoke` = real-WS end-to-end check.
- **Atlas assets:** drop files into `src/assets/atlas/` named by key (any extension); `manifest.ts` resolves them via
  `import.meta.glob` and placeholders vanish. The list + `params` for credits live in `list.ts` (plain data, also
  read by `pnpm assets`, the checklist). Root .gitignore ignores *.mp4/*.wav: use png/webp/webm/mp3.
  Swap verified 2026-10-05 with temporary SVGs (station-base, crew-icons sprite halves, entanglement-reveal).
- **Entanglement Shader (live):** engine output (job `entanglement-shader-v1-a08def9e`, LUTs 60×60) is committed in
  `atlas-src/entanglement-shader/`; `pnpm bake-shader` decodes R/T `.hdr` → `src/assets/atlas/entanglement-lut.json`.
  `atlas/entanglementShader.ts` = WebGL2 port of the engine's GLSL (`lutColour` is line-for-line) + scenes (film,
  two synced faceted crystals); display grading = tonemap + saturation lift only. `components/EntanglementSurface.tsx`
  (`Crystals`, film) falls back to CSS when the LUT or WebGL2 is missing. Params in list.ts (frustrated, 3 layers, 8 rays, R 0.3,
  A 0.6, interaction 1; resolution 60 per the LUT size, although 120 was suggested).
- **gen-assets (2026-10-06):** `scripts/gen-assets.ts` (tsx; atlas-client can't be type-stripped) + `scripts/lib/inputs.ts`
  (procedural 64×36 station / 64×32 crew PNGs; `atlas-src/inputs/` is gitignored by the root `inputs/` rule, it's
  regenerated each run). Tessa max 64×64 on simulators. Tessa jobs 2e442ee7, 7a263168 (fake_fez) and 0510ac96 (aer)
  all failed with engine_timeout after ~60 s, so Blur levels 0–4 were made from the drawn station
  (`--blur-source drawn`), jobs a2dfaf41 (0), b9bd20ff (1), dd70e7a7 (2), 074738dc (3), 5a991314 (4); ~12 s each.
  Provenance files sit next to each PNG; manifest `assetProvenance()` feeds the credits. Display: pixelated, contain.
- **Sound (M5):** `audio/sfx.ts` plays `sfx-*` files or a Web Audio stand-in; mute per context (solo/tv/phone) in
  localStorage, defaults on/on/off; audio unlocks on the first tap. Triggers: win chime (solo round won, TV when
  ≥ half the pairs held, phone flash), alarm (batch ends < 80%, TV rolling crosses below 80%), reveal (tool).
- **Git:** one branch per milestone (`quantum-crew/mN-…`), PR per milestone, user reviews before merge.
- **Status (2026-10-05):** M0–M4 merged. M5 (Atlas asset pipeline, sounds + mute, crew icons, Act III backdrop,
  TV layout fixes) on `quantum-crew/m5-polish` (PR #9); live Entanglement Shader on `…/m5-entanglement-shader`;
  gen-assets + Blur levels on `…/m5-atlas-gen` (stacked, unpushed). Assets 6/11 (shader + 5 Blur levels). Next: William adds assets +
  params; deploy (host TBD); submission.json copy, poster, video. M6 (Act I) only if time allows.
- **Decisions:** marginals in `simulate` are the fraction of CLOSED valves. In simulation, who measures first is a coin
  flip per round unless `order` is given. Solo: the player always measures first; Act II plan pickers feed the
  1,000-round test (rounds are tapped live); the meter spans 50–100%; the 75 line appears from the ceiling reveal
  and 85.4 in Act III; debrief unlocks at a ≥ 80% 1,000-round test or after 4 Act III batches; hint after 3 Act III
  batches under 80%. No framer-motion yet (CSS animations suffice); sounds and mute toggle are M5.
  Event: rounds 3.5 s (MP_ROUND_MS); the huddle's end auto-starts the batch; a round resolves early once everyone
  answered; joiners mid-batch are seated after it; max 4 per table; empty seat = bot (always OPEN in Act II);
  the TV QR uses the URL the TV was opened at. Act III: bots measure at round start (always first); tunings snap to
  the 8 dial stops; the tool unlocks only after the ceiling reveal; hint and debrief step are TV-local state;
  per-seat marginals are sent only in the debrief phase (plus a pooled "whole crew" row).
- **Open questions:** which Atlas sound engine for sfx; deploy host (decide after M2/M3).
