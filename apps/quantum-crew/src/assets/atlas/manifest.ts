// Every Atlas asset the game uses, with the engine and parameters for the credits screen.
// William makes these on platform.mothquantum.com and drops the files next to this one, named by key
// (any extension, e.g. station-stability-2.png). A missing file renders its placeholder, so the app never breaks.
//
// What the engines do, in plain language (from the engine descriptions in the pinned Atlas OpenAPI spec):
// - Tessa (tessa-image-v1) encodes an image onto quantum circuits, can change it with gates, then measures it back
//   into pixels.
// - Quantum Blur (blur-v1) encodes pixel brightness in a quantum state and applies one rotation per qubit. The
//   blur spreads as interference echoes rather than soft focus: more rotation = a more degraded station.
// - Entanglement Shader (entanglement-shader-v1) generates an iridescent surface material driven by quantum
//   entanglement, which fits the Entanglement Tool.

export type AtlasAsset = {
  key: string;
  /** Expected file name under src/assets/atlas/ (matched by key, any extension). */
  file: string;
  engine: "Tessa" | "Blur" | "Entanglement Shader" | (string & {});
  /** Engine id on the Atlas API, for readers who want to look it up. */
  engineId?: string;
  /** Parameters used, for credits. Filled in by William when the asset is made. */
  params?: Record<string, unknown>;
  placeholder: "css" | "svg" | "silent";
  use: string;
};

export const ATLAS_ASSETS: AtlasAsset[] = [
  {
    key: "station-base",
    file: "station-base.png",
    engine: "Tessa",
    engineId: "tessa-image-v1",
    placeholder: "svg",
    use: "Main station image",
  },
  ...[0, 1, 2, 3, 4].map(
    (level): AtlasAsset => ({
      key: `station-stability-${level}`,
      file: `station-stability-${level}.png`,
      engine: "Blur",
      engineId: "blur-v1",
      placeholder: "css",
      use: `Station at degradation level ${level} (0 = failing, 4 = stable)`,
    }),
  ),
  {
    key: "crew-icons",
    file: "crew-icons.png",
    engine: "Tessa",
    engineId: "tessa-image-v1",
    placeholder: "svg",
    use: "Crew avatars for Table A and Table B",
  },
  {
    key: "entanglement-reveal",
    file: "entanglement-reveal.png",
    engine: "Entanglement Shader",
    engineId: "entanglement-shader-v1",
    placeholder: "css",
    use: "Entanglement Tool reveal and Act III background",
  },
  ...(["alarm", "win", "reveal"] as const).map(
    (name): AtlasAsset => ({
      key: `sfx-${name}`,
      file: `sfx-${name}.mp3`,
      engine: "Atlas sound engine (to confirm)",
      placeholder: "silent",
      use: { alarm: "Alarm below 80% stability", win: "Round won", reveal: "Tool reveal" }[name],
    }),
  ),
];

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
