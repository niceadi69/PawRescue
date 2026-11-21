// Member 4 (Rhythm): vet desk, adoption desk and adoption portal
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { TopBar } from "./StaffGate.jsx";
import {
  MEDICAL_STATUSES,
  capitalize,
  formatDate,
  medicalLabel,
  newestFirst,
  photoPaths,
  shortCode,
  signRescuePhotos,
} from "./helpers";

const REFRESH_MS = 10000;

const TABS = [
  { key: "waiting", label: "Awaiting exam" },
  { key: "treating", label: "Under treatment" },
  { key: "done", label: "Recovered" },
];

const EMPTY_FORM = {
  observations: "",
  diagnosis: "",
  treatment: "",
  medication: "",
  follow_up: "",
  medical_status: "under_treatment",
};

function stageOf(latestStatus) {
  if (!latestStatus) return "waiting";
  if (latestStatus === "recovered" || latestStatus === "cleared_for_adoption") {
    return "done";
  }
  return "treating";
}

function toCase(row) {
  const latest = newestFirst(row.medical_records)[0];
  return {
    id: row.id,
    code: shortCode(row.id),
    animal: capitalize(row.animal_type),
    description: row.description,
    location:
      row.location_text && !row.location_text.startsWith("GPS location")
        ? row.location_text
        : row.latitude != null
          ? `${Number(row.latitude).toFixed(4)}, ${Number(row.longitude).toFixed(4)}`
          : "Location not shared",
    urgency: capitalize(row.urgency),
    reportedAt: row.created_at,
    ai: row.ai_status === "completed" ? row.ai_analysis : null,
    photoPaths: photoPaths(row),
    latestStatus: latest?.medical_status || null,
    lastUpdate: latest?.created_at || null,
    stage: stageOf(latest?.medical_status),
  };
}

export default function VetDashboard({ session, profile }) {
  const [cases, setCases] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("waiting");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    // Row Level Security returns only the reports assigned to this vet
    const { data, error: queryError } = await supabase
      .from("rescue_reports")
      .select(
        "id, animal_type, description, location_text, latitude, longitude, urgency, ai_analysis, ai_status, created_at, report_photos(storage_path, created_at), medical_records(medical_status, created_at)"
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const nextCases = data.map(toCase);
    setCases(nextCases);
    setError("");
    setLoading(false);

    const withPhotos = nextCases.filter((item) => item.photoPaths.length > 0);
    const urls = await signRescuePhotos(
      withPhotos.map((item) => item.photoPaths[0])
    );
    const byCase = {};
    withPhotos.forEach((item, index) => {
      if (urls[index]) byCase[item.id] = urls[index];
    });
    setThumbs(byCase);
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const counts = Object.fromEntries(
    TABS.map((item) => [
      item.key,
      cases.filter((caseItem) => caseItem.stage === item.key).length,
    ])
  );
  const visible = cases.filter((caseItem) => caseItem.stage === tab);
  const openCase = cases.find((caseItem) => caseItem.id === openId) || null;

  return (
    <div className="m4-page">
      <TopBar title="Vet desk" profile={profile} session={session} />

      <main className="m4-main">
        <div className="m4-heading">
          <div>
            <h1>Assigned rescue cases</h1>
            <p className="m4-muted">
              Cases the NGO has assigned to you. Record each exam so the NGO
              can follow the animal's recovery.
            </p>
          </div>
        </div>

        <div className="m4-tabs">
          {TABS.map((item) => (
            <button
              key={item.key}
              className={`m4-tab ${tab === item.key ? "active" : ""}`}
              onClick={() => setTab(item.key)}
            >
              {item.label} <span className="m4-count">{counts[item.key]}</span>
            </button>
          ))}
        </div>

        {error && <p className="m4-error">Couldn't load cases: {error}</p>}
        {loading && <p className="m4-muted">Loading cases…</p>}

        {!loading && !error && visible.length === 0 && (
          <div className="m4-empty">
            {cases.length === 0
              ? "No cases are assigned to you yet. The NGO assigns cases from its dashboard."
              : "Nothing in this list right now."}
          </div>
        )}

        <div className="m4-grid">
          {visible.map((caseItem) => (
            <article key={caseItem.id} className="m4-card m4-case">
              {thumbs[caseItem.id] ? (
                <img
                  className="m4-thumb"
                  src={thumbs[caseItem.id]}
                  alt={`${caseItem.animal} in report ${caseItem.code}`}
                />
              ) : (
                <div className="m4-thumb m4-thumb-empty">🐾</div>
              )}
              <div className="m4-case-body">
                <p className="m4-code">
                  {caseItem.code} · {caseItem.animal}
                </p>
                <h3>{caseItem.description}</h3>
                <p className="m4-muted">📍 {caseItem.location}</p>
                <p className="m4-muted">
                  Reported {formatDate(caseItem.reportedAt)}
                </p>
                <div className="m4-badges">
                  <span className={`m4-badge urgency-${caseItem.urgency.toLowerCase()}`}>
                    {caseItem.urgency} urgency
                  </span>
                  <span className="m4-badge">
                    {medicalLabel(caseItem.latestStatus)}
                  </span>
                </div>
              </div>
              <button
                className="m4-button"
                onClick={() => setOpenId(caseItem.id)}
              >
                {caseItem.stage === "waiting" ? "Start exam" : "Open case"}
              </button>
            </article>
          ))}
        </div>
      </main>

      {openCase && (
        <CaseDetail
          key={openCase.id}
          caseItem={openCase}
          vetId={session.user.id}
          onClose={() => setOpenId(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function CaseDetail({ caseItem, vetId, onClose, onSaved }) {
  const [photos, setPhotos] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const photoKey = caseItem.photoPaths.join("|");

  useEffect(() => {
    let active = true;
    signRescuePhotos(photoKey ? photoKey.split("|") : []).then((urls) => {
      if (active) setPhotos(urls.filter(Boolean));
    });
    return () => {
      active = false;
    };
  }, [photoKey]);

  const loadRecords = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("medical_records")
      .select("*")
      .eq("report_id", caseItem.id)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
      return;
    }
    setRecords(data);
  }, [caseItem.id]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!form.observations.trim()) {
      setError("Add your observations before saving.");
      return;
    }

    setSaving(true);
    const clean = (value) => value.trim() || null;

    const { error: insertError } = await supabase
      .from("medical_records")
      .insert({
        report_id: caseItem.id,
        vet_id: vetId,
        observations: form.observations.trim(),
        diagnosis: clean(form.diagnosis),
        treatment: clean(form.treatment),
        medication: clean(form.medication),
        follow_up: clean(form.follow_up),
        medical_status: form.medical_status,
      });

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setForm({ ...EMPTY_FORM, medical_status: form.medical_status });
    setNotice("Medical record saved. The NGO can see it now.");
    loadRecords();
    onSaved();
  };

  const ai = caseItem.ai;

  return (
    <div className="m4-overlay" onClick={onClose}>
      <div
        className="m4-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label={`Case ${caseItem.code}`}
      >
        <button className="m4-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <p className="m4-code">
          {caseItem.code} · {caseItem.animal}
        </p>
        <h2>{caseItem.description}</h2>
        <p className="m4-muted">
          📍 {caseItem.location} · Reported {formatDate(caseItem.reportedAt)}
        </p>

        {photos.length > 0 && (
          <div className="m4-photos">
            {photos.map((url, index) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                <img src={url} alt={`Report photo ${index + 1}`} />
              </a>
            ))}
          </div>
        )}

        {ai && (
          <div className="m4-ai">
            <h3>🤖 AI triage from the report</h3>
            <p className="m4-muted">
              AI suggestion only, not a diagnosis. Your exam is what counts.
            </p>
            <p>
              <strong>Urgency:</strong> {capitalize(ai.urgency)} ·{" "}
              <strong>Severity:</strong> {capitalize(ai.severity)}
            </p>
            {ai.recommended_action && (
              <p>
                <strong>Suggested:</strong> {ai.recommended_action}
              </p>
            )}
            {Array.isArray(ai.visible_concerns) &&
              ai.visible_concerns.length > 0 && (
                <ul>
                  {ai.visible_concerns.map((concern, index) => (
                    <li key={`${index}-${concern}`}>{concern}</li>
                  ))}
                </ul>
              )}
          </div>
        )}

        <form className="m4-form" onSubmit={handleSubmit}>
          <h3>Add a medical record</h3>

          <label className="m4-label">
            Observations *
            <textarea
              rows={3}
              value={form.observations}
              onChange={update("observations")}
              placeholder="What you found on examination"
              required
            />
          </label>

          <div className="m4-form-row">
            <label className="m4-label">
              Diagnosis
              <input value={form.diagnosis} onChange={update("diagnosis")} />
            </label>
            <label className="m4-label">
              Medication
              <input value={form.medication} onChange={update("medication")} />
            </label>
          </div>

          <label className="m4-label">
            Treatment
            <textarea
              rows={2}
              value={form.treatment}
              onChange={update("treatment")}
            />
          </label>

          <div className="m4-form-row">
            <label className="m4-label">
              Follow-up
              <input
                value={form.follow_up}
                onChange={update("follow_up")}
                placeholder="e.g. recheck in 3 days"
              />
            </label>
            <label className="m4-label">
              Medical status
              <select
                value={form.medical_status}
                onChange={update("medical_status")}
              >
                {MEDICAL_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <p className="m4-error">{error}</p>}
          {notice && <p className="m4-success">{notice}</p>}

          <button className="m4-button" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save medical record"}
          </button>
        </form>

        <div className="m4-history">
          <h3>Medical history</h3>
          {records.length === 0 && (
            <p className="m4-muted">No records yet. Add the first exam above.</p>
          )}
          {records.map((record) => (
            <div key={record.id} className="m4-record">
              <div className="m4-record-head">
                <span className="m4-badge">
                  {medicalLabel(record.medical_status)}
                </span>
                <span className="m4-muted">{formatDate(record.created_at)}</span>
              </div>
              <p>{record.observations}</p>
              {record.diagnosis && (
                <p>
                  <strong>Diagnosis:</strong> {record.diagnosis}
                </p>
              )}
              {record.treatment && (
                <p>
                  <strong>Treatment:</strong> {record.treatment}
                </p>
              )}
              {record.medication && (
                <p>
                  <strong>Medication:</strong> {record.medication}
                </p>
              )}
              {record.follow_up && (
                <p>
                  <strong>Follow-up:</strong> {record.follow_up}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
