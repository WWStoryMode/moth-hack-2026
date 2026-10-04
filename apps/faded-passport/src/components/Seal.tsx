// The Bureau of Returns seal: an original circular official seal with a geometric moth at its
// centre. Drawn in stamp ink (currentColor = --stamp). Not the Moth Quantum logo.
import { useId } from "react";

export function Seal({ size = 150 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  const r = 71; // radius of the lettering
  return (
    <svg className="seal" width={size} height={size} viewBox="0 0 200 200" role="img" aria-label="Seal of the Bureau of Returns">
      <defs>
        <path id={`ring-${id}`} d={`M 100,100 m -${r},0 a ${r},${r} 0 1,1 ${2 * r},0 a ${r},${r} 0 1,1 -${2 * r},0`} />
      </defs>
      <g fill="none" stroke="currentColor">
        <circle cx="100" cy="100" r="94" strokeWidth="5" />
        <circle cx="100" cy="100" r="86" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="56" strokeWidth="2.5" />
        <circle cx="100" cy="100" r="51" strokeWidth="1" strokeDasharray="2 3" />
      </g>
      <text fill="currentColor" fontFamily="var(--mono)" fontWeight="700" fontSize="15" letterSpacing="1">
        <textPath href={`#ring-${id}`} textLength={2 * Math.PI * r - 4} lengthAdjust="spacing">
          BUREAU OF RETURNS ✦ FORM 40-Y ✦
        </textPath>
      </text>
      {/* Moth: four angular wings, a slim body, two antennae. */}
      <g fill="currentColor" transform="translate(100 102)">
        <path d="M-3,-10 L-38,-30 L-44,-8 L-30,4 L-4,0 Z" />
        <path d="M3,-10 L38,-30 L44,-8 L30,4 L4,0 Z" />
        <path d="M-4,2 L-26,8 L-30,24 L-14,26 L-3,12 Z" />
        <path d="M4,2 L26,8 L30,24 L14,26 L3,12 Z" />
        <path d="M0,-18 C3,-18 4,-8 3,8 C3,18 1,26 0,28 C-1,26 -3,18 -3,8 C-4,-8 -3,-18 0,-18 Z" />
        <circle cx="-22" cy="-15" r="3.5" fill="var(--paper)" />
        <circle cx="22" cy="-15" r="3.5" fill="var(--paper)" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" transform="translate(100 102)">
        <path d="M-1,-18 C-4,-28 -10,-34 -17,-36" />
        <path d="M1,-18 C4,-28 10,-34 17,-36" />
      </g>
    </svg>
  );
}
