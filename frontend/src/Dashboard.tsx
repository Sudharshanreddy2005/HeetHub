import { FormEvent, useCallback, useEffect, useState } from 'react'
import { apiFetch, createMeeting, fetchInvitations, fetchMeetings, type Invitation, type Meeting, updateInvitation, type User } from './features/meeting/meetingApi'
import { Sidebar } from './Sidebar'

type DashboardProps = { user: User; authToken: string; path: string; onNavigate: (path: string) => void; onLogout: () => void; onJoin: (meetingId: string) => void; onAnalytics: (meetingId: string) => void; theme: 'light' | 'dark'; onToggleTheme: () => void }

const formatDate = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

function MeetingList({ meetings, onJoin, onCancel, onAnalytics }: { meetings: Meeting[]; onJoin: (id: string) => void; onCancel?: (id: string) => void; onAnalytics?: (id: string) => void }) {
  if (!meetings.length) return <p className="empty-state">No meetings to show.</p>
  return <div className="meeting-list">{meetings.map((meeting) => <article className="meeting-card" key={meeting.id}>
    <div className="meeting-card-heading"><div><p className="card-kicker">{meeting.status}</p><h3>{meeting.title}</h3></div><span>{formatDate(meeting.scheduled_at)}</span></div>
    <p>{meeting.description || 'No description provided.'}</p>
    <dl className="meeting-meta"><div><dt>Host</dt><dd>{meeting.host_username}</dd></div><div><dt>Duration</dt><dd>{meeting.duration_minutes} min</dd></div><div><dt>Participants</dt><dd>{meeting.participants.map((item) => item.username).join(', ') || 'None'}</dd></div></dl>
    <div className="card-actions">{meeting.status !== 'ENDED' && meeting.status !== 'CANCELLED' && <button type="button" onClick={() => onJoin(meeting.id)}>Join meeting</button>}{onAnalytics && <button type="button" className="button-muted" onClick={() => onAnalytics(meeting.id)}>View analytics</button>}{onCancel && meeting.status === 'SCHEDULED' && <button type="button" className="button-muted" onClick={() => onCancel(meeting.id)}>Cancel</button>}</div>
  </article>)}</div>
}

function InvitationList({ invitations, onAction }: { invitations: Invitation[]; onAction: (id: string, action: 'accept' | 'decline') => void }) {
  if (!invitations.length) return <p className="empty-state">No invitations waiting.</p>
  return <div className="invitation-list">{invitations.map((invitation) => <article className="invitation-row" key={invitation.id}>
    <div><p className="card-kicker">{invitation.invitation_status}</p><h3>{invitation.meeting_title}</h3><p>Hosted by {invitation.host_username} · {formatDate(invitation.scheduled_at)} · {invitation.duration_minutes} min</p></div>
    {invitation.invitation_status === 'PENDING' && <div className="card-actions"><button type="button" onClick={() => onAction(invitation.id, 'accept')}>Accept</button><button type="button" className="button-muted" onClick={() => onAction(invitation.id, 'decline')}>Decline</button></div>}
  </article>)}</div>
}

export function Dashboard({ user, authToken, path, onNavigate, onLogout, onJoin, onAnalytics, theme, onToggleTheme }: DashboardProps) {
  const [upcoming, setUpcoming] = useState<Meeting[]>([])
  const [past, setPast] = useState<Meeting[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [isCreating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', scheduledAt: '', duration: '30', participants: '' })

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const [next, invites, previous] = await Promise.all([fetchMeetings(authToken), fetchInvitations(authToken), fetchMeetings(authToken, '/meetings/past')]); setUpcoming(next); setInvitations(invites); setPast(previous) }
    catch (loadError) { const message = loadError instanceof Error ? loadError.message : 'Unable to load dashboard'; setError(message); if (message.includes('expired')) onLogout() }
    finally { setLoading(false) }
  }, [authToken, onLogout])
  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setCreating(true); setError('')
    try {
      const date = new Date(form.scheduledAt)
      if (Number.isNaN(date.valueOf())) throw new Error('Choose a valid scheduled date and time.')
      const inviteValues = form.participants.split(',').map((item) => item.trim()).filter(Boolean)
      const participantUsernames = inviteValues.filter((value) => !value.includes('@'))
      const participantEmails = inviteValues.filter((value) => value.includes('@'))
      await createMeeting(authToken, {
        title: form.title,
        description: form.description,
        scheduled_at: date.toISOString(),
        duration_minutes: Number(form.duration),
        participant_usernames: participantUsernames,
        participant_emails: participantEmails,
      })
      setForm({ title: '', description: '', scheduledAt: '', duration: '30', participants: '' }); await load()
    } catch (createError) { setError(createError instanceof Error ? createError.message : 'Unable to create the meeting') }
    finally { setCreating(false) }
  }

  const invitationAction = async (id: string, action: 'accept' | 'decline') => { try { await updateInvitation(authToken, id, action); await load() } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Unable to update invitation') } }
  const cancel = async (id: string) => { const response = await apiFetch(`/meetings/${encodeURIComponent(id)}/cancel`, { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } }); if (!response.ok) setError('Unable to cancel this meeting'); else await load() }

  return <main className="app-shell" data-theme={theme}><div className="dashboard-shell"><Sidebar path={path} onNavigate={onNavigate}><div className="sidebar-card"><p className="eyebrow">Security</p><strong>Private meetings</strong><span>Meeting access is verified before join.</span></div></Sidebar><div className="main-panel"><header className="app-header"><div className="header-group"><p className="eyebrow">Private workspace</p><h2>Overview</h2></div><div className="header-user"><button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button><span>{user.username}</span><button type="button" className="button-quiet" onClick={onLogout}>Log out</button></div></header><section className="dashboard-hero"><div><p className="eyebrow">Hi, {user.username}</p><h1>Good to see you.</h1><p>Manage your meetings, invitations, and secure room access from one place.</p></div><button type="button" className="button-primary" onClick={() => document.getElementById('create-meeting')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Create a meeting</button></section>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p className="loading-state">Loading your meetings...</p> : <div className="dashboard-grid"><section className="dashboard-section dashboard-wide"><div className="section-heading"><div><p className="eyebrow">Your schedule</p><h2>Upcoming meetings</h2></div><span className="count-badge">{upcoming.length}</span></div><MeetingList meetings={upcoming} onJoin={onJoin} onCancel={cancel} onAnalytics={onAnalytics} /></section><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Pending</p><h2>Invitations</h2></div><span className="count-badge">{invitations.filter((item) => item.invitation_status === 'PENDING').length}</span></div><InvitationList invitations={invitations} onAction={(id, action) => void invitationAction(id, action)} /></section><section className="dashboard-section"><div className="section-heading"><div><p className="eyebrow">Archive</p><h2>Past meetings</h2></div></div><MeetingList meetings={past} onJoin={onJoin} onAnalytics={onAnalytics} /></section><section className="dashboard-section create-section" id="create-meeting"><div className="section-heading"><div><p className="eyebrow">Plan ahead</p><h2>Create a meeting</h2></div></div><form className="meeting-form" onSubmit={(event) => void submit(event)}><label>Title<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="form-row"><label>Scheduled date and time<input required type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} /></label><label>Duration<select value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })}><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="480">8 hours</option></select></label></div><label>Participant emails <span className="field-hint">comma separated</span><input value={form.participants} onChange={(event) => setForm({ ...form, participants: event.target.value })} placeholder="alex@example.com, jordan@example.com" /></label><button type="submit" disabled={isCreating}>{isCreating ? 'Creating...' : 'Create meeting'}</button></form></section></div>}</div></div></main>
}
