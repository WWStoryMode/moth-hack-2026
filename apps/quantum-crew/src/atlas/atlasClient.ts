// Stub only. Atlas is used through pre-generated assets (see src/assets/atlas/manifest.ts), made on
// platform.mothquantum.com. Live calls are off: the browser must never hold the API key, so a live
// version would go through a server-side proxy using @moth-hack/atlas-client.
export const ATLAS_LIVE = import.meta.env.VITE_ATLAS_LIVE === "true";

export async function generateLive(): Promise<never> {
  throw new Error("Live Atlas calls are not enabled in Quantum Crew; assets are pre-generated.");
}
