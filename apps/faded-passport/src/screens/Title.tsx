import { Paper } from "../components/Paper.tsx";
import { Seal } from "../components/Seal.tsx";
import { S } from "../strings.ts";

export function TitleScreen(props: { onBegin: () => void }) {
  return (
    <Paper>
      <div className="title-page">
        <p className="form-id">{S.form}</p>
        <h1 className="title">{S.title}</h1>
        <p className="tagline">{S.titlePage.tagline}</p>
        <div className="title-seal"><Seal /></div>
      </div>
      <button type="button" className="primary" onClick={props.onBegin}>{S.titlePage.begin}</button>
      <p className="fineprint">{S.intro.privacy}</p>
      <p className="fineprint">{S.titlePage.credit}</p>
    </Paper>
  );
}
