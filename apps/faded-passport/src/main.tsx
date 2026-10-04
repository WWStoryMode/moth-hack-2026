import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { installGlassTexture } from "./lib/glassTexture.ts";
import { installAgeTextures } from "./lib/ageTextures.ts";
import { FLAGS } from "./lib/flags.ts";
import { installInkTexture } from "./lib/inkTexture.ts";
import "./tokens.css";
import "./styles.css";

installInkTexture();
installGlassTexture();
if (FLAGS.age === "all") installAgeTextures(); // only the ageing variant needs them

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
