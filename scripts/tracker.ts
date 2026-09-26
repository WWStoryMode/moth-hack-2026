// pnpm tracker → rewrites the challenge table in README.md from each app's submission.json
// and its provenance files. Edit submission.json, not the table.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CHALLENGES, ROOT, enginesUsed, listApps } from "./lib/submission.ts";

const START = "<!-- tracker:start -->";
const END = "<!-- tracker:end -->";

const apps = listApps();
const rows = CHALLENGES.map((c) => {
  const mine = apps.filter((a) => a.submission.challenge === c.n);
  const cell = (f: (a: (typeof mine)[number]) => string) => (mine.length ? mine.map(f).join("<br>") : "—");
  const links = (a: (typeof mine)[number]) => {
    const l = a.submission.links;
    const parts = [l.repo && `[repo](${l.repo})`, l.demo && `[demo](${l.demo})`, l.video && `[video](${l.video})`];
    return parts.filter(Boolean).join(" · ") || "—";
  };
  return [
    String(c.n).padStart(2, "0"),
    `${c.name} <sub>${c.tier}</sub>`,
    cell((a) => `[\`${a.name}\`](apps/${a.name})`),
    cell((a) => enginesUsed(a).map((e) => `\`${e}\``).join(", ") || "—"),
    cell((a) => a.submission.status),
    cell(links),
  ];
});

const table = [
  "| # | Challenge | App folder | Engines used | Status | Submission link |",
  "|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.join(" | ")} |`),
].join("\n");

const readmePath = join(ROOT, "README.md");
const readme = readFileSync(readmePath, "utf8");
const start = readme.indexOf(START);
const end = readme.indexOf(END);
if (start < 0 || end < start) throw new Error(`README.md needs ${START} … ${END} markers`);
writeFileSync(readmePath, readme.slice(0, start + START.length) + "\n" + table + "\n" + readme.slice(end));
console.log(`README tracker updated (${apps.length} app${apps.length === 1 ? "" : "s"}).`);
