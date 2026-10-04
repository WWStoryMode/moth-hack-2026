// "Wait here": a machine reading over the passport photo while Teleblur runs. Black translucent
// layer, yellow condensed monospace, a scanline over the face. Every value shown is real data
// from this job (engine id, the server-confirmed params, the job id, the polled status); nothing
// is invented. Lines type out as they become known. Reduced motion: static, all text at once.
import { ENGINE } from "../config.ts";
import type { Job } from "../lib/api.ts";

/** `submitted` = the server accepted the job (202); the others come from polling the job status. */
export type ScanPhase = "uploading" | "submitted" | "queued" | "processing" | "completed";

export function ScanOverlay({ phase, job }: { phase: ScanPhase; job?: Job }) {
  // STATUS is padded to a fixed width so its typed-out width never clips a longer value.
  const rows: [string, string, string][] = [["STATUS", "STATUS", phase.toUpperCase().padEnd(10)]];
  if (job) {
    const [a, ...b] = job.jobId.split(/(?<=^[^-]*-[^-]*)-/); // job id over two rows on narrow photos
    rows.unshift(
      ["MODEL", "MODEL", ENGINE],
      ["STRENGTH", "STRENGTH", String(job.params.strength)],
      ["SIZE", "SIZE", String(job.params.size)],
      ["JOB", "JOB", b.length ? `${a}-` : job.jobId],
      ...(b.length ? [["JOB2", "", b.join("-")] as [string, string, string]] : []),
    );
  }
  return (
    <div className="scan" aria-live="polite">
      <div className="scan-line" aria-hidden="true" />
      <div className="scan-text">
        {rows.map(([key, k, v], i) => {
          const text = `${k.padEnd(9)}${v}`;
          return (
            // Keyed by label: a changing STATUS updates in place without retyping the block.
            <div key={key} className="scan-row" style={{ "--n": text.length, "--i": i } as React.CSSProperties}>
              {text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
