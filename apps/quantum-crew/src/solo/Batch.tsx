// A batch of fast rounds. Timers live here; the store decides everything else.
// Buttons fire on pointer-down for speed; a second event in the same round is ignored by the store.
// Keyboard: O / ← = OPEN, C / → = CLOSED in Act II; Space / Enter = MEASURE in Act III.
import { useEffect } from "react";
import { playSfx } from "../audio/sfx.ts";
import { Countdown } from "../components/Countdown.tsx";
import { Dial } from "../components/Dial.tsx";
import { SensorLight } from "../components/SensorLight.tsx";
import { StabilityMeter } from "../components/StabilityMeter.tsx";
import { BATCH_SIZE, LEAD_MS, RESULT_MS, ROUND_MS } from "../config.ts";
import { CLOSED, OPEN, dialFor, type RoundResult, type Valve } from "../shared/chsh.ts";
import { S } from "../strings.ts";
import { actOf, displayedStability, useSolo } from "./soloStore.ts";

export function Batch() {
  const s = useSolo((st) => st);
  const { round, phase, plan, tuning, advance, timeout, answer, measure } = s;
  const act = actOf(phase);
  const batchNo = (act === 2 ? s.act2Batches : s.act3Batches) + 1;

  // Round loop: lead-in → light → (answer | timeout) → result → next light … → readout.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (!round) t = setTimeout(() => advance(Date.now()), LEAD_MS);
    else if (round.result) t = setTimeout(() => advance(Date.now()), RESULT_MS);
    else t = setTimeout(() => timeout(Date.now()), Math.max(0, round.deadline - Date.now()) + 20);
    return () => clearTimeout(t);
  }, [round, advance, timeout]);

  useEffect(() => {
    if (round?.result?.win) playSfx("win", "solo");
  }, [round?.result]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (act === 2 && (k === "o" || k === "arrowleft")) answer(OPEN, Date.now());
      else if (act === 2 && (k === "c" || k === "arrowright")) answer(CLOSED, Date.now());
      else if (act === 3 && (k === " " || k === "enter")) {
        e.preventDefault();
        measure(Date.now());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, answer, measure]);

  const live = round && !round.result;
  const planned: Valve | null = round ? (round.x === 0 ? plan.onGreen : plan.onRed) : null;

  return (
    <main className="screen">
      <div className="meter__head">
        <span className="kicker">{S.batch.label(batchNo)}</span>
        <span className="kicker">{round ? S.batch.round(round.n, BATCH_SIZE) : ""}</span>
      </div>
      <StabilityMeter value={displayedStability(s)} label={S.readout.stability} showCeiling={act === 3} showLimit={act === 3} />
      <Countdown id={round ? round.n : "lead"} ms={round ? ROUND_MS : LEAD_MS} paused={!live} />

      {!round && (
        <div className="stack screen--center spacer">
          <SensorLight light={null} label={S.batch.yourLight} />
          <p className="muted" style={{ textAlign: "center" }}>
            {S.batch.incoming}
          </p>
        </div>
      )}

      {round && !round.result && (
        <>
          <SensorLight light={round.x} label={S.batch.yourLight} />
          <div className="spacer" />
          {act === 2 ? (
            <div className="valves">
              {[OPEN, CLOSED].map((v) => (
                <button key={v} className="btn valve" onPointerDown={() => answer(v, Date.now())}
                  onClick={() => answer(v, Date.now())}>
                  <span className="valve__icon" aria-hidden="true">
                    {v === OPEN ? "═ ═" : "═╪═"}
                  </span>
                  {S.valve[v]}
                  {planned === v && <span className="valve__plan">{S.batch.planTag}</span>}
                </button>
              ))}
            </div>
          ) : (
            <>
              <Dial value={dialFor(tuning, round.x)} small />
              <button className="btn measure" onPointerDown={() => measure(Date.now())}
                onClick={() => measure(Date.now())}>
                {S.batch.measure}
              </button>
            </>
          )}
        </>
      )}

      {round?.result && <RoundOutcome result={round.result} />}
    </main>
  );
}

function RoundOutcome({ result }: { result: RoundResult }) {
  const verdict = result.timedOut ? S.batch.slow : result.win ? S.batch.stable : S.batch.leak;
  return (
    <div className={`result spacer ${result.win ? "result--win" : "result--loss"}`} role="status">
      <div className="result__verdict">{result.win ? "✓ " : "✗ "}{verdict}</div>
      <div className="result__pair panel">
        <Side who={S.batch.you} light={result.x} valve={result.a} />
        <Side who={S.batch.crewmate} light={result.y} valve={result.b} />
      </div>
      <p className="muted small">{S.rule.body}</p>
    </div>
  );
}

function Side({ who, light, valve }: { who: string; light: 0 | 1; valve: Valve | null }) {
  return (
    <div className="result__side">
      <span className="kicker">{who}</span>
      <SensorLight light={light} small />
      <strong>{valve === null ? "—" : S.valve[valve]}</strong>
    </div>
  );
}
