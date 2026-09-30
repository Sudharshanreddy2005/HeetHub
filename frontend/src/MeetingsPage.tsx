import { useCallback, useEffect, useState } from 'react'
import { fetchMeetings, type Meeting, type User } from './features/meeting/meetingApi'
import { Sidebar } from './Sidebar'

type MeetingsPageProps = { user: User; authToken: string; path: string; onNavigate: (path: string) => void; onJoin: (meetingId: string) => void; onAnalytics: (meetingId: string) => void; onLogout: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void }

const formatDate = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

function MeetingCards({ meetings, onJoin, onAnalytics }: { meetings: Meeting[]; onJoin: (meetingId: string) => void; onAnalytics: (meetingId: string) => void }) {
  if (!meetings.length) return <p className="empty-state">No meetings in this section.</p>
  return <div className="meeting-list">{meetings.map((meeting) => <article className="meeting-card" key={meeting.id}>
    <div className="meeting-card-heading"><div><p className="card-kicker">{meeting.status}</p><h3>{meeting.title}</h3></div><span>{formatDate(meeting.scheduled_at)}</span></div>
    <p>{meeting.description || 'No description provided.'}</p>
    <dl className="meeting-meta"><div><dt>Host</dt><dd>{meeting.host_username}</dd></div><div><dt>Duration</dt><dd>{meeting.duration_minutes} min</dd></div><div><dt>Participants</dt><dd>{meeting.participants.map((item) => item.username).join(', ') || 'None'}</dd></div></dl>
    <div className="card-actions">{meeting.status !== 'ENDED' && meeting.status !== 'CANCELLED' && <button type="button" onClick={() => onJoin(meeting.id)}>Join meeting</button>}<button type="button" className="button-muted" onClick={() => onAnalytics(meeting.id)}>View analytics</button></div>
  </article>)}</div>
}

export function MeetingsPage({ user, authToken, path, onNavigate, onJoin, onAnalytics, onLogout, theme, onToggleTheme }: MeetingsPageProps) {
  const [upcoming, setUpcoming] = useState<Meeting[]>([])
  const [past, setPast] = useState<Meeting[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const [next, previous] = await Promise.all([fetchMeetings(authToken), fetchMeetings(authToken, '/meetings/past')]); setUpcoming(next); setPast(previous) }
    catch (loadError) { const message = loadError instanceof Error ? loadError.message : 'Unable to load meetings'; setError(message); if (message.includes('expired')) onLogout() }
    finally { setLoading(false) }
  }, [authToken, onLogout])
  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  return <main className="app-shell" data-theme={theme}><div className="dashboard-shell"><Sidebar path={path} onNavigate={onNavigate}><div className="sidebar-card"><p className="eyebrow">Account</p><strong>{user.username}</strong><span>Private meeting access is verified before join.</span></div></Sidebar><div className="main-panel"><header className="app-header"><div className="header-group"><p className="eyebrow">Private workspace</p><h2>Meetings</h2></div><div className="header-user"><button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button><span>{user.username}</span><button type="button" className="button-quiet" onClick={onLogout}>Log out</button></div></header><section className="page-intro"><p className="eyebrow">Your meeting library</p><h1>Meetings</h1><p>Review upcoming rooms and past meeting records connected to your account.</p></section>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p className="loading-state">Loading your meetings...</p> : <div className="meetings-page-grid"><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Next up</p><h2>Upcoming meetings</h2></div><span className="count-badge">{upcoming.length}</span></div><MeetingCards meetings={upcoming} onJoin={onJoin} onAnalytics={onAnalytics} /></section><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Archive</p><h2>Past meetings</h2></div><span className="count-badge">{past.length}</span></div><MeetingCards meetings={past} onJoin={onJoin} onAnalytics={onAnalytics} /></section></div>}</div></div></main>
}
