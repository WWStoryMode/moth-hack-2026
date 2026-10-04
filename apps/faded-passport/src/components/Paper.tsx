import type { ReactNode } from "react";
import { S } from "../strings.ts";

/** The form every screen is printed on. `bureau={false}` drops the header (e.g. when the permit already shows it). */
export function Paper({ children, step, bureau = true }: { children: ReactNode; step?: string; bureau?: boolean }) {
  return (
    <main className="paper">
      {(bureau || step) && (
        <header className="paper-head">
          {bureau && <span>{S.bureau}</span>}
          {step && <span className="paper-step">{step}</span>}
        </header>
      )}
      {children}
    </main>
  );
}
