import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { TopBar } from "./StaffGate.jsx";
import {
  ADOPTION_STATUSES,
  adoptionLabel,
  capitalize,
  copyRescuePhoto,
  formatDate,
  formatDay,
  newestFirst,
  photoPaths,
  shortCode,
  uploadAdoptionPhoto,
} from "./helpers";

const REFRESH_MS = 15000;

// PostgREST returns a one-to-one embed as an object, one-to-many as a list
const firstOf = (value) => (Array.isArray(value) ? value[0] : value) || null;

export default function AdoptionDesk({ session, profile }) {
  const [ready, setReady] = useState([]);
  const [animals, setAnimals] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [listing, setListing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const [reportsResult, animalsResult, requestsResult] = await Promise.all([
      supabase
        .from("rescue_reports")
        .select(
          "id, animal_type, description, created_at, report_photos(storage_path, created_at), medical_records(medical_status, created_at), adoption_animals(id)"
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("adoption_animals")
        .select("*, adoption_requests(id, status)")
        .order("created_at", { ascending: false }),
      supabase
        .from("adoption_requests")
        .select("*, adoption_animals(name, species)")
        .order("created_at", { ascending: false }),
    ]);

    const failed = [reportsResult, animalsResult, requestsResult].find(
      (result) => result.error
    );
    if (failed) {
      setError(failed.error.message);
      return;
    }

    // Cleared by the vet and not listed yet
    setReady(
      reportsResult.data.filter((report) => {
        const latest = newestFirst(report.medical_records)[0];
        return (
          latest?.medical_status === "cleared_for_adoption" &&
          !firstOf(report.adoption_animals)
        );
      })
    );
    setAnimals(animalsResult.data);
    setRequests(requestsResult.data);
    setError("");
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const setAnimalStatus = async (animalId, status) => {
    setBusyId(animalId);
    const { error: updateError } = await supabase
      .from("adoption_animals")
      .update({ adoption_status: status, updated_at: new Date().toISOString() })
      .eq("id", animalId);
    setBusyId(null);
    if (updateError) setError(updateError.message);
    load();
  };

  const decide = async (request, status) => {
    setBusyId(request.id);
    const { error: updateError } = await supabase
      .from("adoption_requests")
      .update({ status })
      .eq("id", request.id);

    if (!updateError && status === "approved") {
      await supabase
        .from("adoption_animals")
        .update({
          adoption_status: "adopted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", request.animal_id);
    }

    setBusyId(null);
    if (updateError) setError(updateError.message);
    load();
  };

  const pendingRequests = requests.filter((item) => item.status === "pending");
  const decidedRequests = requests.filter((item) => item.status !== "pending");

  return (
    <div className="m4-page">
      <TopBar title="Adoption desk" profile={profile} session={session} />

      <main className="m4-main">
        <div className="m4-heading">
          <div>
            <h1>Adoption desk</h1>
            <p className="m4-muted">
              List animals the vet has cleared, then review adoption
              applications from the public page.
            </p>
          </div>
          <a className="m4-button m4-button-quiet" href="/adopt.html" target="_blank" rel="noreferrer">
            View public page ↗
          </a>
        </div>

        {error && <p className="m4-error">{error}</p>}

        <section className="m4-section">
          <h2>
            Ready to list <span className="m4-count">{ready.length}</span>
          </h2>
          {ready.length === 0 && (
            <div className="m4-empty">
              No animals waiting. They appear here once the vet marks them
              "Cleared for adoption".
            </div>
          )}
          <div className="m4-grid">
            {ready.map((report) => (
              <article key={report.id} className="m4-card m4-case">
                <div className="m4-case-body">
                  <p className="m4-code">
                    {shortCode(report.id)} · {capitalize(report.animal_type)}
                  </p>
                  <h3>{report.description}</h3>
                  <p className="m4-muted">
                    Reported {formatDate(report.created_at)}
                  </p>
                  <span className="m4-badge m4-badge-good">
                    Cleared for adoption
                  </span>
                </div>
                <button className="m4-button" onClick={() => setListing(report)}>
                  List for adoption
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="m4-section">
          <h2>
            Applications{" "}
            <span className="m4-count">{pendingRequests.length} new</span>
          </h2>
          {requests.length === 0 && (
            <div className="m4-empty">No applications yet.</div>
          )}
          <div className="m4-list">
            {[...pendingRequests, ...decidedRequests].map((request) => {
              const animal = firstOf(request.adoption_animals);
              return (
                <article key={request.id} className="m4-card m4-application">
                  <div>
                    <p className="m4-code">
                      For {animal?.name || "an animal"} ·{" "}
                      {formatDate(request.created_at)}
                    </p>
                    <h3>{request.applicant_name}</h3>
                    <p>
                      <strong>Contact:</strong> {request.contact}
                      {request.locality && ` · ${request.locality}`}
                    </p>
                    {request.living_situation && (
                      <p>
                        <strong>Home:</strong> {request.living_situation}
                      </p>
                    )}
                    {request.experience && (
                      <p>
                        <strong>Experience:</strong> {request.experience}
                      </p>
                    )}
                    {request.reason && (
                      <p>
                        <strong>Why:</strong> {request.reason}
                      </p>
                    )}
                  </div>
                  {request.status === "pending" ? (
                    <div className="m4-actions">
                      <button
                        className="m4-button"
                        disabled={busyId === request.id}
                        onClick={() => decide(request, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        className="m4-button m4-button-quiet"
                        disabled={busyId === request.id}
                        onClick={() => decide(request, "rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`m4-badge ${request.status === "approved" ? "m4-badge-good" : ""}`}
                    >
                      {capitalize(request.status)}
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="m4-section">
          <h2>
            Listed animals <span className="m4-count">{animals.length}</span>
          </h2>
          {animals.length === 0 && (
            <div className="m4-empty">No animals listed yet.</div>
          )}
          <div className="m4-grid">
            {animals.map((animal) => {
              const pending = (animal.adoption_requests || []).filter(
                (item) => item.status === "pending"
              ).length;
              return (
                <article key={animal.id} className="m4-card m4-case">
                  {animal.photo_url ? (
                    <img className="m4-thumb" src={animal.photo_url} alt={animal.name} />
                  ) : (
                    <div className="m4-thumb m4-thumb-empty">🐾</div>
                  )}
                  <div className="m4-case-body">
                    <h3>{animal.name}</h3>
                    <p className="m4-muted">
                      {animal.species}
                      {animal.age_text && ` · ${animal.age_text}`} · Listed{" "}
                      {formatDay(animal.created_at)}
                    </p>
                    {pending > 0 && (
                      <span className="m4-badge m4-badge-warn">
                        {pending} application{pending > 1 ? "s" : ""} waiting
                      </span>
                    )}
                  </div>
                  <label className="m4-label">
                    Status
                    <select
                      value={animal.adoption_status}
                      disabled={busyId === animal.id}
                      onChange={(event) =>
                        setAnimalStatus(animal.id, event.target.value)
                      }
                    >
                      {ADOPTION_STATUSES.map((status) => (
                        <option key={status.value} value={status.value}>
                          {adoptionLabel(status.value)}
                        </option>
                      ))}
                    </select>
                  </label>
                </article>
              );
            })}
          </div>
        </section>
      </main>

      {listing && (
        <ListingForm
          report={listing}
          staffId={session.user.id}
          onClose={() => setListing(null)}
          onListed={() => {
            setListing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ListingForm({ report, staffId, onClose, onListed }) {
  const paths = photoPaths(report);
  const [form, setForm] = useState({
    name: "",
    species: capitalize(report.animal_type),
    age_text: "",
    sex: "unknown",
    description: "",
    health_summary: "Examined, treated and cleared for adoption by our partner vet.",
    rescue_story: `Rescued after a PawRescue report on ${formatDay(report.created_at)}. Cared for by our team and partner vet until fully recovered.`,
  });
  const [photoChoice, setPhotoChoice] = useState(paths.length > 0 ? "rescue" : "upload");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);

    let photoUrl = null;
    try {
      if (photoChoice === "rescue" && paths.length > 0) {
        photoUrl = await copyRescuePhoto(paths[0]);
      } else if (photoChoice === "upload" && file) {
        photoUrl = await uploadAdoptionPhoto(file);
      }
    } catch (photoError) {
      setSaving(false);
      setError(`Photo upload failed: ${photoError.message}`);
      return;
    }

    const { error: insertError } = await supabase.from("adoption_animals").insert({
      report_id: report.id,
      name: form.name.trim(),
      species: form.species.trim() || capitalize(report.animal_type),
      age_text: form.age_text.trim() || null,
      sex: form.sex,
      description: form.description.trim() || null,
      health_summary: form.health_summary.trim() || null,
      rescue_story: form.rescue_story.trim() || null,
      photo_url: photoUrl,
      listed_by: staffId,
    });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    onListed();
  };

  return (
    <div className="m4-overlay" onClick={onClose}>
      <form
        className="m4-modal m4-form"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <button type="button" className="m4-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <p className="m4-code">
          {shortCode(report.id)} · {capitalize(report.animal_type)}
        </p>
        <h2>List for adoption</h2>
        <p className="m4-muted">
          Everything here is public. Leave out exact locations and anyone's
          contact details.
        </p>

        <div className="m4-form-row">
          <label className="m4-label">
            Name *
            <input value={form.name} onChange={update("name")} placeholder="e.g. Bruno" required />
          </label>
          <label className="m4-label">
            Species
            <input value={form.species} onChange={update("species")} />
          </label>
        </div>

        <div className="m4-form-row">
          <label className="m4-label">
            Age
            <input value={form.age_text} onChange={update("age_text")} placeholder="e.g. about 2 years" />
          </label>
          <label className="m4-label">
            Sex
            <select value={form.sex} onChange={update("sex")}>
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
        </div>

        <label className="m4-label">
          About them
          <textarea
            rows={2}
            value={form.description}
            onChange={update("description")}
            placeholder="Personality, likes, good with kids or other pets…"
          />
        </label>

        <label className="m4-label">
          Health summary (public)
          <textarea rows={2} value={form.health_summary} onChange={update("health_summary")} />
        </label>

        <label className="m4-label">
          Rescue story (public)
          <textarea rows={3} value={form.rescue_story} onChange={update("rescue_story")} />
        </label>

        <fieldset className="m4-fieldset">
          <legend>Photo</legend>
          {paths.length > 0 && (
            <label className="m4-radio">
              <input
                type="radio"
                checked={photoChoice === "rescue"}
                onChange={() => setPhotoChoice("rescue")}
              />
              Use the photo from the rescue report
            </label>
          )}
          <label className="m4-radio">
            <input
              type="radio"
              checked={photoChoice === "upload"}
              onChange={() => setPhotoChoice("upload")}
            />
            Upload a new photo
          </label>
          {photoChoice === "upload" && (
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
          )}
        </fieldset>

        {error && <p className="m4-error">{error}</p>}

        <button className="m4-button" type="submit" disabled={saving}>
          {saving ? "Publishing…" : "Publish listing"}
        </button>
      </form>
    </div>
  );
}
