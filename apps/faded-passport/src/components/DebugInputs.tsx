// ?debug only: save the exact 512² inputs the app would send, for `pnpm sweep` (all years, same photos).
import { useState } from "react";
import { MASK } from "../config.ts";
import type { Prepared } from "../lib/image.ts";
import { zipStored } from "../lib/zip.ts";

export function DebugInputs(props: { portrait: Prepared; home: Prepared; mask: Prepared; outline: Prepared; years: number }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const info = { app: "faded-passport", savedAt: new Date().toISOString(), yearsChosen: props.years, mask: MASK };
        const zip = await zipStored([
          { name: "portrait.png", data: props.portrait.blob },
          { name: props.home.blob.type === "image/png" ? "home.png" : "home.jpg", data: props.home.blob },
          { name: "mask.png", data: props.mask.blob },
          { name: "outline.png", data: props.outline.blob },
          { name: "inputs.json", data: new Blob([JSON.stringify(info, null, 2)]) },
        ]);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(zip);
        a.download = `faded-passport-inputs-${Date.now()}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
        setBusy(false);
      }}
    >
      Download inputs (debug)
    </button>
  );
}
