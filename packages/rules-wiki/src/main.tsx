// oxlint-disable-next-line import/no-unassigned-import -- Vite injects the global stylesheet.
import "./styles.css";

import { Agentation } from "agentation";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const root = document.querySelector("#root");

if (!root) throw new Error("Root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
    {import.meta.env.DEV ? (
      <Agentation endpoint="http://localhost:4747" />
    ) : null}
  </StrictMode>,
);
