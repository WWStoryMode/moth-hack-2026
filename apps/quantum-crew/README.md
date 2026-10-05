# Quantum Crew

> A co-op party game where two tables of crew keep a space station alive, hit a wall no plan can beat, and then
> break through it with entanglement.

**Moth Hack 2026 — 11 FQxI Challenge**

Quantum Crew is inspired by *Spaceteam*. Players never sit through a physics lecture. They feel a limit first, and
only then learn what it is.

**Learning arc:** collaborate → keep the station stable → hit a wall at 75% → experiment → get a quantum tool →
beat the wall.

## How to play (solo)
Open the app and choose **Solo demo**. It takes about 6 minutes on a phone or a laptop.

1. **Briefing.** You are Table A. An AI crewmate is Table B. Each round your sensor lights **GREEN** or **RED**, and
   you set your valve **OPEN** or **CLOSED** within 2.5 seconds. The station rule is always on screen:
   *valves must MATCH, unless BOTH sensors are RED, then they must DIFFER.* The station needs **80%**.
2. **Act II: plans.** Your crewmate tells you their plan ("I always OPEN"). Pick yours, then play batches of 12
   rounds. After each batch, **Run 1,000 rounds** tests your plan without small-sample luck. Whatever you try,
   it never beats 75%.
3. **Engineering report.** After 3 batches, call engineering: no plan beats 75%.
4. **Act III: the Entanglement Tool.** You get two dials, one for GREEN and one for RED. In each round, tap
   **MEASURE** and the tool sets your valve. Experiment until the 1,000-round test passes 80%. If you're stuck after
   three failed batches, there's a hint.
5. **Debrief.** You learn the physics and see your own numbers, then the credits.

Keyboard: **O / ←** = OPEN, **C / →** = CLOSED, **Space / Enter** = MEASURE.

## How to play (event)
Two tables of players, one phone each, and a TV or projector. A facilitator runs the session from the TV.

1. Open **/screen** on the TV (landing page → **Host on TV**). It creates a station with a 4-letter code and a QR code.
2. Players scan the QR (or open **/play** and type the code), enter a name and pick **Table A** or **Table B**.
   The server pairs A₁↔B₁, A₂↔B₂… (up to 4 pairs). An AI crewmate fills any empty seat.
3. **Start strategy huddle (45 s):** partners may talk across tables and agree a plan. When the clock runs out, the
   comms blackout starts and so does the batch (or press **Start batch now**).
4. Each round, every phone shows only its own light, two valve buttons and a countdown. The TV shows the round
   timer, who has answered and each pair's result. Stability is pooled over the last 48 rounds across all pairs, and
   each pair also has its own mini-meter.
5. Play a few batches, then **Reveal ceiling**: the TV shows the engineering report (no plan beats 75%).
6. **Unlock tool**: every pair gets the Entanglement Tool. Phones show two dials (one for GREEN, one for RED); use a
   huddle to agree settings. In each round a phone shows its light, the dial angle in use and a **MEASURE** button.
   The server decides who measured first: that result is a fair coin, and the partner's result is conditioned on it.
   The TV adds the 85.4% line. **Show hint** puts the engineering hint on the TV.
7. **Debrief** on the TV (Back / Next): the Bell/CHSH wall with the crew's Act II score, the Tsirelson bound with
   the best dial settings and the crew's Act III score, then **no-signalling**: every crew member's OPEN rate split
   by what their partner saw (≈ 50/50 both ways, pooled for the whole crew), then credits.

A phone that reloads or drops out rejoins its seat automatically (same name, same table).

## The physics
This is the **CHSH game**, a Bell test. Two players who can't talk each get a random bit (the light) and output a
bit (the valve). They win if `a XOR b == x AND y`.

- **Classical limit: 75%.** Every plan agreed in advance, random or not, is at best a mix of the 16 deterministic plan
  pairs, and none of those wins more than 3 of the 4 light combinations.
- **Quantum limit: cos²(π/8) ≈ 85.4%.** The players share an entangled pair of qubits (the Bell state |Φ+⟩). Each measures at
  an angle chosen by their own light, and the results agree with probability cos²(θA − θB). The best angles are
  A: 0°/45° and B: 22.5°/−22.5°. No quantum strategy beats this (the Tsirelson bound).
- **No signalling.** Each player's own valve is a 50/50 coin whatever the partner's light or dial. Only the
  *correlation* between the two players changes, so the tool can't carry a message. The debrief shows this with the
  player's own tool settings.

Further reading: [IBM Quantum Learning: the CHSH game](https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information/entanglement-in-action/chsh-game).

In the game, the entangled pair is simulated with the exact quantum probabilities (`src/shared/chsh.ts`). The first
player to measure gets a fair coin, and the second player's result matches it with probability cos²(Δθ).

## Atlas engines
The station art, its degradation levels, the tool reveal and the sounds are made with Moth Quantum Atlas engines
on platform.mothquantum.com. They are listed with their parameters in `src/assets/atlas/manifest.ts` and on the
Credits screen. Any asset that hasn't been added yet shows a CSS/SVG placeholder.

| Asset | Engine |
|---|---|
| `station-base`, `crew-icons` | Tessa (`tessa-image-v1`) |
| `station-stability-0…4` | Quantum Blur (`blur-v1`) |
| `entanglement-reveal` | Entanglement Shader (`entanglement-shader-v1`) |
| `sfx-alarm`, `sfx-win`, `sfx-reveal` | Atlas sound engine (to confirm) |

## Run it locally
```sh
pnpm install
pnpm --filter @moth-hack/quantum-crew dev        # http://localhost:5173/solo
pnpm --filter @moth-hack/quantum-crew dev:phone  # same, reachable from a phone on your Wi-Fi
pnpm --filter @moth-hack/quantum-crew test       # core logic + solo flow tests
pnpm --filter @moth-hack/quantum-crew sim        # classical best, quantum optimum, top-5 dial setups
pnpm --filter @moth-hack/quantum-crew build      # static build in dist/
```

`pnpm dev` also runs the station (WebSocket at `/ws`) inside the Vite dev server, so event mode works locally.
To test with real phones, open the TV page via the **Network** URL that Vite prints (e.g. `http://192.168.x.x:5173/screen`)
so the QR code points somewhere phones can reach. To test alone, use one `/screen` tab and a few `/play` tabs.

```sh
pnpm --filter @moth-hack/quantum-crew smoke   # real WebSocket server + 1 TV + 4 phones, one Act II batch
```

## Deploy
- **Solo only (static):** the solo mode needs no server or API key. Deploy `dist/` anywhere; `vercel.json`
  rewrites every route to `index.html`. On a static host, the event-mode buttons stay disabled.
- **Event mode (one Node process):** `server/index.ts` serves `dist/` and the WebSocket on the same origin.
  Use any host that supports WebSockets (Render, Railway, Fly…), from the repo root:
  - build: `pnpm install && pnpm --filter @moth-hack/quantum-crew build`
  - start: `pnpm --filter @moth-hack/quantum-crew start` (listens on `$PORT`, default 8787; Node ≥ 22.18 runs
    the TypeScript directly)

  Rooms live in memory, so a restart ends every session. Health check: `/healthz`.
