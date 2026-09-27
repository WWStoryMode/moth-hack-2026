# Faded Passport

> A border crossing where your face fades into the home you can't go back to.

A short narrative game for [Moth Hack 2026](https://hack.mothquantum.com), built on the
[Moth Quantum Atlas API](https://docs.mothquantum.com/docs/intro). It inverts *Papers, Please*: you are not the
inspector but the traveller, trying to return home after many years. The officer asks for your passport photo,
asks you to show who you are, asks where you are going, and then a quantum engine answers for you. Entry is
always refused. What changes is **why**.

## How the quantum engine drives the story

Everything that happens to your face is done by one Atlas engine, **TeleBlur** (`telablur-v1`).

TeleBlur puts two images into **one shared quantum state**. The pixels are encoded on n qubits, and one extra
**selector qubit** says which image a part of the state belongs to: 0 for your portrait, 1 for home. Rotating
that selector qubit mixes the two images at the level of **amplitudes**, the numbers a quantum state is made of.
It is not a pixel cross-fade. Because pixel positions are also stored in qubits, the mix spreads through
interference into grid-like, blocky echoes of home inside your face.

| In the story | In TeleBlur |
|---|---|
| **How long since you last came home?** (1–40 years) | `strength`, how far the selector qubit is rotated. A log curve: `0.1 + 0.9·ln(years)/ln(40)`, so the first years fade you fastest |
| **Who are you?** You draw around your face | `mask`. The morph happens only inside your outline, with a feathered edge (grey = soft blend) |
| **Passport, please** / **Where are you going?** | `image1` (your portrait) morphs toward `image2` (home) |
| **The officer's verdict** | Computed from the output: how much the morph changed the face inside your mask picks the refusal reason |

Fixed parameters: `size 512` (both photos are cropped to 512×512), `direction full`, `downscale true`,
`mask_bin_size 4`, `mask_min_region 16`. TeleBlur runs on Moth's quantum **simulator**. The final entry document
prints the engine, every parameter and the job ID in its machine-readable strip, so each document records
exactly how it was made.

## Privacy

Photos are sent to Moth Quantum's API for processing. After the result is fetched, the server deletes the
uploaded photos, the mask and the output from Moth's storage. This app has no database and no browser storage.

## Run locally

Requires Node 22.13+ and pnpm (repo root: `nvm use && corepack enable`), plus a Moth API key.

```sh
# at the repo root
cp .env.example .env               # MOTH_API_KEY=… from https://platform.mothquantum.com
pnpm install
pnpm --filter @moth-hack/faded-passport dev        # http://localhost:5173
pnpm --filter @moth-hack/faded-passport dev:phone  # also on your LAN, to test on a phone
```

`pnpm --filter @moth-hack/faded-passport try [--years N]` runs one TeleBlur job from the terminal using
synthetic images (1 credit) and saves the result + provenance to `output/`.

## Environment variables

| Name | Where | Purpose |
|---|---|---|
| `MOTH_API_KEY` | server only | Atlas API key. Never sent to the browser |
| `TICKET_SECRET` | server only (required on Vercel) | Signs job tickets so the proxy only serves jobs it created. Any long random string (`openssl rand -hex 32`) |
| `SUBMISSIONS_OPEN` | server | `false` stops all new jobs (kill switch if credits run low) |

## Architecture

```
browser (React + Vite)                 Vercel functions (api/)                 Moth Atlas API
crop 512² · draw mask · compose doc ─► /api/submit  upload ×3, submit job ─►  /assets, /engines/telablur-v1/process
                                   ◄─  signed ticket
poll every 2 s ──────────────────────► /api/status ─────────────────────────►  /jobs/{id}/status
fetch morph ─────────────────────────► /api/result  stream PNG, delete assets ► /jobs/{id}/result, DELETE /assets/{id}
```

The API key lives only in the functions. The server rebuilds the TeleBlur parameters from `years`; the client
never sets them. Uploads must be 512×512 PNG/JPEG (checked from the file header) and under 1.5 MB.

## Deploy (Vercel)

Import the repo in Vercel and set **Root Directory** to `apps/faded-passport` (framework: Vite). Then add the
three environment variables above.

## For the hackathon submission

- **Challenge 01:** the downloaded entry document (the morph, plus the parameters printed on it).
- **Challenge 08:** the deployed app.
- **Challenge 05:** the app as a short narrative game.

Short description: *Faded Passport is a short border-crossing game in which your passport photo dissolves into
a photo of home. Moth's TeleBlur engine places both images in one quantum state and rotates a single selector
qubit between them. How long you've been away sets the rotation, the outline you draw around your face sets
where it happens, and how much your face changed decides why the officer refuses you. Entry is always refused.*
