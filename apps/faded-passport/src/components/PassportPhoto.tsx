// A portrait shown as a passport photo: 35:45 frame, centre-cropped from the square image, with a
// light sepia "old document" treatment. Display-only: nothing here changes what is sent to the API.
// With `processedMask` (the drawn face outline), an untreated copy is layered on top through that
// mask, so the region Teleblur processed stays in true colour and stands out.
import type { ReactNode } from "react";

export function PassportPhoto(props: { src: string; alt: string; processedMask?: string; children?: ReactNode }) {
  const mask = props.processedMask ? `url(${props.processedMask})` : undefined;
  return (
    <div className="passport-photo">
      <img className="pp-treated" src={props.src} alt={props.alt} draggable={false} />
      {mask && (
        <img className="pp-processed" src={props.src} alt="" aria-hidden="true" draggable={false} style={{ maskImage: mask, WebkitMaskImage: mask }} />
      )}
      {props.children}
    </div>
  );
}
