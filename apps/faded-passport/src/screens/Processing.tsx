// While Teleblur runs, the officer examines your papers.
import { BoothWindow } from "../components/BoothWindow.tsx";
import { Paper } from "../components/Paper.tsx";
import { PassportPhoto } from "../components/PassportPhoto.tsx";
import { Stamp } from "../components/Stamp.tsx";
import { S } from "../strings.ts";

export function ProcessingScreen(props: { elapsedMs: number; portraitUrl: string }) {
  const lines = S.processing.officer;
  const line = props.elapsedMs > 60_000 ? S.processing.slow : lines[Math.min(lines.length - 1, Math.floor(props.elapsedMs / 4000))]!;
  return (
    <Paper>
      <BoothWindow line={line} />
      <PassportPhoto src={props.portraitUrl} alt="">
        <Stamp hovering />
      </PassportPhoto>
    </Paper>
  );
}
