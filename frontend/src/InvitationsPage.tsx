import { useCallback, useEffect, useState } from 'react'
import { fetchInvitations, type Invitation, updateInvitation, type User } from './features/meeting/meetingApi'
import { Sidebar } from './Sidebar'

type InvitationsPageProps = { user: User; authToken: string; path: string; onNavigate: (path: string) => void; onLogout: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void }

const formatDate = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

export function InvitationsPage({ user, authToken, path, onNavigate, onLogout, theme, onToggleTheme }: InvitationsPageProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setInvitations(await fetchInvitations(authToken)) }
    catch (loadError) { const message = loadError instanceof Error ? loadError.message : 'Unable to load invitations'; setError(message); if (message.includes('expired')) onLogout() }
    finally { setLoading(false) }
  }, [authToken, onLogout])
  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  const respond = async (id: string, action: 'accept' | 'decline') => {
    setUpdating(id); setError('')
    try { await updateInvitation(authToken, id, action); await load() }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'Unable to update invitation') }
    finally { setUpdating('') }
  }

  return <main className="app-shell" data-theme={theme}><div className="dashboard-shell"><Sidebar path={path} onNavigate={onNavigate}><div className="sidebar-card"><p className="eyebrow">Inbox</p><strong>{user.username}</strong><span>Invitations received by your account.</span></div></Sidebar><div className="main-panel"><header className="app-header"><div className="header-group"><p className="eyebrow">Private workspace</p><h2>Invitations</h2></div><div className="header-user"><button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button><span>{user.username}</span><button type="button" className="button-quiet" onClick={onLogout}>Log out</button></div></header><section className="page-intro"><p className="eyebrow">Your inbox</p><h1>Invitations</h1><p>Review meeting invitations sent to your authenticated account.</p></section>{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p className="loading-state">Loading invitations...</p> : invitations.length ? <div className="page-list">{invitations.map((invitation) => <article className="meeting-card invitation-card" key={invitation.id}><div className="meeting-card-heading"><div><p className="card-kicker">{invitation.invitation_status}</p><h3>{invitation.meeting_title}</h3></div><span>{formatDate(invitation.scheduled_at)}</span></div><p>Hosted by {invitation.host_username} · {invitation.duration_minutes} min</p>{invitation.invitation_status === 'PENDING' && <div className="card-actions"><button type="button" disabled={updating === invitation.id} onClick={() => void respond(invitation.id, 'accept')}>Accept</button><button type="button" className="button-muted" disabled={updating === invitation.id} onClick={() => void respond(invitation.id, 'decline')}>Decline</button></div>}</article>)}</div> : <p className="empty-state">No invitations yet.</p>}</div></div></main>
}
