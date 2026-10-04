// End of Act II: the wall is named. Still no physics words; those wait for the debrief.
import { StabilityMeter } from "../components/StabilityMeter.tsx";
import { winRate } from "../shared/chsh.ts";
import { S } from "../strings.ts";
import { useSolo } from "./soloStore.ts";

export function Ceiling() {
  const act2 = useSolo((s) => s.act2);
  const revealTool = useSolo((s) => s.revealTool);
  return (
    <main className="screen">
      <p className="kicker">{S.ceiling.kicker}</p>
      <div className="huge">{S.ceiling.big}</div>
      <div className="stack">
        {S.ceiling.lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      <div className="panel">
        <StabilityMeter value={act2.length ? winRate(act2) : null} label={S.readout.actSoFar(act2.length)} showCeiling />
      </div>
      <div className="spacer" />
      <button className="btn btn--primary" onClick={revealTool}>
        {S.ceiling.go}
      </button>
    </main>
  );
}
