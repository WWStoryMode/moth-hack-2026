import { useRef, useState } from "react";
import { DEBUG } from "../lib/debug.ts";

/**
 * Photo input. Labels say what each button does:
 * - "Take selfie" / "Take photo" opens the camera (capture=user / environment). Only on touch
 *   devices: on desktop browsers ignore `capture`, so it would just open the same file picker.
 * - "Upload photo" opens the gallery / file picker.
 * Before a photo is chosen, the camera (phone) or upload (desktop) is the main action. Afterwards
 * both shrink to text buttons, so handing the photo over is the main action.
 */
export function PhotoPicker(props: {
  camera: "user" | "environment";
  hasPhoto: boolean;
  labels: { take: string; retake: string; choose: string; chooseAgain: string };
  onFile: (file: File) => void;
  /** ?debug only: sample image URLs (src/samples.ts); "Try a sample" cycles through them. */
  samples?: readonly string[];
}) {
  const [note, setNote] = useState<string | null>(null);
  const [next, setNext] = useState(0);
  const cam = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const touch = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) props.onFile(f);
  };
  const l = props.labels;
  const quiet = props.hasPhoto;
  return (
    <div className={`row photo-input${quiet ? " photo-input-quiet" : ""}`}>
      {touch && (
        <button type="button" className={quiet ? "text-button" : "primary"} onClick={() => cam.current?.click()}>
          {quiet ? l.retake : l.take}
        </button>
      )}
      <button
        type="button"
        className={quiet ? "text-button" : touch ? "secondary" : "primary"}
        onClick={() => pick.current?.click()}
      >
        {quiet ? l.chooseAgain : l.choose}
      </button>
      <input ref={cam} type="file" accept="image/*" capture={props.camera} hidden onChange={onChange} />
      <input ref={pick} type="file" accept="image/*" hidden onChange={onChange} />
      {DEBUG && props.samples?.length ? (
        <button
          type="button"
          className="text-button"
          onClick={async () => {
            const url = props.samples![next % props.samples!.length]!;
            setNext(next + 1);
            const res = await fetch(url).catch(() => undefined);
            const blob = res?.ok ? await res.blob() : undefined;
            if (!blob || !blob.type.startsWith("image/")) return setNote(`No sample at ${url} (see public/samples/README.md)`);
            setNote(null);
            props.onFile(new File([blob], url.split("/").pop()!, { type: blob.type }));
          }}
        >
          Try a sample (debug){props.samples.length > 1 ? ` ${(next % props.samples.length) + 1}/${props.samples.length}` : ""}
        </button>
      ) : null}
      {note && <p className="fineprint">{note}</p>}
    </div>
  );
}
