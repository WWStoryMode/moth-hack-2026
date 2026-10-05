// All player-facing text in one place. Edit freely.
// In-world copy only, up to the debrief: physics words (qubit, Bell, CHSH…) appear only in `debrief`.

export const S = {
  title: "Quantum Crew",
  rule: {
    head: "Station rule",
    body: "Valves must MATCH, unless BOTH sensors are RED. Then they must DIFFER.",
  },
  light: { 0: "GREEN", 1: "RED" } as const,
  valve: { 0: "OPEN", 1: "CLOSED" } as const,

  landing: {
    tagline: "Keep the station alive. Some problems no plan can solve.",
    solo: "Solo demo",
    soloSub: "You and an AI crewmate · about 6 minutes",
    host: "Host on TV",
    hostSub: "Event mode: open this on the big screen",
    join: "Join with code",
    joinSub: "Event mode: on your phone",
    credits: "Credits",
  },

  intro: {
    kicker: "Station log · shift 1",
    lines: [
      "The station's coolant runs through two sections. You are at Table A. Your crewmate, an AI, is at Table B.",
      "Each round, your section's sensor lights GREEN or RED. You each set a valve: OPEN or CLOSED.",
      "No talking between sections during a round. You have 2.5 seconds.",
    ],
    survival: "The station needs 80% stability to survive.",
    go: "Take your post",
  },

  plan: {
    kicker: "Strategy huddle",
    title: "Agree a plan",
    crewmate: "Your crewmate radios in: “I always OPEN, whatever my light.”",
    blind: "You can't see their light. They can't see yours.",
    whenGreen: "When my light is GREEN",
    whenRed: "When my light is RED",
    start: (n: number) => `Start batch ${n}`,
    last: (pct: string) => `Last batch: ${pct} stable`,
  },

  batch: {
    label: (n: number) => `Batch ${n}`,
    round: (n: number, total: number) => `Round ${n}/${total}`,
    incoming: "Lights incoming…",
    yourLight: "Your sensor",
    planTag: "Plan",
    measure: "Measure",
    stable: "Stable",
    leak: "Leak",
    slow: "Too slow",
    you: "You",
    crewmate: "Crewmate",
  },

  readout: {
    kicker: (n: number) => `Batch ${n} complete`,
    held: (wins: number, total: number) => `${wins} of ${total} rounds held`,
    stability: "Station stability",
    actSoFar: (n: number) => `All ${n} rounds this shift`,
    simulate: "Run 1,000 rounds",
    simulateSub2: "Test your plan against 1,000 more lights",
    simulateSub3: "Test your tool settings against 1,000 more lights",
    simLabel: "1,000-round test",
    simResult: (pct: string) => `1,000-round test: ${pct}`,
    again2: "Back to the huddle",
    again3: "Retune and go again",
    report: "Call engineering",
    debrief: "Debrief",
  },

  meter: {
    survival: "Survival 80",
    ceiling: "Ceiling 75",
    limit: "Limit 85.4",
    empty: "No data",
  },

  ceiling: {
    kicker: "Engineering report",
    big: "75%",
    lines: [
      "We tried every plan your crew could make. Every single one.",
      "None of them holds more than 75% of rounds. Not on average, not ever.",
      "The station needs 80%.",
    ],
    go: "Then we need something that isn't a plan",
  },

  tool: {
    kicker: "Incoming cargo",
    title: "The Entanglement Tool",
    lines: [
      "Two linked crystals have arrived. One sits in your tool. The other is in your crewmate's tool at Table B.",
      "Turn the dial. Tap MEASURE. The crystal decides your valve: OPEN or CLOSED.",
      "Your crewmate has already tuned theirs. Set one dial for GREEN and one for RED, and find what holds.",
    ],
    go: "Pick up the tool",
  },

  tuning: {
    kicker: "Tool tuning",
    title: "Tune your dials",
    crewmate: "Your crewmate's tool is tuned. You can't see their dials.",
    hintButton: "Ask engineering for a hint",
    hint: "Try making your two dials 45° apart, and your partner's offset by half that.",
    start: (n: number) => `Start batch ${n}`,
  },

  dial: { prev: "Turn dial left", next: "Turn dial right" },

  debrief: {
    kicker: "Debrief",
    next: "Next",
    back: "Back",
    again: "Play again",
    table: (t: string) => `Table ${t} (best setting)`,
    home: "Home",
    steps: [
      {
        title: "No plan beats 75%",
        body: [
          "The wall you hit in Act II is a Bell inequality. This is the CHSH game (Clauser, Horne, Shimony and Holt, 1969).",
          "Two players who can't talk, with any plan agreed in advance (even a random one), win at most 75% of rounds.",
        ],
        stat: (pct: string) => `Your Act II rounds: ${pct}`,
      },
      {
        title: "Entanglement broke through",
        body: [
          "The two crystals were a pair of entangled qubits. Measured at dial angles θA and θB, their results agree with probability cos²(θA − θB).",
          "With dials 45° apart and your partner's offset by half that (A: 0° and 45°; B: 22.5° and −22.5°, shown as 157.5°), a crew wins cos²(22.5°) ≈ 85.4% of rounds. No quantum strategy does better: this is the Tsirelson bound.",
          "Real experiments have broken the 75% wall with entangled photons; that work won the 2022 Nobel Prize in Physics.",
        ],
        stat: (pct: string) => `Your best 1,000-round test: ${pct}`,
      },
      {
        title: "But no messages",
        body: [
          "Your own valve came out OPEN about half the time, whether your crewmate's light was GREEN or RED. So you can't read their light from your result, and the tool can't carry a message.",
          "Only the correlation between your two results changed. That is what no-signalling means.",
        ],
      },
      {
        title: "Credits",
        body: [],
      },
    ],
    panel: {
      head: (n: string) => `Your tool settings, ${n} test rounds`,
      yourRounds: (n: number, green: string, red: string) =>
        `In your ${n} real Act III rounds your valve came out OPEN ${green} of the time when your crewmate saw GREEN, and ${red} when they saw RED. Few rounds means more noise; the 10,000 above settle it.`,
      row: (who: string, light: string) => `${who}: OPEN when partner saw ${light}`,
      you: "You",
      crewmate: "Crewmate",
    },
  },

  credits: {
    title: "Credits",
    lead: "Made for Moth Hack 2026 (FQxI Challenge) with Moth Quantum Atlas engines.",
    simulated:
      "The entangled pair in the game is simulated in your browser with the exact quantum probabilities. The station art, the tool reveal and the sounds come from Atlas engines.",
    assets: "Atlas assets",
    pending: "placeholder until the asset is added",
    learn: "Learn more: the CHSH game on IBM Quantum Learning",
    learnUrl:
      "https://quantum.cloud.ibm.com/learning/en/courses/basics-of-quantum-information/entanglement-in-action/chsh-game",
    back: "Back",
  },

  event: {
    unavailable: "Event mode needs the station server. This copy of the game is solo only.",
    connecting: "Connecting to the station…",
    reconnecting: "Signal lost. Reconnecting…",
    table: (t: string) => `Table ${t}`,
    you: "you",
  },

  tv: {
    station: (code: string) => `Station ${code}`,
    join: "Join on your phone",
    joinAt: (url: string) => `or open ${url}`,
    code: "Code",
    noPlayers: "Nobody aboard yet.",
    phase: {
      lobby: "Scan to join. Pick Table A or Table B.",
      strategy: "Strategy huddle: talk to your partner now",
      round: "Comms blackout: no talking between tables",
      roundResult: "Comms blackout: no talking between tables",
      batchDone: "Batch complete",
      ceiling: "Engineering report",
      tool: "The Entanglement Tool",
      debrief: "Debrief",
    },
    batchHeld: (pct: string) => `${pct} of rounds held`,
    roundOf: (batch: number, round: number, size: number) => `Batch ${batch} · round ${round}/${size}`,
    pooled: "Station stability · last 48 rounds",
    allTime: (act: number, pct: string, n: number) => `Act ${act === 2 ? "II" : "III"} so far: ${pct} of ${n} rounds`,
    timeouts: (n: number) => `${n} too slow`,
    pair: (id: number) => `Pair ${id}`,
    controls: "Host controls",
    cmd: {
      startStrategy: "Start strategy huddle (45 s)",
      startBatch: "Start batch now",
      revealCeiling: "Reveal the ceiling",
      unlockTool: "Unlock Entanglement Tool",
      debrief: "Debrief",
      reset: "Reset",
    },
    resetConfirm: "Reset the session? Scores are cleared; players stay.",
    next: "Next build: Act III and debrief",
  },

  phone: {
    title: "Join the crew",
    code: "Station code",
    name: "Your name",
    pickTable: "Your table",
    join: "Board the station",
    seat: (table: string, name: string) => `Table ${table} · ${name}`,
    partner: (name: string, table: string) => `Partner: ${name} (Table ${table})`,
    lobby: "You're aboard. Eyes on the big screen.",
    waitingSeat: "You'll get a partner after this batch.",
    huddle: "Strategy huddle",
    huddleBody: "Talk to your partner now. Agree what you'll each do. When the clock runs out, comms go dark.",
    plan: "Your plan",
    valveSet: (v: string) => `Valve set: ${v}. Hold…`,
    watch: "Eyes on the big screen.",
    leave: "Leave",
  },
};
