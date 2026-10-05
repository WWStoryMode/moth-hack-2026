// Act II strategy huddle: the player picks a valve for each light. The crewmate always OPENs.
import { Rule } from "../components/Rule.tsx";
import { SensorLight } from "../components/SensorLight.tsx";
import { pct } from "../components/StabilityMeter.tsx";
import { CLOSED, GREEN, OPEN, RED, winRate, type Light } from "../shared/chsh.ts";
import { S } from "../strings.ts";
import { useSolo } from "./soloStore.ts";

export function Plan() {
  const plan = useSolo((s) => s.plan);
  const setPlan = useSolo((s) => s.setPlan);
  const beginBatch = useSolo((s) => s.beginBatch);
  const batches = useSolo((s) => s.act2Batches);
  const lastBatch = useSolo((s) => s.batch);

  const row = (light: Light, label: string) => {
    const current = light === GREEN ? plan.onGreen : plan.onRed;
    return (
      <div className="stack">
        <div className="dial__label">
          <SensorLight light={light} small />
          <span>{label}</span>
        </div>
        <div className="row" role="radiogroup" aria-label={label}>
          {[OPEN, CLOSED].map((v) => (
            <button
              key={v}
              role="radio"
              aria-checked={current === v}
              className={`btn ${current === v ? "btn--selected" : ""}`}
              onClick={() => setPlan(light, v)}
            >
              {S.valve[v]}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="screen">
      <p className="kicker">{S.plan.kicker}</p>
      <h1>{S.plan.title}</h1>
      <p>{S.plan.crewmate}</p>
      <Rule />
      <div className="panel stack">
        {row(GREEN, S.plan.whenGreen)}
        {row(RED, S.plan.whenRed)}
      </div>
      <p className="muted small">{S.plan.blind}</p>
      {batches > 0 && <p className="muted">{S.plan.last(pct(winRate(lastBatch)))}</p>}
      <div className="spacer" />
      <button className="btn btn--primary" onClick={beginBatch}>
        {S.plan.start(batches + 1)}
      </button>
    </main>
  );
}
