// Member 4 (Rhythm): vet desk, adoption desk and adoption portal
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./member4.css";
import AdoptionPortal from "./AdoptionPortal.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AdoptionPortal />
  </StrictMode>
);
