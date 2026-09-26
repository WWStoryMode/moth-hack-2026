// pnpm new-app c03-my-idea   → scaffolds apps/c03-my-idea from apps/_template
// Names starting cNN- are linked to challenge NN; anything else is a sandbox app.
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { APPS_DIR, ROOT, challengeLabel, type Submission } from "./lib/submission.ts";

const name = process.argv[2];
if (!name || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  console.error("Usage: pnpm new-app <kebab-name>   e.g. pnpm new-app c01-quantum-portrait");
  process.exit(1);
}
const dir = join(APPS_DIR, name);
if (existsSync(dir)) {
  console.error(`apps/${name} already exists`);
  process.exit(1);
}

const match = /^c(\d{2})-/.exec(name);
const challenge = match ? Number(match[1]) : null;
if (challenge !== null && (challenge < 1 || challenge > 10)) {
  console.error(`Challenge number must be 01–10 (got ${match?.[1]})`);
  process.exit(1);
}

cpSync(join(APPS_DIR, "_template"), dir, { recursive: true, filter: (src) => !src.includes("node_modules") });

for (const file of ["package.json", "README.md", "CLAUDE.md", "src/index.ts"]) {
  const p = join(dir, file);
  writeFileSync(
    p,
    readFileSync(p, "utf8")
      .replaceAll("@moth-hack/template", `@moth-hack/${name}`)
      .replaceAll("{{APP}}", name)
      .replaceAll("{{CHALLENGE}}", challengeLabel(challenge)),
  );
}
const subFile = join(dir, "submission.json");
const sub = JSON.parse(readFileSync(subFile, "utf8")) as Submission;
sub.challenge = challenge;
writeFileSync(subFile, JSON.stringify(sub, null, 2) + "\n");

execSync("pnpm install", { cwd: ROOT, stdio: "inherit" });
execSync("pnpm tracker", { cwd: ROOT, stdio: "inherit" });
console.log(`\nCreated apps/${name} (${challengeLabel(challenge)}). Run it: pnpm --filter @moth-hack/${name} start`);
