import { MothApiError, MothJobError } from "@moth-hack/atlas-client";

/** An error with a status and a stable `code` the client maps to in-story dialogue. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Run a handler; turn known errors into JSON responses. Never echoes request headers or the key. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { code: e.code, message: e.message });
    if (e instanceof MothApiError) {
      console.error(e.message);
      const status = e.status === 429 || e.status === 503 ? 503 : e.status === 410 ? 410 : 502;
      return json(status, { code: status === 503 ? "busy" : status === 410 ? "expired" : "upstream", message: e.title ?? "Moth API error" });
    }
    if (e instanceof MothJobError) {
      console.error(e.message);
      return json(502, { code: "job_failed", message: e.failure?.type ?? e.status });
    }
    console.error(e);
    return json(500, { code: "internal", message: "Unexpected error" });
  }
}
