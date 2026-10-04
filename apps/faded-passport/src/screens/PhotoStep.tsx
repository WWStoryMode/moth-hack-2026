// Shared by "Passport, please" (portrait, front camera) and "Where are you going?" (home, rear camera).
import { useState, type ReactNode } from "react";
import { Officer } from "../components/Officer.tsx";
import { Paper } from "../components/Paper.tsx";
import { PassportPhoto } from "../components/PassportPhoto.tsx";
import { PhotoPicker } from "../components/PhotoPicker.tsx";
import { prepareSquare, type Prepared } from "../lib/image.ts";
import { S } from "../strings.ts";

export function PhotoStep(props: {
  step: string;
  text: { officer: string; hint: string; take: string; choose: string; next: string; retake: string };
  camera: "user" | "environment";
  /** Portrait is PNG so the morph comes back lossless; home can be JPEG. */
  type: "image/png" | "image/jpeg";
  alt: string;
  /** Show the preview as a passport photo (35:45, sepia). Used for the portrait, not for home. */
  passport?: boolean;
  /** ?debug only: sample image URLs for this step (src/samples.ts). */
  samples?: readonly string[];
  onDone: (photo: Prepared) => void;
  /** Rendered under the photo once one is chosen (used for the ?debug input download). */
  extra?: (photo: Prepared) => ReactNode;
}) {
  const [photo, setPhoto] = useState<Prepared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = props.text;
  return (
    <Paper step={props.step}>
      <Officer line={t.officer} />
      <p className="hint">{error ?? t.hint}</p>
      {photo && (props.passport
        ? <PassportPhoto src={photo.url} alt={props.alt} />
        : <img className="photo" src={photo.url} alt={props.alt} />)}
      {photo && props.extra?.(photo)}
      <PhotoPicker
        camera={props.camera}
        takeLabel={photo ? t.retake : t.take}
        chooseLabel={t.choose}
        samples={props.samples}
        onFile={async (f) => {
          setError(null);
          try {
            if (photo) URL.revokeObjectURL(photo.url);
            setPhoto(await prepareSquare(f, props.type));
          } catch {
            setPhoto(null);
            setError(S.errors.unreadable);
          }
        }}
      />
      <button type="button" className="primary" disabled={!photo} onClick={() => photo && props.onDone(photo)}>
        {t.next}
      </button>
    </Paper>
  );
}
