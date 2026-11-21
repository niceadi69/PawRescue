import { useState } from "react";
import "./App.css";

const reports = [
  {
    id: "PR001",
    name: "Golden Retriever",
    type: "Dog",
    location: "Model Town",
    urgency: "Critical",
    status: "New",
    date: "Today, 10:30 AM",
    image: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=600",
  },
  {
    id: "PR002",
    name: "Brown Puppy",
    type: "Dog",
    location: "Civil Lines",
    urgency: "High",
    status: "Assigned",
    date: "Today, 11:15 AM",
    image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600",
  },
  {
    id: "PR003",
    name: "Street Dog",
    type: "Dog",
    location: "Urban Estate",
    urgency: "Medium",
    status: "In Progress",
    date: "Today, 12:00 PM",
    image: "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=600",
  },
  {
    id: "PR004",
    name: "Rescue Puppy",
    type: "Dog",
    location: "Green Park",
    urgency: "Low",
    status: "New",
    date: "Yesterday",
    image: "https://images.unsplash.com/photo-1537151608828-ea2b11777ee8?w=600",
  },
];

const initialVolunteers = [
  {
    id: 1,
    name: "Rahul Sharma",
    phone: "+91 98765 43210",
    area: "Model Town",
    cases: 3,
    available: true,
    initials: "RS",
  },
  {
    id: 2,
    name: "Priya Singh",
    phone: "+91 98765 12345",
    area: "Civil Lines",
    cases: 2,
    available: true,
    initials: "PS",
  },
  {
    id: 3,
    name: "Aman Verma",
    phone: "+91 98765 67890",
    area: "Urban Estate",
    cases: 4,
    available: false,
    initials: "AV",
  },
  {
    id: 4,
    name: "Neha Kapoor",
    phone: "+91 98765 11111",
    area: "Green Park",
    cases: 1,
    available: true,
    initials: "NK",
  },
];

const menu = [
  { name: "Overview", icon: "📊" },
  { name: "Rescue Reports", icon: "🐾" },
  { name: "Rescued Animals", icon: "🐶" },
  { name: "Volunteers", icon: "🤝" },
  { name: "Settings", icon: "⚙️" },
];

function App() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [assigned, setAssigned] = useState({});
  const [animalCare, setAnimalCare] = useState({});
  const [volunteers, setVolunteers] = useState(initialVolunteers);
  const [showVolunteerForm, setShowVolunteerForm] = useState(false);
  const [newVolunteer, setNewVolunteer] = useState({
    name: "",
    phone: "",
    area: "",
  });

  const filteredReports = reports.filter((report) => {
    const matchesFilter = filter === "All" || report.urgency === filter;
    const searchTerm = search.toLowerCase();

    const matchesSearch =
      report.name.toLowerCase().includes(searchTerm) ||
      report.location.toLowerCase().includes(searchTerm) ||
      report.id.toLowerCase().includes(searchTerm);

    return matchesFilter && matchesSearch;
  });

  const availableCount = volunteers.filter(
    (volunteer) => volunteer.available
  ).length;

  const handleAddVolunteer = (event) => {
    event.preventDefault();

    const name = newVolunteer.name.trim();
    const phone = newVolunteer.phone.trim();
    const area = newVolunteer.area.trim();

    if (!name || !phone || !area) {
      return;
    }

    const initials = name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("");

    const volunteer = {
      id: Date.now(),
      name,
      phone,
      area,
      cases: 0,
      available: true,
      initials,
    };

    setVolunteers((current) => [...current, volunteer]);
    setNewVolunteer({ name: "", phone: "", area: "" });
    setShowVolunteerForm(false);
  };

  const toggleVolunteerAvailability = (volunteerId) => {
    setVolunteers((current) =>
      current.map((volunteer) =>
        volunteer.id === volunteerId
          ? { ...volunteer, available: !volunteer.available }
          : volunteer
      )
    );
  };

  const renderReports = () => (
    <>
      <div className="section-heading">
        <h2>
          {activeTab === "Overview" ? "Recent Rescue Reports" : "Rescue Reports"}
        </h2>
        <input
          className="search"
          placeholder="🔍 Search reports..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="filters">
        {["All", "Critical", "High", "Medium", "Low"].map((item) => (
          <button
            key={item}
            className={`filter-btn ${filter === item ? "active" : ""}`}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="report-list">
        {filteredReports.map((report) => (
          <article className="report-card" key={report.id}>
            <img className="dog-photo" src={report.image} alt={report.name} />

            <div className="report-info">
              <h3>{report.name}</h3>
              <p>🆔 {report.id} · {report.type}</p>
              <p>📍 {report.location}</p>
              <p>🕒 {report.date}</p>
              <span
                className={`badge ${
                  report.urgency === "Critical" || report.urgency === "High"
                    ? "urgent"
                    : report.urgency === "Medium"
                    ? "medium"
                    : "low"
                }`}
              >
                {report.urgency} Priority
              </span>
              &nbsp;
              <span className="badge status">{report.status}</span>
            </div>

            <button
              className="view-btn"
              onClick={() => setSelectedReport(report)}
            >
              View Report
            </button>
          </article>
        ))}

        {filteredReports.length === 0 && (
          <div className="empty">No matching rescue reports found.</div>
        )}
      </section>
    </>
  );
  
const rescuedAnimals = reports.filter(
  (report) => report.status === "Rescued"
);

const updateAnimalCare = (reportId, field, value) => {
  setAnimalCare((current) => ({
    ...current,
    [reportId]: {
      ...current[reportId],
      [field]: value,
    },
  }));
};

const renderRescuedAnimals = () => (
  <section className="rescued-page">
    <div className="section-heading">
      <div>
        <h2>Rescued Animals 🐾</h2>
        <p>Track rescued animals and their recovery.</p>
      </div>
      <span className="badge status">
        {rescuedAnimals.length} rescued
      </span>
    </div>

    {rescuedAnimals.length === 0 ? (
      <div className="empty">
        <h3>No rescued animals yet</h3>
        <p>
          Change a rescue report's status to Rescued
          and the animal will appear here.
        </p>
      </div>
    ) : (
      <div className="rescued-grid">
        {rescuedAnimals.map((animal) => {
          const care = animalCare[animal.id] || {
            treatment: "Under observation",
            adoptionReady: false,
            notes: "",
          };

          return (
            <article className="rescued-card" key={animal.id}>
              <img
                className="rescued-photo"
                src={animal.image}
                alt={animal.name}
              />

              <div className="rescued-card-content">
                <h3>{animal.name}</h3>
                <p>Report ID: {animal.id}</p>
                <p>📍 {animal.location}</p>
                <p>
                  🤝 Volunteer:{" "}
                  {assigned[animal.id] || "Not assigned"}
                </p>

                <label className="care-label">
                  Treatment Progress
                </label>

                <select
                  className="volunteer-select"
                  value={care.treatment}
                  onChange={(e) =>
                    updateAnimalCare(
                      animal.id,
                      "treatment",
                      e.target.value
                    )
                  }
                >
                  <option>Under observation</option>
                  <option>Receiving treatment</option>
                  <option>Recovering</option>
                  <option>Fully recovered</option>
                </select>

                <label className="care-label">
                  Care Notes
                </label>

                <textarea
                  className="care-notes"
                  placeholder="Enter treatment or recovery notes..."
                  value={care.notes}
                  onChange={(e) =>
                    updateAnimalCare(
                      animal.id,
                      "notes",
                      e.target.value
                    )
                  }
                  rows={3}
                />

                <label className="adoption-toggle">
                  <input
                    type="checkbox"
                    checked={care.adoptionReady}
                    onChange={(e) =>
                      updateAnimalCare(
                        animal.id,
                        "adoptionReady",
                        e.target.checked
                      )
                    }
                  />
                  Ready for adoption
                </label>
              </div>
            </article>
          );
        })}
      </div>
    )}
  </section>
);

  const renderVolunteers = () => (
    <section className="volunteer-page">
      <div className="section-heading">
        <div>
          <h2>Volunteer Management</h2>
          <p>Manage your rescue team and their availability.</p>
        </div>
        <button
          className="view-btn"
          onClick={() => setShowVolunteerForm((show) => !show)}
        >
          {showVolunteerForm ? "Cancel" : "+ Add Volunteer"}
        </button>
      </div>

      <div className="volunteer-summary">
        <div className="stat-card">
          <div className="stat-icon">🤝</div>
          <div className="stat-number">{volunteers.length}</div>
          <div className="stat-label">Total Volunteers</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🟢</div>
          <div className="stat-number">{availableCount}</div>
          <div className="stat-label">Available Now</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🚑</div>
          <div className="stat-number">
            {volunteers.reduce((total, volunteer) => total + volunteer.cases, 0)}
          </div>
          <div className="stat-label">Rescue Cases Handled</div>
        </div>
      </div>

      {showVolunteerForm && (
        <form className="volunteer-form" onSubmit={handleAddVolunteer}>
          <h3>Add a new volunteer</h3>
          <input
            type="text"
            placeholder="Full name"
            value={newVolunteer.name}
            onChange={(event) =>
              setNewVolunteer({ ...newVolunteer, name: event.target.value })
            }
            required
          />
          <input
            type="tel"
            placeholder="Phone number"
            value={newVolunteer.phone}
            onChange={(event) =>
              setNewVolunteer({ ...newVolunteer, phone: event.target.value })
            }
            required
          />
          <input
            type="text"
            placeholder="Area / locality"
            value={newVolunteer.area}
            onChange={(event) =>
              setNewVolunteer({ ...newVolunteer, area: event.target.value })
            }
            required
          />
          <button className="view-btn" type="submit">
            Save Volunteer
          </button>
        </form>
      )}

      <div className="volunteer-list">
        {volunteers.map((volunteer) => (
          <article className="volunteer-card" key={volunteer.id}>
            <div className="volunteer-avatar">{volunteer.initials}</div>
            <div className="volunteer-info">
              <h3>{volunteer.name}</h3>
              <p>📞 {volunteer.phone}</p>
              <p>📍 {volunteer.area}</p>
              <p>🐾 {volunteer.cases} rescue cases handled</p>
            </div>
            <div className="volunteer-actions">
              <span
                className={`volunteer-status ${
                  volunteer.available ? "available" : "unavailable"
                }`}
              >
                {volunteer.available ? "Available" : "Unavailable"}
              </span>
              <button
                className="filter-btn"
                onClick={() => toggleVolunteerAvailability(volunteer.id)}
              >
                Mark {volunteer.available ? "Unavailable" : "Available"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">🐾 Paw<span>Rescue</span></div>
        <div className="sidebar-label">MAIN MENU</div>

        {menu.map((item) => (
          <button
            key={item.name}
            className={`nav-item ${activeTab === item.name ? "active" : ""}`}
            onClick={() => setActiveTab(item.name)}
          >
            {item.icon} &nbsp; {item.name}
          </button>
        ))}

        <div className="sidebar-bottom">
          ❤️ Every rescue matters.
          <br />
          Together, we save lives.
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="welcome">
            <h1>Welcome back! 👋</h1>
            <p>Here's what's happening with PawRescue today.</p>
          </div>
          <div className="profile">🧑 NGO Administrator</div>
        </header>

        {activeTab !== "Volunteers" && (
          <section className="stats">
            <div className="stat-card">
              <div className="stat-icon">📋</div>
              <div className="stat-number">128</div>
              <div className="stat-label">Total Reports</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🚨</div>
              <div className="stat-number">18</div>
              <div className="stat-label">Pending Rescues</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🚑</div>
              <div className="stat-number">12</div>
              <div className="stat-label">Rescue In Progress</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">❤️</div>
              <div className="stat-number">98</div>
              <div className="stat-label">Animals Rescued</div>
            </div>
          </section>
        )}

        {activeTab === "Overview" || activeTab === "Rescue Reports"
  ? renderReports()
  : activeTab === "Rescued Animals"
  ? renderRescuedAnimals()
  : activeTab === "Volunteers"
  ? renderVolunteers()
  : (
    <section className="section-heading">
      <div>
        <h2>{activeTab}</h2>
        <p>This section is ready for the next development step.</p>
      </div>
    </section>
  )}
         
      </main>

      {selectedReport && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="report-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="close-btn"
              onClick={() => setSelectedReport(null)}
              aria-label="Close report details"
            >
              ✕
            </button>

            <img
              className="modal-photo"
              src={selectedReport.image}
              alt={selectedReport.name}
            />

            <h2>{selectedReport.name}</h2>
            <p className="modal-id">Report ID: {selectedReport.id}</p>

            <div className="modal-details">
              <p><strong>Animal:</strong> {selectedReport.type}</p>
              <p><strong>Location:</strong> {selectedReport.location}</p>
              <p><strong>Reported:</strong> {selectedReport.date}</p>
              <p><strong>Urgency:</strong> {selectedReport.urgency}</p>
              <p><strong>Status:</strong> {selectedReport.status}</p>
              <p>
                <strong>Volunteer:</strong>{" "}
                {assigned[selectedReport.id] || "Not assigned"}
              </p>
            </div>

            <div className="assignment-area">
              <h3>Assign Rescue Volunteer</h3>
              <select
                className="volunteer-select"
                value={assigned[selectedReport.id] || ""}
                onChange={(event) =>
                  setAssigned((previous) => ({
                    ...previous,
                    [selectedReport.id]: event.target.value,
                  }))
                }
              >
                <option value="">Choose a volunteer</option>
                {volunteers
                  .filter((volunteer) => volunteer.available)
                  .map((volunteer) => (
                    <option key={volunteer.id} value={volunteer.name}>
                      {volunteer.name}
                    </option>
                  ))}
              </select>

              {assigned[selectedReport.id] && (
                <p className="assignment-success">
                  ✓ Volunteer assigned successfully!
                </p>
              )}
            </div>

            <button
              className="modal-action"
              onClick={() => setSelectedReport(null)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
