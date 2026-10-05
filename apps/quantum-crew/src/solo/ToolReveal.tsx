// The emotional peak: the Entanglement Tool arrives, in a look the game hasn't used before.
// Background: William's Entanglement Shader asset if present, else a slow conic shimmer.
import { atlasUrl, isVideo } from "../assets/atlas/manifest.ts";
import { S } from "../strings.ts";
import { useSolo } from "./soloStore.ts";

export function ToolReveal() {
  const openTool = useSolo((s) => s.openTool);
  const art = atlasUrl("entanglement-reveal");
  return (
    <main className="screen reveal">
      <div className="reveal__field" aria-hidden="true" style={art ? { filter: "none", opacity: 0.5 } : undefined}>
        {art && (isVideo(art) ? <video src={art} autoPlay loop muted playsInline /> : <img src={art} alt="" />)}
      </div>
      <p className="kicker">{S.tool.kicker}</p>
      <div className="reveal__crystals" aria-hidden="true">
        <div className="crystal" />
        <div className="crystal" />
      </div>
      <h1 className="reveal__title">{S.tool.title}</h1>
      <div className="stack">
        {S.tool.lines.map((l) => (
          <p key={l}>{l}</p>
        ))}
      </div>
      <div className="spacer" />
      <button className="btn btn--primary" onClick={openTool}>
        {S.tool.go}
      </button>
    </main>
  );
}
