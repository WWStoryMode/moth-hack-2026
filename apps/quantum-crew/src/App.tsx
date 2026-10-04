// Routes: / landing · /solo the solo demo · /credits · /screen and /play (event mode, from M3).
import { usePath } from "./lib/router.ts";
import { Credits } from "./screens/Credits.tsx";
import { EventSoon } from "./screens/EventSoon.tsx";
import { Landing } from "./screens/Landing.tsx";
import { Solo } from "./solo/Solo.tsx";

export function App() {
  switch (usePath()) {
    case "/solo":
      return <Solo />;
    case "/credits":
      return <Credits />;
    case "/screen":
    case "/play":
      return <EventSoon />;
    default:
      return <Landing />;
  }
}
