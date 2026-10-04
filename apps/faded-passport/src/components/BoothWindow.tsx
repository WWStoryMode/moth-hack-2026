// The booth: the officer seen through scratched glass from the traveller's side. A faceless
// silhouette under a peaked cap (brim down: the officer never looks up), dim fluorescent light
// behind, and a document slot at the bottom edge of the glass. The spoken line sits underneath.
import type { Ref } from "react";
import { CapShapes } from "./Cap.tsx";

export function BoothWindow(props: { line: string; sticky?: boolean; slotRef?: Ref<HTMLDivElement> }) {
  return (
    <div className={`booth${props.sticky ? " booth-sticky" : ""}`}>
      <div className="booth-window" aria-hidden="true">
        <div className="booth-light" />
        <svg className="booth-officer" viewBox="0 0 200 120" preserveAspectRatio="xMidYMax meet">
          <g fill="var(--booth-silhouette)">
            {/* shoulders and uniform, collar */}
            <path d="M14,120 C22,94 58,82 100,82 C142,82 178,94 186,120 Z" />
            <path d="M84,84 L100,100 L116,84" fill="none" stroke="var(--booth-rim)" strokeOpacity="0.35" strokeWidth="1.2" />
            {/* neck and head: no face, only a dark shape under the visor */}
            <rect x="88" y="66" width="24" height="20" rx="6" />
            <ellipse cx="100" cy="56" rx="21" ry="24" />
          </g>
          {/* rim light from the tube behind */}
          <path d="M22,112 C34,94 62,85 100,85 C138,85 166,94 178,112" fill="none" stroke="var(--booth-rim)" strokeOpacity="0.25" strokeWidth="1.5" />
          <g color="var(--booth-silhouette)" transform="translate(66 22) scale(1.06)">
            <CapShapes highlight="var(--booth-rim)" />
          </g>
        </svg>
        <div className="booth-glass" />
        <div className="booth-slot" ref={props.slotRef} />
      </div>
      <p className="officer-line" role="status" aria-live="polite">“{props.line}”</p>
    </div>
  );
}
