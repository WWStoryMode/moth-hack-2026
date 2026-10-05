import { S } from "../strings.ts";

/**
 * `landing`: plays the one-off stamp-landing animation when it mounts. `granted`: ENTRY GRANTED in
 * green ink instead of ENTRY DENIED in red.
 */
export function Stamp(props: { years?: number; landing?: boolean; granted?: boolean }) {
  const { years, landing = false, granted = false } = props;
  return (
    <div className={`stamp${landing ? " stamp-land" : ""}${granted ? " stamp-granted" : ""}`}>
      <strong>{granted ? S.document.stampGranted : S.document.stamp}</strong>
      {years !== undefined && <span>{years} yr{years === 1 ? "" : "s"} absent</span>}
    </div>
  );
}
