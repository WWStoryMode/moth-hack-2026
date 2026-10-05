import { useEffect, useState } from "react";

/** Converts a server deadline to this device's clock, so phone and server clocks never need to agree. */
export const toLocalDeadline = (deadline: number | null, serverNow: number): number | null =>
  deadline === null ? null : Date.now() + (deadline - serverNow);

/** Milliseconds left until a local deadline, re-rendering a few times a second. */
export function useRemainingMs(localDeadline: number | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (localDeadline === null) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [localDeadline]);
  return localDeadline === null ? null : Math.max(0, localDeadline - now);
}
