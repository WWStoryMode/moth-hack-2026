// The final entry document (the downloadable Challenge 01 image with the Teleblur params printed on
// it), plus the processing record: the raw Teleblur output, the parameters as JSON, or everything
// (including the exact inputs sent) as a zip, so the run can be kept or reproduced.
import { useEffect, useState } from "react";
import { Paper } from "../components/Paper.tsx";
import { composeDocument, type DocumentInput } from "../lib/document.ts";
import { recordFiles, recordJsonBlob, recordZip, saveBlob, type RecordInput } from "../lib/record.ts";
import { S } from "../strings.ts";

export function DocumentScreen(props: { input: DocumentInput; record: Omit<RecordInput, "document">; onAgain: () => void }) {
  const [doc, setDoc] = useState<{ blob: Blob; url: string } | null>(null);
  const [zipping, setZipping] = useState(false);
  useEffect(() => {
    let u: string | undefined;
    composeDocument(props.input).then((blob) => setDoc({ blob, url: (u = URL.createObjectURL(blob)) }));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [props.input]);
  const r = { ...props.record, document: doc?.blob };
  const stem = `faded-passport-${props.input.years}y-${props.record.jobId.slice(0, 8)}`;
  const files = recordFiles(r);
  return (
    <Paper bureau={false}>
      {doc ? (
        <img className="document" src={doc.url} alt={`Your entry document, stamped ${props.input.accepted ? S.document.stampGranted : S.document.stamp}`} />
      ) : (
        <p className="hint">…</p>
      )}
      <div className="row doc-actions">
        {doc && (
          <a className="button primary" href={doc.url} download={`${stem}-permit.png`}>
            {S.document.download}
          </a>
        )}
        <button type="button" className="secondary" onClick={props.onAgain}>{S.document.again}</button>
      </div>
      <section className="record" aria-labelledby="record-heading">
        <h2 id="record-heading" className="record-heading">{S.document.recordHeading}</h2>
        <p className="fineprint">{S.document.recordNote}</p>
        <div className="row record-row">
          <button type="button" className="text-button" onClick={() => saveBlob(r.morph, `${stem}-${files.output}`)}>
            {S.document.downloadImage}
          </button>
          <button type="button" className="text-button" onClick={() => saveBlob(recordJsonBlob(r), `${stem}-${files.params}`)}>
            {S.document.downloadParams}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={zipping || !doc}
            onClick={async () => {
              setZipping(true);
              saveBlob(await recordZip(r), `${stem}.zip`);
              setZipping(false);
            }}
          >
            {S.document.downloadAll}
          </button>
        </div>
      </section>
    </Paper>
  );
}
