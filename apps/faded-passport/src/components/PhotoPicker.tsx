import { useRef } from "react";

/**
 * Photo input. Labels say what each button does:
 * - "Take selfie" / "Take photo" opens the camera (capture=user / environment). Only on touch
 *   devices: on desktop browsers ignore `capture`, so it would just open the same file picker.
 * - "Upload photo" opens the gallery / file picker.
 * - "Use a sample …" loads a sample image (src/samples.ts) through the same path as an upload, for
 *   players who'd rather not use their own photo or have no camera. Always a quiet text button.
 * Before a photo is chosen, the camera (phone) or upload (desktop) is the main action. Afterwards
 * both shrink to text buttons, so handing the photo over is the main action.
 */
export function PhotoPicker(props: {
  camera: "user" | "environment";
  hasPhoto: boolean;
  labels: { take: string; retake: string; choose: string; chooseAgain: string; sample?: string };
  onFile: (file: File) => void;
  /** Loads the next sample image (PhotoStep owns the samples); shown as "Use a sample …". */
  onSample?: () => void;
  /** Message under the buttons (e.g. a sample that couldn't be loaded). */
  note?: string | null;
}) {
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
      {/* Only before a photo is chosen: afterwards the row stays as it was (see PhotoStep for "Another place"). */}
      {!quiet && props.onSample && l.sample ? (
        <button type="button" className="text-button" onClick={props.onSample}>
          {l.sample}
        </button>
      ) : null}
      {props.note && <p className="fineprint">{props.note}</p>}
    </div>
  );
}
