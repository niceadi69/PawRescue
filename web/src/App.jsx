import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'
import Member4Links, { AdoptLink } from './member4/Member4Links'

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [ngo, setNgo] = useState(null)
  const [pendingNGOs, setPendingNGOs] = useState([])
  const [assignedReports, setAssignedReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)

  const [mode, setMode] = useState('login')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [reviewing, setReviewing] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [fullName, setFullName] = useState('')
  const [organisationName, setOrganisationName] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function loadPendingNGOs() {
    const { data, error } = await supabase
      .from('ngos')
      .select('id, organisation_name, description, verification_status, created_at')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      setError(`Could not load applications: ${error.message}`)
      return
    }

    setPendingNGOs(data || [])
  }

  async function loadAssignedReports(userId) {
    setReportsLoading(true)

    const { data: assignments, error: assignmentError } = await supabase
      .from('rescue_assignments')
      .select('id, report_id, assignment_status, assigned_at')
      .eq('ngo_id', userId)

    if (assignmentError) {
      setError(`Could not load assignments: ${assignmentError.message}`)
      setReportsLoading(false)
      return
    }

    if (!assignments || assignments.length === 0) {
      setAssignedReports([])
      setReportsLoading(false)
      return
    }

    const reportIds = assignments.map(item => item.report_id)

    const { data: reports, error: reportError } = await supabase
      .from('rescue_reports')
      .select('id, animal_type, description, location_text, urgency, status, created_at')
      .in('id', reportIds)

    if (reportError) {
      setError(`Could not load rescue reports: ${reportError.message}`)
      setReportsLoading(false)
      return
    }

    const combined = assignments.map(assignment => ({
      ...assignment,
      report: reports?.find(report => report.id === assignment.report_id),
    })).filter(item => item.report)

    setAssignedReports(combined)
    setReportsLoading(false)
  }

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

    const orgName = user.user_metadata?.organisation_name

    let { data: ngoData, error: ngoError } = await supabase
      .from('ngos')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (ngoError) {
      setError(`NGO lookup failed: ${ngoError.message}`)
      return
    }

    if (!ngoData && orgName) {
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

      const { data: refreshedNGO } = await supabase
        .from('ngos')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      ngoData = refreshedNGO
    }

    setNgo(ngoData)

    if (data.role === 'admin') {
      await loadPendingNGOs()
    }

    if (data.role === 'ngo') {
      await loadAssignedReports(user.id)
    }
  }

  useEffect(() => {
    let mounted = true

    async function initialize() {
      const { data, error } = await supabase.auth.getSession()

      if (!mounted) return

      if (error) setError(error.message)

      setSession(data?.session ?? null)
      setLoading(false)
    }

    initialize()

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (mounted) {
          setSession(newSession)
          setProfile(null)
          setNgo(null)
          setPendingNGOs([])
          setAssignedReports([])
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
      setNgo(null)
      setPendingNGOs([])
      setAssignedReports([])
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
        'Account created! Confirm your email, then sign in to complete registration.'
      )
    }

    setSubmitting(false)
  }

  async function handleReview(ngoId, decision) {
    setReviewing(ngoId)
    setError('')
    setMessage('')

    const newRole = decision === 'approved' ? 'ngo' : 'user'

    const { data: updatedNGO, error: ngoError } = await supabase
      .from('ngos')
      .update({ verification_status: decision })
      .eq('id', ngoId)
      .eq('verification_status', 'pending')
      .select('id')
      .maybeSingle()

    if (ngoError || !updatedNGO) {
      setError(
        ngoError?.message ||
        'Application was not updated. Check admin permissions.'
      )
      setReviewing(null)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', ngoId)

    if (profileError) {
      await supabase
        .from('ngos')
        .update({ verification_status: 'pending' })
        .eq('id', ngoId)

      setError(`Role update failed: ${profileError.message}`)
      setReviewing(null)
      await loadPendingNGOs()
      return
    }

    setMessage(`NGO application ${decision}.`)
    await loadPendingNGOs()
    setReviewing(null)
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
      return
    }

    setSession(null)
    setProfile(null)
    setNgo(null)
    setPendingNGOs([])
    setAssignedReports([])
    setMessage('')
    setError('')
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <h2>🐾 PawRescue</h2>
        <p>Preparing your workspace...</p>
      </main>
    )
  }

  if (session) {
    if (!profile) {
      return (
        <main className="loading-screen">
          <section className="auth-card">
            <h1>🐾 PawRescue</h1>
            <p>Loading your account...</p>
            {error && <p className="error-message">{error}</p>}
            <button onClick={handleLogout}>Log out</button>
          </section>
        </main>
      )
    }

    return (
      <main className="dashboard">
        <header className="dashboard-header">
          <div>
            <h1 className="brand">🐾 PawRescue</h1>
            <p>Animal Rescue Management Portal</p>
          </div>

          <button className="logout-button" onClick={handleLogout}>
            Log out
          </button>
        </header>

        <section className="welcome-card">
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h2>Welcome, {profile.full_name || session.user.email}</h2>
          <p>
            Signed in as <strong>{profile.role}</strong>
          </p>
        </section>

        {profile.role === 'admin' && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>NGO Applications</h2>
                <p>Review organisations requesting access.</p>
              </div>

              <span className="count">
                {pendingNGOs.length} pending
              </span>
            </div>

            <button
              className="secondary-button"
              onClick={loadPendingNGOs}
            >
              Refresh applications
            </button>

            {pendingNGOs.length === 0 ? (
              <div className="empty-state">
                No pending applications. You're all caught up!
              </div>
            ) : (
              <div className="application-list">
                {pendingNGOs.map(item => (
                  <article className="application-card" key={item.id}>
                    <h3>{item.organisation_name}</h3>
                    <p>{item.description || 'No description provided.'}</p>

                    <p className="small-text">
                      Submitted: {new Date(item.created_at).toLocaleDateString()}
                    </p>

                    <div className="action-row">
                      <button
                        className="approve-button"
                        disabled={reviewing === item.id}
                        onClick={() => handleReview(item.id, 'approved')}
                      >
                        {reviewing === item.id ? 'Processing...' : 'Approve'}
                      </button>

                      <button
                        className="reject-button"
                        disabled={reviewing === item.id}
                        onClick={() => handleReview(item.id, 'rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {profile.role === 'ngo' && (
          <>
            <section className="panel organisation-panel">
              <p className="eyebrow">NGO DASHBOARD</p>
              <h2>{ngo?.organisation_name || 'Your organisation'}</h2>

              <div className="approved-status">
                ✓ Organisation approved
              </div>

              <p>Your organisation account is active.</p>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Assigned Rescue Reports</h2>
                  <p>Reports assigned to your organisation.</p>
                </div>

                <span className="count">
                  {assignedReports.length} assigned
                </span>
              </div>

              <button
                className="secondary-button"
                onClick={() => loadAssignedReports(session.user.id)}
              >
                Refresh reports
              </button>

              {reportsLoading ? (
                <div className="empty-state">
                  Loading rescue reports...
                </div>
              ) : assignedReports.length === 0 ? (
                <div className="empty-state">
                  <h3>No assigned reports yet</h3>
                  <p>
                    New rescue assignments will appear here when an
                    administrator assigns a case to your organisation.
                  </p>
                </div>
              ) : (
                <div className="report-list">
                  {assignedReports.map(item => (
                    <article className="report-card" key={item.id}>
                      <div className="panel-header">
                        <h3>
                          🐾 {item.report.animal_type || 'Animal report'}
                        </h3>

                        <span className={`urgency-badge ${(
                          item.report.urgency || 'unknown'
                        ).toLowerCase()}`}>
                          {item.report.urgency || 'Unknown urgency'}
                        </span>
                      </div>

                      <p>{item.report.description || 'No description provided.'}</p>

                      <div className="report-meta">
                        <span>
                          <strong>Location:</strong>{' '}
                          {item.report.location_text || 'Not provided'}
                        </span>

                        <span>
                          <strong>Report:</strong>{' '}
                          {item.report.status || 'Unknown'}
                        </span>

                        <span>
                          <strong>Assignment:</strong>{' '}
                          {item.assignment_status || 'Assigned'}
                        </span>
                      </div>

                      <p className="small-text">
                        Reported: {new Date(item.report.created_at).toLocaleString()}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {profile.role === 'user' && (
          <section className="panel">
            <h2>Registration status</h2>

            {ngo ? (
              <>
                <p><strong>{ngo.organisation_name}</strong></p>

                <div className={
                  ngo.verification_status === 'rejected'
                    ? 'rejected-status'
                    : 'pending-status'
                }>
                  {ngo.verification_status === 'rejected'
                    ? 'Application rejected'
                    : '⏳ Pending admin verification'}
                </div>
              </>
            ) : (
              <p>You are signed in with a standard user account.</p>
            )}
          </section>
        )}

        <Member4Links role={profile.role} />

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <span className="brand-icon">🐾</span>
          <h1>PawRescue</h1>
          <p>Animal Rescue Management Portal</p>
        </div>

        <div className="tabs">
          <button
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => {
              setMode('login')
              setError('')
              setMessage('')
            }}
          >
            Login
          </button>

          <button
            className={mode === 'signup' ? 'tab active' : 'tab'}
            onClick={() => {
              setMode('signup')
              setError('')
              setMessage('')
            }}
          >
            NGO Registration
          </button>
        </div>

        <h2 className="auth-heading">
          {mode === 'login' ? 'Welcome back' : 'Register your NGO'}
        </h2>

        <form
          onSubmit={mode === 'login' ? handleLogin : handleSignup}
          className="form-stack"
        >
          {mode === 'signup' && (
            <>
              <label>Full name</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                placeholder="Your full name"
              />

              <label>Organisation name</label>
              <input
                value={organisationName}
                onChange={e => setOrganisationName(e.target.value)}
                required
                placeholder="Your NGO's name"
              />

              <label>Organisation description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Tell us about your organisation"
                rows={3}
              />
            </>
          )}

          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            placeholder="Enter your email"
          />

          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="At least 8 characters"
          />

          <button type="submit" disabled={submitting} className="primary-button">
            {submitting
              ? 'Please wait...'
              : mode === 'login'
                ? 'Sign in'
                : 'Submit NGO Registration'}
          </button>
        </form>

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}

        <AdoptLink />
      </section>
    </main>
  )
}

export default App;
