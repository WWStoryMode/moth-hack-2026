// Provenance = a record of exactly what produced an output. The GET /jobs endpoints don't
// return the params a job ran with, so we record them at submit time. These files feed the
// submission form's "engines used" and "QPU or emulation?" answers (see scripts/export.ts).
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface Provenance {
  engineId: string;
  jobId: string;
  /** "emu" / "qpu" when the job set it; null means the engine's default (emulator where supported). */
  mode: "emu" | "qpu" | null;
  params: Record<string, unknown> | null;
  inputFiles: Record<string, string> | null;
  submittedAt: string;
  completedAt: string;
  output?: { slot: string | undefined; assetId: string };
}

// Engine params like qpu_token are credentials. Never write them to disk.
const SECRET_KEY = /token|secret|password|api[_-]?key|instance/i;

function redact(obj: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!obj) return null;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, SECRET_KEY.test(k) && v != null ? "[redacted]" : v]),
  );
}

function modeOf(value: unknown): "emu" | "qpu" | null {
  // Some engines use params.mode for other things (qrc-train-v2: "order"), so only emu/qpu count.
  return value === "emu" || value === "qpu" ? value : null;
}

export function buildProvenance(init: {
  engineId: string;
  jobId: string;
  params: Record<string, unknown> | undefined;
  options: Record<string, unknown> | undefined;
  submittedAt: string;
  completedAt: string;
}): Provenance {
  return {
    engineId: init.engineId,
    jobId: init.jobId,
    mode: modeOf(init.options?.mode) ?? modeOf(init.params?.mode),
    params: redact(init.params),
    inputFiles: (init.options?.input_files as Record<string, string> | undefined) ?? null,
    submittedAt: init.submittedAt,
    completedAt: init.completedAt,
  };
}

/** Write `<file>.provenance.json` next to an output file. */
export async function writeProvenance(file: string, provenance: Provenance): Promise<string> {
  const path = `${file}.provenance.json`;
  await writeFile(path, JSON.stringify(provenance, null, 2) + "\n");
  return path;
}

/**
 * Save an inline-result run as `<dir>/<timestamp>-<engine>.json` (provenance + result).
 * Inline results expire server-side, so save them as soon as you have them.
 */
export async function saveRun(dir: string, record: { provenance: Provenance; result: unknown }): Promise<string> {
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(dir, `${stamp}-${record.provenance.engineId}.json`);
  await writeFile(path, JSON.stringify({ provenance: record.provenance, result: record.result }, null, 2) + "\n");
  return path;
}
