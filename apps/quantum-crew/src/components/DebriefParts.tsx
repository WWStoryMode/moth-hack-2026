// Pieces of the debrief shared by the solo phone screens and the TV.
import { Dial } from "./Dial.tsx";
import { pct } from "./StabilityMeter.tsx";
import { OPTIMAL_TUNING, type OpenRates } from "../shared/chsh.ts";
import { S } from "../strings.ts";

export function OptimalDials({ table }: { table: "A" | "B" }) {
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

export const fmt = (r: number | null) => (r === null ? "—" : pct(r));

export function Bars({ who, rates }: { who: string; rates: OpenRates }) {
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
