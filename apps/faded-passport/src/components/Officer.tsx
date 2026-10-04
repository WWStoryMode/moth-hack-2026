/**
 * The officer speaks from behind the glass. All you see is a peaked cap from slightly above, brim
 * tilted down: the officer never looks up. Original art, same size and place as before.
 */
export function Officer({ line }: { line: string }) {
  return (
    <div className="officer" role="status" aria-live="polite">
      <svg className="officer-cap" viewBox="0 0 64 40" aria-hidden="true">
        {/* band: narrower than the crown, mostly hidden under it */}
        <path d="M14,17 L50,17 L49,27 C42,29.5 22,29.5 15,27 Z" fill="currentColor" />
        <path d="M15,24.5 C22,26.8 42,26.8 49,24.5" fill="none" stroke="var(--paper)" strokeOpacity="0.4" strokeWidth="0.9" />
        {/* crown, seen from slightly above: wide, overhanging the band */}
        <ellipse cx="32" cy="12.5" rx="30" ry="10.5" fill="currentColor" />
        <ellipse cx="32" cy="11.5" rx="25" ry="7" fill="none" stroke="var(--paper)" strokeOpacity="0.2" strokeWidth="1" />
        {/* badge on the front of the crown */}
        <path d="M32,15.5 L36,17.3 L35.4,21.2 L32,23.2 L28.6,21.2 L28,17.3 Z" fill="var(--paper)" />
        <path d="M32,17.4 L33.8,18.3 L33.5,20.3 L32,21.2 L30.5,20.3 L30.2,18.3 Z" fill="currentColor" />
        {/* visor, tilted down toward you: the officer doesn't look up */}
        <path d="M10,27.5 C16,36 25,39.5 32,39.5 C39,39.5 48,36 54,27.5 C46,31 39,32 32,32 C25,32 18,31 10,27.5 Z" fill="currentColor" />
        <path d="M16,31.8 C22,36 27,37.4 32,37.4 C37,37.4 42,36 48,31.8" fill="none" stroke="var(--paper)" strokeOpacity="0.25" strokeWidth="0.9" />
      </svg>
      <p className="officer-line">“{line}”</p>
    </div>
  );
}
