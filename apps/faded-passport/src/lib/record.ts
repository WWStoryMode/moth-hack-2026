// The processing record: what Teleblur was given, what it returned, and exactly how. Built in the
// browser from data the game already holds (no extra API calls, nothing stored), so a player can keep
// the raw result and the parameters, or reproduce the run. All values are real values from this play.
import { ENGINE, MASK, SIZE, STRENGTH_CURVE, TELABLUR_SIZE, VERDICT, type TelablurParams } from "../config.ts";
import type { ReasonKey } from "./change.ts";
import { FLAGS } from "./flags.ts";
import { zipStored } from "./zip.ts";

export interface RecordInput {
  jobId: string;
  /** Server-confirmed Teleblur params (from /api/submit), exactly what the job ran with. */
  params: TelablurParams;
  years: number;
  /** The three files sent as image1, image2, mask; plus the drawn outline (not sent, used for the verdict). */
  portrait: Blob;
  home: Blob;
  mask: Blob;
  outline: Blob;
  /** Teleblur's output image, as returned. */
  morph: Blob;
  /** The composed entry document PNG (if ready). */
  document?: Blob;
  verdict: { accepted: boolean; reason: ReasonKey; likeness: number; homeness: number };
  completedAt: Date;
}

const ext = (b: Blob) => (b.type === "image/jpeg" ? "jpg" : "png");

/** File names used in the zip, and referenced from the JSON. */
export function recordFiles(r: RecordInput) {
  return {
    output: `teleblur-output.${ext(r.morph)}`,
    image1: `input-portrait.${ext(r.portrait)}`,
    image2: `input-home.${ext(r.home)}`,
    mask: `input-mask.${ext(r.mask)}`,
    outline: `outline.${ext(r.outline)}`,
    document: "entry-permit.png",
    params: "parameters.json",
  };
}

export function recordJson(r: RecordInput) {
  const f = recordFiles(r);
  return {
    app: "Faded Passport",
    recordedAt: r.completedAt.toISOString(),
    engine: { id: ENGINE, name: "Quantum Teleblur", api: "Moth Quantum Atlas API", backend: "simulator" },
    jobId: r.jobId,
    years: r.years,
    params: r.params,
    inputs: {
      image1: { file: f.image1, role: "portrait (morphed toward image2)", type: r.portrait.type, width: SIZE, height: SIZE },
      image2: { file: f.image2, role: "home (the destination)", type: r.home.type, width: SIZE, height: SIZE },
      mask: {
        file: f.mask,
        role: "where the morph applies (white = fully, black = not at all)",
        type: r.mask.type,
        width: SIZE,
        height: SIZE,
        recipe: MASK,
      },
    },
    output: { file: f.output, type: r.morph.type, width: SIZE, height: SIZE },
    /** How the game turned the years into Teleblur params. */
    mapping: { strengthCurve: STRENGTH_CURVE, size: { ...TELABLUR_SIZE, curve: "log" } },
    verdict: {
      outcome: r.verdict.accepted ? "entry granted" : "entry denied",
      reason: r.verdict.reason,
      likeness: round(r.verdict.likeness),
      homeness: round(r.verdict.homeness),
      thresholds: VERDICT,
      measuredInside: f.outline,
    },
    playtestVariant: { age: FLAGS.age },
  };
}

const round = (n: number) => Math.round(n * 10000) / 10000;

export function recordJsonBlob(r: RecordInput): Blob {
  return new Blob([JSON.stringify(recordJson(r), null, 2) + "\n"], { type: "application/json" });
}

/** Everything in one zip: permit, raw output, parameters, and the exact inputs sent. */
export async function recordZip(r: RecordInput): Promise<Blob> {
  const f = recordFiles(r);
  return zipStored([
    ...(r.document ? [{ name: f.document, data: r.document }] : []),
    { name: f.output, data: r.morph },
    { name: f.params, data: recordJsonBlob(r) },
    { name: f.image1, data: r.portrait },
    { name: f.image2, data: r.home },
    { name: f.mask, data: r.mask },
    { name: f.outline, data: r.outline },
  ]);
}

/** Save a blob as a file (works for in-memory blobs on desktop and phones). */
export function saveBlob(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
