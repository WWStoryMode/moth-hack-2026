// The emotional peak: the Entanglement Tool arrives, in a look the game hasn't used before.
// Background: William's Entanglement Shader asset if present, else a slow conic shimmer.
import { useEffect } from "react";
import { atlasUrl, isVideo } from "../assets/atlas/manifest.ts";
import { playSfx } from "../audio/sfx.ts";
import { Crystals, EntanglementSurface, hasEntanglementShader } from "../components/EntanglementSurface.tsx";
import { S } from "../strings.ts";
import { useSolo } from "./soloStore.ts";

export function ToolReveal() {
  const openTool = useSolo((s) => s.openTool);
  const art = atlasUrl("entanglement-reveal");
  useEffect(() => playSfx("reveal", "solo"), []);
  return (
    <main className="screen reveal">
      <RevealField art={art} />
      <p className="kicker">{S.tool.kicker}</p>
      <Crystals />
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

/** Behind the reveal: an added image/video, else the live Entanglement Shader film, else a conic shimmer. */
export function RevealField({ art }: { art: string | undefined }) {
  const live = !art && hasEntanglementShader();
  return (
    <div className={`reveal__field ${art || live ? "reveal__field--art" : ""}`} aria-hidden="true">
      {art ? (
        isVideo(art) ? <video src={art} autoPlay loop muted playsInline /> : <img src={art} alt="" />
      ) : (
        live && <EntanglementSurface mode="film" />
      )}
    </div>
  );
}
