// Friendly aliases over the types generated from the Moth OpenAPI spec
// (src/generated/schema.ts — regenerate with `pnpm gen:types`, never edit by hand).
import type { components, paths } from "./generated/schema.ts";

type Schemas = components["schemas"];

export type SubmitJobResponse = Schemas["SubmitJobOutputBody"];
export type JobStatusResponse = Schemas["JobStatusOutputBody"];
export type JobResultResponse = Schemas["JobResultOutputBody"];
export type OutputItem = Schemas["OutputItem"];
export type Asset = Schemas["Asset"];
export type CreateAssetRequest = Schemas["CreateAssetInputBody"];
export type CreateAssetResponse = Schemas["CreateAssetOutputBody"];
export type ProblemDetails = Schemas["ErrorModel"];
export type ProblemErrorDetail = Schemas["ErrorDetail"];
export type Me = Schemas["MeOutputBody"];

/** Terminal job states from the docs; they never change once reached. */
export type TerminalJobStatus = "completed" | "failed" | "cancelled";

/** `error` on a failed job (docs: Job status & results). The spec leaves it untyped. */
export interface JobFailure {
  type: string;
  message: string;
  retryable: boolean;
}

// The spec has one typed submit path per engine, e.g. /api/v1/engines/coin-toss-v1/process.
// We pull the engine IDs out of those paths so `submitJob("coin-toss-v1", …)` checks params.
type EngineProcessPath = Extract<keyof paths, `/api/v1/engines/${string}/process`>;
type EngineIdOf<P> = P extends `/api/v1/engines/${infer Id}/process` ? Id : never;

/** Engines documented in the pinned spec. */
export type KnownEngineId = Exclude<EngineIdOf<EngineProcessPath>, "{engineID}">;
/** Any engine ID; known IDs get autocomplete and typed params. */
export type EngineId = KnownEngineId | (string & {});

type JsonBody<Op> = Op extends { requestBody?: { content: { "application/json": infer B } } }
  ? B
  : never;

/** Full request body for an engine's /process call. */
export type SubmitBody<E extends string> = E extends KnownEngineId
  ? JsonBody<paths[`/api/v1/engines/${E}/process`]["post"]>
  : Schemas["SubmitJobInputBody"];

/** The `params` object for an engine. */
export type EngineParams<E extends string> =
  SubmitBody<E> extends { params?: infer P } ? NonNullable<P> : Record<string, unknown>;

/** Everything in the body except `params` (input_files, mode, start_from, stop_after). */
export type SubmitOptions<E extends string> = Omit<SubmitBody<E>, "params">;

/**
 * Inline result of coin-toss-v1, from the engine's docs page
 * (https://docs.mothquantum.com/docs/engines/coin-toss-v1). The spec types `result` as unknown.
 */
export interface CoinTossResult {
  output: "heads" | "tails";
  heads: number;
  tails: number;
  shots: number;
  // Not on the docs page; seen in a live response (job be2523ba…, 2026-09-26). Optional in case they change.
  /** Simulator/hardware that ran it, e.g. "aer" (Qiskit's simulator) in emu mode. */
  backend?: string;
  ibm_job_id?: string;
  mode?: "emu" | "qpu";
}
