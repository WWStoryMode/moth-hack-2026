// Vercel function: GET /api/result. Logic lives in server/telablur.ts (shared with the dev server).
import { handle } from "../server/http.ts";
import { result } from "../server/telablur.ts";

export function GET(request: Request): Promise<Response> {
  return handle(() => result(request));
}
