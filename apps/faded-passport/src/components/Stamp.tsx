import { S } from "../strings.ts";

/** `landing`: plays the one-off stamp-landing animation when it mounts (timing unchanged: it mounts when it always did). */
export function Stamp({ years, hovering = false, landing = false }: { years?: number; hovering?: boolean; landing?: boolean }) {
  return (
    <div className={`stamp${hovering ? " stamp-hover" : ""}${landing ? " stamp-land" : ""}`} aria-hidden={hovering}>
      <strong>{S.document.stamp}</strong>
      {years !== undefined && <span>{years} yr{years === 1 ? "" : "s"} absent</span>}
    </div>
  );
}
