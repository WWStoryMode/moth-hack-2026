import { navigate } from "../lib/router.ts";
import { S } from "../strings.ts";

/** /screen and /play until the station server lands in M3. */
export function EventSoon() {
  return (
    <main className="screen screen--center">
      <h1>{S.event.title}</h1>
      <p className="muted">{S.event.body}</p>
      <button className="btn btn--primary" onClick={() => navigate("/solo")}>
        {S.event.solo}
      </button>
    </main>
  );
}
