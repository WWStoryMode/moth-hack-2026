// The station on screen. Prefers William's Blur degradation levels; falls back to the Tessa base image with a CSS
// filter, then to an SVG placeholder with the same filter.
import { atlasUrl } from "../assets/atlas/manifest.ts";
import { SURVIVAL_THRESHOLD } from "../shared/chsh.ts";

/** 0 = failing … 4 = stable. */
export function levelFor(rate: number | null): number {
  if (rate === null) return 3;
  if (rate >= SURVIVAL_THRESHOLD) return 4;
  if (rate >= 0.75) return 3;
  if (rate >= 0.65) return 2;
  if (rate >= 0.55) return 1;
  return 0;
}

export function StationVisual({ rate }: { rate: number | null }) {
  const level = levelFor(rate);
  const levelUrl = atlasUrl(`station-stability-${level}`);
  const baseUrl = atlasUrl("station-base");
  const alarm = rate !== null && rate < SURVIVAL_THRESHOLD;
  return (
    <div className={`station station--l${level} ${levelUrl ? "" : "station--css"}`} aria-hidden="true">
      {levelUrl ? <img src={levelUrl} alt="" /> : baseUrl ? <img src={baseUrl} alt="" /> : <StationSvg />}
      {alarm && <div className="station__alarm" />}
    </div>
  );
}

function StationSvg() {
  return (
    <svg viewBox="0 0 320 180">
      <g fill="none" stroke="#4a5e74" strokeWidth="3">
        <circle cx="160" cy="90" r="62" />
        <circle cx="160" cy="90" r="50" strokeDasharray="6 5" stroke="#2c3a4a" />
        <path d="M98 90H70M222 90h28M160 28V12M160 152v16" />
      </g>
      <circle cx="160" cy="90" r="16" fill="#ffb627" />
      <rect x="22" y="72" width="48" height="36" rx="6" fill="#1b2531" stroke="#39e58c" strokeWidth="3" />
      <rect x="250" y="72" width="48" height="36" rx="6" fill="#1b2531" stroke="#39e58c" strokeWidth="3" />
      <text x="46" y="96" textAnchor="middle" fill="#eef3f8" fontSize="16" fontFamily="monospace" fontWeight="700">A</text>
      <text x="274" y="96" textAnchor="middle" fill="#eef3f8" fontSize="16" fontFamily="monospace" fontWeight="700">B</text>
      <g fill="#9db0c4">
        <circle cx="40" cy="30" r="1.2" />
        <circle cx="290" cy="22" r="1" />
        <circle cx="250" cy="160" r="1.4" />
        <circle cx="70" cy="150" r="1" />
        <circle cx="120" cy="20" r="0.8" />
      </g>
    </svg>
  );
}
