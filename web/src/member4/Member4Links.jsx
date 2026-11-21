// Member 4 (Rhythm): vet desk, adoption desk and adoption portal
// Links from the main dashboard into the Member 4 pages. They are on the
// same site, so whoever is signed in here is already signed in there.
import "./links.css";

const base = import.meta.env.BASE_URL;

const PAGES = {
  vet: { href: `${base}vet.html`, label: "Open the vet desk" },
  desk: { href: `${base}adoption-desk.html`, label: "Open the adoption desk" },
  adopt: { href: `${base}adopt.html`, label: "View the public adoption portal" },
  donate: { href: `${base}donate.html`, label: "Open the donation page" },
};

const BY_ROLE = {
  veterinarian: {
    title: "Veterinarian workspace",
    text: "Your assigned cases, with photos, AI triage and medical records, are on the vet desk.",
    links: ["vet"],
  },
  admin: {
    title: "Treatment and adoption",
    text: "Open any report on the vet desk to assign it to an NGO and a vet, then list recovered animals for adoption.",
    links: ["vet", "desk", "adopt"],
  },
  ngo: {
    title: "Adoption",
    text: "List animals your vets have cleared for adoption, and review applications from the public.",
    links: ["desk", "adopt"],
  },
};

export default function Member4Links({ role }) {
  const entry = BY_ROLE[role];
  if (!entry) return null;

  return (
    <section className="panel">
      <h2>{entry.title}</h2>
      <p>{entry.text}</p>
      <div className="m4-link-row">
        {entry.links.map((key, index) => (
          <a
            key={key}
            className={index === 0 ? "m4-link m4-link-main" : "m4-link"}
            href={PAGES[key].href}
          >
            {PAGES[key].label}
          </a>
        ))}
      </div>
    </section>
  );
}

export function AdoptLink() {
  return (
    <p className="m4-adopt-link">
      Looking to adopt? <a href={PAGES.adopt.href}>Meet the rescued animals</a>
      {" · "}
      <a href={PAGES.donate.href}>Support a rescue</a>
    </p>
  );
}
