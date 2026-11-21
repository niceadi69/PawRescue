// Member 4 (Rhythm): vet desk, adoption desk and adoption portal
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

const ROLE_LABELS = {
  veterinarian: "vets",
  ngo: "NGO staff",
  admin: "admins",
};

// Sign-in screen plus a role check. Renders children({ session, profile })
// only for users whose profiles.role is in allowedRoles.
export default function StaffGate({ title, allowedRoles, children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (active) setSession(nextSession);
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfileError("");
      return undefined;
    }

    let active = true;

    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setProfileError(error.message);
        setProfile(
          data || { id: session.user.id, full_name: null, role: "user" }
        );
      });

    return () => {
      active = false;
    };
  }, [session]);

  if (checking || (session && !profile && !profileError)) {
    return (
      <div className="m4-center">
        <p className="m4-muted">Loading…</p>
      </div>
    );
  }

  if (!session) return <LoginForm title={title} />;

  if (!profile || !allowedRoles.includes(profile.role)) {
    const who = allowedRoles.map((role) => ROLE_LABELS[role] || role);

    return (
      <div className="m4-center">
        <div className="m4-card m4-auth">
          <div className="m4-brand">
            🐾 Paw<span>Rescue</span>
          </div>
          <h1>Not available for this account</h1>
          <p className="m4-muted">
            {title} is for {who.join(" and ")}. You're signed in as{" "}
            {session.user.email}
            {profile?.role ? ` (${profile.role})` : ""}.
          </p>
          {profileError && <p className="m4-error">{profileError}</p>}
          <button
            className="m4-button"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return children({ session, profile });
}

function LoginForm({ title }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setBusy(false);
    }
  };

  return (
    <div className="m4-center">
      <form className="m4-card m4-auth" onSubmit={handleSubmit}>
        <div className="m4-brand">
          🐾 Paw<span>Rescue</span>
        </div>
        <h1>{title}</h1>
        <p className="m4-muted">Sign in with your PawRescue staff account.</p>

        <label className="m4-label">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="m4-label">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="m4-error">{error}</p>}

        <button className="m4-button" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export function TopBar({ title, profile, session }) {
  return (
    <header className="m4-topbar">
      <div className="m4-brand">
        🐾 Paw<span>Rescue</span>
        <span className="m4-topbar-title">{title}</span>
      </div>
      <div className="m4-topbar-user">
        <span>{profile.full_name || session.user.email}</span>
        <button
          className="m4-button m4-button-quiet"
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
