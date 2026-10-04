// Act III strategy phase: one dial per light. The crewmate's dials are hidden until the debrief.
import { Dial } from "../components/Dial.tsx";
import { Rule } from "../components/Rule.tsx";
import { SensorLight } from "../components/SensorLight.tsx";
import { StabilityMeter } from "../components/StabilityMeter.tsx";
import { GREEN, RED, winRate } from "../shared/chsh.ts";
import { S } from "../strings.ts";
import { hintAvailable, useSolo } from "./soloStore.ts";

export function Tuning() {
  const s = useSolo((st) => st);
  return (
    <main className="screen">
      <p className="kicker">{S.tuning.kicker}</p>
      <h1>{S.tuning.title}</h1>
      <p>{S.tuning.crewmate}</p>
      <Rule />
      <div className="row panel">
        <Dial
          value={s.tuning.greenDeg}
          onChange={(d) => s.setDial(GREEN, d)}
          label={<SensorLight light={GREEN} small />}
        />
        <Dial value={s.tuning.redDeg} onChange={(d) => s.setDial(RED, d)} label={<SensorLight light={RED} small />} />
      </div>
      {s.act3.length > 0 && (
        <div className="panel">
          <StabilityMeter value={winRate(s.act3)} label={S.readout.actSoFar(s.act3.length)} showCeiling showLimit />
        </div>
      )}
      {hintAvailable(s) &&
        (s.hintShown ? (
          <p className="panel" role="status">
            {S.tuning.hint}
          </p>
        ) : (
          <button className="btn btn--ghost" onClick={s.showHint}>
            {S.tuning.hintButton}
          </button>
        ))}
      <div className="spacer" />
      <button className="btn btn--primary" onClick={s.beginBatch}>
        {S.tuning.start(s.act3Batches + 1)}
      </button>
    </main>
  );
}
