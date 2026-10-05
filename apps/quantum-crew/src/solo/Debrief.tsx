// The debrief: the only place physics words appear. Four steps: the Bell/CHSH wall, the Tsirelson bound,
// no-signalling (with the player's own numbers), and credits.
import { useMemo } from "react";
import { CreditsList } from "../components/CreditsList.tsx";
import { Dial } from "../components/Dial.tsx";
import { pct } from "../components/StabilityMeter.tsx";
import { DEBRIEF_SIM_ROUNDS } from "../config.ts";
import { navigate } from "../lib/router.ts";
import {
  OPTIMAL_TUNING,
  openRatesByPartnerLight,
  playRounds,
  quantumStrategyFn,
  winRate,
  type OpenRates,
} from "../shared/chsh.ts";
import { mulberry32 } from "../shared/rng.ts";
import { S } from "../strings.ts";
import { useSolo } from "./soloStore.ts";

export function Debrief() {
  const s = useSolo((st) => st);
  const step = s.debriefStep;
  const steps = S.debrief.steps;
  const content = steps[step]!;
  const last = step === steps.length - 1;

  return (
    <main className="screen">
      <div className="steps" aria-hidden="true">
        {steps.map((_, i) => (
          <span key={i} className={i <= step ? "on" : ""} />
        ))}
      </div>
      <p className="kicker">{S.debrief.kicker}</p>
      <h1>{content.title}</h1>
      <div className="stack">
        {content.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>

      {step === 0 && content.stat && s.act2.length > 0 && (
        <p className="panel">{content.stat(pct(winRate(s.act2)))}</p>
      )}
      {step === 1 && content.stat && (
        <>
          <p className="panel">{content.stat(pct(Math.max(s.bestAct3Sim, s.act3.length ? winRate(s.act3) : 0)))}</p>
          <div className="panel stack">
            <OptimalDials table="A" />
            <OptimalDials table="B" />
          </div>
        </>
      )}
      {step === 2 && <NoSignallingPanel />}
      {last && <CreditsList />}

      <div className="spacer" />
      {last ? (
        <div className="row">
          <button className="btn" onClick={() => navigate("/")}>
            {S.debrief.home}
          </button>
          <button className="btn btn--primary" onClick={s.reset}>
            {S.debrief.again}
          </button>
        </div>
      ) : (
        <div className="row">
          {step > 0 && (
            <button className="btn" onClick={() => s.setDebriefStep(step - 1)}>
              {S.debrief.back}
            </button>
          )}
          <button className="btn btn--primary" onClick={() => s.setDebriefStep(step + 1)}>
            {S.debrief.next}
          </button>
        </div>
      )}
    </main>
  );
}

function OptimalDials({ table }: { table: "A" | "B" }) {
  const t = OPTIMAL_TUNING[table];
  return (
    <div className="stack">
      <span className="kicker">{S.debrief.table(table)}</span>
      <div className="row">
        <Dial value={t.greenDeg} small label={S.light[0]} />
        <Dial value={t.redDeg} small label={S.light[1]} />
      </div>
    </div>
  );
}

/** Each player's OPEN rate split by the partner's light: ≈ 50% both ways, so no message gets through. */
function NoSignallingPanel() {
  const tuning = useSolo((s) => s.tuning);
  const act3 = useSolo((s) => s.act3);
  const sim = useMemo(
    () =>
      openRatesByPartnerLight(
        playRounds(quantumStrategyFn(tuning, OPTIMAL_TUNING.B, "A"), DEBRIEF_SIM_ROUNDS, mulberry32(2026)),
      ),
    [tuning],
  );
  const real = openRatesByPartnerLight(act3);
  const P = S.debrief.panel;
  return (
    <div className="panel stack">
      <p className="kicker">{P.head(DEBRIEF_SIM_ROUNDS.toLocaleString("en-GB"))}</p>
      <Bars who={P.you} rates={sim.a} />
      <Bars who={P.crewmate} rates={sim.b} />
      {act3.length > 0 && (
        <p className="muted small">{P.yourRounds(act3.length, fmt(real.a.partnerGreen), fmt(real.a.partnerRed))}</p>
      )}
    </div>
  );
}

const fmt = (r: number | null) => (r === null ? "—" : pct(r));

function Bars({ who, rates }: { who: string; rates: OpenRates }) {
  return (
    <div className="bars">
      {([0, 1] as const).map((light) => {
        const r = light === 0 ? rates.partnerGreen : rates.partnerRed;
        return (
          <div className="bar" key={light}>
            <span>{S.debrief.panel.row(who, S.light[light])}</span>
            <strong>{fmt(r)}</strong>
            <div className="bar__track">
              <div className="bar__fill" style={{ width: `${(r ?? 0) * 100}%` }} />
              <div className="bar__half" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
