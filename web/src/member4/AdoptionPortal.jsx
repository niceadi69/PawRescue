import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { capitalize, formatDay } from "./helpers";

const REFRESH_MS = 30000;

const EMPTY_APPLICATION = {
  applicant_name: "",
  contact: "",
  locality: "",
  living_situation: "",
  experience: "",
  reason: "",
};

export default function AdoptionPortal() {
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("adoption_animals")
      .select(
        "id, name, species, age_text, sex, description, health_summary, rescue_story, photo_url, adoption_status, created_at"
      )
      .in("adoption_status", ["available", "application_pending"])
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
    } else {
      setAnimals(data);
      setError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const openAnimal = animals.find((animal) => animal.id === openId) || null;

  return (
    <div className="m4-page">
      <header className="m4-hero">
        <div className="m4-brand">
          🐾 Paw<span>Rescue</span>
        </div>
        <h1>Give a rescued animal a second chance</h1>
        <p>
          Every animal here was reported by someone who cared, rescued by
          volunteers and treated by a vet. Now they're ready for a home.
        </p>
        <p className="m4-hero-note">
          Seen an injured or abused animal? Report it in seconds through the
          PawRescue Telegram bot.
        </p>
      </header>

      <main className="m4-main">
        {error && <p className="m4-error">Couldn't load animals: {error}</p>}
        {loading && <p className="m4-muted">Loading animals…</p>}

        {!loading && !error && animals.length === 0 && (
          <div className="m4-empty">
            No animals are up for adoption right now. Check back soon.
          </div>
        )}

        <div className="m4-grid m4-grid-wide">
          {animals.map((animal) => (
            <article key={animal.id} className="m4-card m4-pet">
              {animal.photo_url ? (
                <img className="m4-pet-photo" src={animal.photo_url} alt={animal.name} />
              ) : (
                <div className="m4-pet-photo m4-thumb-empty">🐾</div>
              )}
              <div className="m4-case-body">
                <h3>{animal.name}</h3>
                <p className="m4-muted">
                  {[
                    animal.species,
                    animal.age_text,
                    animal.sex !== "unknown" && capitalize(animal.sex),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {animal.description && <p>{animal.description}</p>}
                {animal.adoption_status === "application_pending" && (
                  <span className="m4-badge m4-badge-warn">
                    Application in progress
                  </span>
                )}
              </div>
              <button className="m4-button" onClick={() => setOpenId(animal.id)}>
                Meet {animal.name}
              </button>
            </article>
          ))}
        </div>
      </main>

      {openAnimal && (
        <AnimalDetail
          key={openAnimal.id}
          animal={openAnimal}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function AnimalDetail({ animal, onClose }) {
  const [form, setForm] = useState(EMPTY_APPLICATION);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSending(true);

    const clean = (value) => value.trim() || null;

    // Insert only: the public can't read applications back
    const { error: insertError } = await supabase.from("adoption_requests").insert({
      animal_id: animal.id,
      applicant_name: form.applicant_name.trim(),
      contact: form.contact.trim(),
      locality: clean(form.locality),
      living_situation: clean(form.living_situation),
      experience: clean(form.experience),
      reason: clean(form.reason),
    });

    setSending(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSent(true);
  };

  return (
    <div className="m4-overlay" onClick={onClose}>
      <div
        className="m4-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={`About ${animal.name}`}
      >
        <button className="m4-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        {animal.photo_url && (
          <img className="m4-modal-photo" src={animal.photo_url} alt={animal.name} />
        )}

        <h2>{animal.name}</h2>
        <p className="m4-muted">
          {[animal.species, animal.age_text, animal.sex !== "unknown" && capitalize(animal.sex)]
            .filter(Boolean)
            .join(" · ")}{" "}
          · Listed {formatDay(animal.created_at)}
        </p>

        {animal.description && <p>{animal.description}</p>}

        {animal.rescue_story && (
          <div className="m4-story">
            <h3>Their rescue story</h3>
            <p>{animal.rescue_story}</p>
          </div>
        )}

        {animal.health_summary && (
          <div className="m4-story">
            <h3>Health</h3>
            <p>{animal.health_summary}</p>
          </div>
        )}

        {sent ? (
          <div className="m4-success-box">
            <h3>Application sent 🎉</h3>
            <p>
              Thank you! The rescue team will review it and contact you on{" "}
              {form.contact}.
            </p>
          </div>
        ) : (
          <form className="m4-form" onSubmit={handleSubmit}>
            <h3>Apply to adopt {animal.name}</h3>

            <div className="m4-form-row">
              <label className="m4-label">
                Your name *
                <input
                  value={form.applicant_name}
                  onChange={update("applicant_name")}
                  autoComplete="name"
                  required
                />
              </label>
              <label className="m4-label">
                Phone or email *
                <input
                  value={form.contact}
                  onChange={update("contact")}
                  autoComplete="tel"
                  required
                />
              </label>
            </div>

            <div className="m4-form-row">
              <label className="m4-label">
                Area / city
                <input value={form.locality} onChange={update("locality")} />
              </label>
              <label className="m4-label">
                Your home
                <select value={form.living_situation} onChange={update("living_situation")}>
                  <option value="">Choose one</option>
                  <option value="House with a yard">House with a yard</option>
                  <option value="House without a yard">House without a yard</option>
                  <option value="Apartment">Apartment</option>
                  <option value="Hostel or shared housing">Hostel or shared housing</option>
                  <option value="Other">Other</option>
                </select>
              </label>
            </div>

            <label className="m4-label">
              Experience with pets
              <textarea rows={2} value={form.experience} onChange={update("experience")} />
            </label>

            <label className="m4-label">
              Why would you like to adopt {animal.name}?
              <textarea rows={2} value={form.reason} onChange={update("reason")} />
            </label>

            {error && <p className="m4-error">{error}</p>}

            <button className="m4-button" type="submit" disabled={sending}>
              {sending ? "Sending…" : "Send application"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
