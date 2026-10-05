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
- **Atlas assets:** drop files into `src/assets/atlas/` named by manifest key (any extension); `import.meta.glob`
  picks them up and placeholders vanish. Fill `params` in `manifest.ts` for the credits. NB the root .gitignore
  ignores *.mp4/*.wav: use png/webm/mp3 or add an exception.
- **Git:** one branch per milestone (`quantum-crew/mN-…`), PR per milestone, user reviews before merge.
- **Status (2026-10-05):** M0–M2 merged. M3 (rooms + TV + phones, Act II) done on `quantum-crew/m3-rooms`: 34 tests,
  `pnpm smoke` passes, TV + 3 phones driven in headless Chrome (join, huddle, batch, ceiling, reload-rejoin).
  Next: M4 Act III multiplayer (tuning, server-side measure order, `round:measured`) + TV debrief with marginals.
- **Decisions:** marginals in `simulate` are the fraction of CLOSED valves. In simulation, who measures first is a coin
  flip per round unless `order` is given. Solo: the player always measures first; Act II plan pickers feed the
  1,000-round test (rounds are tapped live); the meter spans 50–100%; the 75 line appears from the ceiling reveal
  and 85.4 in Act III; debrief unlocks at a ≥ 80% 1,000-round test or after 4 Act III batches; hint after 3 Act III
  batches under 80%. No framer-motion yet (CSS animations suffice); sounds and mute toggle are M5.
  Event: rounds 3.5 s (MP_ROUND_MS); the huddle's end auto-starts the batch; a round resolves early once everyone
  answered; joiners mid-batch are seated after it; max 4 per table; empty seat = bot (always OPEN in Act II);
  the TV QR uses the URL the TV was opened at.
- **Open questions:** which Atlas sound engine for sfx; deploy host (decide after M2/M3).
