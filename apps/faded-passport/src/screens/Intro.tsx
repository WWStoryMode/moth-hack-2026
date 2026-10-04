// Years away → Teleblur `strength`: the longer you've been gone, the further the selector qubit
// is rotated from "you" toward "home".
import { useState } from "react";
import { YEARS, yearsToStrength, yearsToTelablurSize } from "../config.ts";
import { Paper } from "../components/Paper.tsx";
import { S } from "../strings.ts";

/** `initial`: keeps the last choice on a replay. `onYears`: live updates (the paper ages as you drag with ?age=all). */
export function IntroScreen(props: { initial?: number; onYears?: (years: number) => void; onStart: (years: number) => void }) {
  const [years, setYears] = useState<number>(props.initial ?? YEARS.initial);
  return (
    <Paper>
      <p className="lead">{S.intro.lead}</p>
      <label className="question" htmlFor="years">{S.intro.question}</label>
      <output className="years" htmlFor="years">{S.intro.years(years)}</output>
      <input
        id="years"
        type="range"
        min={YEARS.min}
        max={YEARS.max}
        step={1}
        value={years}
        onChange={(e) => {
          const y = Number(e.target.value);
          setYears(y);
          props.onYears?.(y);
        }}
      />
      <p className="fineprint readout">
        {S.intro.readout(yearsToStrength(years).toFixed(3), yearsToTelablurSize(years)).split(" · ").map((part, i) => (
          <span key={i}>{i > 0 && " · "}<span className="nowrap">{part}</span></span>
        ))}
      </p>
      <button type="button" className="primary" onClick={() => props.onStart(years)}>{S.intro.start}</button>
    </Paper>
  );
}
