import { Officer } from "../components/Officer.tsx";
import { Paper } from "../components/Paper.tsx";
import { PassportPhoto } from "../components/PassportPhoto.tsx";
import { Stamp } from "../components/Stamp.tsx";
import { S } from "../strings.ts";

/** `outlineUrl`: the drawn face, so the Teleblur-processed region is shown untreated. */
export function VerdictScreen(props: { morphUrl: string; outlineUrl: string; reason: string; years: number; onNext: () => void }) {
  return (
    <Paper>
      <Officer line={S.verdict.officer} />
      <PassportPhoto src={props.morphUrl} processedMask={props.outlineUrl} alt="Your passport photo, after the quantum morph">
        <Stamp years={props.years} landing />
      </PassportPhoto>
      <p className="reason">{props.reason}</p>
      <button type="button" className="primary" onClick={props.onNext}>{S.verdict.handBack}</button>
    </Paper>
  );
}
