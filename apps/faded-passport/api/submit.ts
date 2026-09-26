// Vercel function: POST /api/submit. Logic lives in server/telablur.ts (shared with the dev server).
import { handle } from "../server/http.ts";
import { submit } from "../server/telablur.ts";

export function POST(request: Request): Promise<Response> {
  return handle(() => submit(request));
}
