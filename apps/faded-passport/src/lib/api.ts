// Browser side of the proxy. The API key never comes near this file: everything goes through /api.
import { POLL, type TelablurParams } from "../config.ts";

export interface Job {
  ticket: string;
  jobId: string;
  params: TelablurParams;
}

/** Error codes the server returns (plus client-side "timeout"); mapped to dialogue in strings.ts. */
export class BorderError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

async function fail(res: Response): Promise<never> {
  const body = (await res.json().catch(() => ({}))) as { code?: string };
  throw new BorderError(body.code ?? "generic");
}

export async function submit(input: { portrait: Blob; home: Blob; mask: Blob; years: number }): Promise<Job> {
  const form = new FormData();
  form.set("years", String(input.years));
  form.set("image1", input.portrait, "portrait.png");
  form.set("image2", input.home, "home.jpg");
  form.set("mask", input.mask, "mask.png");
  const res = await fetch("/api/submit", { method: "POST", body: form });
  if (!res.ok) return fail(res);
  return (await res.json()) as Job;
}

/** Poll until done; `onTick` gets elapsed ms and the job's latest status (for the dialogue and the scan). */
export async function waitForMorph(job: Job, onTick?: (elapsedMs: number, status: string) => void): Promise<Blob> {
  const t0 = Date.now();
  const q = `ticket=${encodeURIComponent(job.ticket)}`;
  for (;;) {
    const res = await fetch(`/api/status?${q}`);
    if (!res.ok) return fail(res);
    const { status } = (await res.json()) as { status: string };
    onTick?.(Date.now() - t0, status);
    if (status === "completed") break;
    if (status === "failed" || status === "cancelled") throw new BorderError("job_failed");
    if (Date.now() - t0 > POLL.timeoutMs) throw new BorderError("timeout");
    await new Promise((r) => setTimeout(r, POLL.intervalMs));
  }
  const res = await fetch(`/api/result?${q}`);
  if (!res.ok) return fail(res);
  return res.blob();
}
