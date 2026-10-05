// Act III background: the Atlas Entanglement Shader rendered live as a rippling film, softly behind the panels.
// An image or video named entanglement-reveal.* takes its place if one is added; with neither, the .quantum
// gradient alone sets the mood.
import { atlasUrl, isVideo } from "../assets/atlas/manifest.ts";
import { EntanglementSurface } from "./EntanglementSurface.tsx";

export function QuantumBackdrop() {
  const art = atlasUrl("entanglement-reveal");
  return (
    <div className="backdrop" aria-hidden="true">
      {art ? (
        isVideo(art) ? <video src={art} autoPlay loop muted playsInline /> : <img src={art} alt="" />
      ) : (
        <EntanglementSurface mode="film" />
      )}
    </div>
  );
}
