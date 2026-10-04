// ?debug only: a small corner label so you can see which playtest variant a tester is on.
import { DEBUG } from "../lib/debug.ts";
import { describeFlags } from "../lib/flags.ts";

export function DebugBadge({ detail }: { detail?: string }) {
  if (!DEBUG) return null;
  return (
    <div className="debug-badge" aria-hidden="true">
      {describeFlags()}
      {detail ? ` · ${detail}` : ""}
    </div>
  );
}
