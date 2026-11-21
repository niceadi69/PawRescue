
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [fullName, setFullName] = useState('')
  const [organisationName, setOrganisationName] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function loadProfile(user) {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user.id)
      .single()

    if (error) {
      setError(`Profile error: ${error.message}`)
      return
    }

    setProfile(data)

    // Create the NGO record after the account has an authenticated session.
    const orgName = user.user_metadata?.organisation_name

    if (orgName) {
      const { data: existingNGO, error: lookupError } = await supabase
        .from('ngos')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()

      if (lookupError) {
        setError(`NGO lookup failed: ${lookupError.message}`)
        return
      }

      if (!existingNGO) {
        const { error: insertError } = await supabase
          .from('ngos')
          .insert({
            id: user.id,
            organisation_name: orgName,
            description: user.user_metadata?.organisation_description || null,
            verification_status: 'pending',
          })

        if (insertError) {
          setError(`NGO registration failed: ${insertError.message}`)
          return
        }
      }
    }
  }

  useEffect(() => {
    let mounted = true

    async function initialize() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) {
        setError(error.message)
      }

      setSession(data?.session ?? null)
      setLoading(false)
    }

    initialize()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mounted) {
          setSession(newSession)
          setProfile(null)
          setError('')
          setMessage('')
        }
      }
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session?.user) {
      loadProfile(session.user)
    } else {
      setProfile(null)
    }
  }, [session])

  async function handleLogin(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) setError(error.message)

    setSubmitting(false)
  }

  async function handleSignup(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'user',
          organisation_name: organisationName,
          organisation_description: description,
        },
      },
    })

    if (error) {
      setError(error.message)
    } else if (data.session) {
      setMessage('Account created! Your NGO registration is pending approval.')
    } else {
      setMessage(
        'Account created! Check your email to confirm your account. Your NGO registration will be completed when you first sign in.'
      )
    }

    setSubmitting(false)
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
      return
    }

    setSession(null)
    setProfile(null)
    setMessage('')
    setError('')
  }

  if (loading) {
    return <main style={styles.page}>Loading PawRescue...</main>
  }

  if (session) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <h1 style={styles.heading}>🐾 PawRescue</h1>
          <h2>Welcome!</h2>

          <p>Signed in as: {session.user.email}</p>

          {profile ? (
            <>
              <p>Name: {profile.full_name || 'Not provided'}</p>
              <p>Account role: <strong>{profile.role}</strong></p>
              {session.user.user_metadata?.organisation_name && (
                <p>
                  Organisation: {session.user.user_metadata.organisation_name}
                </p>
              )}
              <p>
                NGO approval: <strong>Pending admin verification</strong>
              </p>
            </>
          ) : (
            <p>Loading your profile...</p>
          )}

          {error && <p style={styles.error}>{error}</p>}

          <button style={styles.button} onClick={handleLogout}>
            Log out
          </button>
        </section>
      </main>
    )
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <h1 style={styles.heading}>🐾 PawRescue</h1>
        <p style={styles.subtitle}>Animal Rescue Management Portal</p>

        <div style={styles.tabs}>
          <button
            style={mode === 'login' ? styles.activeTab : styles.tab}
            onClick={() => {
              setMode('login')
              setError('')
              setMessage('')
            }}
          >
            Login
          </button>

          <button
            style={mode === 'signup' ? styles.activeTab : styles.tab}
            onClick={() => {
              setMode('signup')
              setError('')
              setMessage('')
            }}
          >
            NGO Registration
          </button>
        </div>

        <h2>{mode === 'login' ? 'Welcome back' : 'Register your NGO'}</h2>

        <form
          onSubmit={mode === 'login' ? handleLogin : handleSignup}
          style={styles.form}
        >
          {mode === 'signup' && (
            <>
              <label>Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                style={styles.input}
                placeholder="Your full name"
              />

              <label>Organisation name</label>
              <input
                value={organisationName}
                onChange={(e) => setOrganisationName(e.target.value)}
                required
                style={styles.input}
                placeholder="Your NGO's name"
              />

              <label>Organisation description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={styles.input}
                placeholder="Tell us about your organisation"
                rows={3}
              />
            </>
          )}

          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
            placeholder="Enter your email"
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={styles.input}
            placeholder="At least 8 characters"
          />

          <button
            type="submit"
            disabled={submitting}
            style={styles.button}
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in'
                : 'Submit NGO Registration'}
          </button>
        </form>

        {message && <p style={styles.success}>{message}</p>}
        {error && <p style={styles.error}>{error}</p>}
      </section>
    </main>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#f3f6f4',
    fontFamily: 'Arial, sans-serif',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    background: 'white',
    padding: '32px',
    borderRadius: '16px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
  },
  heading: {
    color: '#207a50',
    textAlign: 'center',
    fontSize: '32px',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    margin: '24px 0',
  },
  tab: {
    flex: 1,
    padding: '11px',
    background: '#eee',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  activeTab: {
    flex: 1,
    padding: '11px',
    background: '#207a50',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '20px',
  },
  input: {
    padding: '12px',
    border: '1px solid #ccc',
    borderRadius: '8px',
    fontSize: '15px',
    fontFamily: 'Arial, sans-serif',
  },
  button: {
    padding: '13px',
    background: '#207a50',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
    marginTop: '12px',
  },
  error: {
    color: '#c0392b',
    marginTop: '16px',
  },
  success: {
    color: '#207a50',
    marginTop: '16px',
  },
}

export default App
