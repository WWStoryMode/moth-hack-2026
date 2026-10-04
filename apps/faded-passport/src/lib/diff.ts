import { verdict, type Verdict } from "./change.ts";
import { pixels } from "./image.ts";

export type { ReasonKey, Verdict } from "./change.ts";

/** The verdict (see change.ts) from image URLs in the browser. Display/judging only: nothing is sent. */
export async function verdictFor(portraitUrl: string, morphUrl: string, homeUrl: string, outlineUrl: string): Promise<Verdict> {
  const [p, m, h, o] = await Promise.all([pixels(portraitUrl), pixels(morphUrl), pixels(homeUrl), pixels(outlineUrl)]);
  return verdict(p, m, h, o);
}
