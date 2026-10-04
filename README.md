# Moth Hack 2026

My entries for [Moth Hack 2026](https://hack.mothquantum.com), a hackathon about making creative work with
quantum computing through the [Moth Quantum Atlas API](https://docs.mothquantum.com/docs/intro).

Each challenge entry is its own app in `apps/`, sharing a typed API client in `packages/atlas-client`.
Each one is exported as a standalone repo for submission.

## Setup

```sh
nvm use                 # Node 24 (see .nvmrc)
corepack enable         # provides pnpm
pnpm install
cp .env.example .env    # add your MOTH_API_KEY from https://platform.mothquantum.com
pnpm first-call         # flip a quantum coin
```

## Workflow

| Step | Command |
|---|---|
| Start a challenge app | `pnpm new-app c01-my-idea` |
| Run it | `pnpm --filter @moth-hack/c01-my-idea start` |
| Check types | `pnpm typecheck` |
| Refresh this table | `pnpm tracker` |
| Build the submission (repo + form answers) | `pnpm export c01-my-idea` |

## Challenge tracker

Generated from each app's `submission.json`; run `pnpm tracker` to refresh.

<!-- tracker:start -->
| # | Challenge | App folder | Engines used | Status | Submission link |
|---|---|---|---|---|---|
| 01 | One image, one engine <sub>Beginner</sub> | [`faded-passport`](apps/faded-passport) | `telablur-v1` | building | — |
| 02 | Make it audible <sub>Beginner</sub> | — | — | — | — |
| 03 | Three dimensions <sub>Beginner</sub> | — | — | — | — |
| 04 | Moving image <sub>Intermediate</sub> | — | — | — | — |
| 05 | Quantum game <sub>Intermediate</sub> | [`faded-passport`](apps/faded-passport) | `telablur-v1` | building | — |
| 06 | Daisy Chain <sub>Intermediate</sub> | — | — | — | — |
| 07 | Make a VST or AU <sub>Intermediate</sub> | — | — | — | — |
| 08 | Make a web app <sub>Intermediate</sub> | [`faded-passport`](apps/faded-passport) | `telablur-v1` | building | — |
| 09 | Quantum-native 1 <sub>Expert</sub> | — | — | — | — |
| 10 | Quantum-native 2 <sub>Expert</sub> | — | — | — | — |
| 11 | FQxI Challenge <sub>Guest</sub> | — | — | — | — |
<!-- tracker:end -->
