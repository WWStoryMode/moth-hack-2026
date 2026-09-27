// pnpm export <app> [--challenge N] [--no-verify]
//
// Builds, for one app (and one of its challenge entries):
//   dist/submissions/<app>/repo/       standalone project (atlas-client vendored) → push as its own public repo
//   dist/submissions/<app>/repo.zip
//   dist/submissions/<app>/form-NN/    FORM.md (answers in form order) + poster/images/slides to upload
// and checks the entry against the submission form's rules. Nothing is pushed or uploaded.
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";
import {
  ROOT,
  challengeLabel,
  collectProvenance,
  enginesUsed,
  entryFor,
  hardwareAnswer,
  loadApp,
} from "./lib/submission.ts";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
const verify = !args.includes("--no-verify");
if (!name) {
  console.error("Usage: pnpm export <app> [--challenge N] [--no-verify]");
  process.exit(1);
}

const app = loadApp(name);
const flag = args.indexOf("--challenge");
const challenges = app.submission.challenges;
const challenge = flag >= 0 ? Number(args[flag + 1]) : challenges.length === 1 ? challenges[0] : undefined;
if (challenge === undefined || !challenges.includes(challenge)) {
  console.error(
    challenges.length
      ? `apps/${name} is entered for challenges ${challenges.join(", ")}; pick one with --challenge N`
      : `apps/${name} has no challenges in submission.json (sandbox apps can't be exported)`,
  );
  process.exit(1);
}
const sub = entryFor(app.submission, challenge);
const provenance = collectProvenance(app.dir);
const out = join(ROOT, "dist", "submissions", name);
const repo = join(out, "repo");
const form = join(out, `form-${String(challenge).padStart(2, "0")}`);
for (const p of [repo, join(out, "repo.zip"), form]) rmSync(p, { recursive: true, force: true });
mkdirSync(repo, { recursive: true });
mkdirSync(form, { recursive: true });

// ─── Checks against the form's rules ──────────────────────────────────────────────
const problems: string[] = [];
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const sentences = (s: string) => (s.trim().match(/[.!?](\s|$)/g) ?? []).length;

if (!sub.title.trim()) problems.push("title is empty");
if (!sub.pitch.trim()) problems.push("pitch is empty");
else if (sentences(sub.pitch) > 1) problems.push(`pitch should be one sentence (found ${sentences(sub.pitch)})`);
const dw = words(sub.description);
if (dw < 100 || dw > 200) problems.push(`description is ${dw} words (form asks 100–200)`);
const tw = words(sub.technical);
if (tw < 50 || tw > 100) problems.push(`technical is ${tw} words (form asks 50–100)`);
if (enginesUsed(app, provenance).length === 0) problems.push("no engines recorded (no provenance files, no enginesViaPlatform)");
if (!sub.links.repo) problems.push("links.repo missing — a public repo is REQUIRED for code projects");
if (!sub.links.video) problems.push("links.video missing — demo video (≤3 min, public YouTube/Vimeo) is REQUIRED");
if (sub.genAI.used && sub.genAI.tools.length === 0) problems.push("genAI.used is true but no tools listed");

if (!sub.media.poster) problems.push("media.poster missing — poster art is REQUIRED");
else {
  const p = join(app.dir, sub.media.poster);
  const dims = existsSync(p) ? imageSize(p) : null;
  if (!existsSync(p)) problems.push(`poster not found: ${sub.media.poster}`);
  else if (!dims) problems.push(`poster must be PNG or JPEG: ${sub.media.poster}`);
  else {
    const ratio = dims.w / dims.h;
    if (ratio < 1 || ratio > 4 / 3 + 0.01)
      problems.push(`poster is ${dims.w}×${dims.h} (ratio ${ratio.toFixed(2)}); form prefers 1:1 to 4:3 landscape`);
  }
}
if (sub.media.images.length > 5) problems.push(`${sub.media.images.length} additional images (max 5)`);
for (const img of sub.media.images) if (!existsSync(join(app.dir, img))) problems.push(`image not found: ${img}`);
if (sub.media.slides && extname(sub.media.slides).toLowerCase() !== ".pdf") problems.push("slides must be a PDF");

// ─── Standalone repo ──────────────────────────────────────────────────────────────
// The app's own tsconfig*.json / vite.config.ts / api/ are kept; only workspace links are rewritten.
const SKIP = new Set(["node_modules", "output", "dist", "CLAUDE.md", "BRIEF.md", "submission.json", "package.json", ".env"]);
for (const entry of readdirSync(app.dir)) {
  if (!SKIP.has(entry)) cpSync(join(app.dir, entry), join(repo, entry), { recursive: true });
}

const clientDir = join(ROOT, "packages", "atlas-client");
const vendor = join(repo, "vendor", "atlas-client");
cpSync(join(clientDir, "src"), join(vendor, "src"), { recursive: true });
const clientPkg = JSON.parse(readFileSync(join(clientDir, "package.json"), "utf8"));
delete clientPkg.scripts;
delete clientPkg.devDependencies;
writeFileSync(join(vendor, "package.json"), JSON.stringify(clientPkg, null, 2) + "\n");

const rootPkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const appPkg = JSON.parse(readFileSync(join(app.dir, "package.json"), "utf8"));
const deps = { ...(appPkg.dependencies ?? {}) };
if (deps["@moth-hack/atlas-client"]) deps["@moth-hack/atlas-client"] = "file:./vendor/atlas-client";
writeFileSync(
  join(repo, "package.json"),
  JSON.stringify(
    {
      name: name,
      version: appPkg.version ?? "1.0.0",
      private: true,
      type: "module",
      description: sub.pitch || undefined,
      engines: { node: ">=20.12" },
      scripts: appPkg.scripts,
      dependencies: deps,
      devDependencies: { ...rootPkg.devDependencies, ...(appPkg.devDependencies ?? {}) },
    },
    null,
    2,
  ) + "\n",
);

// Apps may import the client source by relative path (see apps/faded-passport/server/atlas.ts);
// point those at the vendored copy.
for (const f of walk(repo).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(`${join("vendor", "")}`))) {
  const text = readFileSync(f, "utf8");
  if (!text.includes("packages/atlas-client/src/")) continue;
  const rel = relative(join(f, ".."), join(vendor, "src")).split("\\").join("/");
  writeFileSync(f, text.replace(/(?:\.\.\/)+packages\/atlas-client\/src\//g, `${rel.startsWith(".") ? rel : `./${rel}`}/`));
}

cpSync(join(ROOT, "tsconfig.base.json"), join(repo, "tsconfig.base.json"));
for (const f of readdirSync(repo).filter((f) => /^tsconfig.*\.json$/.test(f) && f !== "tsconfig.base.json")) {
  const p = join(repo, f);
  writeFileSync(p, readFileSync(p, "utf8").replaceAll("../../tsconfig.base.json", "./tsconfig.base.json"));
}
if (!existsSync(join(repo, ".env.example"))) cpSync(join(ROOT, ".env.example"), join(repo, ".env.example"));
writeFileSync(join(repo, ".gitignore"), "node_modules/\n.env\n.env.local\noutput/\ndist/\n.vercel/\n");
if (!existsSync(join(repo, "README.md"))) problems.push("app has no README.md for judges");

// ─── Secret scan: never ship a key ────────────────────────────────────────────────
const leaks: string[] = [];
const realKey = readEnvKey();
for (const f of walk(repo)) {
  if (basename(f) === ".env") leaks.push(`${relative(repo, f)} (a .env file)`);
  const text = readFileSync(f, "latin1");
  if (/moth_[A-Za-z0-9_-]{16,}/.test(text) || (realKey && text.includes(realKey))) leaks.push(relative(repo, f));
}
if (leaks.length) {
  rmSync(out, { recursive: true, force: true });
  console.error(`\n✗ Possible API key in:\n  ${leaks.join("\n  ")}\nExport deleted. Remove the key and re-run.`);
  process.exit(1);
}

// ─── Form pack ────────────────────────────────────────────────────────────────────
const media = [sub.media.poster, ...sub.media.images, sub.media.slides].filter((m): m is string => !!m);
for (const m of media) if (existsSync(join(app.dir, m))) cpSync(join(app.dir, m), join(form, basename(m)));
writeFileSync(join(form, "FORM.md"), formMarkdown());

if (verify) {
  console.log("Verifying the standalone repo installs and typechecks (npm)…");
  execSync("npm install --no-audit --no-fund --loglevel=error && npm run typecheck", { cwd: repo, stdio: "inherit" });
  rmSync(join(repo, "node_modules"), { recursive: true, force: true });
}
execSync(`zip -qr ../repo.zip . -x 'node_modules/*'`, { cwd: repo });

console.log(`\nExported ${relative(ROOT, out)}/  (repo/, repo.zip, ${basename(form)}/FORM.md)`);
if (problems.length) console.log(`\n⚠ Not ready to submit:\n  - ${problems.join("\n  - ")}`);
else console.log("\n✓ All form checks pass.");

// ─── helpers ──────────────────────────────────────────────────────────────────────
function formMarkdown(): string {
  const engines = enginesUsed(app, provenance);
  const gen = sub.genAI;
  return `# Submission form — ${sub.title || name}

Form: https://airtable.com/appsrkUE9iVgeGsH5/pagdAHP56ovMdYX7x/form
Deadline: **Fri 2 Oct 2026, 11:59 PM Pacific** (= Sat 3 Oct 07:59 London)

${problems.length ? `> ⚠ Not ready:\n${problems.map((p) => `> - ${p}`).join("\n")}\n` : "> ✓ All checks pass.\n"}
## About you / team
Fill in yourself (not stored in this repo): team or individual, name, contact email, Discord handle, GitHub handle, occupation, team details, other links.

## Project
**Project title:** ${sub.title}

**Elevator pitch:** ${sub.pitch}

**Select your challenge:** ${challengeLabel(sub.challenge)}

**Project description** (${dw} words):

${sub.description}

**Technical description** (${tw} words):

${sub.technical}

**Which Moth Atlas engines did you use?** ${engines.join(", ") || "—"}

**QPU or emulation?** ${hardwareAnswer(app, provenance)}

**Code repository:** ${sub.links.repo ?? "— (push repo/ to a public GitHub repo)"}

**Demo URL:** ${sub.links.demo ?? "—"}

**Generative AI usage:** ${gen.used ? "Yes" : "No"}${gen.notes ? ` — ${gen.notes}` : ""}

**What generative AI tools did you use?** ${gen.tools.join(", ") || "—"}

**Non-Moth APIs:** ${sub.nonMothApis.length ? "Yes" : "No"}

**Non-Moth API details:** ${sub.nonMothApis.map((a) => `${a.name}: ${a.details}`).join("; ") || "—"}

## Media (files in this folder)
- **Poster art:** ${sub.media.poster ? basename(sub.media.poster) : "— REQUIRED"}
- **Demo video link:** ${sub.links.video ?? "— REQUIRED"}
- **Additional images:** ${sub.media.images.map((i) => basename(i)).join(", ") || "—"}
- **Slides (PDF):** ${sub.media.slides ? basename(sub.media.slides) : "—"}

### Demo video checklist (≤ 3 min, public)
- [ ] Idea pitch
- [ ] Techniques used — which engines, what the quantum part does
- [ ] Results shown
- [ ] Set to public and plays logged-out

## Last bits
Tick eligibility, permission to show work, teammates' details (if any), keep in touch (optional).

## Runs recorded (provenance)
${provenance.map((p) => `- \`${p.engineId}\` job \`${p.jobId}\` mode=${p.mode ?? "default"} — ${p.file}`).join("\n") || "—"}
`;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** The real key from .env, only to search for it — never printed. */
function readEnvKey(): string | undefined {
  const envFile = join(ROOT, ".env");
  if (!existsSync(envFile)) return process.env.MOTH_API_KEY;
  const m = /^MOTH_API_KEY=(.+)$/m.exec(readFileSync(envFile, "utf8"));
  const v = m?.[1]?.trim().replace(/^["']|["']$/g, "");
  return v && v !== "your-key-here" && v.length >= 8 ? v : undefined;
}

/** PNG/JPEG pixel size from the file header. */
function imageSize(file: string): { w: number; h: number } | null {
  const b = readFileSync(file);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1]!;
      const len = b.readUInt16BE(i + 2);
      // SOF0–SOF15 carry the frame size (excluding DHT/JPG/DAC markers C4, C8, CC).
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}
