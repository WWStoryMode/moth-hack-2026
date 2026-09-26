// The whole Moth side of a play: upload three images, run TeleBlur, hand back the morph,
// then delete everything from Moth's storage. The API key never leaves this module.
//
// Quantum idea (telablur-v1): both images are loaded into ONE quantum state, plus a single
// extra "selector" qubit whose 0/1 says "portrait" or "home". Rotating that selector qubit by
// `strength` mixes the two pictures at the level of amplitudes (the numbers a quantum state is
// made of), not by fading pixels — so the portrait doesn't just cross-fade, it bleeds into home.
import { createClient, loadEnv, type MothClient } from "@moth-hack/atlas-client";
import { ENGINE, telablurParams, type TelablurParams } from "../src/config.ts";
import { assertOpen, checkImage, checkYears } from "./guards.ts";
import { HttpError, json } from "./http.ts";
import { issueTicket, readTicket } from "./ticket.ts";

let client: MothClient | undefined;
function moth(): MothClient {
  if (!process.env.MOTH_API_KEY) loadEnv(); // local dev: repo-root .env; on Vercel the env var is set
  return (client ??= createClient());
}

export interface SubmitResponse {
  ticket: string;
  jobId: string;
  params: TelablurParams;
}

export type PlayStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

/** POST multipart: image1 (portrait), image2 (home), mask (PNG), years. */
export async function submit(request: Request): Promise<Response> {
  assertOpen();
  const form = await request.formData().catch(() => {
    throw new HttpError(400, "invalid", "Expected multipart form data");
  });
  const years = checkYears(form.get("years"));
  const [image1, image2, mask] = await Promise.all([
    checkImage(form.get("image1"), "image1"),
    checkImage(form.get("image2"), "image2"),
    checkImage(form.get("mask"), "mask", { pngOnly: true }),
  ]);

  const m = moth();
  const ext = (t: string) => (t === "image/png" ? "png" : "jpg");
  const uploads = await Promise.allSettled([
    m.uploadAssetBytes(image1.bytes, { filename: `portrait.${ext(image1.contentType)}`, contentType: image1.contentType }),
    m.uploadAssetBytes(image2.bytes, { filename: `home.${ext(image2.contentType)}`, contentType: image2.contentType }),
    m.uploadAssetBytes(mask.bytes, { filename: "mask.png", contentType: "image/png" }),
  ]);
  const assets = uploads.flatMap((u) => (u.status === "fulfilled" ? [u.value.asset_id] : []));
  const failed = uploads.find((u) => u.status === "rejected");
  if (failed) {
    await cleanup(assets);
    throw failed.reason;
  }
  const [a1, a2, am] = assets as [string, string, string];

  const params = telablurParams(years); // strength comes from years on the server, never from the client
  try {
    const job = await m.submitJob(ENGINE, params, { input_files: { image1: a1, image2: a2, mask: am } });
    const body: SubmitResponse = { ticket: issueTicket({ jobId: job.job_id, assets, years }), jobId: job.job_id, params };
    return json(202, body);
  } catch (e) {
    await cleanup(assets);
    throw e;
  }
}

/** GET ?ticket= → { status }. Unknown in-between states (e.g. "fetching") count as processing. */
export async function status(request: Request): Promise<Response> {
  const t = readTicket(new URL(request.url).searchParams.get("ticket"));
  const st = await moth().getStatus(t.jobId);
  const known: PlayStatus[] = ["queued", "processing", "completed", "failed", "cancelled"];
  const s = (known as string[]).includes(st.status) ? (st.status as PlayStatus) : "processing";
  if (s === "failed" || s === "cancelled") await cleanup(t.assets);
  const failure = s === "failed" ? (st.error as { type?: string } | undefined)?.type : undefined;
  return json(200, { status: s, ...(failure ? { failure } : {}) });
}

/** GET ?ticket= → the morphed image bytes (same origin, so the canvas can read its pixels). */
export async function result(request: Request): Promise<Response> {
  const t = readTicket(new URL(request.url).searchParams.get("ticket"));
  const m = moth();
  const res = await m.getResult(t.jobId);
  const out = res.outputs?.find((o) => o.slot === "result") ?? res.outputs?.[0];
  if (!out?.url) throw new HttpError(502, "no_output", "The job finished without an image");
  // Presigned URL: no Authorization header; it expires, so fetch it now.
  const img = await fetch(out.url);
  if (!img.ok) throw new HttpError(502, "upstream", `Output download failed (${img.status})`);
  const bytes = await img.arrayBuffer();
  await cleanup([...t.assets, out.output_asset_id]);
  return new Response(bytes, {
    status: 200,
    headers: { "Content-Type": out.content_type ?? "image/png", "Cache-Control": "no-store" },
  });
}

/** Best-effort delete: "not kept by this app" should be true on Moth's side too. */
async function cleanup(assetIds: string[]): Promise<void> {
  const results = await Promise.allSettled(assetIds.map((id) => moth().deleteAsset(id)));
  for (const r of results) if (r.status === "rejected") console.error("asset cleanup failed:", String(r.reason));
}
