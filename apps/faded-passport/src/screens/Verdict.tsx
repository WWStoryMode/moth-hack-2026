import { Officer } from "../components/Officer.tsx";
import { Paper } from "../components/Paper.tsx";
import { Stamp } from "../components/Stamp.tsx";
import { S } from "../strings.ts";

export function VerdictScreen(props: { morphUrl: string; reason: string; years: number; onNext: () => void }) {
  return (
    <Paper>
      <Officer line={S.verdict.officer} />
      <div className="examine">
        <img className="photo" src={props.morphUrl} alt="Your passport photo, after the quantum morph" />
        <Stamp years={props.years} landing />
      </div>
      <p className="reason">{props.reason}</p>
      <button type="button" className="primary" onClick={props.onNext}>{S.verdict.handBack}</button>
    </Paper>
  );
}
