# faded-passport

Working notes for Claude (not exported). The source of truth for intent is `BRIEF.md`; see the root CLAUDE.md
for repo rules.

- **Goal:** a mobile-first narrative web game. The traveller's portrait morphs into home via Teleblur; entry is
  always refused.
- **Challenges:** 01 (entry document PNG), 08 (deployed web app), 05 (quantum game + itch.io game jam). 06 maybe later.
- **Engine:** `telablur-v1`, 1 credit per run, simulator only (no `mode`), so the form answer is "Emulation".
  Quantum idea: both images share one quantum state, and a selector qubit rotated by `strength` mixes them at
  the amplitude level. Pixel positions are qubits too, so the mix spreads as grid-like interference.
- **Layout:** `api/*.ts` are thin Vercel Web handlers → `server/telablur.ts` (all Moth calls). `src/config.ts` is
  shared by browser and server (params, years curve, thresholds). All text is in `src/strings.ts`.
  `tsconfig.json` = Node side (Vercel compiles api/ with it), `tsconfig.app.json` = browser.
- **Status (2026-09-27):** MVP works end to end. User tested on PC and phone. Deployed at
  https://faded-passport.vercel.app (functions fixed via relative `server/atlas.ts` + rewriteRelativeImportExtensions).
  Added since: title + story pages; portrait-luminance mask (MASK in config: multiply ×0.5 outside → ×1.5 inside,
  feather 16); strength = 0.1 + 0.9·t² (slow start, fast end); Teleblur size 8 → 128 on a log curve.
- **Phase 1 visual pass (2026-10-03, branch faded-passport/phase-1-visual, tag phase-1-visual):** all colours,
  fonts, spacing and borders are tokens in `src/tokens.css` (canvas code reads them via `lib/tokens.ts`). Red
  (`--stamp`) is only for official marks. Title shows `components/Seal.tsx`; ENTRY DENIED appears only at the
  verdict and on the permit. Ink wear comes from `lib/inkTexture.ts` (rendered once). Passport photos use
  `components/PassportPhoto.tsx` (35:45, sepia; the processed face is untreated on the verdict and permit).
  MRZ font: bundled OCR-B (`public/fonts`, licence file alongside). Debug samples: `src/samples.ts` +
  `public/samples/` (the four pixel-art samples are committed and public; anything else there is gitignored). The brand is "Teleblur"; the API id is `telablur-v1`.
- **Tuning TODO:** verdict thresholds (0.10 / 0.20) are provisional. Use a sweep's summary.csv. Teleblur `size` may
  round up to a power of two (as Quantum Blur does), so sizes 65–128 could look identical; unverified.
- **Sweep:** `?debug` home step → "Download inputs" zip → `pnpm sweep <zip> --years …` (1 credit/year, `--dry-run`
  is free). Summary CSV has the change + verdict per year, which is the data for tuning thresholds.
- **Open risks:** the itch.io build needs `VITE_API_BASE` + CORS (stretch). The sweep's live path is untested
  (dry run passes; it uses the same client calls as `pnpm try`).
