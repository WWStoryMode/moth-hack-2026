import { useRef, useState } from "react";
import { DEBUG } from "../lib/debug.ts";

/**
 * Two buttons: camera (capture="user"/"environment" opens the camera on phones) and file picker.
 * On desktop both open the file picker.
 */
export function PhotoPicker(props: {
  camera: "user" | "environment";
  takeLabel: string;
  chooseLabel: string;
  onFile: (file: File) => void;
  /** ?debug only: sample image URLs (src/samples.ts); "Use sample photo" cycles through them. */
  samples?: readonly string[];
}) {
  const [note, setNote] = useState<string | null>(null);
  const [next, setNext] = useState(0);
  const cam = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) props.onFile(f);
  };
  return (
    <div className="row">
      <button type="button" onClick={() => cam.current?.click()}>{props.takeLabel}</button>
      <button type="button" className="secondary" onClick={() => pick.current?.click()}>{props.chooseLabel}</button>
      <input ref={cam} type="file" accept="image/*" capture={props.camera} hidden onChange={onChange} />
      <input ref={pick} type="file" accept="image/*" hidden onChange={onChange} />
      {DEBUG && props.samples?.length ? (
        <button
          type="button"
          className="secondary"
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
          Use sample photo (debug){props.samples.length > 1 ? ` ${(next % props.samples.length) + 1}/${props.samples.length}` : ""}
        </button>
      ) : null}
      {note && <p className="fineprint">{note}</p>}
    </div>
  );
}
