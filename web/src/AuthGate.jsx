import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "./supabaseClient";
import "./auth.css";

// Shows the NGO sign-in screen until a staff member is logged in.
// Without Supabase keys it shows the dashboard with sample data.
export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabase) return undefined;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession)
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) return children;

  if (checking) {
    return (
      <div className="auth-screen">
        <p className="auth-muted">Loading…</p>
      </div>
    );
  }

  if (!session) return <LoginForm />;

  return children;
}

function LoginForm() {
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
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">
          🐾 Paw<span>Rescue</span>
        </div>
        <h1>Rescue team sign in</h1>
        <p className="auth-muted">
          For NGO staff and vets. Citizens report animals through the Telegram
          bot.
        </p>

        <label className="auth-label">
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            required
          />
        </label>

        <label className="auth-label">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        <button className="auth-button" type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
