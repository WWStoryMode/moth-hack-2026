import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { installGlassTexture } from "./lib/glassTexture.ts";
import { installInkTexture } from "./lib/inkTexture.ts";
import "./tokens.css";
import "./styles.css";

installInkTexture();
installGlassTexture();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
