// Member 4 (Rhythm): donation page (demo)
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./member4.css";
import "./donate.css";
import DonatePage from "./DonatePage.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <DonatePage />
  </StrictMode>
);
