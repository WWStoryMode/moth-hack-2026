// Routes: / landing · /solo the solo demo · /credits · /screen the TV (event host) · /play a phone.
import { usePath } from "./lib/router.ts";
import { Credits } from "./screens/Credits.tsx";
import { Landing } from "./screens/Landing.tsx";
import { Play } from "./screens/Play.tsx";
import { Screen } from "./screens/Screen.tsx";
import { Solo } from "./solo/Solo.tsx";

export function App() {
  switch (usePath()) {
    case "/solo":
      return <Solo />;
    case "/credits":
      return <Credits />;
    case "/screen":
      return <Screen />;
    case "/play":
      return <Play />;
    default:
      return <Landing />;
  }
}
