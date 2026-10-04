// After each batch: how it went, the station, and a 1,000-round test to see past small-sample luck.
import { StabilityMeter } from "../components/StabilityMeter.tsx";
import { StationVisual } from "../components/StationVisual.tsx";
import { BATCH_SIZE } from "../config.ts";
import { S } from "../strings.ts";
import { actOf, canReportCeiling, debriefAvailable, displayedStability, useSolo } from "./soloStore.ts";

export function Readout() {
  const s = useSolo((st) => st);
  const act = actOf(s.phase);
  const batchNo = act === 2 ? s.act2Batches : s.act3Batches;
  const wins = s.batch.filter((r) => r.win).length;
  const rounds = act === 2 ? s.act2 : s.act3;
  const value = displayedStability(s);

  return (
    <main className="screen">
      <p className="kicker">{S.readout.kicker(batchNo)}</p>
      <h1>{S.readout.held(wins, BATCH_SIZE)}</h1>
      <StationVisual rate={value} />
      <div className="panel">
        <StabilityMeter
          value={value}
          label={s.lastSim ? S.readout.simLabel : S.readout.actSoFar(rounds.length)}
          showCeiling={act === 3}
          showLimit={act === 3}
        />
      </div>
      <button className="btn" onClick={s.runSimulation}>
        {S.readout.simulate}
        <small>{act === 2 ? S.readout.simulateSub2 : S.readout.simulateSub3}</small>
      </button>
      <div className="spacer" />
      {act === 2 ? (
        <>
          {canReportCeiling(s) && (
            <button className="btn btn--primary" onClick={s.reportCeiling}>
              {S.readout.report}
            </button>
          )}
          <button className={`btn ${canReportCeiling(s) ? "" : "btn--primary"}`} onClick={s.nextBatch}>
            {S.readout.again2}
          </button>
        </>
      ) : (
        <>
          {debriefAvailable(s) && (
            <button className="btn btn--primary" onClick={s.startDebrief}>
              {S.readout.debrief}
            </button>
          )}
          <button className={`btn ${debriefAvailable(s) ? "" : "btn--primary"}`} onClick={s.nextBatch}>
            {S.readout.again3}
          </button>
        </>
      )}
    </main>
  );
}
