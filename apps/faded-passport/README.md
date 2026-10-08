# Faded Passport

> A border crossing where your face fades into the home you can't go back to.

A short narrative game for [Moth Hack 2026](https://hack.mothquantum.com), built on the
[Moth Quantum Atlas API](https://docs.mothquantum.com/docs/intro). It inverts *Papers, Please*: you are not the
inspector but the traveller, trying to return home after many years. The officer asks for your passport photo,
asks you to show who you are, asks where you are going, and then a quantum engine answers for you. While the
photo still looks like you, you're let through with a shrug ("Next."). Once the years have dissolved your face,
entry is refused, and the reason says how far you've turned into the place you left.

## How the quantum engine drives the story

Everything that happens to your face is done by one Atlas engine, **Teleblur** (`telablur-v1`).

Teleblur puts two images into **one shared quantum state**. The pixels are encoded on n qubits, and one extra
**selector qubit** says which image a part of the state belongs to: 0 for your portrait, 1 for home. Rotating
that selector qubit mixes the two images at the level of **amplitudes**, the numbers a quantum state is made of.
It is not a pixel cross-fade. Because pixel positions are also stored in qubits, the mix spreads through
interference into grid-like, blocky echoes of home inside your face.

| In the story | In Teleblur |
|---|---|
| **How long since you last came home?** (1–40 years) | `strength`, how far the selector qubit is rotated, along a curve through (1 y, 0) · (9 y, 0.08) · (11 y, 0.36) · (25 y, 0.61) · (27 y, 0.85) · (40 y, 1). Long gentle softening, quick jumps over the muddy middle strengths, years of banded interference, then home slowly taking over |
| (same slider) | `size`, Teleblur's pixel budget per pass: 8 at 1 year → 128 at 40 years on a log curve. The 512×512 face region is shrunk to size×size, morphed on fewer or more qubits, then scaled back up, so the morph is blockier or finer |
| **Who are you?** You draw around your face | `mask`. Built from your portrait's own brightness: ×1.5 inside your outline, ×0.5 outside, with a feathered edge. Bright skin morphs fully into home; dark features resist; the background only leaks a little |
| **Passport, please** / **Where are you going?** | `image1` (your portrait) morphs toward `image2` (home) |
| **The officer's verdict** | Computed from the output, inside your outline. **Likeness** (structural similarity to your original face) ≥ 0.60 → **ENTRY GRANTED** (green stamp: "Documents in order."). Otherwise refused, and **homeness** (closer to your portrait or to your home photo) picks the reason: ≥ 0.50 "Bearer cannot be distinguished from the declared destination.", ≥ 0.40 "This address cannot be verified.", else "This photo does not match the bearer." Thresholds: `VERDICT` in `src/config.ts` |

Fixed parameters: both photos are cropped to 512×512, `direction full`, `downscale true`,
`mask_bin_size 4`, `mask_min_region 16`. Teleblur runs on Moth's quantum **simulator**. The final entry document
prints the engine, every parameter and the job ID in its machine-readable strip, so each document records
exactly how it was made.

## Playtest variants

Flags are read from the URL when the page loads and stay fixed for the session (`src/lib/flags.ts`).
They only change what is drawn: nothing is tracked or logged, and what is sent to the Moth API is the same
in every variant.

| URL | What changes |
|---|---|
| `/` or `/?age=photo` | Default: only the photo degrades |
| `/?age=all` | The whole document ages with the years: yellowing, edge shading, grain, browner ink, fading stamp, darker desk; foxing from 5 years, a coffee ring from 15, a crease from 25. The downloaded permit ages too. |
| `/?age=hint` | Photo only, plus YEARS ABSENT on the permit printed in ink that fades with the years |
| add `&debug=1` | A small label in the top corner shows the active variant (plus the debug tools) |

All text stays at WCAG AA contrast at 40 years (the ageing colours are clamped in `src/lib/ageing.ts`).

## Processing record (for Challenge 01 and reproducibility)

On the final screen, under the permit, **Processing record** offers:

- **Processed image**: the raw Teleblur output, byte-for-byte as returned by the API
- **Parameters (JSON)**: engine, job ID, the server-confirmed Teleblur params, years, the mask recipe, the
  years → strength/size mapping, and the verdict scores (likeness, homeness, thresholds)
- **Everything (.zip)**: the permit, the raw output, `parameters.json`, and the exact inputs sent (`image1`
  portrait, `image2` home, `mask`) plus the drawn outline, so the run can be reproduced

These are assembled in the browser from what the game already holds: no extra API calls, nothing stored.

## Sample photos

Players who'd rather not use their own face, or have no camera, can pick **Use a sample portrait** and **Use a
sample place** (pixel-art images in `public/samples/`, paths in `src/samples.ts`). On a sample home photo, the
**Another place** tab cycles street → canal → park. Samples go through exactly the same processing as an upload.

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

`pnpm --filter @moth-hack/faded-passport try [--years N]` runs one Teleblur job from the terminal using
synthetic images (1 credit) and saves the result + provenance to `output/`.

**Sweep all the years on one set of photos.** Open the app with `?debug`, and on the home step press
**Download inputs (debug)**. That saves the exact 512² portrait, home, mask and outline the app would send. Then:

```sh
pnpm --filter @moth-hack/faded-passport sweep ~/Downloads/faded-passport-inputs-….zip --years 1-40
#   --years "1,5-40:5" (1, 5, 10 … 40) · --concurrency 4 · --yes (skip the prompt) · --dry-run (no credits)
```

It costs 1 credit per year and asks before starting. It uploads the inputs once and writes
`output/sweep-<time>/` with `yNN.png` + provenance, `summary.csv`/`.json` (strength, size, likeness, homeness, outcome per
year), and `contact-sheet.png`. Everything is deleted from Moth afterwards.

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

The API key lives only in the functions. The server rebuilds the Teleblur parameters from `years`; the client
never sets them. Uploads must be 512×512 PNG/JPEG (checked from the file header) and under 1.5 MB.

## Deploy (Vercel)

Import the repo in Vercel and set **Root Directory** to `apps/faded-passport` (framework: Vite). Then add the
three environment variables above.

## For the hackathon submission

- **Challenge 01:** the downloaded entry document (the morph, plus the parameters printed on it).
- **Challenge 08:** the deployed app.
- **Challenge 05:** the app as a short narrative game.

Short description: *Faded Passport is a short border-crossing game in which your passport photo dissolves into
a photo of home. Moth's Teleblur engine places both images in one quantum state and rotates a single selector
qubit between them. How long you've been away sets the rotation, the outline you draw around your face sets
where it happens, and whether your face is still recognisable decides if the officer lets you through, or why not.*
