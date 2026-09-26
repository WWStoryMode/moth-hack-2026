import { S } from "../strings.ts";

export function Stamp({ years, hovering = false }: { years?: number; hovering?: boolean }) {
  return (
    <div className={`stamp${hovering ? " stamp-hover" : ""}`} aria-hidden={hovering}>
      <strong>{S.document.stamp}</strong>
      {years !== undefined && <span>{years} yr{years === 1 ? "" : "s"} absent</span>}
    </div>
  );
}
