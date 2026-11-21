
import Home from './pages/Home'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './App.css'
import Member4Links, { AdoptLink } from './member4/Member4Links'

function TriageDetails({ report }) {
  const analysis = report?.ai_analysis

  if (report?.ai_status !== 'completed' || !analysis) {
    return (
      <div className="triage-panel">
        <h4>🤖 AI Triage</h4>
        <p>AI analysis unavailable. Manual human assessment required.</p>
      </div>
    )
  }

  const confidence = Math.round((Number(analysis.confidence) || 0) * 100)

  return (
    <div className="triage-panel">
      <div className="triage-heading">
        <h4>🤖 AI Triage Analysis</h4>
        <span className="triage-confidence">{confidence}% confidence</span>
      </div>

      <div className="triage-meta">
        <span>
          <strong>Severity:</strong> {report.severity || analysis.severity || 'Unknown'}
        </span>
        <span>
          <strong>Urgency:</strong> {report.urgency || analysis.urgency || 'Unknown'}
        </span>
      </div>

      <div className="triage-section">
        <strong>Visible concerns</strong>
        {analysis.visible_concerns?.length > 0 ? (
          <ul>
            {analysis.visible_concerns.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p>No specific concerns identified by AI.</p>
        )}
      </div>

      <div className="triage-section">
        <strong>Recommended action</strong>
        <p>{analysis.recommended_action || 'Human assessment required.'}</p>
      </div>

      {analysis.uncertainties?.length > 0 && (
        <div className="triage-section">
          <strong>Uncertainties</strong>
          <ul>
            {analysis.uncertainties.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="human-review-warning">
        ⚠️ AI triage is advisory, not a veterinary diagnosis. Human review is required.
      </div>
    </div>
  )
}

const MEDICAL_STATUS_LABELS = {
  under_observation: 'Under observation',
  under_treatment: 'Under treatment',
  recovering: 'Recovering',
  recovered: 'Recovered',
  cleared_for_adoption: 'Cleared for adoption'
}

const LOGIN_ROLES = [
  { value: 'user', label: 'General / Applicant', icon: '👤' },
  { value: 'ngo', label: 'NGO', icon: '🏥' },
  { value: 'volunteer', label: 'Volunteer', icon: '🙋' },
  { value: 'admin', label: 'Admin', icon: '🛡️' },
  { value: 'veterinarian', label: 'Veterinarian', icon: '🩺' }
]

function MedicalProgress({ report }) {
  const medical = report?.latestMedicalRecord

  return (
    <div className="triage-panel medical-progress">
      <h4>🏥 Veterinary Treatment Progress</h4>

      {!medical ? (
        <p>
          No veterinary update yet. Waiting for the assigned vet to examine this animal.
        </p>
      ) : (
        <>
          <p>
            <strong>Medical status:</strong>{' '}
            {MEDICAL_STATUS_LABELS[medical.medical_status] ||
              medical.medical_status ||
              'Unknown'}
          </p>

          {medical.diagnosis && (
            <p><strong>Diagnosis:</strong> {medical.diagnosis}</p>
          )}

          {medical.observations && (
            <p><strong>Observations:</strong> {medical.observations}</p>
          )}

          {medical.treatment && (
            <p><strong>Treatment:</strong> {medical.treatment}</p>
          )}

          {medical.medication && (
            <p><strong>Medication:</strong> {medical.medication}</p>
          )}

          {medical.follow_up && (
            <p><strong>Follow-up:</strong> {medical.follow_up}</p>
          )}

          <p className="small-text">
            Last updated: {new Date(medical.created_at).toLocaleString()}
          </p>

          {medical.medical_status === 'cleared_for_adoption' && (
            <div className="approved-status">
              ✓ Vet has cleared this animal for adoption.
              Visit the Adoption Desk to publish its listing.
            </div>
          )}

          {medical.medical_status === 'recovered' && (
            <div className="pending-status">
              Animal marked recovered. Veterinary adoption clearance is still required.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [ngo, setNgo] = useState(null)
  const [volunteer, setVolunteer] = useState(null)
  const [vetApplication, setVetApplication] = useState(null)
  const [showAuth, setShowAuth] = useState(false)

  const [pendingNGOs, setPendingNGOs] = useState([])
  const [pendingVolunteers, setPendingVolunteers] = useState([])
  const [pendingVetApplications, setPendingVetApplications] = useState([])

  const [assignedReports, setAssignedReports] = useState([])
  const [availableOffers, setAvailableOffers] = useState([])

  const [reportsLoading, setReportsLoading] = useState(false)
  const [offersLoading, setOffersLoading] = useState(false)
  const [claimingOffer, setClaimingOffer] = useState(null)

  const [serviceAreas, setServiceAreas] = useState([])
  const [newArea, setNewArea] = useState('')
  const [areasLoading, setAreasLoading] = useState(false)
  const [areaSubmitting, setAreaSubmitting] = useState(false)

  const [mode, setMode] = useState('login')
  const [loginRole, setLoginRole] = useState('user')

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

  // Volunteer application fields
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [district, setDistrict] = useState('')
  const [governmentIdType, setGovernmentIdType] = useState('')
  const [idFile, setIdFile] = useState(null)
  const [availability, setAvailability] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)

  // Veterinarian application fields
  const [vetQualification, setVetQualification] = useState('')
  const [vetClinicName, setVetClinicName] = useState('')

  function clearAuthMessages() {
    setError('')
    setMessage('')
  }

  function resetDashboardData() {
    setProfile(null)
    setNgo(null)
    setVolunteer(null)
    setVetApplication(null)
    setPendingNGOs([])
    setPendingVolunteers([])
    setPendingVetApplications([])
    setAssignedReports([])
    setAvailableOffers([])
    setServiceAreas([])
  }

  async function loadPendingNGOs() {
    const { data, error } = await supabase
      .from('ngos')
      .select('id, organisation_name, description, verification_status, created_at')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      setError(`Could not load NGO applications: ${error.message}`)
      return
    }

    setPendingNGOs(data || [])
  }

  async function loadPendingVolunteers() {
    const { data, error } = await supabase
      .from('volunteers')
      .select('id, phone, city, district, government_id_type, government_id_path, availability, verification_status, created_at')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      setError(`Could not load volunteer applications: ${error.message}`)
      return
    }

    setPendingVolunteers(data || [])
  }

  async function loadPendingVetApplications() {
    const { data, error } = await supabase
      .from('veterinarian_applications')
      .select('id, full_name, qualification, clinic_name, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) {
      setError(`Could not load veterinarian applications: ${error.message}`)
      return
    }

    setPendingVetApplications(data || [])
  }

  async function loadVetApplication(userId) {
    const { data, error } = await supabase
      .from('veterinarian_applications')
      .select('id, full_name, qualification, clinic_name, status, created_at')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      setError(`Could not load veterinarian application: ${error.message}`)
      return
    }

    setVetApplication(data)
  }

  async function loadVolunteer(userId) {
    const { data, error } = await supabase
      .from('volunteers')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      setError(`Could not load volunteer application: ${error.message}`)
      return
    }

    setVolunteer(data)
  }

  async function loadAssignedReports(userId) {
    setReportsLoading(true)
    setError('')

    const { data: assignments, error: assignmentError } = await supabase
      .from('rescue_assignments')
      .select('id, report_id, assignment_status, assigned_at')
      .eq('ngo_id', userId)

    if (assignmentError) {
      setError(`Could not load assignments: ${assignmentError.message}`)
      setReportsLoading(false)
      return
    }

    if (!assignments?.length) {
      setAssignedReports([])
      setReportsLoading(false)
      return
    }

    const reportIds = assignments.map(item => item.report_id)

    const { data: reports, error: reportError } = await supabase
      .from('rescue_reports')
      .select(`
        id,
        animal_type,
        description,
        location_text,
        urgency,
        severity,
        ai_analysis,
        ai_status,
        status,
        created_at,
        medical_records (
          observations,
          diagnosis,
          treatment,
          medication,
          follow_up,
          medical_status,
          created_at
        )
      `)
      .in('id', reportIds)

    if (reportError) {
      setError(`Could not load rescue reports: ${reportError.message}`)
      setReportsLoading(false)
      return
    }

    const updatedReports = assignments
      .map(assignment => {
        const report = reports?.find(
          item => item.id === assignment.report_id
        )

        if (!report) return null

        const medicalRecords = [...(report.medical_records || [])].sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime()
        )

        return {
          ...assignment,
          report: {
            ...report,
            latestMedicalRecord: medicalRecords[0] || null
          }
        }
      })
      .filter(Boolean)

    setAssignedReports(updatedReports)
    setReportsLoading(false)
  }

  async function loadAvailableOffers(userId) {
    setOffersLoading(true)

    const { data, error } = await supabase
      .from('rescue_case_offers')
      .select(`
        id, status, offered_at,
        report:rescue_reports (
          id, animal_type, description, location_text, urgency,
          severity, ai_analysis, ai_status, status, created_at
        )
      `)
      .eq('ngo_id', userId)
      .eq('status', 'offered')
      .order('offered_at', { ascending: false })

    if (error) {
      setError(`Could not load available cases: ${error.message}`)
      setOffersLoading(false)
      return
    }

    setAvailableOffers((data || []).filter(offer => offer.report))
    setOffersLoading(false)
  }

  async function handleClaimOffer(offerId) {
    setClaimingOffer(offerId)
    setError('')
    setMessage('')

    const { error } = await supabase.rpc('claim_rescue_offer', {
      p_offer_id: offerId,
    })

    if (error) {
      setError(`Could not claim this case: ${error.message}`)
      await loadAvailableOffers(session.user.id)
      setClaimingOffer(null)
      return
    }

    setMessage(
      'Rescue case successfully claimed! Your organisation is now assigned.'
    )

    await Promise.all([
      loadAvailableOffers(session.user.id),
      loadAssignedReports(session.user.id),
    ])

    setClaimingOffer(null)
  }

  async function loadServiceAreas(userId) {
    setAreasLoading(true)

    const { data, error } = await supabase
      .from('ngo_service_areas')
      .select('id, area_name, created_at')
      .eq('ngo_id', userId)
      .order('area_name', { ascending: true })

    if (error) {
      setError(`Could not load service areas: ${error.message}`)
      setAreasLoading(false)
      return
    }

    setServiceAreas(data || [])
    setAreasLoading(false)
  }

  async function handleAddArea(event) {
    event.preventDefault()
    const areaName = newArea.trim()

    if (!areaName) {
      setError('Please enter an area name.')
      return
    }

    setAreaSubmitting(true)
    setError('')
    setMessage('')

    const { error } = await supabase
      .from('ngo_service_areas')
      .insert({
        ngo_id: session.user.id,
        area_name: areaName
      })

    if (error) {
      setError(
        error.code === '23505'
          ? 'This service area has already been added.'
          : `Could not add service area: ${error.message}`
      )
      setAreaSubmitting(false)
      return
    }

    setNewArea('')
    setMessage(`Added ${areaName} to your service areas.`)
    await loadServiceAreas(session.user.id)
    setAreaSubmitting(false)
  }

  async function handleRemoveArea(areaId) {
    setError('')
    setMessage('')

    const { error } = await supabase
      .from('ngo_service_areas')
      .delete()
      .eq('id', areaId)
      .eq('ngo_id', session.user.id)

    if (error) {
      setError(`Could not remove service area: ${error.message}`)
      return
    }

    setMessage('Service area removed.')
    await loadServiceAreas(session.user.id)
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
      await Promise.all([
        loadPendingNGOs(),
        loadPendingVolunteers(),
        loadPendingVetApplications()
      ])
    }

    if (data.role === 'ngo') {
      await Promise.all([
        loadAssignedReports(user.id),
        loadAvailableOffers(user.id),
        loadServiceAreas(user.id),
      ])
    }

    if (data.role === 'user' || data.role === 'volunteer') {
      await Promise.all([
        loadVolunteer(user.id),
        loadVetApplication(user.id)
      ])
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
          resetDashboardData()
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
      resetDashboardData()
    }
  }, [session])

  // Role-specific login
  async function handleLogin(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        })

      if (loginError) {
        setError(loginError.message)
        return
      }

      const { data: account, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profileError || !account) {
        await supabase.auth.signOut()
        setError(
          profileError?.message ||
          'Could not verify your account role.'
        )
        return
      }

      if (account.role !== loginRole) {
        await supabase.auth.signOut()

        const roleNames = {
          user: 'General / Applicant',
          ngo: 'NGO',
          volunteer: 'Volunteer',
          admin: 'Admin',
          veterinarian: 'Veterinarian',
        }

        setError(
          `This account is not registered as ${roleNames[loginRole]}. ` +
          `Your account role is ${roleNames[account.role] || account.role}. ` +
          'Please select the correct login portal.'
        )
        return
      }

      setMessage('Login successful!')
    } catch (err) {
      setError(err.message || 'Something went wrong during login.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignup(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')

    const isNGO = mode === 'signup'
    const isVolunteer = mode === 'volunteer'
    const isVeterinarian = mode === 'veterinarian'

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'user',
          registration_type: isNGO
            ? 'ngo'
            : isVolunteer
              ? 'volunteer'
              : isVeterinarian
                ? 'veterinarian'
                : 'user',
          ...(isNGO && {
            organisation_name: organisationName,
            organisation_description: description,
          }),
        },
      },
    })

    if (error) {
      setError(error.message)
    } else if (data.session) {
      setMessage(
        isNGO
          ? 'Account created! Your NGO registration is pending approval.'
          : isVolunteer
            ? 'Account created! You can now continue to the volunteer section.'
            : isVeterinarian
              ? 'Account created! Sign in and submit your veterinarian application for admin review.'
              : 'Account created successfully!'
      )
    } else {
      setMessage(
        isVeterinarian
          ? 'Account created! Confirm your email, sign in, and submit your veterinarian application.'
          : 'Account created! Confirm your email, then sign in to continue.'
      )
    }

    setSubmitting(false)
  }

  async function handleVetApplication(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    const qualification = vetQualification.trim()
    const clinic = vetClinicName.trim()

    if (!qualification || !clinic) {
      setError('Please provide your qualification and clinic details.')
      return
    }

    setSubmitting(true)

    const { error } = await supabase
      .from('veterinarian_applications')
      .insert({
        id: session.user.id,
        full_name: profile.full_name || session.user.email,
        qualification,
        clinic_name: clinic,
        status: 'pending'
      })

    if (error) {
      setError(
        error.code === '23505'
          ? 'A veterinarian application already exists for this account.'
          : `Could not submit veterinarian application: ${error.message}`
      )
      setSubmitting(false)
      return
    }

    setVetApplication({
      id: session.user.id,
      full_name: profile.full_name || session.user.email,
      qualification,
      clinic_name: clinic,
      status: 'pending'
    })

    setMessage('Veterinarian application submitted successfully. An admin must review it before access is granted.')
    setSubmitting(false)
  }

  async function handleVetReview(applicationId, decision) {
    setReviewing(applicationId)
    setError('')
    setMessage('')

    const { data: application, error: fetchError } = await supabase
      .from('veterinarian_applications')
      .select('id, full_name, qualification, clinic_name, status')
      .eq('id', applicationId)
      .eq('status', 'pending')
      .maybeSingle()

    if (fetchError || !application) {
      setError(fetchError?.message || 'This application is no longer pending.')
      setReviewing(null)
      await loadPendingVetApplications()
      return
    }

    if (decision === 'rejected') {
      const { error: rejectError } = await supabase
        .from('veterinarian_applications')
        .update({ status: 'rejected' })
        .eq('id', applicationId)
        .eq('status', 'pending')

      if (rejectError) {
        setError(`Could not reject application: ${rejectError.message}`)
      } else {
        setMessage('Veterinarian application rejected.')
      }

      await loadPendingVetApplications()
      setReviewing(null)
      return
    }

    const { error: vetInsertError } = await supabase
      .from('veterinarians')
      .insert({
        id: application.id,
        qualification: application.qualification,
        clinic_name: application.clinic_name
      })

    if (vetInsertError && vetInsertError.code !== '23505') {
      setError(`Could not create veterinarian profile: ${vetInsertError.message}`)
      setReviewing(null)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: 'veterinarian' })
      .eq('id', applicationId)

    if (profileError) {
      if (!vetInsertError) {
        await supabase
          .from('veterinarians')
          .delete()
          .eq('id', applicationId)
      }

      setError(`Could not activate veterinarian account: ${profileError.message}`)
      setReviewing(null)
      return
    }

    const { error: approvalError } = await supabase
      .from('veterinarian_applications')
      .update({ status: 'approved' })
      .eq('id', applicationId)
      .eq('status', 'pending')

    if (approvalError) {
      setError(
        `Veterinarian profile was created, but application status could not be updated: ${approvalError.message}. Please refresh and check the account before retrying.`
      )
      setReviewing(null)
      await loadPendingVetApplications()
      return
    }

    setMessage('Veterinarian application approved. The account can now access the veterinarian dashboard.')
    await loadPendingVetApplications()
    setReviewing(null)
  }

  async function handleVolunteerApplication(event) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (!ageConfirmed) {
      setError(
        'Formal volunteer applications require applicants to be at least 18 years old.'
      )
      return
    }

    if (!termsAccepted) {
      setError('Please accept the volunteer terms before submitting.')
      return
    }

    if (!idFile) {
      setError('Please select your verification document.')
      return
    }

    if (idFile.size > 5 * 1024 * 1024) {
      setError('The verification document must be smaller than 5 MB.')
      return
    }

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'application/pdf'
    ]

    if (!allowedTypes.includes(idFile.type)) {
      setError('Please upload a JPG, PNG or PDF document.')
      return
    }

    setSubmitting(true)

    const userId = session.user.id
    const extension = idFile.name.split('.').pop()?.toLowerCase() || 'file'
    const filePath = `${userId}/${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('volunteer-ids')
      .upload(filePath, idFile, {
        upsert: false,
        contentType: idFile.type,
      })

    if (uploadError) {
      setError(`Document upload failed: ${uploadError.message}`)
      setSubmitting(false)
      return
    }

    const { error: insertError } = await supabase
      .from('volunteers')
      .insert({
        id: userId,
        phone: phone.trim(),
        city: city.trim(),
        district: district.trim(),
        government_id_type: governmentIdType,
        government_id_path: filePath,
        availability: availability.trim() || null,
        verification_status: 'pending',
        terms_accepted: true,
        age_confirmed: true,
      })

    if (insertError) {
      await supabase.storage
        .from('volunteer-ids')
        .remove([filePath])

      setError(`Application could not be submitted: ${insertError.message}`)
      setSubmitting(false)
      return
    }

    setVolunteer({
      phone: phone.trim(),
      city: city.trim(),
      district: district.trim(),
      verification_status: 'pending',
    })

    setMessage('Your volunteer application has been submitted for admin review.')
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

  async function handleVolunteerReview(volunteerId, decision) {
    setReviewing(volunteerId)
    setError('')
    setMessage('')

    const { data: updated, error } = await supabase
      .from('volunteers')
      .update({ verification_status: decision })
      .eq('id', volunteerId)
      .eq('verification_status', 'pending')
      .select('id')
      .maybeSingle()

    if (error || !updated) {
      setError(
        error?.message ||
        'Volunteer application was not updated. Check admin permissions.'
      )
      setReviewing(null)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: decision === 'approved' ? 'volunteer' : 'user'
      })
      .eq('id', volunteerId)

    if (profileError) {
      await supabase
        .from('volunteers')
        .update({ verification_status: 'pending' })
        .eq('id', volunteerId)

      setError(`Role update failed: ${profileError.message}`)
      setReviewing(null)
      await loadPendingVolunteers()
      return
    }

    setMessage(`Volunteer application ${decision}.`)
    await loadPendingVolunteers()
    setReviewing(null)
  }

  async function handleViewDocument(path) {
    setError('')

    const { data, error } = await supabase.storage
      .from('volunteer-ids')
      .createSignedUrl(path, 60)

    if (error) {
      setError(`Could not open verification document: ${error.message}`)
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setError(error.message)
      return
    }

    setSession(null)
    resetDashboardData()
    setMessage('')
    setError('')
    setShowAuth(false)
    setMode('login')
    setLoginRole('user')
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
            <button
              type="button"
              onClick={() => setShowAuth(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#287348',
                cursor: 'pointer',
                fontWeight: 700,
                marginBottom: '16px'
              }}
            >
              ← Back to homepage
            </button>

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
          <p>Signed in as <strong>{profile.role}</strong></p>
        </section>

        {profile.role === 'admin' && (
          <>
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
                  No pending NGO applications.
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

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>🙋 Volunteer Applications</h2>
                  <p>Review volunteer details and verification documents.</p>
                </div>

                <span className="count">
                  {pendingVolunteers.length} pending
                </span>
              </div>

              <button
                className="secondary-button"
                onClick={loadPendingVolunteers}
              >
                Refresh volunteer applications
              </button>

              {pendingVolunteers.length === 0 ? (
                <div className="empty-state">
                  No pending volunteer applications.
                </div>
              ) : (
                <div className="application-list">
                  {pendingVolunteers.map(item => (
                    <article className="application-card" key={item.id}>
                      <h3>Volunteer application</h3>
                      <p><strong>Phone:</strong> {item.phone}</p>
                      <p><strong>City:</strong> {item.city}</p>
                      <p><strong>District:</strong> {item.district}</p>
                      <p><strong>ID type:</strong> {item.government_id_type}</p>
                      <p>
                        <strong>Availability:</strong>{' '}
                        {item.availability || 'Not specified'}
                      </p>

                      <p className="small-text">
                        Submitted: {new Date(item.created_at).toLocaleDateString()}
                      </p>

                      <button
                        className="secondary-button"
                        onClick={() => handleViewDocument(item.government_id_path)}
                      >
                        View verification document
                      </button>

                      <div className="action-row">
                        <button
                          className="approve-button"
                          disabled={reviewing === item.id}
                          onClick={() => handleVolunteerReview(item.id, 'approved')}
                        >
                          {reviewing === item.id ? 'Processing...' : 'Approve'}
                        </button>

                        <button
                          className="reject-button"
                          disabled={reviewing === item.id}
                          onClick={() => handleVolunteerReview(item.id, 'rejected')}
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>🩺 Veterinarian Applications</h2>
                  <p>Review professional qualifications and clinic details before granting dashboard access.</p>
                </div>

                <span className="count">
                  {pendingVetApplications.length} pending
                </span>
              </div>

              <button
                className="secondary-button"
                onClick={loadPendingVetApplications}
              >
                Refresh veterinarian applications
              </button>

              {pendingVetApplications.length === 0 ? (
                <div className="empty-state">
                  No pending veterinarian applications.
                </div>
              ) : (
                <div className="application-list">
                  {pendingVetApplications.map(item => (
                    <article className="application-card" key={item.id}>
                      <h3>{item.full_name}</h3>

                      <p>
                        <strong>Qualification:</strong> {item.qualification}
                      </p>

                      <p>
                        <strong>Clinic:</strong> {item.clinic_name}
                      </p>

                      <p className="small-text">
                        Submitted: {new Date(item.created_at).toLocaleDateString()}
                      </p>

                      <div className="action-row">
                        <button
                          className="approve-button"
                          disabled={reviewing === item.id}
                          onClick={() => handleVetReview(item.id, 'approved')}
                        >
                          {reviewing === item.id ? 'Processing...' : 'Approve'}
                        </button>

                        <button
                          className="reject-button"
                          disabled={reviewing === item.id}
                          onClick={() => handleVetReview(item.id, 'rejected')}
                        >
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {profile.role === 'ngo' && (
          <>
            <section className="panel organisation-panel">
              <p className="eyebrow">NGO DASHBOARD</p>
              <h2>{ngo?.organisation_name || 'Your organisation'}</h2>
              <div className="approved-status">✓ Organisation approved</div>
              <p>Your organisation account is active.</p>
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>📍 Your Service Areas</h2>
                  <p>
                    Add the neighbourhoods, cities or districts your organisation can respond to.
                  </p>
                </div>

                <span className="count">
                  {serviceAreas.length} areas
                </span>
              </div>

              <form onSubmit={handleAddArea} className="service-area-form">
                <label htmlFor="service-area">Add an area</label>

                <div className="service-area-input-row">
                  <input
                    id="service-area"
                    value={newArea}
                    onChange={e => setNewArea(e.target.value)}
                    placeholder="e.g. Patiala, Urban Estate"
                    maxLength={100}
                    required
                  />

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={areaSubmitting}
                  >
                    {areaSubmitting ? 'Adding...' : 'Add area'}
                  </button>
                </div>
              </form>

              {areasLoading ? (
                <div className="empty-state">
                  Loading service areas...
                </div>
              ) : serviceAreas.length === 0 ? (
                <div className="empty-state">
                  <h3>No service areas added</h3>
                  <p>Add the areas your NGO serves.</p>
                </div>
              ) : (
                <div className="service-area-list">
                  {serviceAreas.map(area => (
                    <div className="service-area-item" key={area.id}>
                      <span>📍 {area.area_name}</span>

                      <button
                        type="button"
                        className="remove-area-button"
                        onClick={() => handleRemoveArea(area.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>🚨 Available Rescue Cases</h2>
                  <p>
                    Cases offered to your organisation. The first approved NGO to claim a case gets the assignment.
                  </p>
                </div>

                <span className="count">
                  {availableOffers.length} available
                </span>
              </div>

              <button
                className="secondary-button"
                onClick={() => loadAvailableOffers(session.user.id)}
                disabled={offersLoading}
              >
                {offersLoading ? 'Refreshing...' : 'Refresh available cases'}
              </button>

              {offersLoading ? (
                <div className="empty-state">
                  Loading available cases...
                </div>
              ) : availableOffers.length === 0 ? (
                <div className="empty-state">
                  <h3>No available cases right now</h3>
                  <p>Cases offered to your organisation will appear here.</p>
                </div>
              ) : (
                <div className="report-list">
                  {availableOffers.map(offer => (
                    <article className="report-card" key={offer.id}>
                      <div className="panel-header">
                        <h3>🐾 {offer.report.animal_type || 'Animal report'}</h3>

                        <span className={`urgency-badge ${(offer.report.urgency || 'unknown').toLowerCase()}`}>
                          {offer.report.urgency || 'Unknown urgency'}
                        </span>
                      </div>

                      <p>
                        {offer.report.description || 'No description provided.'}
                      </p>

                      <TriageDetails report={offer.report} />

                      <div className="report-meta">
                        <span>
                          <strong>Location:</strong>{' '}
                          {offer.report.location_text || 'Not provided'}
                        </span>

                        <span>
                          <strong>Report status:</strong>{' '}
                          {offer.report.status || 'Unknown'}
                        </span>
                      </div>

                      <p className="small-text">
                        Offered: {new Date(offer.offered_at).toLocaleString()}
                      </p>

                      <button
                        className="approve-button"
                        disabled={claimingOffer !== null}
                        onClick={() => handleClaimOffer(offer.id)}
                      >
                        {claimingOffer === offer.id ? 'Claiming case...' : 'Accept Case'}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Assigned Rescue Reports</h2>
                  <p>
                    View rescue reports and veterinary treatment progress for your organisation.
                  </p>
                </div>

                <span className="count">
                  {assignedReports.length} assigned
                </span>
              </div>

              <button
                className="secondary-button"
                onClick={() => loadAssignedReports(session.user.id)}
                disabled={reportsLoading}
              >
                {reportsLoading ? 'Refreshing...' : 'Refresh reports'}
              </button>

              {reportsLoading ? (
                <div className="empty-state">
                  Loading rescue reports...
                </div>
              ) : assignedReports.length === 0 ? (
                <div className="empty-state">
                  <h3>No assigned reports yet</h3>
                  <p>Cases your organisation accepts will appear here.</p>
                </div>
              ) : (
                <div className="report-list">
                  {assignedReports.map(item => (
                    <article className="report-card" key={item.id}>
                      <div className="panel-header">
                        <h3>🐾 {item.report.animal_type || 'Animal report'}</h3>

                        <span className={`urgency-badge ${(item.report.urgency || 'unknown').toLowerCase()}`}>
                          {item.report.urgency || 'Unknown urgency'}
                        </span>
                      </div>

                      <p>
                        {item.report.description || 'No description provided.'}
                      </p>

                      <TriageDetails report={item.report} />

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

                      <MedicalProgress report={item.report} />

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

        {profile.role === 'volunteer' && (
          <section className="panel">
            <p className="eyebrow">VOLUNTEER DASHBOARD</p>
            <h2>🙋 Welcome to the PawRescue volunteer team!</h2>

            <div className="approved-status">
              ✓ Volunteer application approved
            </div>

            <p>Your volunteer account is active.</p>
            <p><strong>City:</strong> {volunteer?.city || 'Not available'}</p>
            <p><strong>District:</strong> {volunteer?.district || 'Not available'}</p>
            <p><strong>Availability:</strong> {volunteer?.availability || 'Not specified'}</p>
            <p>Thank you for supporting animal welfare.</p>
          </section>
        )}

        {profile.role === 'veterinarian' && (
          <section className="panel">
            <p className="eyebrow">VETERINARIAN ACCESS</p>
            <h2>🩺 Welcome to PawRescue</h2>

            <div className="approved-status">
              ✓ Veterinarian account approved
            </div>

            <p>
              Your veterinarian account is active. You can access the veterinarian dashboard
              through the workspace links below.
            </p>
          </section>
        )}

        {profile.role === 'user' && (
          <section className="panel">
            {ngo ? (
              <>
                <h2>NGO registration status</h2>
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
            ) : vetApplication ? (
              <>
                <h2>🩺 Veterinarian application status</h2>

                <p><strong>Qualification:</strong> {vetApplication.qualification}</p>
                <p><strong>Clinic:</strong> {vetApplication.clinic_name}</p>

                <div className={
                  vetApplication.status === 'rejected'
                    ? 'rejected-status'
                    : vetApplication.status === 'approved'
                      ? 'approved-status'
                      : 'pending-status'
                }>
                  {vetApplication.status === 'rejected'
                    ? 'Application rejected'
                    : vetApplication.status === 'approved'
                      ? 'Application approved'
                      : '⏳ Pending admin verification'}
                </div>

                <p>
                  Your application must be reviewed before veterinarian dashboard access is granted.
                </p>
              </>
            ) : volunteer ? (
              <>
                <h2>Volunteer application status</h2>

                <div className={
                  volunteer.verification_status === 'rejected'
                    ? 'rejected-status'
                    : 'pending-status'
                }>
                  {volunteer.verification_status === 'rejected'
                    ? 'Application rejected'
                    : '⏳ Pending admin verification'}
                </div>

                <p>
                  Your application has been received. An admin must review it before volunteer access is granted.
                </p>
              </>
            ) : (
              <>
                <h2>Volunteer registration</h2>

                <p>
                  Formal PawRescue volunteer applications are available to adults aged 18 or older.
                </p>

                <form
                  onSubmit={handleVolunteerApplication}
                  className="form-stack"
                >
                  <label>Phone number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                    placeholder="Your contact number"
                  />

                  <label>City</label>
                  <input
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    required
                    placeholder="Your city"
                  />

                  <label>District</label>
                  <input
                    value={district}
                    onChange={e => setDistrict(e.target.value)}
                    required
                    placeholder="Your district"
                  />

                  <label>Government ID type</label>
                  <select
                    value={governmentIdType}
                    onChange={e => setGovernmentIdType(e.target.value)}
                    required
                  >
                    <option value="">Select document type</option>
                    <option value="Aadhaar">Aadhaar</option>
                    <option value="Driving Licence">Driving licence</option>
                    <option value="Passport">Passport</option>
                    <option value="Voter ID">Voter ID</option>
                    <option value="Other">Other government ID</option>
                  </select>

                  <label>Verification document (JPG, PNG or PDF; max 5 MB)</label>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={e => setIdFile(e.target.files?.[0] || null)}
                    required
                  />

                  <label>Availability</label>
                  <textarea
                    value={availability}
                    onChange={e => setAvailability(e.target.value)}
                    rows={3}
                    placeholder="When are you generally available?"
                  />

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={ageConfirmed}
                      onChange={e => setAgeConfirmed(e.target.checked)}
                    />
                    I confirm that I am 18 years of age or older.
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={e => setTermsAccepted(e.target.checked)}
                    />
                    I agree to the volunteer terms and understand that my application requires admin verification.
                  </label>

                  <p className="small-text">
                    Verification documents are stored in a private bucket and are only accessible to authorised reviewers. Do not submit anyone else's document.
                  </p>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={submitting || !ageConfirmed || !termsAccepted}
                  >
                    {submitting
                      ? 'Submitting application...'
                      : 'Submit volunteer application'}
                  </button>
                </form>
              </>
            )}
          </section>
        )}

        {profile.role === 'user' && !ngo && !volunteer && !vetApplication && (
          <section className="panel">
            <h2>🩺 Veterinarian applications</h2>
            <p>
              Qualified veterinary professionals can submit their professional details
              for review by the PawRescue administration team.
            </p>

            <form onSubmit={handleVetApplication} className="form-stack">
              <label>Professional qualification</label>
              <input
                value={vetQualification}
                onChange={e => setVetQualification(e.target.value)}
                placeholder="Enter your veterinary qualification"
                required
              />

              <label>Clinic / hospital name</label>
              <input
                value={vetClinicName}
                onChange={e => setVetClinicName(e.target.value)}
                placeholder="Enter your clinic or hospital"
                required
              />

              <p className="small-text">
                This application is intended only for qualified veterinary professionals.
                Admin approval is required before access is granted.
              </p>

              <button
                type="submit"
                className="primary-button"
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit veterinarian application'}
              </button>
            </form>
          </section>
        )}

        <Member4Links role={profile.role} />

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}
      </main>
    )
  }

  if (!showAuth) {
    return <Home onSignIn={() => setShowAuth(true)} />
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
            type="button"
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => {
              setMode('login')
              clearAuthMessages()
            }}
          >
            Login
          </button>

          <button
            type="button"
            className={mode === 'signup' ? 'tab active' : 'tab'}
            onClick={() => {
              setMode('signup')
              clearAuthMessages()
            }}
          >
            NGO Registration
          </button>

          <button
            type="button"
            className={mode === 'volunteer' ? 'tab active' : 'tab'}
            onClick={() => {
              setMode('volunteer')
              clearAuthMessages()
            }}
          >
            Volunteer Registration
          </button>

          <button
            type="button"
            className={mode === 'veterinarian' ? 'tab active' : 'tab'}
            onClick={() => {
              setMode('veterinarian')
              clearAuthMessages()
            }}
          >
            Veterinarian Registration
          </button>
        </div>

        {mode === 'login' && (
          <div className="login-role-section">
            <p className="login-role-heading">Choose your login portal</p>

            <div className="login-role-grid">
              {LOGIN_ROLES.map(role => (
                <button
                  key={role.value}
                  type="button"
                  className={
                    loginRole === role.value
                      ? 'login-role-button selected'
                      : 'login-role-button'
                  }
                  onClick={() => {
                    setLoginRole(role.value)
                    clearAuthMessages()
                  }}
                >
                  <span className="login-role-icon">{role.icon}</span>
                  <span>{role.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <h2 className="auth-heading">
          {mode === 'login'
            ? loginRole === 'user'
              ? 'Welcome back'
              : `${LOGIN_ROLES.find(role => role.value === loginRole)?.label || 'Account'} Login`
            : mode === 'signup'
              ? 'Register your NGO'
              : mode === 'volunteer'
                ? 'Register as a volunteer'
                : 'Veterinarian registration'}
        </h2>

        <form
          onSubmit={mode === 'login' ? handleLogin : handleSignup}
          className="form-stack"
        >
          {mode !== 'login' && (
            <>
              <label>Full name</label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                placeholder="Your full name"
              />
            </>
          )}

          {mode === 'signup' && (
            <>
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

          {mode === 'volunteer' && (
            <div className="empty-state">
              <p>
                Create your PawRescue account to access the volunteer section.
                Formal rescue-volunteer applications require adult eligibility
                and admin verification.
              </p>
            </div>
          )}

          {mode === 'veterinarian' && (
            <div className="empty-state">
              <p>
                This registration is for qualified veterinary professionals.
                After creating an account and signing in, they can submit their
                qualification and clinic details for admin review.
              </p>
            </div>
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

          <button
            type="submit"
            disabled={submitting}
            className="primary-button"
          >
            {submitting
              ? 'Please wait...'
              : mode === 'login'
                ? `Sign in${loginRole !== 'user' ? ` as ${LOGIN_ROLES.find(role => role.value === loginRole)?.label}` : ''}`
                : mode === 'signup'
                  ? 'Submit NGO Registration'
                  : mode === 'volunteer'
                    ? 'Create Volunteer Account'
                    : 'Create Veterinarian Account'}
          </button>
        </form>

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}

        <AdoptLink />
      </section>
    </main>
  )
}

export default App
