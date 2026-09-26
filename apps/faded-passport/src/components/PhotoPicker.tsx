import { useRef } from "react";

/**
 * Two buttons: camera (capture="user"/"environment" opens the camera on phones) and file picker.
 * On desktop both open the file picker.
 */
export function PhotoPicker(props: {
  camera: "user" | "environment";
  takeLabel: string;
  chooseLabel: string;
  onFile: (file: File) => void;
}) {
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
    </div>
  );
}
