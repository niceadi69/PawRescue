import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./member4.css";
import AdoptionPortal from "./AdoptionPortal.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AdoptionPortal />
  </StrictMode>
);
