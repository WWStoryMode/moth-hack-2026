// Read design tokens (src/tokens.css) from JS, for code that draws on a canvas.
export function cssVar(name: `--${string}`, fallback = ""): string {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
