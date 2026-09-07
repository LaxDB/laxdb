import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { BlenderLab } from "./app";

const root = document.getElementById("root");
if (!root) throw new Error("Missing viewer root element");

createRoot(root).render(
  <StrictMode>
    <BlenderLab />
  </StrictMode>,
);
