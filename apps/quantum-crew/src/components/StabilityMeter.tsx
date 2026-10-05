import { CLASSICAL_LIMIT, QUANTUM_LIMIT, SURVIVAL_THRESHOLD } from "../shared/chsh.ts";
import { S } from "../strings.ts";

// DECISION: the bar spans 50–100%. Every interesting value sits between 60 and 90, and a 0–100 bar
// would squash the 75 / 80 / 85.4 lines together.
const MIN = 0.5;
const pos = (rate: number) => `${(Math.min(1, Math.max(MIN, rate)) - MIN) / (1 - MIN) * 100}%`;

export const pct = (rate: number) => `${(rate * 100).toFixed(1)}%`;

type Props = {
  value: number | null;
  label: string;
  /** The 75% line appears once the ceiling is revealed; the 85.4% line once the tool is in play. */
  showCeiling?: boolean;
  showLimit?: boolean;
};

export function StabilityMeter({ value, label, showCeiling = false, showLimit = false }: Props) {
  const ok = value !== null && value >= SURVIVAL_THRESHOLD;
  return (
    <div className="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value === null ? undefined : Math.round(value * 100)}>
      <div className="meter__head">
        <span className="kicker">{label}</span>
        <span className={`meter__value ${value === null ? "" : ok ? "meter__value--ok" : "meter__value--bad"}`}>
          {value === null ? "—" : pct(value)}
        </span>
      </div>
      <div className="meter__track">
        <div className={`meter__fill ${ok ? "meter__fill--ok" : ""}`} style={{ width: value === null ? 0 : pos(value) }} />
        {showCeiling && (
          <div className="meter__line meter__line--ceiling" style={{ left: pos(CLASSICAL_LIMIT) }}>
            <span>{S.meter.ceiling}</span>
          </div>
        )}
        <div className="meter__line meter__line--survival" style={{ left: pos(SURVIVAL_THRESHOLD) }}>
          <span>{S.meter.survival}</span>
        </div>
        {showLimit && (
          <div className="meter__line meter__line--limit" style={{ left: pos(QUANTUM_LIMIT) }}>
            <span>{S.meter.limit}</span>
          </div>
        )}
      </div>
    </div>
  );
}
