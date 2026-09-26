# Claude Code brief — Moth Hack 2026: Faded Passport, a TeleBlur border crossing

Paste this whole file into Claude Code (or save it in the repo as `apps/faded-passport/BRIEF.md` and tell Claude Code to read it).

---

## Your task

Help me build a mobile-first web app for Moth Hack 2026 (Moth Quantum's quantum-creativity hackathon). The app is called **Faded Passport** (folder/slug: `faded-passport`). It lives as its own app inside my existing `moth-hack-2026` repo, which holds several apps. Name folders, package, page title and README after the app, not after a challenge number, because it will be submitted to more than one challenge. **Before writing code, read this brief, inspect the repo structure, and propose a plan and file layout for my approval.** Then build the MVP first, stretch goals after.

Deadline: virtual hackathon closes **2 October 2026**.

## The piece

A short narrative game inspired by *Papers, Please*, inverted: the player is not the border inspector but the traveller, trying to return home after many years. Themes: blur, memory fade, the impossibility of return. The quantum engine's morph is the core mechanic: the traveller's face dissolves into the home they're trying to reach.

### Flow

1. **Intro / how long?** The player asks themselves: "How long since I last came home?" Slider from 1 to 40 years. This drives TeleBlur `strength`.
2. **"Passport, please."** The officer asks for the passport photo. Player uploads a portrait or takes a selfie (front camera).
3. **"Who are you?"** Player draws around their face on the portrait with a finger/mouse to create a mask.
4. **"Where are you going?"** Player uploads a photo of home or takes a snapshot of their surroundings (rear camera).
5. **Processing.** Call TeleBlur: portrait (`image1`) morphs into home (`image2`), limited to the drawn face mask, with strength from the years. Treat the wait as the officer examining documents (stamp hovering, a line of dialogue).
6. **Verdict: always refused.** The officer always refuses entry. The refusal *reason* varies (see below). The officer hands the documents back.
7. **The document.** Final screen: a composed passport/entry page with the morphed portrait, the damaged home image, a DENIED-style stamp, the years away, and a machine-readable strip at the bottom listing the engine and exact parameters used. Downloadable as PNG. This image is my Challenge 01 submission (Challenge 01 asks for "the result with the parameters used").

Visual style: original bureaucratic/border-document aesthetic. Do not copy *Papers, Please* art, fonts, or UI assets.

## Hackathon submissions

This one project is intended for several challenges (I'll confirm on the Moth Discord that one project can be entered more than once). Keep the build flexible enough to serve each:

- **Challenge 01 — One image, one engine (Beginner):** the downloadable entry document from the final screen, with the TeleBlur parameters printed on it.
- **Challenge 08 — Make a web app (Intermediate):** the deployed app itself, which calls the Atlas API. Needs a public link and a short description.
- **Challenge 05 — Quantum game (Intermediate):** the app as a short narrative game. Also eligible for the Global Quantum Game Jam on itch.io, so keep it embeddable/uploadable as a web build.
- **Possible Challenge 06 — Daisy Chain:** only if we later add more Atlas engines with a real narrative purpose (e.g. another image engine for paper damage). Not in MVP.

Judging criteria for all: quality of execution, depth of quantum and Atlas usage, originality. The README should explain clearly how TeleBlur drives the story (years → strength, drawn mask → where the morph happens, output → the officer's verdict).

## Tech

- React + TypeScript + Vite (my usual stack).
- Mobile-first, must also work on desktop. Deploy to Vercel.
- **API key must never reach the client.** Use Vercel serverless functions as a proxy; key in env var `MOTH_API_KEY`.
- No browser storage needed; don't persist user images anywhere. Add a single line on the intro screen saying photos are sent to Moth's API for processing and not kept by this app.

### Camera / images

- Use `<input type="file" accept="image/*" capture="user">` for the portrait and `capture="environment"` for home. Falls back to file picker on desktop. No `getUserMedia` needed for MVP.
- Fix EXIF orientation.
- **Moth assets must be `image/jpeg` or `image/png`.** iPhones often produce HEIC, so re-encode every image through a canvas.
- Crop both images to the same square size (start with 512×512) so `image1`, `image2` and the mask align. Set TeleBlur `size` to match.

### Mask drawing

- Freehand lasso on a canvas over the portrait. Must be forgiving on phones: auto-close the path on release, smooth the stroke, undo/redraw button, allow zoom before drawing if feasible.
- Export as **PNG**, same dimensions as the portrait: white inside the face, black outside.

## Moth Atlas API

Docs: https://docs.mothquantum.com/docs/intro
Engine page: https://docs.mothquantum.com/docs/engines/telablur-v1
OpenAPI: https://api.mothquantum.com/openapi.json
Base URL: `https://api.mothquantum.com/api/v1`, header `Authorization: Bearer <MOTH_API_KEY>`.

### Upload flow (per image, including the mask)

1. `POST /assets` with JSON `{ filename, content_type, size_bytes }` (exact byte size).
2. Response includes `asset_id` and `upload: { url, method, headers }`. Send the bytes to `upload.url` with exactly `upload.headers`.
3. `POST /assets/{asset_id}/complete`.

### Job

`POST /engines/telablur-v1/process` (1 credit per run). Documented defaults:

```json
{
  "params": {
    "direction": "full",
    "downscale": true,
    "mask_bin_size": 4,
    "mask_min_region": 16,
    "size": 1024,
    "strength": 0.5
  },
  "input_files": {
    "image1": "<asset_id>",
    "image2": "<asset_id>"
  }
}
```

Then poll `GET /jobs/{job_id}/status` every ~2s until status is `completed`, `failed`, or `cancelled`. Then `GET /jobs/{job_id}/result`; the output image is in `outputs[].url` (presigned GET URL, it expires, so fetch it promptly).

Known parameter meanings (from the docs and the sibling Quantum Blur engine):
- `strength`: morph amount. In Quantum Blur, 0 = unchanged, 1 = max, and values above 1 start to reverse (rotation is periodic). Verify TeleBlur behaves the same.
- `size`: pixel budget per pass, 8 to 1024; qubits = `ceil(log2(size)) * 2`.
- `downscale`: `true` downscales oversized regions; `false` tiles them.
- `mask_bin_size`, `mask_min_region`: mask cleanup thresholds (for compression noise).

### ⚠️ Verify before building on these

The docs I could read did not show:
1. The allowed values of `direction`.
2. The name of the **third input slot** (the page says "3 file slots"; very likely an optional mask, as in `blur-v1`).

First step: write a small script that uses the API key to fetch the engine's metadata (the Engine schema includes `params_schema` and `input_files`) or the telablur section of `openapi.json`, and print the real schema. Update this plan with what you find.

**✅ Verified 2026-09-26 from the pinned spec (`packages/atlas-client/openapi.json`, v0.41.0):**
1. `direction`: `"full"` (default) · `"vertical"` (only y-qubits rotated) · `"horizontal"` (only x-qubits).
2. Third slot: **`mask`**, optional. Must match `image1`'s size. Soft blend: black keeps image1, white is fully
   morphed, grey blends. RGB masks are converted to luminance. `image1` and `image2` are required.
- `strength` is limited to **0–1** by the schema. `size` is 8–1024. There is no `mode`: it runs on a simulator.
- Output = `(1-mask)·image1 + mask·teleblurred`, at the input size.
- First live run (synthetic images, 10 years, strength 0.599): 14 s end to end, about 3 s of that on the job itself.

## Mapping years → strength

Start with a log curve, then tune by eye on real outputs:

```
strength = 0.1 + 0.8 * ln(years) / ln(40)
// ≈ 0.10 @1y, 0.45 @5y, 0.60 @10y, 0.75 @20y, 0.90 @40y
```

Keep this in one config file so I can tweak it.

## Refusal logic

Entry is always refused. The reason is chosen from what the quantum morph actually did: compare the returned image with the original portrait **inside the mask** (e.g. mean absolute pixel difference, normalised 0–1) and pick a line by threshold. Examples to start from (I'll rewrite the copy):

- Low change: "This photo does not match the bearer."
- Medium change: "This address cannot be verified."
- High change: "The person in this photo is a place."

Also show the years away on the stamp. Keep all dialogue in one editable strings file.

## Scope

**MVP (build first):** years slider → portrait upload → mask drawing → home upload → asset uploads + TeleBlur job via proxy → verdict → composed downloadable entry document with parameter strip.

**Stretch, in order:** stamp and paper animations during processing; start the portrait upload while the player is still on the home step; sound; multiple officer dialogue variants; share button.

## Working style

- Plan first, wait for my OK, then build in small commits.
- Keep a `README.md` for the app: what it is, how to run locally, env vars, and a short description I can reuse for the hackathon submission.
- Tell me when you need me to test something on my phone.
