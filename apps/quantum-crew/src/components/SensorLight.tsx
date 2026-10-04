import type { Light } from "../shared/chsh.ts";
import { S } from "../strings.ts";

export function SensorLight({ light, label, small = false }: { light: Light | null; label?: string; small?: boolean }) {
  const cls = light === null ? "light--off" : `light--${light}`;
  return (
    <div className={`light ${cls} ${small ? "light--small" : ""}`} aria-live="polite">
      {label && <span className="kicker">{label}</span>}
      <div className="light__bulb">{light === null ? "…" : S.light[light]}</div>
      {small && light !== null && <strong>{S.light[light]}</strong>}
    </div>
  );
}
