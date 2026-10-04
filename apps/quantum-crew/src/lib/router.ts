// A five-route app doesn't need a router library: pathname + history API.
// DECISION: no react-router; unknown paths fall back to the landing page.
import { useSyncExternalStore } from "react";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") window.addEventListener("popstate", notify);

export function navigate(to: string) {
  if (to === location.pathname + location.search) return;
  history.pushState(null, "", to);
  window.scrollTo(0, 0);
  notify();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname);
}
