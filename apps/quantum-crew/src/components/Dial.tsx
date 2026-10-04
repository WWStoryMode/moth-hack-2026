// The Entanglement Tool dial: 8 stops from 0° to 157.5°. The needle is drawn as a full line through the hub
// because a measurement at θ and at θ + 180° is the same measurement: 157.5° points where −22.5° would.
import type { ReactNode } from "react";
import { DIAL_POSITIONS } from "../shared/chsh.ts";
import { S } from "../strings.ts";

const R = 50;
const point = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad) };
};

export const formatDeg = (deg: number) => `${deg}°`;

type Props = {
  value: number;
  onChange?: (deg: number) => void;
  label?: ReactNode;
  small?: boolean;
};

export function Dial({ value, onChange, label, small = false }: Props) {
  const i = DIAL_POSITIONS.indexOf(value as (typeof DIAL_POSITIONS)[number]);
  const step = (d: number) => onChange?.(DIAL_POSITIONS[(i + d + DIAL_POSITIONS.length) % DIAL_POSITIONS.length]!);
  const tip = point(value, R - 8);
  return (
    <div className={`dial ${small ? "dial--small" : ""}`}>
      {label && <div className="dial__label">{label}</div>}
      <svg viewBox="-68 -68 136 136" role="img" aria-label={`${formatDeg(value)}`}>
        <circle className="dial__face" r={R} />
        {DIAL_POSITIONS.map((deg) => {
          const a = point(deg, R - 3);
          const b = point(deg, R + 3);
          const o = point(deg + 180, R - 3);
          const o2 = point(deg + 180, R + 3);
          return (
            <g key={deg}>
              <line className="dial__tick" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              <line className="dial__tick" x1={o.x} y1={o.y} x2={o2.x} y2={o2.y} />
            </g>
          );
        })}
        <line className="dial__needle dial__tail" x1={-tip.x} y1={-tip.y} x2={0} y2={0} />
        <line className="dial__needle" x1={0} y1={0} x2={tip.x} y2={tip.y} />
        <circle className="dial__hub" r={6} />
        {onChange &&
          DIAL_POSITIONS.map((deg) => {
            const p = point(deg, R + 10);
            return (
              <circle
                key={deg}
                className={`dial__stop ${deg === value ? "dial__stop--on" : ""}`}
                cx={p.x}
                cy={p.y}
                r={5.5}
                onClick={() => onChange(deg)}
              >
                <title>{formatDeg(deg)}</title>
              </circle>
            );
          })}
      </svg>
      {onChange ? (
        <div className="dial__controls">
          <button className="btn" onClick={() => step(-1)} aria-label={S.dial.prev}>
            ◀
          </button>
          <span className="dial__value">{formatDeg(value)}</span>
          <button className="btn" onClick={() => step(1)} aria-label={S.dial.next}>
            ▶
          </button>
        </div>
      ) : (
        <span className="dial__value">{formatDeg(value)}</span>
      )}
    </div>
  );
}
