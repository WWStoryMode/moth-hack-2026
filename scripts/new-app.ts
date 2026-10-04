// pnpm new-app <name> [--challenges 1,8]   → scaffolds apps/<name> from apps/_template
// Name apps after the project. A cNN- prefix also works as a shortcut for --challenges NN.
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { APPS_DIR, ROOT, challengeLabel, type Submission } from "./lib/submission.ts";

const name = process.argv[2];
const flag = process.argv.indexOf("--challenges");
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
const challenges =
  flag > 0 ? (process.argv[flag + 1] ?? "").split(",").map(Number) : match ? [Number(match[1])] : [];
if (challenges.some((c) => !Number.isInteger(c) || c < 1 || c > 11)) {
  console.error("Challenge numbers must be 1–11");
  process.exit(1);
}
const challenge = challenges[0] ?? null;

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
sub.challenges = challenges;
writeFileSync(subFile, JSON.stringify(sub, null, 2) + "\n");

execSync("pnpm install", { cwd: ROOT, stdio: "inherit" });
execSync("pnpm tracker", { cwd: ROOT, stdio: "inherit" });
console.log(`\nCreated apps/${name} (${challenges.map(challengeLabel).join(", ") || "sandbox"}). Run it: pnpm --filter @moth-hack/${name} start`);
