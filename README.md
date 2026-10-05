# Moth Hack 2026

My entries for [Moth Hack 2026](https://hack.mothquantum.com), a hackathon about making creative work with
quantum computing through the [Moth Quantum Atlas API](https://docs.mothquantum.com/docs/intro).

Each project is its own app in `apps/`, and they share a typed API client in `packages/atlas-client`. One project
can be entered for several challenges, and each entry can be exported as a standalone repo for submission.

## Projects

### [Faded Passport](apps/faded-passport): complete

**Play it:** https://faded-passport.vercel.app · entered for challenges **01**, **05** and **08** · engine
**Quantum Teleblur** (`telablur-v1`, simulator)

A short border-crossing game in reverse: you are the traveller trying to return home after many years. Your
passport photo is morphed into a photo of home by Teleblur, which places both images in one quantum state and
rotates a selector qubit between them. How long you've been away sets the rotation, and the outline you draw
around your face sets where it happens. While the photo still looks like you, the officer lets you through
("Next."). Once the years have dissolved your face, entry is refused.

- Mobile-first React + Vite app. Vercel serverless functions keep the API key off the browser.
- The years map to Teleblur `strength` and `size` along a curve tuned on 1–40 year sweeps of real photos.
- The verdict is measured from the actual quantum output: likeness (structural similarity) and homeness.
- At the end you can download the entry permit, the raw Teleblur output, the exact parameters (JSON), or
  everything including the inputs (zip), so every play is reproducible.
- Playtest variants: `?age=all` (the document ages with the years), `?age=hint`, and `&debug=1`.
- Photos are sent to Moth for processing and deleted afterwards. The app stores nothing.

Details: [`apps/faded-passport/README.md`](apps/faded-passport/README.md).

### [Quantum Crew](apps/quantum-crew): in progress

Entered for challenge **11** (FQxI). A co-op party game where two tables of players hit the 75% limit of any
classical plan, then beat it with a shared entanglement tool. Details:
[`apps/quantum-crew/README.md`](apps/quantum-crew/README.md).

## Challenge tracker

Generated from each app's `submission.json`; run `pnpm tracker` to refresh.

<!-- tracker:start -->
| # | Challenge | App folder | Engines used | Status | Submission link |
|---|---|---|---|---|---|
| 01 | One image, one engine <sub>Beginner</sub> | [`faded-passport`](apps/faded-passport) | `telablur-v1` | ready | [demo](https://faded-passport.vercel.app) |
| 02 | Make it audible <sub>Beginner</sub> | — | — | — | — |
| 03 | Three dimensions <sub>Beginner</sub> | — | — | — | — |
| 04 | Moving image <sub>Intermediate</sub> | — | — | — | — |
| 05 | Quantum game <sub>Intermediate</sub> | [`faded-passport`](apps/faded-passport) | `telablur-v1` | ready | [demo](https://faded-passport.vercel.app) |
| 06 | Daisy Chain <sub>Intermediate</sub> | — | — | — | — |
| 07 | Make a VST or AU <sub>Intermediate</sub> | — | — | — | — |
| 08 | Make a web app <sub>Intermediate</sub> | [`faded-passport`](apps/faded-passport) | `telablur-v1` | ready | [demo](https://faded-passport.vercel.app) |
| 09 | Quantum-native 1 <sub>Expert</sub> | — | — | — | — |
| 10 | Quantum-native 2 <sub>Expert</sub> | — | — | — | — |
| 11 | FQxI Challenge <sub>Guest</sub> | [`quantum-crew`](apps/quantum-crew) | — | building | — |
<!-- tracker:end -->

## Setup

```sh
nvm use                 # Node 24 (see .nvmrc)
corepack enable         # provides pnpm
pnpm install
cp .env.example .env    # add your MOTH_API_KEY from https://platform.mothquantum.com
pnpm first-call         # flip a quantum coin (sandbox, 2 credits)
```

## Workflow

| Step | Command |
|---|---|
| Start a project app | `pnpm new-app my-idea --challenges 1,8` |
| Run it | `pnpm --filter @moth-hack/my-idea dev` (or `start` for scripts) |
| Check types across the workspace | `pnpm typecheck` |
| Refresh the tracker table | `pnpm tracker` |
| Build a submission (standalone repo + form answers) | `pnpm export my-idea --challenge 8` |

## Repo layout

```
packages/atlas-client   typed Moth Atlas API client (jobs, polling, uploads, errors, provenance)
apps/faded-passport     Faded Passport (challenges 01, 05, 08)
apps/quantum-crew       Quantum Crew (challenge 11)
apps/first-call         sandbox: the first coin-toss call (never submitted)
apps/_template          copied by `pnpm new-app`
scripts/                new-app, tracker, export
```

API keys live only in `.env` (gitignored) and never reach browser code. Test outputs (`output/`) and personal
photos are gitignored.
