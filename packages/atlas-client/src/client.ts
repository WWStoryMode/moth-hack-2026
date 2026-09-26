import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { MothApiError, MothJobError, MothTimeoutError, toApiError } from "./errors.ts";
import { buildProvenance, writeProvenance, type Provenance } from "./provenance.ts";
import type {
  Asset,
  CreateAssetRequest,
  CreateAssetResponse,
  EngineId,
  EngineParams,
  JobFailure,
  JobResultResponse,
  JobStatusResponse,
  Me,
  OutputItem,
  SubmitJobResponse,
  SubmitOptions,
  TerminalJobStatus,
} from "./types.ts";

export const DEFAULT_BASE_URL = "https://api.mothquantum.com/api/v1";

export interface ClientOptions {
  /** Defaults to process.env.MOTH_API_KEY. Pass explicitly only in tests. */
  apiKey?: string;
  baseUrl?: string;
  /** Max automatic retries for retry-safe requests (see `request`). */
  maxRetries?: number;
}

export interface WaitOptions {
  /** Docs recommend polling every 2–5 s. */
  intervalMs?: number;
  /** Simulator jobs take seconds; QPU jobs can queue for minutes — raise this for mode "qpu". */
  timeoutMs?: number;
  /** Called whenever the status changes. */
  onStatus?: (status: JobStatusResponse) => void;
}

export interface RunRecord<R = unknown> {
  provenance: Provenance;
  status: JobStatusResponse;
  result: R | undefined;
  outputs: OutputItem[];
}

const TERMINAL: ReadonlySet<string> = new Set<TerminalJobStatus>(["completed", "failed", "cancelled"]);

// Only these types are listed in the assets docs. Anything else must be passed explicitly.
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MothClient {
  // A private field: not enumerable, not shown by console.log/util.inspect, never serialized.
  readonly #apiKey: string;
  readonly baseUrl: string;
  readonly maxRetries: number;

  constructor(options: ClientOptions = {}) {
    const key = options.apiKey ?? process.env.MOTH_API_KEY;
    if (!key || key === "your-key-here") {
      throw new Error(
        "MOTH_API_KEY is not set. Copy .env.example to .env at the repo root and paste your key " +
          "from https://platform.mothquantum.com.",
      );
    }
    this.#apiKey = key;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.maxRetries = options.maxRetries ?? 4;
  }

  /**
   * One authenticated JSON call. With `retry: true`, 429/502/503 are retried with exponential
   * backoff (the API sends no reset header) and 500 is retried once, per the errors docs.
   */
  async request<T>(method: string, path: string, opts: { body?: unknown; retry?: boolean } = {}): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(this.baseUrl + path, {
        method,
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          Accept: "application/json, application/problem+json",
          ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
      });
      if (res.ok) {
        const text = await res.text();
        return (text ? JSON.parse(text) : undefined) as T;
      }
      const err = await toApiError(res, method, path);
      const canRetry =
        opts.retry && attempt < this.maxRetries && err.retryable && (err.status !== 500 || attempt === 0);
      if (!canRetry) throw err;
      await sleep(Math.min(1000 * 2 ** attempt, 16_000) + Math.random() * 250);
    }
  }

  /** GET /me — cheap way to check the key works (no credits used). */
  getMe(): Promise<Me> {
    return this.request<Me>("GET", "/me", { retry: true });
  }

  /**
   * POST /engines/{engineId}/process. Returns 202 immediately; nothing has run yet.
   * Retried only on 429/503: the docs say those mean the job was not recorded, so
   * resubmitting can't double-charge credits. Other failures are thrown as-is.
   */
  async submitJob<E extends EngineId>(
    engineId: E,
    params?: EngineParams<E>,
    options?: SubmitOptions<E>,
  ): Promise<SubmitJobResponse> {
    const body = { ...(options ?? {}), ...(params !== undefined ? { params } : {}) };
    const path = `/engines/${encodeURIComponent(engineId)}/process`;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.request<SubmitJobResponse>("POST", path, { body });
      } catch (e) {
        const safe = e instanceof MothApiError && (e.status === 429 || e.status === 503);
        if (!safe || attempt >= this.maxRetries) throw e;
        await sleep(Math.min(1000 * 2 ** attempt, 16_000) + Math.random() * 250);
      }
    }
  }

  /** GET /jobs/{jobId}/status — the live state. */
  getStatus(jobId: string): Promise<JobStatusResponse> {
    return this.request<JobStatusResponse>("GET", `/jobs/${encodeURIComponent(jobId)}/status`, { retry: true });
  }

  /**
   * Poll until the job is terminal. Resolves on `completed`; throws MothJobError on
   * `failed`/`cancelled` and MothTimeoutError on timeout. Unknown in-between states
   * (e.g. `fetching`) are treated as processing, as the docs advise.
   */
  async waitForJob(jobId: string, opts: WaitOptions = {}): Promise<JobStatusResponse> {
    const intervalMs = Math.max(opts.intervalMs ?? 2000, 1000);
    const timeoutMs = opts.timeoutMs ?? 120_000;
    const deadline = Date.now() + timeoutMs;
    let last: string | undefined;
    for (;;) {
      const st = await this.getStatus(jobId);
      if (st.status !== last) {
        last = st.status;
        opts.onStatus?.(st);
      }
      if (TERMINAL.has(st.status)) {
        if (st.status === "completed") return st;
        throw new MothJobError(jobId, st.engine_id, st.status as "failed" | "cancelled", st.error as JobFailure | undefined);
      }
      if (Date.now() + intervalMs > deadline) throw new MothTimeoutError(jobId, st.status, timeoutMs);
      await sleep(intervalMs);
    }
  }

  /**
   * GET /jobs/{jobId}/result. Inline `result` for JSON engines, `outputs[]` with presigned
   * URLs for file engines. 409 = not finished; 410 = inline result expired (save it right away).
   */
  async getResult<R = unknown>(jobId: string): Promise<Omit<JobResultResponse, "result"> & { result?: R }> {
    return this.request("GET", `/jobs/${encodeURIComponent(jobId)}/result`, { retry: true });
  }

  /** Submit → wait → fetch result, recording exactly what was sent for provenance. */
  async run<E extends EngineId, R = unknown>(
    engineId: E,
    params?: EngineParams<E>,
    opts: { submit?: SubmitOptions<E>; wait?: WaitOptions } = {},
  ): Promise<RunRecord<R>> {
    const submitted = await this.submitJob(engineId, params, opts.submit);
    const status = await this.waitForJob(submitted.job_id, opts.wait);
    const res = await this.getResult<R>(submitted.job_id);
    const provenance = buildProvenance({
      engineId,
      jobId: submitted.job_id,
      params: params as Record<string, unknown> | undefined,
      options: opts.submit as Record<string, unknown> | undefined,
      submittedAt: submitted.submitted_at,
      completedAt: status.updated_at,
    });
    return { provenance, status, result: res.result, outputs: res.outputs ?? [] };
  }

  /**
   * Download every file output of a completed job into `dir`. With `provenance`, also writes
   * `<file>.provenance.json` next to each file. Returns the saved file paths.
   */
  async downloadOutputs(jobId: string, dir: string, provenance?: Provenance): Promise<string[]> {
    const { outputs } = await this.getResult(jobId);
    await mkdir(dir, { recursive: true });
    const saved: string[] = [];
    for (const out of outputs ?? []) {
      if (!out.url) continue;
      // Presigned URL: the signature is the credential, so no Authorization header here.
      const res = await fetch(out.url);
      if (!res.ok) throw await toApiError(res, "GET", `presigned download (${out.slot ?? out.output_asset_id})`);
      const file = join(dir, out.filename ?? `${out.slot ?? "output"}-${out.output_asset_id}`);
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      if (provenance) {
        await writeProvenance(file, { ...provenance, output: { slot: out.slot, assetId: out.output_asset_id } });
      }
      saved.push(file);
    }
    return saved;
  }

  /**
   * Upload a local file as an asset (three steps, per the assets docs):
   *  1. POST /assets with filename, content_type, size_bytes → presigned upload
   *  2. send the bytes to upload.url with exactly upload.method + upload.headers
   *  3. POST /assets/{id}/complete
   * Returns the completed asset; pass `asset.asset_id` in a job's `input_files`.
   */
  async uploadAsset(filePath: string, opts: { contentType?: string; filename?: string } = {}): Promise<Asset> {
    const contentType = opts.contentType ?? CONTENT_TYPES[extname(filePath).toLowerCase()];
    if (!contentType) {
      throw new Error(`Can't infer a content type for ${basename(filePath)}; pass { contentType }.`);
    }
    const { size } = await stat(filePath);
    const createBody: CreateAssetRequest = {
      filename: opts.filename ?? basename(filePath),
      content_type: contentType,
      size_bytes: size,
    };
    const created = await this.request<CreateAssetResponse>("POST", "/assets", { body: createBody });

    // Bytes go straight to storage, not the API: no Authorization header. fetch computes
    // Content-Length from the buffer (which equals the declared size) and won't let us set it.
    const headers = Object.fromEntries(
      Object.entries(created.upload.headers).filter(([k]) => k.toLowerCase() !== "content-length"),
    );
    const put = await fetch(created.upload.url, {
      method: created.upload.method,
      headers,
      body: await readFile(filePath),
    });
    if (!put.ok) throw await toApiError(put, created.upload.method, `presigned upload (${created.asset_id})`);

    return this.request<Asset>("POST", `/assets/${encodeURIComponent(created.asset_id)}/complete`);
  }
}

export function createClient(options?: ClientOptions): MothClient {
  return new MothClient(options);
}
