// Shared by "Passport, please" (portrait, front camera) and "Where are you going?" (home, rear camera).
import { useRef, useState, type ReactNode } from "react";
import { BoothWindow } from "../components/BoothWindow.tsx";
import { DragToSlot } from "../components/DragToSlot.tsx";
import { Paper } from "../components/Paper.tsx";
import { PassportPhoto } from "../components/PassportPhoto.tsx";
import { PhotoPicker } from "../components/PhotoPicker.tsx";
import { DEBUG } from "../lib/debug.ts";
import { prepareSquare, type Prepared } from "../lib/image.ts";
import { S } from "../strings.ts";

export function PhotoStep(props: {
  step: string;
  text: { officer: string; hint: string; take: string; choose: string; next: string; retake: string; chooseAgain: string; sample?: string; sampleAgain?: string; dragHint?: string };
  camera: "user" | "environment";
  /** Portrait is PNG so the morph comes back lossless; home can be JPEG. */
  type: "image/png" | "image/jpeg";
  alt: string;
  /** Show the preview as a passport photo (35:45, sepia). Used for the portrait, not for home. */
  passport?: boolean;
  /** Sample image URLs for this step (src/samples.ts), offered to every player. */
  samples?: readonly string[];
  onDone: (photo: Prepared) => void;
  /** Rendered under the photo once one is chosen (used for the ?debug input download). */
  extra?: (photo: Prepared) => ReactNode;
}) {
  const [photo, setPhoto] = useState<Prepared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /** Index of the next sample to load, and whether the current photo is a sample. */
  const [nextSample, setNextSample] = useState(0);
  const [isSample, setIsSample] = useState(false);
  const slot = useRef<HTMLDivElement>(null);
  /** The portrait is handed through the booth slot (drag, or the "Hand it over" button). */
  const handOver = props.passport && !!photo;
  const t = props.text;
  const samples = props.samples ?? [];

  const takePhoto = async (f: Blob, fromSample: boolean) => {
    setError(null);
    try {
      if (photo) URL.revokeObjectURL(photo.url);
      setPhoto(await prepareSquare(f, props.type));
      setIsSample(fromSample);
    } catch {
      setPhoto(null);
      setError(S.errors.unreadable);
    }
  };
  /** Load the next sample image through the same path as an upload. */
  const loadSample = async () => {
    const url = samples[nextSample % samples.length];
    if (!url) return;
    setNextSample(nextSample + 1);
    const res = await fetch(url).catch(() => undefined);
    const blob = res?.ok ? await res.blob() : undefined;
    if (!blob || !blob.type.startsWith("image/")) return setNote(`No sample at ${url} (see public/samples/README.md)`);
    setNote(null);
    await takePhoto(blob, true);
  };
  /** "Another place": a corner tab over a sample photo, so cycling adds no height. */
  const anotherSample = photo && isSample && samples.length > 1 && t.sampleAgain && (
    <button type="button" className="sample-tab" onClick={loadSample}>
      {t.sampleAgain}
      {DEBUG ? ` (${(nextSample % samples.length) + 1}/${samples.length})` : ""}
    </button>
  );
  return (
    <Paper step={props.step}>
      <BoothWindow line={t.officer} sticky={props.passport} slotRef={slot} />
      <p className="hint">{error ?? t.hint}</p>
      {photo && (props.passport
        ? (
          <DragToSlot slotRef={slot} onDone={() => props.onDone(photo)} buttonLabel={t.next} hint={t.dragHint ?? ""}>
            <PassportPhoto src={photo.url} alt={props.alt} />
          </DragToSlot>
        )
        : (
          <div className="photo-frame">
            <img className="photo" src={photo.url} alt={props.alt} />
            {anotherSample}
          </div>
        ))}
      {photo && props.extra?.(photo)}
      <PhotoPicker
        camera={props.camera}
        hasPhoto={!!photo}
        labels={t}
        onSample={samples.length ? loadSample : undefined}
        note={note}
        onFile={(f) => takePhoto(f, false)}
      />
      {/* The main button appears once there's a photo to hand over (before that, taking one is the main action). */}
      {photo && !handOver && (
        <button type="button" className="primary" onClick={() => props.onDone(photo)}>
          {t.next}
        </button>
      )}
    </Paper>
  );
}
