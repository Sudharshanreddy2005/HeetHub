import { FormEvent, useCallback, useEffect, useState, type ReactNode } from 'react'
import { AuthenticatedShell } from './AuthenticatedShell'
import { Dashboard } from './Dashboard'
import { AnalyticsOverview, AnalyticsPage } from './AnalyticsPage'
import { MeetingsPage } from './MeetingsPage'
import { SettingsPage } from './SettingsPage'
import { InvitationsPage } from './InvitationsPage'
import { fetchCurrentUser, login, requestMeetingAccessByCode, type User, register } from './features/meeting/meetingApi'
import { MeetingRoom } from './features/meeting/MeetingRoom'
import { loadPreferences, savePreferences, type Preferences, type ThemePreference } from './preferences'

type ThemeMode = 'light' | 'dark'

function preferenceTheme(preference: ThemePreference, systemTheme: ThemeMode): ThemeMode {
  return preference === 'system' ? systemTheme : preference
}

function ThemeToggle({ theme, onToggle }: { theme: ThemeMode; onToggle: () => void }) {
  return (
    <button type="button" className="theme-toggle" onClick={onToggle} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}

function LandingPage({
  theme,
  onToggleTheme,
  onLogin,
  onSignUp,
  onJoinMeeting,
}: {
  theme: ThemeMode
  onToggleTheme: () => void
  onLogin: () => void
  onSignUp: () => void
  onJoinMeeting?: (meetingId: string) => void
}) {
  const [isJoinDialogOpen, setJoinDialogOpen] = useState(false)
  const [meetingCode, setMeetingCode] = useState('')
  const [meetingPasscode, setMeetingPasscode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleJoinSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setJoinError('')
    if (!meetingCode.trim()) return
    const authToken = localStorage.getItem('access_token')
    if (!authToken) {
      onLogin()
      return
    }
    setIsSubmitting(true)
    try {
      const access = await requestMeetingAccessByCode(meetingCode.trim(), meetingPasscode.trim(), authToken)
      setJoinDialogOpen(false)
      if (onJoinMeeting) {
        onJoinMeeting(access.meeting_id)
      } else {
        window.history.pushState({}, '', `/meetings/${access.meeting_id}`)
        window.dispatchEvent(new PopStateEvent('popstate'))
      }
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Unable to join meeting')
    } finally {
      setIsSubmitting(false)
    }
  }

  const scrollToWhatsNew = () => {
    const el = document.getElementById('whats-new')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="gather-layout" data-theme={theme}>
      {/* Header */}
      <header className="gather-layout__header" id="GATHER_LAYOUT_HEADER">
        <div className="gather-layout__header__inner">
          <a className="gather-layout__header__title" href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            <span className="gather-layout__header__title-badge">MH</span>
            <span>MeetHub</span>
          </a>

          <button
            type="button"
            className="gather-button gather-button--small gather-button--plain gather-hide-when-media-mobile"
            onClick={scrollToWhatsNew}
          >
            What&apos;s new
          </button>

          <button
            type="button"
            className="gather-button gather-button--small gather-button--secondary"
            onClick={onLogin}
          >
            Login
          </button>

          <button
            type="button"
            className="gather-button gather-button--small gather-button--primary"
            onClick={onSignUp}
          >
            Sign Up
          </button>

          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </header>

      {/* Main Container */}
      <main className="gather-layout__main">
        <div className="gather-layout__main__inner">
          
          {/* Hero Section */}
          <section className="gather-hero">
            <div className="gather-hero__media">
              <div className="gather-hero__media__inner">
                <picture>
                  <img
                    src="/assets/hero_meeting_banner.jpg"
                    alt="MeetHub video meeting experience"
                    className="gather-hero-img"
                    loading="eager"
                  />
                </picture>
              </div>
            </div>

            <div className="gather-hero__content">
              <span className="gather-hero__tag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                Next-Gen Secure Conferencing
              </span>
              <h1>AI Powered Meetings</h1>
              <p>
                Invitation-based video meetings with live chat, host moderation, and optional visual engagement estimates. Connect through LiveKit and keep camera and microphone controls in your hands.
              </p>

              <div className="gather-button-group">
                <button
                  type="button"
                  className="gather-button gather-button--large gather-button--primary"
                  onClick={onSignUp}
                >
                  <svg width="22" height="22" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fill="#ffffff" d="M5.75 6A3.75 3.75 0 0 0 2 9.75v8.5A3.75 3.75 0 0 0 5.75 22h9.5A3.75 3.75 0 0 0 19 18.25v-.503l4.252 2.936c1.16.801 2.744-.03 2.744-1.44V8.753c0-1.41-1.584-2.242-2.744-1.44L19 10.249V9.75A3.75 3.75 0 0 0 15.25 6h-9.5ZM19 12.071l5.104-3.524a.25.25 0 0 1 .392.206v10.49a.25.25 0 0 1-.392.206L19 15.923v-3.853ZM3.5 9.75A2.25 2.25 0 0 1 5.75 7.5h9.5a2.25 2.25 0 0 1 2.25 2.25v8.5a2.25 2.25 0 0 1-2.25 2.25h-9.5a2.25 2.25 0 0 1-2.25-2.25v-8.5Z"/>
                  </svg>
                  Start a meeting for free
                </button>

                <button
                  type="button"
                  className="gather-button gather-button--large gather-button--secondary"
                  onClick={() => setJoinDialogOpen(true)}
                >
                  <svg width="22" height="22" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fill="currentColor" d="M12.747 8.416a.7.7 0 0 1 .538.83l-.419 1.954h3.467l.482-2.246a.7.7 0 1 1 1.368.293l-.418 1.953H18.9a.7.7 0 1 1 0 1.4h-1.435l-.6 2.8H18.2a.7.7 0 1 1 0 1.4h-1.634l-.481 2.246a.7.7 0 1 1-1.37-.293l.419-1.953h-3.468l-.481 2.247a.7.7 0 0 1-1.37-.294l.42-1.953H9.1a.7.7 0 1 1 0-1.4h1.434l.6-2.8H9.8a.7.7 0 1 1 0-1.4h1.634l.482-2.247a.7.7 0 0 1 .83-.537Zm-.78 6.984h3.467l.6-2.8h-3.468l-.6 2.8ZM4.2 7.7a3.5 3.5 0 0 1 3.5-3.5h12.6a3.5 3.5 0 0 1 3.5 3.5v12.6a3.5 3.5 0 0 1-3.5 3.5H7.7a3.5 3.5 0 0 1-3.5-3.5V7.7Zm3.5-2.1a2.1 2.1 0 0 0-2.1 2.1v12.6c0 1.16.94 2.1 2.1 2.1h12.6a2.1 2.1 0 0 0 2.1-2.1V7.7a2.1 2.1 0 0 0-2.1-2.1H7.7Z"/>
                  </svg>
                  Join a meeting
                </button>
              </div>
            </div>
          </section>

          {/* Join Meeting Modal */}
          {isJoinDialogOpen && (
            <div className="gather-modal" role="dialog" aria-modal="true" aria-labelledby="GATHER_JOIN_MODAL_TITLE">
              <div className="gather-modal__header">
                <h2 className="gather-modal__title" id="GATHER_JOIN_MODAL_TITLE">Join with Meeting ID</h2>
                <button
                  type="button"
                  className="gather-modal__close"
                  onClick={() => { setJoinDialogOpen(false); setJoinError('') }}
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={(e) => void handleJoinSubmit(e)} className="gather-modal__content">
                <p>Enter your meeting code and secure passcode to enter the private room.</p>

                <div>
                  <label className="gather-input-label" htmlFor="MEETING_CODE_INPUT">
                    Meeting ID / Code *
                  </label>
                  <input
                    id="MEETING_CODE_INPUT"
                    className="gather-input"
                    placeholder="e.g. 660f4b32 or code"
                    value={meetingCode}
                    onChange={(e) => setMeetingCode(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className="gather-input-label" htmlFor="MEETING_PASSCODE_INPUT">
                    Meeting Passcode *
                  </label>
                  <input
                    id="MEETING_PASSCODE_INPUT"
                    type="password"
                    className="gather-input"
                    placeholder="Enter meeting passcode"
                    value={meetingPasscode}
                    onChange={(e) => setMeetingPasscode(e.target.value)}
                  />
                </div>

                {joinError && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.85rem' }} role="alert">
                    {joinError}
                  </p>
                )}

                <button
                  type="submit"
                  className="gather-button gather-button--primary gather-button--large"
                  disabled={isSubmitting}
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  {isSubmitting ? 'Verifying access...' : 'Join Meeting'}
                </button>
              </form>
            </div>
          )}

          {/* Bento Grid */}
          <section className="gather-bento-grid" aria-label="Key features">
            
            {/* Bento Item 1: Voice Moderation */}
            <div className="gather-bento-grid__item">
              <div className="gather-bento-grid__item-header">
                <span className="gather-icon-circle">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gather-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                  </svg>
                </span>
                <span className="gather-paid-badge">AI Audio Shield</span>
              </div>
              <div className="gather-icon-with-heading__text">
                <h2>Voice Moderation</h2>
                <small>Optional speech recognition with no default raw-audio storage</small>
              </div>
              <div className="gather-bento-image-wrap">
                <img
                  src="/assets/voice_moderation.jpg"
                  alt="Voice Moderation Shield"
                  className="gather-bento-image"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Bento Item 2: Chat Toxicity */}
            <div className="gather-bento-grid__item">
              <div className="gather-bento-grid__item-header">
                <span className="gather-icon-circle">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gather-emerald)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                </span>
                <span className="gather-paid-badge">Smart Guard</span>
              </div>
              <div className="gather-icon-with-heading__text">
                <h2>Toxicity Filtering</h2>
                <small>Machine-learned chat screening with instant host controls</small>
              </div>
              <div className="gather-bento-image-wrap">
                <img
                  src="/assets/chat_toxicity.jpg"
                  alt="Chat Toxicity Guard"
                  className="gather-bento-image"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Bento Item 3: Local Visual Engagement */}
            <div className="gather-bento-grid__item">
              <div className="gather-bento-grid__item-header">
                <span className="gather-icon-circle">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gather-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <circle cx="12" cy="12" r="4"/>
                    <line x1="21.17" y1="8" x2="12" y2="8"/>
                    <line x1="3.95" y1="6.06" x2="8.54" y2="14"/>
                    <line x1="10.88" y1="21.94" x2="15.46" y2="14"/>
                  </svg>
                </span>
                <span className="gather-paid-badge">Local baseline</span>
              </div>
              <div className="gather-icon-with-heading__text">
                <h2>Visual Engagement Estimation</h2>
                <small>Optional camera-frame brightness baseline; no face or gaze recognition</small>
              </div>
              <div className="gather-bento-image-wrap">
                <img
                  src="/assets/visual_engagement.jpg"
                  alt="Visual Engagement Radar"
                  className="gather-bento-image"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Bento Item 4: Screen Sharing */}
            <div className="gather-bento-grid__item">
              <div className="gather-bento-grid__item-header">
                <span className="gather-icon-circle">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gather-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </span>
                <span className="gather-paid-badge">LiveKit video</span>
              </div>
              <div className="gather-icon-with-heading__text">
                <h2>Screen Collaboration</h2>
                <small>Low-latency WebRTC media transport powered by LiveKit SFU</small>
              </div>
              <div className="gather-bento-image-wrap">
                <img
                  src="/assets/screen_collaboration.jpg"
                  alt="Screen Collaboration Workspace"
                  className="gather-bento-image"
                  loading="lazy"
                />
              </div>
            </div>

          </section>

          {/* What's New Section */}
          <section className="gather-whats-new-section" id="whats-new">
            <h2>MeetHub meeting tools</h2>
            <p>
              Host analytics summarize meeting attendance, visual engagement estimates, and moderation outcomes using available meeting data.
            </p>
            <a
              className="gather-whats-new-button"
              href="#GATHER_LAYOUT_HEADER"
              onClick={(e) => { e.preventDefault(); onSignUp() }}
            >
              Get Started for Free &rarr;
            </a>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="gather-layout__footer">
        <div className="gather-layout__footer__top">
          <button
            type="button"
            className="gather-button gather-button--small gather-button--secondary"
            onClick={onLogin}
          >
            Sign in to Workspace
          </button>
          <button
            type="button"
            className="gather-button gather-button--small gather-button--primary"
            onClick={onSignUp}
          >
            Create New Account
          </button>
        </div>

        <div className="gather-layout__footer__bottom">
          <span>Invitation-based access</span>
          <span>Privacy-aware processing</span>
          <span>Host-controlled moderation</span>
          <span>LiveKit meetings</span>
          <span>&copy; 2026 MeetHub</span>
        </div>
      </footer>
    </div>
  )
}


function JoinPage({
  meetingToken,
  authToken,
  onBack,
  onJoin,
  theme,
  onToggleTheme,
}: {
  meetingToken: string
  authToken: string
  onBack: () => void
  onJoin: (meetingId: string) => void
  theme: ThemeMode
  onToggleTheme: () => void
}) {
  const [code, setCode] = useState(meetingToken)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setSubmitting(true)
    try {
      const access = await requestMeetingAccessByCode(code.trim(), password, authToken)
      onJoin(access.meeting_id)
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to join this meeting')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page" data-theme={theme}>
      <section className="auth-panel">
        <div className="auth-header">
          <div className="brand"><span className="brand-mark">MH</span><span>MeetHub</span></div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <p className="eyebrow">Join meeting</p>
        <h1>Secure meeting access</h1>
        <p className="auth-copy">Use your meeting code and password to continue safely.</p>
        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Meeting code
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="ABCD1234" />
          </label>
          <label>
            Meeting password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter secure password" />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button-primary" type="submit" disabled={submitting}>{submitting ? 'Joining...' : 'Continue'}</button>
        </form>
        <button type="button" className="button-quiet" onClick={onBack}>Back to sign in</button>
      </section>
    </main>
  )
}

function RegisterPage({
  theme,
  onToggleTheme,
  onNavigate,
  onSuccess,
}: {
  theme: ThemeMode
  onToggleTheme: () => void
  onNavigate: (path: string) => void
  onSuccess: (token: string, user: User) => void
}) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    password_confirmation: '',
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [authError, setAuthError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validateField = (name: string, value: string, currentData = formData) => {
    switch (name) {
      case 'full_name': {
        const trimmed = value.trim()
        if (!trimmed) return 'Full name is required.'
        if (/\d/.test(trimmed)) return 'Full name must contain only letters and cannot contain numbers.'
        if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) return 'Full name must contain only alphabetic letters and spaces.'
        if (trimmed.length < 2 || trimmed.length > 50) return 'Full name must be between 2 and 50 characters.'
        return ''
      }
      case 'email': {
        const trimmed = value.trim().toLowerCase()
        if (!trimmed) return 'Email address is required.'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Please enter a valid email address.'
        return ''
      }
      case 'phone': {
        const trimmed = value.trim()
        if (!trimmed) return 'Phone number is required.'
        if (/[a-zA-Z]/.test(trimmed)) return 'Phone number must contain only numeric digits (no letters).'
        const digitsOnly = trimmed.replace(/[^\d]/g, '')
        if (digitsOnly.length < 10 || digitsOnly.length > 15) return 'Phone number must be digits only (10 to 15 numbers).'
        return ''
      }
      case 'username': {
        const trimmed = value.trim().toLowerCase()
        if (!trimmed) return 'Username is required.'
        if (!/^[a-zA-Z]/.test(trimmed)) return 'Username must start with a letter.'
        if (!/^[a-zA-Z0-9_]{3,30}$/.test(trimmed)) return 'Username must be 3-30 characters with letters, numbers, or underscores only.'
        return ''
      }
      case 'password': {
        if (!value) return 'Password is required.'
        if (value.length < 8) return 'Password must be at least 8 characters long.'
        if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter.'
        if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter.'
        if (!/\d/.test(value)) return 'Password must contain at least one number (0-9).'
        if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)) return 'Password must contain at least one special character (!@#$%^&*...).'
        return ''
      }
      case 'password_confirmation': {
        if (!value) return 'Please confirm your password.'
        if (value !== currentData.password) return 'Password and confirmed password must match.'
        return ''
      }
      default:
        return ''
    }
  }

  const errors = {
    full_name: validateField('full_name', formData.full_name),
    email: validateField('email', formData.email),
    phone: validateField('phone', formData.phone),
    username: validateField('username', formData.username),
    password: validateField('password', formData.password),
    password_confirmation: validateField('password_confirmation', formData.password_confirmation),
  }

  const passwordCriteria = {
    minLength: formData.password.length >= 8,
    hasUpper: /[A-Z]/.test(formData.password),
    hasLower: /[a-z]/.test(formData.password),
    hasDigit: /\d/.test(formData.password),
    hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(formData.password),
    matchesConfirm: Boolean(formData.password && formData.password === formData.password_confirmation),
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setAuthError('')
  }

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')

    const allTouched = {
      full_name: true,
      email: true,
      phone: true,
      username: true,
      password: true,
      password_confirmation: true,
    }
    setTouched(allTouched)

    const hasError = Object.values(errors).some(Boolean)
    if (hasError) {
      const firstError = Object.values(errors).find(Boolean)
      setAuthError(firstError || 'Please correct the highlighted errors before submitting.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await register({
        username: formData.username.trim().toLowerCase(),
        email: formData.email.trim().toLowerCase(),
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim().replace(/[^\d+]/g, ''),
        password: formData.password,
        password_confirmation: formData.password_confirmation,
      })
      onSuccess(response.access_token, response.user)
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : 'Unable to create account')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-page" data-theme={theme}>
      <section className="auth-panel">
        <div className="auth-header">
          <div className="brand"><span className="brand-mark">MH</span><span>MeetHub</span></div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <p className="eyebrow">Create access</p>
        <h1>Create your account</h1>
        <p className="auth-copy">Set up your secure workspace and start hosting or joining meetings.</p>
        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          {authError && (
            <div className="form-error" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{authError}</span>
            </div>
          )}

          <div>
            <label htmlFor="reg_full_name">Full name *</label>
            <input
              id="reg_full_name"
              required
              name="full_name"
              autoComplete="name"
              placeholder="e.g. John Doe"
              className={touched.full_name && errors.full_name ? 'input-invalid' : touched.full_name && !errors.full_name ? 'input-valid' : ''}
              value={formData.full_name}
              onChange={(e) => handleChange('full_name', e.target.value)}
              onBlur={() => handleBlur('full_name')}
            />
            {touched.full_name && errors.full_name && (
              <span className="field-error-text" role="alert">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errors.full_name}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="reg_email">Email address *</label>
            <input
              id="reg_email"
              required
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              className={touched.email && errors.email ? 'input-invalid' : touched.email && !errors.email ? 'input-valid' : ''}
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
            />
            {touched.email && errors.email && (
              <span className="field-error-text" role="alert">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errors.email}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="reg_phone">Phone number * (Digits only, 10-15)</label>
            <input
              id="reg_phone"
              required
              type="tel"
              name="phone"
              autoComplete="tel"
              placeholder="e.g. 9876543210"
              className={touched.phone && errors.phone ? 'input-invalid' : touched.phone && !errors.phone ? 'input-valid' : ''}
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              onBlur={() => handleBlur('phone')}
            />
            {touched.phone && errors.phone && (
              <span className="field-error-text" role="alert">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errors.phone}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="reg_username">Username *</label>
            <input
              id="reg_username"
              required
              name="username"
              autoComplete="username"
              placeholder="e.g. jdoe99"
              className={touched.username && errors.username ? 'input-invalid' : touched.username && !errors.username ? 'input-valid' : ''}
              value={formData.username}
              onChange={(e) => handleChange('username', e.target.value)}
              onBlur={() => handleBlur('username')}
            />
            {touched.username && errors.username && (
              <span className="field-error-text" role="alert">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errors.username}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="reg_password">Password *</label>
            <input
              id="reg_password"
              required
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters with upper, lower, number & special"
              className={touched.password && errors.password ? 'input-invalid' : touched.password && !errors.password ? 'input-valid' : ''}
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
            />
            {touched.password && errors.password && (
              <span className="field-error-text" role="alert">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errors.password}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="reg_password_confirmation">Confirm password *</label>
            <input
              id="reg_password_confirmation"
              required
              type="password"
              name="password_confirmation"
              autoComplete="new-password"
              placeholder="Re-enter password"
              className={touched.password_confirmation && errors.password_confirmation ? 'input-invalid' : touched.password_confirmation && !errors.password_confirmation ? 'input-valid' : ''}
              value={formData.password_confirmation}
              onChange={(e) => handleChange('password_confirmation', e.target.value)}
              onBlur={() => handleBlur('password_confirmation')}
            />
            {touched.password_confirmation && errors.password_confirmation && (
              <span className="field-error-text" role="alert">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {errors.password_confirmation}
              </span>
            )}
          </div>

          {/* Password Security Rules Checklist */}
          <div className="password-requirements-card">
            <p>Password Requirements Checklist</p>
            <div className={`req-item ${passwordCriteria.minLength ? 'met' : ''}`}>
              <span className="req-icon">{passwordCriteria.minLength ? '✓' : '•'}</span>
              <span>At least 8 characters</span>
            </div>
            <div className={`req-item ${passwordCriteria.hasUpper ? 'met' : ''}`}>
              <span className="req-icon">{passwordCriteria.hasUpper ? '✓' : '•'}</span>
              <span>At least 1 uppercase letter (A-Z)</span>
            </div>
            <div className={`req-item ${passwordCriteria.hasLower ? 'met' : ''}`}>
              <span className="req-icon">{passwordCriteria.hasLower ? '✓' : '•'}</span>
              <span>At least 1 lowercase letter (a-z)</span>
            </div>
            <div className={`req-item ${passwordCriteria.hasDigit ? 'met' : ''}`}>
              <span className="req-icon">{passwordCriteria.hasDigit ? '✓' : '•'}</span>
              <span>At least 1 number (0-9)</span>
            </div>
            <div className={`req-item ${passwordCriteria.hasSpecial ? 'met' : ''}`}>
              <span className="req-icon">{passwordCriteria.hasSpecial ? '✓' : '•'}</span>
              <span>At least 1 special character (!@#$%^&*...)</span>
            </div>
            <div className={`req-item ${passwordCriteria.matchesConfirm ? 'met' : ''}`}>
              <span className="req-icon">{passwordCriteria.matchesConfirm ? '✓' : '•'}</span>
              <span>Passwords must match</span>
            </div>
          </div>

          <button className="button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create account'}
          </button>
          <button type="button" className="button-quiet" onClick={() => onNavigate('/login')}>
            Sign in
          </button>
        </form>
      </section>
      <aside className="auth-aside">
        <p className="eyebrow">Work with trust</p>
        <h2>Meetings that stay private.</h2>
        <div className="aside-stat">
          <strong>Secure access</strong>
          <span>Only approved users can join your private meetings.</span>
        </div>
        <div className="aside-stat">
          <strong>Better context</strong>
          <span>AI signals help hosts understand meeting flow without compromising privacy.</span>
        </div>
      </aside>
    </main>
  )
}

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('access_token') ?? '')
  const [user, setUser] = useState<User | null>(null)
  const [path, setPath] = useState(window.location.pathname)
  const [authError, setAuthError] = useState('')
  const [isLoginSubmitting, setLoginSubmitting] = useState(false)
  const [isLoading, setLoading] = useState(Boolean(token))
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences)
  const [systemTheme, setSystemTheme] = useState<ThemeMode>(() => globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light')
  const theme = preferenceTheme(preferences.theme, systemTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.reduceMotion = String(preferences.reduceMotion)
    document.documentElement.dataset.highContrast = String(preferences.highContrast)
    document.documentElement.dataset.fontSize = preferences.fontSize
    savePreferences(preferences)
  }, [preferences, theme])

  useEffect(() => {
    const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const updatePreferences = useCallback((changes: Partial<Preferences>) => {
    setPreferences((current) => ({ ...current, ...changes }))
  }, [])

  const toggleTheme = useCallback(() => {
    updatePreferences({ theme: theme === 'dark' ? 'light' : 'dark' })
  }, [theme, updatePreferences])

  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname)
    window.addEventListener('popstate', syncPath)
    return () => window.removeEventListener('popstate', syncPath)
  }, [])

  useEffect(() => {
    if (!token) return
    void fetchCurrentUser(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('access_token')
        setToken('')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  const navigate = useCallback((nextPath: string) => {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    setToken('')
    setUser(null)
    navigate('/login')
  }, [navigate])

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthError('')
    setLoginSubmitting(true)
    const form = new FormData(event.currentTarget)
    try {
      const response = await login(String(form.get('email') ?? ''), String(form.get('password') ?? ''))
      localStorage.setItem('access_token', response.access_token)
      setToken(response.access_token)
      setUser(response.user)
      navigate('/dashboard')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in')
    } finally {
      setLoginSubmitting(false)
    }
  }

  const withWorkspace = (content: ReactNode) => {
    if (!token || !user) return content
    return (
      <AuthenticatedShell
        user={user}
        authToken={token}
        path={path}
        theme={theme}
        onNavigate={navigate}
        onLogout={logout}
        onToggleTheme={toggleTheme}
      >
        {content}
      </AuthenticatedShell>
    )
  }

  if (isLoading) {
    return (
      <main className="center-page" data-theme={theme}>
        <p className="loading-state">Securing your session...</p>
      </main>
    )
  }

  const analyticsMatch = path.match(/^\/meetings\/([^/]+)\/analytics$/)
  const meetingMatch = path.match(/^\/meetings\/([^/]+)$/) || path.match(/^\/meeting\/([^/]+)$/)
  const joinMatch = path.match(/^\/join\/([^/]+)$/)

  if (!token && (path === '/dashboard' || path === '/meetings' || path === '/analytics' || path === '/settings' || path === '/invitations' || path.startsWith('/meeting/') || path.startsWith('/meetings/') || path.startsWith('/join/'))) {
    return (
      <main className="auth-page" data-theme={theme}>
        <section className="auth-panel">
          <div className="auth-header">
            <div className="brand"><span className="brand-mark">MH</span><span>MeetHub</span></div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <p className="eyebrow">Private workspace</p>
          <h1>Welcome back</h1>
          <p className="auth-copy">Sign in to manage invited meetings and continue securely.</p>
          <form className="auth-form" onSubmit={(event) => void handleLogin(event)}>
            <label>
              Email
              <input required name="email" autoComplete="email" placeholder="you@example.com" />
            </label>
            <label>
              Password
              <input required type="password" name="password" autoComplete="current-password" />
            </label>
            {authError && <p className="form-error" role="alert">{authError}</p>}
            <button className="button-primary" type="submit" disabled={isLoginSubmitting}>{isLoginSubmitting ? 'Signing in...' : 'Sign in'}</button>
            <button type="button" className="button-quiet" onClick={() => navigate('/register')}>Create account</button>
          </form>
        </section>
        <aside className="auth-aside">
          <p className="eyebrow">A calmer way to meet</p>
          <h2>Private, clear, and secure.</h2>
          <div className="aside-stat">
            <strong>Private by design</strong>
            <span>Only invited participants can enter your meetings.</span>
          </div>
          <div className="aside-stat">
            <strong>Human-controlled</strong>
            <span>Moderation signals support hosts without replacing their judgment.</span>
          </div>
        </aside>
      </main>
    )
  }

  if (analyticsMatch && token && user) {
    return withWorkspace(
      <AnalyticsPage
        meetingId={analyticsMatch[1]}
        authToken={token}
        user={user}
        path={path}
        onNavigate={navigate}
        onBack={() => navigate('/dashboard')}
        onLogout={logout}
        theme={theme}
        onToggleTheme={toggleTheme}
      />,
    )
  }

  if (meetingMatch && token) {
      if (joinMatch && token) {
        return (
          <JoinPage
            meetingToken={joinMatch[1]}
            authToken={token}
            onBack={() => navigate('/login')}
            onJoin={(meetingId) => navigate(`/meetings/${meetingId}`)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )
      }

    return (
      <MeetingRoom
        meetingId={meetingMatch[1]}
        authToken={token}
        onLeave={() => navigate('/dashboard')}
        onAuthExpired={logout}
        theme={theme}
        onToggleTheme={toggleTheme}
        preferences={preferences}
      />
    )
  }

  if (token && user && path === '/dashboard') {
    return withWorkspace(
      <Dashboard
        user={user}
        authToken={token}
        path={path}
        theme={theme}
        onNavigate={navigate}
        onLogout={logout}
        onJoin={(meetingId) => navigate(`/meetings/${meetingId}`)}
        onAnalytics={(meetingId) => navigate(`/meetings/${meetingId}/analytics`)}
        onToggleTheme={toggleTheme}
      />,
    )
  }

  if (token && user && path === '/meetings') {
    return withWorkspace(<MeetingsPage user={user} authToken={token} path={path} onNavigate={navigate} onJoin={(meetingId) => navigate(`/meetings/${meetingId}`)} onAnalytics={(meetingId) => navigate(`/meetings/${meetingId}/analytics`)} onLogout={logout} theme={theme} onToggleTheme={toggleTheme} />)
  }

  if (token && user && path === '/analytics') {
    return withWorkspace(<AnalyticsOverview user={user} authToken={token} path={path} onNavigate={navigate} onLogout={logout} theme={theme} onToggleTheme={toggleTheme} />)
  }

  if (token && user && path === '/settings') {
    return withWorkspace(<SettingsPage user={user} theme={theme} path={path} onNavigate={navigate} onToggleTheme={toggleTheme} onLogout={logout} preferences={preferences} onPreferencesChange={updatePreferences} />)
  }

  if (token && user && path === '/invitations') {
    return withWorkspace(<InvitationsPage user={user} authToken={token} path={path} onNavigate={navigate} onLogout={logout} theme={theme} onToggleTheme={toggleTheme} />)
  }

  if (user && token) {
    return withWorkspace(
      <Dashboard
        user={user}
        authToken={token}
        path={path}
        onNavigate={navigate}
        onLogout={logout}
        onJoin={(meetingId) => navigate(`/meetings/${meetingId}`)}
        onAnalytics={(meetingId) => navigate(`/meetings/${meetingId}/analytics`)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />,
    )
  }

  if (!token && path === '/') {
    return (
      <LandingPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onLogin={() => navigate('/login')}
        onSignUp={() => navigate('/register')}
        onJoinMeeting={(meetingId) => navigate(`/meetings/${meetingId}`)}
      />
    )
  }

  if (!token && path === '/login') {
    return (
      <main className="auth-page" data-theme={theme}>
        <section className="auth-panel">
          <div className="auth-header">
            <div className="brand"><span className="brand-mark">MH</span><span>MeetHub</span></div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
          <p className="eyebrow">Private workspace</p>
          <h1>Welcome back</h1>
          <p className="auth-copy">Sign in to manage invited meetings and continue securely.</p>
          <form className="auth-form" onSubmit={(event) => void handleLogin(event)}>
            <label>
              Email
              <input required name="email" autoComplete="email" placeholder="you@example.com" />
            </label>
            <label>
              Password
              <input required type="password" name="password" autoComplete="current-password" />
            </label>
            {authError && <p className="form-error" role="alert">{authError}</p>}
            <button className="button-primary" type="submit" disabled={isLoginSubmitting}>{isLoginSubmitting ? 'Signing in...' : 'Sign in'}</button>
            <button type="button" className="button-quiet" onClick={() => navigate('/register')}>Create account</button>
          </form>
        </section>
        <aside className="auth-aside">
          <p className="eyebrow">A calmer way to meet</p>
          <h2>Private, clear, and secure.</h2>
          <div className="aside-stat">
            <strong>Private by design</strong>
            <span>Only invited participants can enter your meetings.</span>
          </div>
          <div className="aside-stat">
            <strong>Human-controlled</strong>
            <span>Moderation signals support hosts without replacing their judgment.</span>
          </div>
        </aside>
      </main>
    )
  }

  if (!token && path === '/register') {
    return (
      <RegisterPage
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={navigate}
        onSuccess={(accessToken, userObj) => {
          localStorage.setItem('access_token', accessToken)
          setToken(accessToken)
          setUser(userObj)
          navigate('/dashboard')
        }}
      />
    )
  }


  if (!token && path !== '/' && path !== '/login' && path !== '/register') {
    return null
  }

  return null
}
