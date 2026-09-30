import { useEffect, useState } from 'react'

import { fetchMeetingAnalytics, fetchMeetings, type Meeting, type MeetingAnalytics, type User } from './features/meeting/meetingApi'
import { Sidebar } from './Sidebar'

type AnalyticsPageProps = { meetingId: string; authToken: string; user: User; path: string; onNavigate: (path: string) => void; onBack: () => void; onLogout: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void }

const formatDate = (value: string | null) => value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded'
const formatDuration = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`

export function AnalyticsPage({ meetingId, authToken, user, path, onNavigate, onBack, onLogout, theme, onToggleTheme }: AnalyticsPageProps) {
  const [analytics, setAnalytics] = useState<MeetingAnalytics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void fetchMeetingAnalytics(meetingId, authToken)
      .then(setAnalytics)
      .catch((loadError: unknown) => {
        const message = loadError instanceof Error ? loadError.message : 'Unable to load meeting analytics'
        setError(message)
        if (message.includes('expired')) onLogout()
      })
  }, [authToken, meetingId, onLogout])

  if (error) return <main className="app-shell" data-theme={theme}><header className="app-header"><span className="brand">AI Secure Meeting</span><button type="button" className="theme-toggle" onClick={onToggleTheme}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button></header><section className="analytics-error"><p className="form-error" role="alert">{error}</p><button type="button" onClick={onBack}>Back to dashboard</button></section></main>
  if (!analytics) return <main className="center-page" data-theme={theme}><p className="loading-state">Loading analytics...</p></main>

  return <main className="app-shell" data-theme={theme}><div className="dashboard-shell"><Sidebar path={path} onNavigate={onNavigate}><div className="sidebar-card"><p className="eyebrow">Host view</p><strong>Meeting analytics</strong><span>Engagement values are estimates.</span></div></Sidebar><div className="main-panel">
    <header className="app-header"><div className="header-group"><p className="eyebrow">Private workspace</p><h2>Analytics</h2></div><div className="header-user"><button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button><span>{user.username}</span><button type="button" className="button-quiet" onClick={onLogout}>Log out</button></div></header>
    <div className="analytics-page">
      <button type="button" className="back-link" onClick={onBack}>Back to dashboard</button>
      <div className="analytics-title"><p className="eyebrow">Host view · {analytics.meeting_status}</p><h1>Meeting analytics</h1><p>Aggregated signals for this meeting. Engagement values are estimates, not proof of attention.</p></div>
      <div className="analytics-stats"><article><span>Scheduled duration</span><strong>{analytics.scheduled_duration_minutes} min</strong></article><article><span>Observed duration</span><strong>{formatDuration(analytics.actual_duration_seconds)}</strong></article><article><span>Participants</span><strong>{analytics.total_participants}</strong></article><article><span>Moderation events</span><strong>{analytics.moderation.total_events}</strong></article></div>
      <div className="analytics-grid">
        <section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Attendance</p><h2>Participant timeline</h2></div></div><div className="attendance-list">{analytics.attendance.map((record) => <div className="attendance-row" key={record.username}><strong>{record.username}</strong><span>{record.role} · {record.invitation_status}</span><small>{formatDate(record.joined_at)} to {formatDate(record.left_at)}</small></div>)}</div></section>
        <section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Visual estimates</p><h2>Engagement distribution</h2></div></div><div className="distribution-list"><div><span>High</span><strong>{analytics.engagement.high}</strong></div><div><span>Moderate</span><strong>{analytics.engagement.moderate}</strong></div><div><span>Low</span><strong>{analytics.engagement.low}</strong></div><div><span>Unavailable</span><strong>{analytics.engagement.unavailable}</strong></div></div><dl className="analytics-meta"><div><dt>Eligible readings</dt><dd>{analytics.engagement.eligible}</dd></div><div><dt>Average score</dt><dd>{analytics.engagement.average_score ?? 'Not available'}</dd></div><div><dt>Peak score</dt><dd>{analytics.engagement.peak_score ?? 'Not available'}</dd></div><div><dt>Lowest score</dt><dd>{analytics.engagement.lowest_score ?? 'Not available'}</dd></div></dl></section>
        <section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Moderation</p><h2>Outcomes</h2></div></div><div className="distribution-list"><div><span>Warnings</span><strong>{analytics.moderation.warnings}</strong></div><div><span>Blocked</span><strong>{analytics.moderation.blocked}</strong></div><div><span>Allowed</span><strong>{analytics.moderation.allowed}</strong></div><div><span>Host actions</span><strong>{analytics.moderation.host_actions}</strong></div><div><span>Muted</span><strong>{analytics.moderation.muted}</strong></div><div><span>Removed or blocked</span><strong>{analytics.moderation.removed + analytics.moderation.blocked_participants}</strong></div></div></section>
      </div>
    </div></div></div></main>
}

type AnalyticsOverviewProps = { user: User; authToken: string; path: string; onNavigate: (path: string) => void; onLogout: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void }

export function AnalyticsOverview({ user, authToken, path, onNavigate, onLogout, theme, onToggleTheme }: AnalyticsOverviewProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { Promise.all([fetchMeetings(authToken), fetchMeetings(authToken, '/meetings/past')]).then(([upcoming, past]) => setMeetings([...upcoming, ...past])).catch((loadError: unknown) => { const message = loadError instanceof Error ? loadError.message : 'Unable to load analytics meetings'; setError(message); if (message.includes('expired')) onLogout() }).finally(() => setLoading(false)) }, [authToken, onLogout])

  return <main className="app-shell" data-theme={theme}><div className="dashboard-shell"><Sidebar path={path} onNavigate={onNavigate}><div className="sidebar-card"><p className="eyebrow">Account</p><strong>{user.username}</strong><span>Analytics access follows your account permissions.</span></div></Sidebar><div className="main-panel"><header className="app-header"><div className="header-group"><p className="eyebrow">Host workspace</p><h2>Analytics</h2></div><div className="header-user"><button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button><span>{user.username}</span><button type="button" className="button-quiet" onClick={onLogout}>Log out</button></div></header><section className="page-intro"><p className="eyebrow">Meeting intelligence</p><h1>Analytics</h1><p>Select a meeting to view the existing host analytics.</p></section>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p className="loading-state">Loading analytics...</p> : meetings.length ? <div className="analytics-meeting-list">{meetings.map((meeting) => <article className="meeting-card" key={meeting.id}><div className="meeting-card-heading"><div><p className="card-kicker">{meeting.status}</p><h3>{meeting.title}</h3></div><span>{new Date(meeting.scheduled_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span></div><p>Hosted by {meeting.host_username} · {meeting.duration_minutes} min</p><div className="card-actions"><button type="button" onClick={() => onNavigate(`/meetings/${meeting.id}/analytics`)}>View analytics</button></div></article>)}</div> : <p className="empty-state">No meetings with analytics are available for this account.</p>}</div></div></main>
}
