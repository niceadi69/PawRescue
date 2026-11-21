// Member 4 (Rhythm): public animal cruelty report form
// Saves to public.cruelty_reports (anyone can file one, only admins can read
// them) and evidence photos to the private cruelty-evidence bucket. The table
// and bucket are in supabase/member4_vet_adoption.sql, section 5.
import { useState } from "react";
import { supabase } from "../supabaseClient";

const base = import.meta.env.BASE_URL;

const INCIDENTS = [
  { id: "beating", icon: "🩹", label: "Beating or injuring" },
  { id: "poisoning", icon: "🧪", label: "Poisoning or killing" },
  { id: "neglect", icon: "🥣", label: "Starving, chaining or neglect" },
  { id: "abandonment", icon: "🏚️", label: "Abandonment" },
  { id: "transport", icon: "🚚", label: "Cruel transport or overloading" },
  { id: "slaughter", icon: "⚠️", label: "Illegal slaughter" },
  { id: "dog_removal", icon: "🐕", label: "Community dogs removed or relocated" },
  { id: "fights_shows", icon: "🎪", label: "Used for fights or shows" },
  { id: "wildlife", icon: "🦜", label: "Wildlife trapped or sold" },
  { id: "other", icon: "📝", label: "Something else" },
];

const ANIMALS = [
  "Dog",
  "Cat",
  "Cow, bull or buffalo",
  "Goat or sheep",
  "Horse, donkey or mule",
  "Camel",
  "Bird",
  "Monkey",
  "Other wild animal",
  "Other",
];

const STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

const MAX_FILES = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const FIX_NOTICE = "Please fix the highlighted fields.";

const today = () => new Date().toLocaleDateString("en-CA");

const emptyForm = () => ({
  incident: "",
  animal: "",
  count: "1",
  now: "",
  date: today(),
  time: "",
  description: "",
  people: "",
  vehicle: "",
  state: "",
  city: "",
  locality: "",
  landmark: "",
  pincode: "",
  lat: null,
  lng: null,
  anonymous: false,
  name: "",
  phone: "",
  email: "",
  contactOk: true,
  firHelp: false,
  truthful: false,
  website: "",
});

function makeReference() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `PR-CR-${Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("")}`;
}

// Accepts 98765 43210, +91 98765 43210, 098765 43210 and the like
function normalisePhone(value) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}

function validate(form) {
  const errors = {};
  const count = Number(form.count);

  if (!form.incident) errors.incident = "Choose what kind of cruelty you saw.";
  if (!form.animal) errors.animal = "Choose the animal.";
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    errors.count = "Enter a number from 1 to 500.";
  }
  if (!form.now) errors.now = "Tell us whether it's happening right now.";
  if (form.date && form.date > today()) errors.date = "The date can't be in the future.";
  if (form.description.trim().length < 20) {
    errors.description = "Describe what happened in at least 20 characters.";
  }
  if (!form.state) errors.state = "Choose the state or union territory.";
  if (!form.city.trim()) errors.city = "Enter the city or district.";
  if (!form.locality.trim()) errors.locality = "Enter the area or locality.";
  if (form.pincode.trim() && !/^[1-9][0-9]{5}$/.test(form.pincode.trim())) {
    errors.pincode = "A PIN code has 6 digits and doesn't start with 0.";
  }

  if (!form.anonymous) {
    const phone = normalisePhone(form.phone);
    if (form.phone.trim() && !/^[6-9][0-9]{9}$/.test(phone)) {
      errors.phone = "Enter a 10-digit Indian mobile number.";
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email address.";
    }
    if (form.contactOk && !form.phone.trim() && !form.email.trim() && !errors.phone) {
      errors.phone = "Add a mobile number or an email so we can reach you.";
    }
  }

  if (!form.truthful) errors.truthful = "Please confirm the declaration.";
  return errors;
}

function Field({ label, optional, hint, error, children }) {
  return (
    <label className={error ? "rp-field rp-field-bad" : "rp-field"}>
      <span className="rp-label">
        {label}
        {optional && <em> (optional)</em>}
      </span>
      {children}
      {error ? <span className="rp-err">{error}</span> : hint && <span className="rp-hint">{hint}</span>}
    </label>
  );
}

function StepHead({ n, title }) {
  return (
    <div className="rp-step-head">
      <span className="rp-step-n">{n}</span>
      <h2>{title}</h2>
    </div>
  );
}

function Done({ result, onReset }) {
  return (
    <section className="dn-card rp-done" aria-live="polite">
      <p className="rp-tick" aria-hidden="true">
        ✓
      </p>
      <h2>Report received. Thank you for speaking up.</h2>
      <p className="dn-muted">Save this reference number to follow up on your report:</p>
      <p className="rp-ref">{result.reference}</p>
      {result.urgent && (
        <p className="rp-urgent">
          You said this is happening right now. If you haven't already, call{" "}
          <a href="tel:112">112</a>.
        </p>
      )}
      {result.photoFailures > 0 && (
        <p className="rp-error">
          {result.photoFailures} photo(s) couldn't be uploaded, but your report was saved.
        </p>
      )}
      <ol className="rp-next-list">
        <li>Our team reviews your report{result.photos > 0 ? " and photos" : ""}.</li>
        <li>If an animal needs help, we pass it to a partner NGO that covers the area.</li>
        <li>If you asked for it, we help you file a police complaint.</li>
      </ol>
      <div className="rp-actions">
        <button type="button" className="m4-button" onClick={onReset}>
          File another report
        </button>
        <a className="m4-button m4-button-quiet" href={`${base}adopt.html`}>
          Meet animals up for adoption
        </a>
      </div>
    </section>
  );
}

export default function ReportCruelty() {
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState([]);
  const [fileNote, setFileNote] = useState("");
  const [geoNote, setGeoNote] = useState("");
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  // Clear a field's error as soon as the person changes it
  const clearError = (name) => {
    const linked = { email: ["phone"], contactOk: ["phone"], anonymous: ["phone", "email"] };
    setErrors((current) => {
      const keys = [name, ...(linked[name] || [])].filter((key) => current[key]);
      if (keys.length === 0) return current;
      const next = { ...current };
      keys.forEach((key) => delete next[key]);
      return next;
    });
  };

  const set = (name) => (event) => {
    const { type, checked, value } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    clearError(name);
  };

  const pick = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    clearError(name);
  };

  const addFiles = (list) => {
    const images = Array.from(list).filter((file) => file.type.startsWith("image/"));
    const small = images.filter((file) => file.size <= MAX_BYTES);
    const skipped = images.length - small.length;
    const room = MAX_FILES - files.length;
    setFiles((current) => [...current, ...small].slice(0, MAX_FILES));
    if (skipped > 0) setFileNote(`${skipped} photo(s) over 5 MB were skipped.`);
    else if (small.length > room) setFileNote(`Only ${MAX_FILES} photos can be attached.`);
    else setFileNote("");
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoNote("Location isn't available in this browser. Type the address instead.");
      return;
    }
    setGeoNote("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }));
        setGeoNote(`Location added (accurate to about ${Math.round(position.coords.accuracy)} m).`);
      },
      () => setGeoNote("Couldn't get your location. You can still type the address."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const reset = () => {
    setForm(emptyForm());
    setFiles([]);
    setFileNote("");
    setGeoNote("");
    setErrors({});
    setNotice("");
    setResult(null);
  };

  const submit = async (event) => {
    event.preventDefault();

    // Bots fill the hidden field; people never see it
    if (form.website) {
      setResult({ reference: makeReference(), photos: 0, photoFailures: 0, urgent: false });
      return;
    }

    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setNotice(FIX_NOTICE);
      // Bring the first problem into view
      requestAnimationFrame(() => {
        document
          .querySelector(".rp-field-bad, .rp-err")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
      return;
    }

    setBusy(true);
    setNotice("");

    const id = crypto.randomUUID();
    const reference = makeReference();
    const evidence = [];
    let photoFailures = 0;

    for (const [index, file] of files.entries()) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${id}/${index + 1}.${ext}`;
      const { error } = await supabase.storage
        .from("cruelty-evidence")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (error) photoFailures += 1;
      else evidence.push(path);
    }

    const phone = normalisePhone(form.phone);
    const { error } = await supabase.from("cruelty_reports").insert({
      id,
      reference,
      incident_type: form.incident,
      animal_type: form.animal,
      animal_count: Number(form.count),
      happening_now: form.now === "yes",
      incident_date: form.date || null,
      incident_time: form.time || null,
      description: form.description.trim(),
      people_involved: form.people.trim() || null,
      vehicle_number: form.vehicle.trim().toUpperCase() || null,
      state: form.state,
      city: form.city.trim(),
      locality: form.locality.trim(),
      landmark: form.landmark.trim() || null,
      pincode: form.pincode.trim() || null,
      latitude: form.lat,
      longitude: form.lng,
      evidence_paths: evidence,
      is_anonymous: form.anonymous,
      reporter_name: form.anonymous ? null : form.name.trim() || null,
      reporter_phone: form.anonymous ? null : phone || null,
      reporter_email: form.anonymous ? null : form.email.trim() || null,
      contact_ok: !form.anonymous && form.contactOk,
      wants_fir_help: form.firHelp,
    });

    setBusy(false);

    if (error) {
      setNotice(
        `We couldn't save your report (${error.message}). If the animal is in danger, call 112.`
      );
      return;
    }

    setResult({ reference, photos: evidence.length, photoFailures, urgent: form.now === "yes" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="m4-page dn-page rp-page">
      <header className="dn-hero">
        <nav className="dn-nav">
          <a className="m4-brand" href={`${base}index.html`}>
            🐾 Paw<span>Rescue</span>
          </a>
          <div className="dn-links">
            <a href={`${base}adopt.html`}>Adopt</a>
            <a href={`${base}donate.html`}>Donate</a>
            <a className="dn-on" href={`${base}report.html`} aria-current="page">
              Report cruelty
            </a>
          </div>
        </nav>
        <div className="dn-hero-body">
          <p className="dn-kicker">Speak up for them</p>
          <h1>Report animal cruelty</h1>
          <p className="rp-hindi" lang="hi">
            पशु क्रूरता की शिकायत दर्ज करें
          </p>
          <p>
            Seen an animal being beaten, poisoned, starved or cruelly transported?
            Tell us what happened. It takes a few minutes, and you can stay anonymous.
          </p>
        </div>
      </header>

      <p className="rp-sos" role="note">
        <strong>Animal in danger right now?</strong> Call <a href="tel:112">112</a>{" "}
        (police emergency) first, then fill in this form.
      </p>

      <main className="dn-main">
        {result ? (
          <Done result={result} onReset={reset} />
        ) : (
          <div className="rp-layout">
            <form className="rp-form" onSubmit={submit} noValidate>
              <section className="dn-card rp-step">
                <StepHead n="1" title="What happened?" />

                <fieldset className="rp-set">
                  <legend className="rp-label">Type of cruelty</legend>
                  <div className="rp-types">
                    {INCIDENTS.map((item) => (
                      <label
                        key={item.id}
                        className={form.incident === item.id ? "rp-type rp-type-on" : "rp-type"}
                      >
                        <input
                          type="radio"
                          name="incident"
                          value={item.id}
                          checked={form.incident === item.id}
                          onChange={() => pick("incident", item.id)}
                        />
                        <span className="rp-type-icon" aria-hidden="true">
                          {item.icon}
                        </span>
                        {item.label}
                      </label>
                    ))}
                  </div>
                  {errors.incident && <span className="rp-err">{errors.incident}</span>}
                </fieldset>

                <div className="rp-row">
                  <Field label="Animal" error={errors.animal}>
                    <select value={form.animal} onChange={set("animal")}>
                      <option value="">Choose…</option>
                      {ANIMALS.map((animal) => (
                        <option key={animal}>{animal}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="How many animals?" error={errors.count}>
                    <input type="number" min="1" max="500" value={form.count} onChange={set("count")} />
                  </Field>
                </div>

                <fieldset className="rp-set">
                  <legend className="rp-label">Is it happening right now?</legend>
                  <div className="rp-seg">
                    {[
                      ["yes", "Yes, right now"],
                      ["no", "No, it already happened"],
                    ].map(([value, text]) => (
                      <label
                        key={value}
                        className={
                          form.now === value
                            ? `rp-seg-on${value === "yes" ? " rp-seg-yes" : ""}`
                            : ""
                        }
                      >
                        <input
                          type="radio"
                          name="now"
                          value={value}
                          checked={form.now === value}
                          onChange={() => pick("now", value)}
                        />
                        {text}
                      </label>
                    ))}
                  </div>
                  {errors.now && <span className="rp-err">{errors.now}</span>}
                  {form.now === "yes" && (
                    <p className="rp-urgent">
                      Please call <a href="tel:112">112</a> now. You can finish this report after.
                    </p>
                  )}
                </fieldset>

                <div className="rp-row">
                  <Field label="Date" error={errors.date}>
                    <input type="date" max={today()} value={form.date} onChange={set("date")} />
                  </Field>
                  <Field label="Approximate time" optional>
                    <input type="time" value={form.time} onChange={set("time")} />
                  </Field>
                </div>

                <Field
                  label="What did you see?"
                  error={errors.description}
                  hint={`${form.description.trim().length}/4000 · Who did what, to which animal, and is it still there?`}
                >
                  <textarea
                    maxLength={4000}
                    value={form.description}
                    onChange={set("description")}
                    placeholder="e.g. A man near the vegetable market has been beating a brown dog with a stick every evening. The dog now limps on its front leg."
                  />
                </Field>

                <div className="rp-row">
                  <Field label="People involved" optional hint="Name, description or shop, if known">
                    <input value={form.people} onChange={set("people")} />
                  </Field>
                  <Field label="Vehicle number" optional hint="For cruel transport, e.g. PB 11 AB 1234">
                    <input
                      value={form.vehicle}
                      onChange={set("vehicle")}
                      placeholder="PB 11 AB 1234"
                      style={{ textTransform: "uppercase" }}
                    />
                  </Field>
                </div>
              </section>

              <section className="dn-card rp-step">
                <StepHead n="2" title="Where did it happen?" />
                <div className="rp-row">
                  <Field label="State or union territory" error={errors.state}>
                    <select value={form.state} onChange={set("state")}>
                      <option value="">Choose…</option>
                      {STATES.map((state) => (
                        <option key={state}>{state}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="City or district" error={errors.city}>
                    <input value={form.city} onChange={set("city")} placeholder="e.g. Patiala" />
                  </Field>
                </div>
                <div className="rp-row">
                  <Field label="Area or locality" error={errors.locality}>
                    <input value={form.locality} onChange={set("locality")} placeholder="e.g. Tripuri, near the gurdwara" />
                  </Field>
                  <Field label="Landmark" optional>
                    <input value={form.landmark} onChange={set("landmark")} placeholder="e.g. opposite the petrol pump" />
                  </Field>
                </div>
                <div className="rp-row">
                  <Field label="PIN code" optional error={errors.pincode}>
                    <input
                      inputMode="numeric"
                      maxLength={6}
                      value={form.pincode}
                      onChange={set("pincode")}
                      placeholder="147001"
                    />
                  </Field>
                  <div className="rp-field">
                    <span className="rp-label">
                      Exact spot <em>(optional)</em>
                    </span>
                    <div className="rp-geo">
                      <button type="button" className="rp-ghost" onClick={locate}>
                        📍 Use my current location
                      </button>
                    </div>
                    {geoNote && <span className="rp-hint">{geoNote}</span>}
                  </div>
                </div>
              </section>

              <section className="dn-card rp-step">
                <StepHead n="3" title="Photos" />
                <label className="rp-drop">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => {
                      addFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                  <span className="rp-drop-icon" aria-hidden="true">
                    📷
                  </span>
                  <strong>Add up to 3 photos</strong>
                  <span className="rp-hint">JPG or PNG, up to 5 MB each. Only PawRescue staff can see them.</span>
                </label>
                {files.length > 0 && (
                  <ul className="rp-files">
                    {files.map((file, index) => (
                      <li key={`${file.name}-${index}`}>
                        <span>{file.name}</span>
                        <button
                          type="button"
                          className="dn-copy"
                          onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {fileNote && <span className="rp-hint">{fileNote}</span>}
                <p className="rp-hint">
                  Never put yourself at risk to take photos. Keep the originals: police may ask for them.
                </p>
              </section>

              <section className="dn-card rp-step">
                <StepHead n="4" title="About you" />
                <label className="rp-switch">
                  <input type="checkbox" checked={form.anonymous} onChange={set("anonymous")} />
                  <span className="rp-knob" aria-hidden="true" />
                  Report anonymously
                </label>

                {form.anonymous ? (
                  <p className="rp-hint">
                    We won't store your name or contact details. We also can't update you or ask
                    follow-up questions.
                  </p>
                ) : (
                  <>
                    <div className="rp-row">
                      <Field label="Your name" optional>
                        <input value={form.name} onChange={set("name")} autoComplete="name" />
                      </Field>
                      <Field label="Mobile number" error={errors.phone}>
                        <div className="rp-phone">
                          <span>+91</span>
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={form.phone}
                            onChange={set("phone")}
                            placeholder="98765 43210"
                            autoComplete="tel-national"
                          />
                        </div>
                      </Field>
                    </div>
                    <Field label="Email" optional error={errors.email}>
                      <input type="email" value={form.email} onChange={set("email")} autoComplete="email" />
                    </Field>
                    <label className="rp-check">
                      <input type="checkbox" checked={form.contactOk} onChange={set("contactOk")} />
                      PawRescue may contact me about this report.
                    </label>
                  </>
                )}

                <label className="rp-check">
                  <input type="checkbox" checked={form.firHelp} onChange={set("firHelp")} />
                  I'd like help filing a police complaint (FIR).
                </label>
                <label className={errors.truthful ? "rp-check rp-check-bad" : "rp-check"}>
                  <input type="checkbox" checked={form.truthful} onChange={set("truthful")} />
                  The information I've given is true to the best of my knowledge.
                </label>
                {errors.truthful && <span className="rp-err">{errors.truthful}</span>}
                <p className="rp-hint">
                  Your details are only seen by PawRescue staff, and shared with the police only if
                  you ask for help with a complaint.
                </p>
              </section>

              <div className="rp-hp" aria-hidden="true">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
                </label>
              </div>

              {notice && !(notice === FIX_NOTICE && Object.keys(errors).length === 0) && (
                <p className="rp-error" role="alert">
                  {notice}
                </p>
              )}

              <div className="rp-submit-row">
                <button type="submit" className="m4-button rp-submit" disabled={busy}>
                  {busy ? "Sending your report…" : "Submit report"}
                </button>
                <p className="dn-fine">
                  SatHack 2026 prototype. In a real emergency, call 112 or go to your nearest police
                  station.
                </p>
              </div>
            </form>

            <aside className="rp-aside">
              <section className="dn-card rp-law">
                <h2>Know the law</h2>
                <ul>
                  <li>
                    <b>Prevention of Cruelty to Animals Act, 1960 · Section 11</b>
                    Beating, overloading, starving, confining or abandoning an animal is cruelty.
                  </li>
                  <li>
                    <b>Bharatiya Nyaya Sanhita, 2023 · Section 325</b>
                    Killing, poisoning or maiming any animal: up to 5 years in prison, a fine, or both.
                    It replaced IPC Sections 428 and 429.
                  </li>
                  <li>
                    <b>Animal Birth Control Rules, 2023</b>
                    Community dogs may be picked up for sterilisation and vaccination, and must be
                    returned to the same area.
                  </li>
                  <li>
                    <b>Wild Life (Protection) Act, 1972</b>
                    Protects wild animals and birds, including from trapping and trade.
                  </li>
                  <li>
                    <b>Constitution of India · Article 51A(g)</b>
                    Compassion for living creatures is a fundamental duty of every citizen.
                  </li>
                </ul>
                <p className="dn-fine">General information, not legal advice.</p>
              </section>

              <section className="dn-card rp-tips">
                <h2>Tips for a strong report</h2>
                <ul>
                  <li>Note the exact place, date and time.</li>
                  <li>Describe the animal: colour, size, injuries.</li>
                  <li>For cruel transport, note the vehicle number.</li>
                  <li>Don't confront anyone. Let the police and NGOs act.</li>
                  <li>You can also complain at the nearest police station.</li>
                </ul>
              </section>
            </aside>
          </div>
        )}
      </main>

      <footer className="dn-foot">
        PawRescue · SatHack 2026 prototype. In an emergency, call 112.
      </footer>
    </div>
  );
}
