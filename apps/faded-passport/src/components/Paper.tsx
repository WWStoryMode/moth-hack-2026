import type { ReactNode } from "react";
import { S } from "../strings.ts";

/** The form every screen is printed on. */
export function Paper({ children, step }: { children: ReactNode; step?: string }) {
  return (
    <main className="paper">
      <header className="paper-head">
        <span>{S.bureau}</span>
        {step && <span className="paper-step">{step}</span>}
      </header>
      {children}
    </main>
  );
}
