// Vercel function: GET /api/status. Logic lives in server/telablur.ts (shared with the dev server).
import { handle } from "../server/http.ts";
import { status } from "../server/telablur.ts";

export function GET(request: Request): Promise<Response> {
  return handle(() => status(request));
}
