import { useEffect, useState } from "react";
import { StationVisual } from "../components/StationVisual.tsx";
import { navigate } from "../lib/router.ts";
import { stationAvailable } from "../net/socket.ts";
import { S } from "../strings.ts";

export function Landing() {
  // Event mode needs the station server; a static (solo-only) deploy doesn't have one.
  const [event, setEvent] = useState<boolean | null>(null);
  useEffect(() => {
    void stationAvailable().then(setEvent);
  }, []);

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
      <div className="row">
        <button className="btn" disabled={!event} onClick={() => navigate("/screen")}>
          {S.landing.host}
          <small>{S.landing.hostSub}</small>
        </button>
        <button className="btn" disabled={!event} onClick={() => navigate("/play")}>
          {S.landing.join}
          <small>{S.landing.joinSub}</small>
        </button>
      </div>
      {event === false && <p className="muted small">{S.event.unavailable}</p>}
      <button className="btn btn--ghost" onClick={() => navigate("/credits")}>
        {S.landing.credits}
      </button>
    </main>
  );
}
