import { CreditsList } from "../components/CreditsList.tsx";
import { navigate } from "../lib/router.ts";
import { S } from "../strings.ts";

export function Credits() {
  return (
    <main className="screen">
      <h1>{S.credits.title}</h1>
      <CreditsList />
      <button className="btn" onClick={() => (history.length > 1 ? history.back() : navigate("/"))}>
        {S.credits.back}
      </button>
    </main>
  );
}
