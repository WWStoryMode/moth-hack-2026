// The final entry document — the downloadable Challenge 01 image with the Teleblur params printed on it.
import { useEffect, useState } from "react";
import { Paper } from "../components/Paper.tsx";
import { composeDocument, type DocumentInput } from "../lib/document.ts";
import { S } from "../strings.ts";

export function DocumentScreen(props: { input: DocumentInput; onAgain: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let u: string | undefined;
    composeDocument(props.input).then((blob) => setUrl((u = URL.createObjectURL(blob))));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [props.input]);
  return (
    <Paper bureau={false}>
      {url ? <img className="document" src={url} alt="Your entry document, stamped Entry denied" /> : <p className="hint">…</p>}
      <div className="row">
        {url && (
          <a className="button primary" href={url} download={`faded-passport-${props.input.years}y.png`}>
            {S.document.download}
          </a>
        )}
        <button type="button" className="secondary" onClick={props.onAgain}>{S.document.again}</button>
      </div>
    </Paper>
  );
}
