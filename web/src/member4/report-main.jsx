// Member 4 (Rhythm): public animal cruelty report form
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./member4.css";
import "./donate.css";
import "./report.css";
import ReportCruelty from "./ReportCruelty.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ReportCruelty />
  </StrictMode>
);
