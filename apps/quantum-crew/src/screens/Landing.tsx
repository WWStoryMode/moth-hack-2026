import { StationVisual } from "../components/StationVisual.tsx";
import { navigate } from "../lib/router.ts";
import { S } from "../strings.ts";

export function Landing() {
  return (
    <main className="screen screen--center">
      <p className="kicker">Moth Hack 2026 · FQxI</p>
      <h1>{S.title}</h1>
      <p className="muted">{S.landing.tagline}</p>
      <StationVisual rate={null} />
      <button className="btn btn--primary" onClick={() => navigate("/solo")}>
        {S.landing.solo}
        <small>{S.landing.soloSub}</small>
      </button>
      {/* DECISION: event mode stays disabled until the M3 server exists. */}
      <div className="row">
        <button className="btn" disabled>
          {S.landing.host}
        </button>
        <button className="btn" disabled>
          {S.landing.join}
        </button>
      </div>
      <p className="muted small">{S.landing.eventSoon}</p>
      <button className="btn btn--ghost" onClick={() => navigate("/credits")}>
        {S.landing.credits}
      </button>
    </main>
  );
}
