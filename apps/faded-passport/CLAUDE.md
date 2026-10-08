# faded-passport

Working notes for Claude (not exported). The source of truth for intent is `BRIEF.md`; see the root CLAUDE.md
for repo rules.

- **Goal:** a mobile-first narrative web game. The traveller's portrait morphs into home via Teleblur. Entry is
  granted ("Next.", green stamp) while the face is still recognisable, refused otherwise (branch faded-passport/accept-entry).
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
  feather 16); strength = piecewise STRENGTH_CURVE in config.ts, crossing 0.13–0.36 and 0.61–0.85 in ~1 year each (branch faded-passport/linear-strength; was 0.1 + 0.9·t², then linear); Teleblur size 8 → 128 on a log curve.
- **Phase 1 visual pass (2026-10-03, branch faded-passport/phase-1-visual, tag phase-1-visual):** all colours,
  fonts, spacing and borders are tokens in `src/tokens.css` (canvas code reads them via `lib/tokens.ts`). Red
  (`--stamp`) is only for official marks. Title shows `components/Seal.tsx`; ENTRY DENIED appears only at the
  verdict and on the permit. Ink wear comes from `lib/inkTexture.ts` (rendered once). Passport photos use
  `components/PassportPhoto.tsx` (35:45, sepia; the processed face is untreated on the verdict and permit).
  MRZ font: bundled OCR-B (`public/fonts`, licence file alongside). Debug samples: `src/samples.ts` +
  `public/samples/` (the four pixel-art samples are committed and public; anything else there is gitignored). The brand is "Teleblur"; the API id is `telablur-v1`.
- **Phase 2 UX (2026-10-04, branch faded-passport/phase-2-ux, tag phase-2-ux):** flags in `lib/flags.ts`
  (`?age=photo|all|hint`, `?debug=1`; retry ageing was dropped). The booth window (`components/BoothWindow.tsx`)
  replaces the officer icon. Portrait hand-over is drag-to-slot (`components/DragToSlot.tsx`) with a "Hand it
  over" button alternative; mask/home keep buttons (they answer questions). The terminal scan
  (`components/ScanOverlay.tsx`) shows only real job values. Ageing: `lib/ageing.ts` (AA-clamped colours,
  stage by years) + `lib/ageTextures.ts`; the permit ages with `?age=all`. Photo inputs are labelled by action;
  the camera button is hidden on desktop.
- **Verdict (accept-entry branch):** `lib/change.ts` `verdict()`: likeness (outline-weighted SSIM, 128 px luma) ≥ 0.60 →
  granted; else homeness ≥ 0.50 → "cannot be distinguished from the declared destination", ≥ 0.40 → address, else no
  match. Thresholds `VERDICT` in config.ts, measured on the user's 1–40 sweeps (granted 1–6, place 38–40). Green
  stamp `--stamp-granted`; both stamp inks clamped ≥ 3:1 when aged. The sweep CSV reports likeness/homeness/outcome.
- **Processing record (branch faded-passport/process-record):** the Document screen downloads the raw Teleblur output,
  `parameters.json` (`lib/record.ts`, real values only) or a zip with the permit + output + params + the exact inputs.
- **Samples for everyone (branch faded-passport/samples-for-all):** sample buttons show without `?debug` (before a photo is
  chosen); a sample home photo gets an "Another place" corner tab. Loading lives in `screens/PhotoStep.tsx`.
- **Tuning TODO:** verdict thresholds come from one photo pair; re-check with other faces/homes via a sweep's summary.csv. Teleblur `size` may
  round up to a power of two (as Quantum Blur does), so sizes 65–128 could look identical; unverified.
- **Sweep:** `?debug` home step → "Download inputs" zip → `pnpm sweep <zip> --years …` (1 credit/year, `--dry-run`
  is free). Summary CSV has the change + verdict per year, which is the data for tuning thresholds.
- **Open risks:** the itch.io build needs `VITE_API_BASE` + CORS (stretch). The sweep's live path is untested
  (dry run passes; it uses the same client calls as `pnpm try`).
