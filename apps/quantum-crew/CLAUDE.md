# quantum-crew

Working notes for Claude (not exported). The spec is `~/Downloads/SPEC.md` (not in the repo); the plan is milestones
M0–M6. See the root CLAUDE.md for repo rules.

- **Challenge:** 11 FQxI Challenge (Guest): an educational app teaching a general audience about quantum, ≥ 1 Atlas engine.
- **Goal:** a Spaceteam-style co-op party game (two tables, phones + a shared TV) plus a solo mode for judges. Players
  feel the 75% classical ceiling of the CHSH game, then beat it (≈ 85.4%) with a shared "Entanglement Tool".
  Physics words appear only in the debrief.
- **Engines used:** Atlas assets made by William on platform.mothquantum.com (tessa-image-v1 station art, blur-v1
  degradation levels, entanglement-shader-v1 tool reveal, a sound engine for sfx). The in-game entanglement is a
  classical simulation of |Φ+⟩ in `src/shared/chsh.ts`; say so honestly in the README and credits.
- **Layout:** `src/shared/` is pure logic shared by client, server, tests and scripts (`rng.ts` mulberry32,
  `chsh.ts`). `scripts/sim.ts` prints the classical best, quantum optimum and top-5 dial grid.
  `tsconfig.json` is the Node side; the browser tsconfig arrives in M2.
- **Git:** one branch per milestone (`quantum-crew/mN-…`), PR per milestone, user reviews before merge.
- **Status (2026-10-05):** M0 merged. M1 (core logic) done: 18 tests pass, `pnpm sim` → 0.7500 / 0.8536.
  Next: M2 solo mode (React + Vite + Zustand, static build, no server).
- **Decisions:** marginals in `simulate` are the fraction of CLOSED valves. In simulation, who measures first is a coin
  flip per round unless `order` is given.
- **Open questions:** which Atlas sound engine for sfx; deploy host (decide after M2/M3).
