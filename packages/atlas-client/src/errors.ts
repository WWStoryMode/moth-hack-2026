import type { JobFailure, ProblemDetails, ProblemErrorDetail } from "./types.ts";

/**
 * An HTTP error from the Moth API, parsed from its RFC 7807 `application/problem+json` body.
 * Never carries request headers, so the API key can't leak through logs.
 */
export class MothApiError extends Error {
  override readonly name = "MothApiError";
  readonly status: number;
  readonly title: string | undefined;
  readonly detail: string | undefined;
  readonly type: string | undefined;
  readonly instance: string | undefined;
  /** Per-field validation problems (mostly on 422). */
  readonly errors: ProblemErrorDetail[];
  readonly method: string;
  readonly path: string;
  /** Raw body when the response wasn't problem+json (e.g. a storage-provider error). */
  readonly rawBody: string | undefined;

  constructor(init: {
    status: number;
    method: string;
    path: string;
    problem?: ProblemDetails | undefined;
    rawBody?: string | undefined;
  }) {
    const { status, method, path, problem, rawBody } = init;
    const errors = problem?.errors ?? [];
    const summary = [problem?.title, problem?.detail].filter(Boolean).join(": ") || rawBody?.slice(0, 200) || "";
    const fieldLines = errors.map((e) => `\n  - ${e.location ?? "?"}: ${e.message ?? ""}`).join("");
    super(`${method} ${path} → ${status}${summary ? ` ${summary}` : ""}${fieldLines}`);
    this.status = status;
    this.title = problem?.title;
    this.detail = problem?.detail;
    this.type = problem?.type;
    this.instance = problem?.instance;
    this.errors = errors;
    this.method = method;
    this.path = path;
    this.rawBody = problem ? undefined : rawBody;
  }

  /** Statuses the errors docs say are safe to retry after backing off. */
  get retryable(): boolean {
    return this.status === 429 || this.status === 502 || this.status === 503 || this.status === 500;
  }
}

/** A job reached `failed` or `cancelled`. */
export class MothJobError extends Error {
  override readonly name = "MothJobError";
  constructor(
    readonly jobId: string,
    readonly engineId: string,
    readonly status: "failed" | "cancelled",
    readonly failure: JobFailure | undefined,
  ) {
    super(
      `Job ${jobId} (${engineId}) ${status}` +
        (failure ? `: ${failure.type} — ${failure.message}${failure.retryable ? " (retryable)" : ""}` : ""),
    );
  }
}

/** waitForJob gave up. The job may still finish; poll again later with the same jobId. */
export class MothTimeoutError extends Error {
  override readonly name = "MothTimeoutError";
  constructor(
    readonly jobId: string,
    readonly lastStatus: string,
    readonly timeoutMs: number,
  ) {
    super(`Job ${jobId} still "${lastStatus}" after ${Math.round(timeoutMs / 1000)}s`);
  }
}

/** Parse a failed fetch Response into a MothApiError. */
export async function toApiError(res: Response, method: string, path: string): Promise<MothApiError> {
  const text = await res.text().catch(() => "");
  let problem: ProblemDetails | undefined;
  if (text && /json/i.test(res.headers.get("content-type") ?? "")) {
    try {
      problem = JSON.parse(text) as ProblemDetails;
    } catch {
      // Not valid JSON; fall through with rawBody.
    }
  }
  return new MothApiError({ status: res.status, method, path, problem, rawBody: text || undefined });
}
