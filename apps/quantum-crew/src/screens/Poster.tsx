// /poster: the submission poster (4:3, 1600×1200), built from the game's own pieces: the live Entanglement
// Shader crystals and film, and two Quantum Blur station levels. Not linked from the game; screenshot it to
// regenerate showcase/poster.png.
import { atlasUrl } from "../assets/atlas/manifest.ts";
import { Crystals, EntanglementSurface } from "../components/EntanglementSurface.tsx";
import { S } from "../strings.ts";

export function Poster() {
  const failing = atlasUrl("station-stability-1");
  const stable = atlasUrl("station-stability-4");
  return (
    <main className="poster">
      <div className="poster__film" aria-hidden="true">
        <EntanglementSurface mode="film" />
      </div>
      <header className="poster__head">
        <p className="kicker">{S.poster.kicker}</p>
        <h1>{S.title}</h1>
        <p className="poster__tagline">{S.poster.tagline}</p>
      </header>
      <Crystals className="poster__crystals" />
      <section className="poster__compare">
        <figure>
          {failing && <img src={failing} alt="" />}
          <figcaption>
            <strong className="poster__num poster__num--bad">75%</strong>
            <span>{S.poster.classical}</span>
          </figcaption>
        </figure>
        <figure>
          {stable && <img src={stable} alt="" />}
          <figcaption>
            <strong className="poster__num poster__num--good">85.4%</strong>
            <span>{S.poster.quantum}</span>
          </figcaption>
        </figure>
      </section>
      <footer className="poster__foot">
        <span>{S.poster.foot}</span>
        <span>{S.poster.engines}</span>
      </footer>
    </main>
  );
}
