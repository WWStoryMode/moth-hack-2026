// Playtest variants, read once from the URL when the app loads and fixed for the session
// (the app never changes the URL). All flag parsing lives here.
//
//   ?age=photo  (default) only the photo degrades
//   ?age=all    the whole document ages with the years (paper, ink, stains; the permit too)
//   ?age=hint   photo only, plus YEARS ABSENT on the permit printed in ink that fades with age
//   ?debug / ?debug=1   developer tools + a corner label showing the active flags
//
// No analytics: flags only change what is drawn. Playtest data comes from watching, not telemetry.

export type AgeMode = "photo" | "all" | "hint";

export interface Flags {
  readonly age: AgeMode;
  readonly debug: boolean;
}

function readFlags(search: string): Flags {
  const q = new URLSearchParams(search);
  const age = q.get("age");
  const debug = q.get("debug");
  return Object.freeze({
    age: age === "all" || age === "hint" ? age : "photo",
    debug: debug !== null && debug !== "0" && debug !== "false",
  });
}

export const FLAGS: Flags = readFlags(typeof location === "undefined" ? "" : location.search);

/** e.g. "age=all · debug" (for the debug label). */
export function describeFlags(f: Flags = FLAGS): string {
  return [`age=${f.age}`, f.debug ? "debug" : ""].filter(Boolean).join(" · ");
}
