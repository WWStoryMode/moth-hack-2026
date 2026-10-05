// Every Atlas asset the game uses, with the engine and parameters for the credits screen. Plain data, so both the
// app (via manifest.ts) and `pnpm assets` can read it.
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
  // DECISION: "synth" = a short Web Audio sound stands in until the Atlas sound file exists, so the game is never mute.
  placeholder: "css" | "svg" | "silent" | "synth";
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
    use: "Crew avatars: one image, Table A on the left half and Table B on the right half",
  },
  {
    key: "entanglement-reveal",
    // The engine returns a shader + lookup tables, not an image: `pnpm bake-shader` turns its output
    // (atlas-src/entanglement-shader/<job>/) into this file, rendered live by a WebGL port of its GLSL.
    file: "entanglement-lut.json",
    engine: "Entanglement Shader",
    engineId: "entanglement-shader-v1",
    // Run on the platform by William (job a08def9e). The LUTs it returned are 60×60, i.e. resolution 60.
    params: {
      style: "frustrated",
      layers: 3,
      incoming_rays: 8,
      reflectance: 0.3,
      absorption: 0.6,
      interaction: 1,
      resolution: 60,
    },
    placeholder: "css",
    use: "The Entanglement Tool's crystals, the reveal and the Act III background, rendered live from the engine's shader",
  },
  ...(["alarm", "win", "reveal"] as const).map(
    (name): AtlasAsset => ({
      key: `sfx-${name}`,
      file: `sfx-${name}.mp3`,
      engine: "Atlas sound engine (to confirm)",
      placeholder: "synth",
      use: { alarm: "Alarm below 80% stability", win: "Round won", reveal: "Tool reveal" }[name],
    }),
  ),
];
