# Moth Hack 2026 monorepo

A pnpm monorepo for Moth Hack 2026, a quantum-creativity hackathon on the Moth Quantum "Atlas" API.
Each challenge gets its own app in `apps/`, and each is submitted separately via its own form entry.
The user is new to quantum computing, so see **Learning mode** below.

**Deadline: Fri 2 Oct 2026, 11:59 PM Pacific (= Sat 3 Oct 07:59 London).** Winners announced 5 Oct on Discord.

## Docs (read before using a new endpoint or engine)
- Intro: https://docs.mothquantum.com/docs/intro
- Getting started: https://docs.mothquantum.com/docs/getting-started
- Authentication: https://docs.mothquantum.com/docs/authentication
- Submitting jobs: https://docs.mothquantum.com/docs/submitting-jobs
- Job status & results: https://docs.mothquantum.com/docs/job-status-and-results
- Assets (uploads): https://docs.mothquantum.com/docs/assets
- Errors & rate limits: https://docs.mothquantum.com/docs/errors
- Engine pages: https://docs.mothquantum.com/docs/engines/<engine-id> (e.g. coin-toss-v1)
- API reference: https://api.mothquantum.com/docs · spec: https://api.mothquantum.com/openapi.json
  (pinned copy: `packages/atlas-client/openapi.json`; refresh with `pnpm gen:types`)
- Hackathon + challenges: https://hack.mothquantum.com · Platform: https://platform.mothquantum.com

## Rules
- **Never invent endpoints, params or result fields.** Check the pinned spec (`packages/atlas-client/openapi.json`)
  or the engine's docs page. The spec types per-engine params, but not inline `result` shapes; type those from
  the engine's docs page and cite it. If unclear, ask the user.
- **API key only from env** (`MOTH_API_KEY`, loaded from the root `.env` by `loadEnv()`). Never log, print,
  hard-code or write it to a file. Never pass it to browser code: web apps (challenges 05, 08) must call the API
  through a server-side proxy.
- **Never commit secrets.** `.env` is gitignored. `pnpm export` scans for `moth_…` keys. Engine params like
  `qpu_token` are redacted from provenance files.
- **Cache quantum results.** Jobs can be slow (QPU mode queues for minutes) and cost credits, and inline results
  expire server-side. Save every run immediately into the app's `output/` (gitignored) with `saveRun()` /
  `downloadOutputs()`. Reuse saved results instead of re-running when iterating on non-quantum code.
- Use `@moth-hack/atlas-client` for all API calls in TS apps; don't hand-roll fetches.
- Default to `mode: "emu"` (emulator) while developing. Use `"qpu"` only when the user asks (a final hardware
  run can strengthen "depth of quantum usage").
- Don't auto-retry job submission except on 429/503 (the client already handles this). Re-submitting costs credits.

## Learning mode
Whenever an app uses an engine, put a short comment at the top of the file (2–6 lines) explaining the quantum
idea behind it in plain language: what the circuit does (superposition, entanglement, measurement, noise…) and
why the output looks the way it does. Also explain new quantum terms briefly in chat.

## Layout
```
packages/atlas-client   typed API client (submitJob, getStatus, waitForJob, getResult, run,
                        uploadAsset, downloadOutputs, getMe, saveRun, loadEnv)
apps/_template          copied by `pnpm new-app`
apps/first-call         sandbox: first coin-toss call (never submitted)
apps/cNN-<slug>         one app per challenge entry (NN = challenge 01–10)
scripts/                new-app, tracker, export
```
- **Each app has its own `CLAUDE.md`** (goal, engines, status, open questions). Read it before working in that app
  and keep it updated.
- Each challenge app has `submission.json`, which mirrors the submission form, plus a committed `showcase/`
  for chosen outputs (poster etc.). Files over ~5 MB (video/audio) stay out of git; they're gitignored by extension.
- Non-TS apps are fine (Python notebook for challenge 10, JUCE/C++ plugin for 07): give them their own tooling
  inside the app folder, with no `package.json` needed. A notebook should call the API directly with `requests`
  so judges can read it top to bottom.

## Commands
- `pnpm typecheck` checks the whole workspace
- `pnpm first-call` runs the coin-toss sandbox
- `pnpm new-app c03-my-idea` scaffolds an app for challenge 03
- `pnpm --filter @moth-hack/<app> start` runs an app
- `pnpm tracker` regenerates the README table from `submission.json` files
- `pnpm export <app>` writes `dist/submissions/<app>/{repo/, repo.zip, form/FORM.md}` and checks the form rules.
  Pushing `repo/` to a public GitHub repo is a separate step; always confirm with the user first.
- After submitting: `git tag submitted/<app>`

## Submission form (one entry per project)
Required: title, one-sentence pitch, challenge, description (100–200 words), technical description
(50–100 words, including engines), engines used, QPU or emulation, **public code repo for code projects**,
**poster image (1:1 to 4:3)**, **demo video link (≤ 3 min, public)**. Optional: demo URL, up to 5 extra images,
slides PDF, gen-AI disclosure, non-Moth APIs. Personal details (name, email, Discord) are **not** stored in this repo.
Judging: quality of execution, depth of quantum + Atlas usage, originality (judged within tier).

Challenge deliverables: 01 image + params · 02 audio + workflow summary · 03 3D (e.g. shader on a 3D asset, as
video) · 04 video · 05 game · 06 many engines in one project · 07 VST/AU plugin + audio examples · 08 web app link
· 09 repo applying a quantum process to media · 10 Python notebook.
