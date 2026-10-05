// Act III background: William's Entanglement Shader asset, softly behind the panels. Nothing if it isn't there yet
// (the .quantum gradient already sets the mood).
import { atlasUrl, isVideo } from "../assets/atlas/manifest.ts";

export function QuantumBackdrop() {
  const art = atlasUrl("entanglement-reveal");
  if (!art) return null;
  return (
    <div className="backdrop" aria-hidden="true">
      {isVideo(art) ? <video src={art} autoPlay loop muted playsInline /> : <img src={art} alt="" />}
    </div>
  );
}
