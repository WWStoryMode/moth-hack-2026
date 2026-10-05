// Resolves the Atlas asset list (list.ts) to the files that exist next to this module. Missing files resolve to
// undefined and the app renders a placeholder, so it never breaks.
import { ATLAS_ASSETS, type AtlasAsset } from "./list.ts";

export { ATLAS_ASSETS, type AtlasAsset };

// Vite resolves whatever files exist at build time; missing ones are simply absent.
const files = import.meta.glob("./*.{png,jpg,jpeg,webp,gif,svg,mp4,webm,mp3,ogg,wav,m4a}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const byKey = new Map<string, string>();
for (const [path, url] of Object.entries(files)) {
  const name = path.slice(2).replace(/\.[^.]+$/, "");
  byKey.set(name, url);
}

/** URL of the asset for this key, or undefined if William hasn't added it yet. */
export function atlasUrl(key: string): string | undefined {
  return byKey.get(key);
}

export function isVideo(url: string): boolean {
  return /\.(mp4|webm)(\?|$)/.test(url);
}
