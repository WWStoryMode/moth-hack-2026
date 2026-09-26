# first-call

Sandbox app, never submitted (no `submission.json`).

- **Goal:** make the first real API call end to end (submit → poll → result → save) and learn the basics.
- **Engine:** `coin-toss-v1` (docs: https://docs.mothquantum.com/docs/engines/coin-toss-v1), 2 credits per run.
  A one-qubit circuit: Hadamard gate → measure. Hadamard puts the qubit in an equal superposition of 0 and 1,
  so each measurement ("shot") is a fair coin flip.
- **Params:** `{ mode: "emu", shots: 20 }`
- **Output:** `apps/first-call/output/<timestamp>-coin-toss-v1.json` (provenance + result)
- **Status:** built and typechecked; not yet run (waiting for the user's API key in `.env`).
