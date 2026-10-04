import { Rule } from "../components/Rule.tsx";
import { StationVisual } from "../components/StationVisual.tsx";
import { S } from "../strings.ts";
import { useSolo } from "./soloStore.ts";

export function Intro() {
  const start = useSolo((s) => s.start);
  return (
    <main className="screen">
      <p className="kicker">{S.intro.kicker}</p>
      <h1>{S.title}</h1>
      <StationVisual rate={null} />
      <div className="stack">
        {S.intro.lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      <Rule />
      <p>
        <strong>{S.intro.survival}</strong>
      </p>
      <div className="spacer" />
      <button className="btn btn--primary" onClick={start}>
        {S.intro.go}
      </button>
    </main>
  );
}
