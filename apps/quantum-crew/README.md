# Quantum Crew

> A co-op party game where two tables of crew keep a space station alive, hit a wall no plan can beat, and then
> break through it with entanglement.

**Moth Hack 2026 — 11 FQxI Challenge**

Work in progress. The full README (how to play, the physics, Atlas engines and credits) arrives with the solo mode.

## The physics in one paragraph
This is the CHSH game. Two players who can't talk each get a random light and set a valve. With any classical plan
they win at most **75%** of rounds. If they share entangled qubits, they can win **≈ 85.4%** (cos²(π/8), the Tsirelson
bound), and still can't use the qubits to send a message. Further reading:
[IBM Quantum Learning: the CHSH game](https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information/entanglement-in-action/chsh-game).

## Run it
```sh
pnpm install
pnpm --filter @moth-hack/quantum-crew test   # core logic tests
pnpm --filter @moth-hack/quantum-crew sim    # classical best, quantum optimum, top-5 dial setups
```
