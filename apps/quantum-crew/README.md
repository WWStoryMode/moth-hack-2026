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

The solo mode is a static site and needs no server or API key. `vercel.json` rewrites all routes to
`index.html` for deployment.
