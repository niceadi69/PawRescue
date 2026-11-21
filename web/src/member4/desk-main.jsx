// Member 4 (Rhythm): vet desk, adoption desk and adoption portal
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./member4.css";
import StaffGate from "./StaffGate.jsx";
import AdoptionDesk from "./AdoptionDesk.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <StaffGate title="Adoption desk" allowedRoles={["ngo", "admin"]}>
      {({ session, profile }) => (
        <AdoptionDesk session={session} profile={profile} />
      )}
    </StaffGate>
  </StrictMode>
);
