// A crew avatar. Uses William's Tessa `crew-icons` image (Table A on the left half, Table B on the right half);
// until it exists, a simple helmet in the table's colour.
import { atlasUrl } from "../assets/atlas/manifest.ts";
import type { Table } from "../shared/chsh.ts";

export function CrewIcon({ table, bot = false, size = 32 }: { table: Table; bot?: boolean; size?: number }) {
  const sprite = atlasUrl("crew-icons");
  const style = { width: size, height: size };
  if (sprite && !bot) {
    return (
      <span
        className="crew-icon"
        aria-hidden="true"
        style={{ ...style, backgroundImage: `url(${sprite})`, backgroundPosition: table === "A" ? "0% 50%" : "100% 50%" }}
      />
    );
  }
  const colour = bot ? "var(--ink-muted)" : table === "A" ? "var(--amber)" : "var(--q-3)";
  return (
    <svg className="crew-icon" viewBox="0 0 32 32" style={style} aria-hidden="true">
      <circle cx="16" cy="15" r="11" fill="none" stroke={colour} strokeWidth="2.5" />
      <rect x="9" y="11" width="14" height="8" rx="4" fill={colour} opacity={bot ? 0.4 : 0.85} />
      <path d="M8 27c2-3 5-4 8-4s6 1 8 4" fill="none" stroke={colour} strokeWidth="2.5" strokeLinecap="round" />
      {bot && <circle cx="16" cy="15" r="2" fill="var(--bg)" />}
    </svg>
  );
}
