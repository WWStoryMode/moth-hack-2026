# faded-passport

Working notes for Claude (not exported). The source of truth for intent is `BRIEF.md`; see the root CLAUDE.md
for repo rules.

- **Goal:** a mobile-first narrative web game. The traveller's portrait morphs into home via TeleBlur; entry is
  always refused.
- **Challenges:** 01 (entry document PNG), 08 (deployed web app), 05 (quantum game + itch.io game jam). 06 maybe later.
- **Engine:** `telablur-v1`, 1 credit per run, simulator only (no `mode`), so the form answer is "Emulation".
  Quantum idea: both images share one quantum state, and a selector qubit rotated by `strength` mixes them at
  the amplitude level. Pixel positions are qubits too, so the mix spreads as grid-like interference.
- **Layout:** `api/*.ts` are thin Vercel Web handlers → `server/telablur.ts` (all Moth calls). `src/config.ts` is
  shared by browser and server (params, years curve, thresholds). All text is in `src/strings.ts`.
  `tsconfig.json` = Node side (Vercel compiles api/ with it), `tsconfig.app.json` = browser.
- **Status (2026-09-26):** MVP built. Proxy verified live (`pnpm try`, 14 s, assets deleted). UI typechecks and
  builds, but hasn't been tried in a browser or on a phone by the user yet. Not deployed.
- **Tuning TODO:** verdict thresholds (0.10 / 0.20) are provisional; the synthetic test gave 0.245 at strength 0.6.
  The years curve may be too strong (the face is nearly all home by 10 years). Tune on real photos; the dev
  console logs `strength → masked change`.
- **Sweep:** `?debug` home step → "Download inputs" zip → `pnpm sweep <zip> --years …` (1 credit/year, `--dry-run`
  is free). Summary CSV has the change + verdict per year, which is the data for tuning thresholds.
- **Open risks:** Vercel compiling the workspace `.ts` package (fallback: esbuild-bundle `api/`). The lasso on a
  real phone hasn't been tested. The itch.io build needs `VITE_API_BASE` + CORS (stretch).
