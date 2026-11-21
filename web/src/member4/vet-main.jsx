// Member 4 (Rhythm): vet desk, adoption desk and adoption portal
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./member4.css";
import StaffGate from "./StaffGate.jsx";
import VetDashboard from "./VetDashboard.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <StaffGate title="Vet desk" allowedRoles={["veterinarian", "admin"]}>
      {({ session, profile }) => (
        <VetDashboard session={session} profile={profile} />
      )}
    </StaffGate>
  </StrictMode>
);
