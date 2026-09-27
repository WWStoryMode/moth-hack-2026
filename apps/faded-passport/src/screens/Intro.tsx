// Years away → TeleBlur `strength`: the longer you've been gone, the further the selector qubit
// is rotated from "you" toward "home".
import { useState } from "react";
import { YEARS, yearsToStrength, yearsToTelablurSize } from "../config.ts";
import { Paper } from "../components/Paper.tsx";
import { S } from "../strings.ts";

export function IntroScreen(props: { onStart: (years: number) => void }) {
  const [years, setYears] = useState<number>(YEARS.initial);
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
        onChange={(e) => setYears(Number(e.target.value))}
      />
      <p className="fineprint">
        telablur-v1 strength {yearsToStrength(years).toFixed(3)} · size {yearsToTelablurSize(years)}
      </p>
      <button type="button" className="primary" onClick={() => props.onStart(years)}>{S.intro.start}</button>
    </Paper>
  );
}
