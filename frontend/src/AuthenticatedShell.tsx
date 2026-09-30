import { useRef, useState, type ReactNode } from 'react'
import { fetchInvitations, fetchMeetings, type Invitation, type Meeting, type User } from './features/meeting/meetingApi'

type SearchResult = { id: string; title: string; detail: string; destination: string }

type AuthenticatedShellProps = {
  user: User
  authToken: string
  path: string
  theme: 'light' | 'dark'
  onNavigate: (path: string) => void
  onLogout: () => void
  onToggleTheme: () => void
  children: ReactNode
}

function getPageTitle(path: string) {
  if (path === '/meetings') return 'Meetings'
  if (path === '/invitations') return 'Invitations'
  if (path === '/analytics' || /\/meetings\/[^/]+\/analytics$/.test(path)) return 'Analytics'
  if (path === '/settings') return 'Settings'
  return 'Dashboard'
}

function getSearchResults(meetings: Meeting[], invitations: Invitation[], query: string): SearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (normalizedQuery.length < 2) return []

  const meetingResults = meetings
    .filter((meeting) => [meeting.title, meeting.description, meeting.host_username, meeting.status].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    .map((meeting) => ({ id: `meeting-${meeting.id}`, title: meeting.title, detail: `${meeting.status} meeting · hosted by ${meeting.host_username}`, destination: '/meetings' }))
  const invitationResults = invitations
    .filter((invitation) => [invitation.meeting_title, invitation.host_username, invitation.invitation_status].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    .map((invitation) => ({ id: `invitation-${invitation.id}`, title: invitation.meeting_title, detail: `Invitation · ${invitation.invitation_status.toLocaleLowerCase()} · ${invitation.host_username}`, destination: '/invitations' }))

  return [...meetingResults, ...invitationResults].slice(0, 6)
}

export function AuthenticatedShell({ user, authToken, path, theme, onNavigate, onLogout, onToggleTheme, children }: AuthenticatedShellProps) {
  const [query, setQuery] = useState('')
  const [searchData, setSearchData] = useState<{ meetings: Meeting[]; invitations: Invitation[] } | null>(null)
  const [isSearching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [isSearchOpen, setSearchOpen] = useState(false)
  const searchLoadStarted = useRef(false)
  const results = searchData ? getSearchResults(searchData.meetings, searchData.invitations, query) : []

  const loadSearchData = () => {
    if (searchData || searchLoadStarted.current) return
    searchLoadStarted.current = true
    setSearching(true)
    setSearchError('')
    Promise.all([
      fetchMeetings(authToken),
      fetchMeetings(authToken, '/meetings/past'),
      fetchInvitations(authToken),
    ])
      .then(([upcoming, past, invitations]) => {
        setSearchData({ meetings: [...upcoming, ...past], invitations })
      })
      .catch((error: unknown) => {
        searchLoadStarted.current = false
        setSearchError(error instanceof Error ? error.message : 'Search is unavailable right now.')
      })
      .finally(() => setSearching(false))
  }

  const openCreateMeeting = () => {
    if (path !== '/dashboard') {
      onNavigate('/dashboard')
      window.setTimeout(() => document.querySelector('.create-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200)
      return
    }
    document.querySelector('.create-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const pageTitle = getPageTitle(path)

  return (
    <div className="authenticated-shell" data-theme={theme}>
      <div className="dashboard-shell">
        <div className="main-panel">
          <header className="app-header authenticated-header">
            <div className="header-group">
              <p className="eyebrow">MeetHub workspace</p>
              <h2>{pageTitle}</h2>
            </div>
            <div className="header-search-wrap">
              <label className="header-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => {
                    const value = event.target.value
                    setQuery(value)
                    setSearchOpen(true)
                    if (value.trim().length < 2) setSearchError('')
                    else loadSearchData()
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
                  aria-label="Search meetings and invitations"
                  aria-expanded={isSearchOpen}
                  aria-controls="workspace-search-results"
                  placeholder="Search meetings and invitations"
                />
              </label>
              {isSearchOpen && query.trim().length >= 2 && (
                <div className="header-search-results" id="workspace-search-results" role="listbox" aria-label="Search results">
                  {isSearching ? <p className="search-result-state">Searching your meetings and invitations...</p> : searchError ? <p className="search-result-state" role="alert">{searchError}</p> : results.length ? results.map((result) => (
                    <button
                      type="button"
                      className="search-result"
                      key={result.id}
                      role="option"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => { setSearchOpen(false); setQuery(''); onNavigate(result.destination) }}
                    >
                      <strong>{result.title}</strong>
                      <span>{result.detail}</span>
                    </button>
                  )) : <p className="search-result-state">No matching meetings or invitations.</p>}
                </div>
              )}
            </div>
            <div className="header-user">
              <button type="button" className="create-meeting-action" onClick={openCreateMeeting} aria-label="Create a meeting">+ <span>Create</span></button>
              <button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
              <span className="header-username">{user.username}</span>
              <button type="button" className="button-quiet" onClick={onLogout}>Log out</button>
            </div>
          </header>
          <div className="authenticated-content">{children}</div>
        </div>
      </div>
    </div>
  )
}
