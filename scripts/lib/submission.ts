// Shared helpers for new-app / tracker / export: the submission.json shape, the challenge
// list from https://hack.mothquantum.com, and provenance collection.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const APPS_DIR = join(ROOT, "apps");

export const CHALLENGES = [
  { n: 1, tier: "Beginner", name: "One image, one engine" },
  { n: 2, tier: "Beginner", name: "Make it audible" },
  { n: 3, tier: "Beginner", name: "Three dimensions" },
  { n: 4, tier: "Intermediate", name: "Moving image" },
  { n: 5, tier: "Intermediate", name: "Quantum game" },
  { n: 6, tier: "Intermediate", name: "Daisy Chain" },
  { n: 7, tier: "Intermediate", name: "Make a VST or AU" },
  { n: 8, tier: "Intermediate", name: "Make a web app" },
  { n: 9, tier: "Expert", name: "Quantum-native 1" },
  { n: 10, tier: "Expert", name: "Quantum-native 2" },
  { n: 11, tier: "Guest", name: "FQxI Challenge" },
] as const;

export type Status = "idea" | "building" | "ready" | "submitted";

/** The per-entry fields of the form; `entries` in submission.json can override these per challenge. */
export type EntryFields = Pick<Submission, "title" | "pitch" | "description" | "technical" | "media" | "links" | "status">;

/** Mirrors the "Tell us about your project" + media sections of the submission form. */
export interface Submission {
  /** Challenges (1–11) this project is entered for — one form entry each. Empty = sandbox. */
  challenges: number[];
  /** Optional per-challenge overrides, keyed by challenge number ("1", "8"…). */
  entries?: Record<string, Partial<EntryFields>>;
  title: string;
  /** One sentence. */
  pitch: string;
  /** 100–200 words: concept, artifacts produced, motivation. */
  description: string;
  /** 50–100 words: tools and techniques, including which Atlas engines. */
  technical: string;
  /** Engines used outside the API (e.g. in the browser at platform.mothquantum.com). */
  enginesViaPlatform: string[];
  /** Set "qpu" if you ran on hardware outside the API; "auto" reads it from provenance. */
  hardware: "auto" | "emu" | "qpu" | "both";
  genAI: { used: boolean; tools: string[]; notes: string };
  nonMothApis: { name: string; details: string }[];
  media: { poster: string | null; images: string[]; slides: string | null };
  links: { repo: string | null; demo: string | null; video: string | null };
  status: Status;
}

export interface AppInfo {
  name: string;
  dir: string;
  submission: Submission;
}

export function listApps(): AppInfo[] {
  return readdirSync(APPS_DIR)
    .filter((n) => !n.startsWith("_") && existsSync(join(APPS_DIR, n, "submission.json")))
    .sort()
    .map((name) => loadApp(name));
}

export function loadApp(name: string): AppInfo {
  const dir = join(APPS_DIR, name);
  const file = join(dir, "submission.json");
  if (!existsSync(file)) throw new Error(`apps/${name}/submission.json not found`);
  return { name, dir, submission: JSON.parse(readFileSync(file, "utf8")) as Submission };
}

/** One form entry: shared fields merged with that challenge's overrides. */
export interface Entry extends Omit<Submission, "challenges" | "entries"> {
  challenge: number;
}

export function entryFor(sub: Submission, challenge: number): Entry {
  const { challenges: _c, entries, ...shared } = sub;
  const o = entries?.[String(challenge)] ?? {};
  return {
    ...shared,
    ...o,
    media: { ...shared.media, ...o.media },
    links: { ...shared.links, ...o.links },
    challenge,
  };
}

export interface ProvenanceRecord {
  engineId: string;
  jobId: string;
  mode: "emu" | "qpu" | null;
  params: Record<string, unknown> | null;
  file: string;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? (n === "node_modules" ? [] : walk(p)) : [p];
  });
}

/**
 * Provenance from `*.provenance.json` and saveRun() files in an app's output/, showcase/ and src/assets/
 * (apps that ship Atlas results as game assets keep their provenance next to them).
 */
export function collectProvenance(appDir: string): ProvenanceRecord[] {
  const dirs = ["output", "showcase", join("src", "assets")];
  const files = dirs.flatMap((d) => walk(join(appDir, d))).filter((f) =>
    f.endsWith(".json"),
  );
  const out: ProvenanceRecord[] = [];
  for (const f of files) {
    try {
      const json = JSON.parse(readFileSync(f, "utf8"));
      const p = f.endsWith(".provenance.json") ? json : json?.provenance;
      // The same job can be recorded twice (raw download in output/ and the shipped asset); list it once.
      if (p?.engineId && p?.jobId && !out.some((o) => o.jobId === p.jobId)) out.push({ ...p, file: relative(appDir, f) });
    } catch {
      // Not JSON we understand; skip.
    }
  }
  return out;
}

export function enginesUsed(app: AppInfo, provenance = collectProvenance(app.dir)): string[] {
  return [...new Set([...provenance.map((p) => p.engineId), ...app.submission.enginesViaPlatform])].sort();
}

/** Answer for the form's "QPU or emulation?" question. */
export function hardwareAnswer(app: AppInfo, provenance: ProvenanceRecord[] = collectProvenance(app.dir)): string {
  const h = app.submission.hardware;
  if (h !== "auto") return { emu: "Emulation", qpu: "QPU", both: "Both" }[h];
  const qpu = provenance.some((p) => p.mode === "qpu");
  const emu = provenance.some((p) => p.mode !== "qpu");
  return qpu && emu ? "Both" : qpu ? "QPU" : emu ? "Emulation" : "Unknown (no runs recorded)";
}

export function challengeLabel(n: number | null): string {
  const c = CHALLENGES.find((c) => c.n === n);
  return c ? `${String(c.n).padStart(2, "0")} ${c.name}` : "— (sandbox)";
}
