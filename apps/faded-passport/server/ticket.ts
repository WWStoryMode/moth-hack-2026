// A ticket is an HMAC-signed note of what the proxy created for one play: the job and its
// assets. status/result only accept tickets, so the public proxy can't be pointed at other
// jobs on this account, and can only delete assets it uploaded itself.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http.ts";

export interface TicketData {
  jobId: string;
  /** Input asset IDs to delete once the result has been fetched. */
  assets: string[];
  years: number;
  iat: number;
}

const MAX_AGE_MS = 6 * 60 * 60 * 1000;
let devSecret: string | undefined;

function secret(): string {
  const s = process.env.TICKET_SECRET;
  if (s) return s;
  if (process.env.VERCEL) throw new Error("TICKET_SECRET is not set in the Vercel environment");
  // Local dev: a per-process secret is fine (tickets just don't survive a restart).
  return (devSecret ??= randomBytes(32).toString("hex"));
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest();

export function issueTicket(data: Omit<TicketData, "iat">): string {
  const payload = b64(JSON.stringify({ ...data, iat: Date.now() }));
  return `${payload}.${b64(sign(payload))}`;
}

export function readTicket(ticket: string | null): TicketData {
  const [payload, sig] = (ticket ?? "").split(".");
  if (!payload || !sig) throw new HttpError(400, "bad_ticket", "Missing ticket");
  const expected = sign(payload);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new HttpError(403, "bad_ticket", "Ticket signature invalid");
  }
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TicketData;
  if (Date.now() - data.iat > MAX_AGE_MS) throw new HttpError(410, "expired", "Ticket expired");
  return data;
}
