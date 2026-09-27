import { maskedChangeFromPixels } from "./change.ts";
import { pixels } from "./image.ts";

export { reasonFor, type ReasonKey } from "./change.ts";

/** How much the quantum morph changed the face (see change.ts), from image URLs in the browser. */
export async function maskedChange(portraitUrl: string, morphUrl: string, outlineUrl: string): Promise<number> {
  const [a, b, m] = await Promise.all([pixels(portraitUrl), pixels(morphUrl), pixels(outlineUrl)]);
  return maskedChangeFromPixels(a, b, m);
}
