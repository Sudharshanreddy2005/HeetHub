import { type ReactNode } from 'react'

type SidebarProps = {
  path: string
  onNavigate: (path: string) => void
  children?: ReactNode
}

const items = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Meetings', path: '/meetings' },
  { label: 'Invitations', path: '/invitations' },
  { label: 'Analytics', path: '/analytics' },
  { label: 'Settings', path: '/settings' },
]

export function Sidebar({ path, onNavigate, children }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand sidebar-brand"><span className="brand-mark">MH</span><span>MeetHub</span></div>
      <nav className="sidebar-nav" aria-label="Sidebar navigation">
        {items.map((item) => {
          const isActive = path === item.path || (item.path === '/analytics' && path.match(/^\/meetings\/[^/]+\/analytics$/))
          return (
            <button
              key={item.path}
              type="button"
              className={`nav-button${isActive ? ' nav-button-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(item.path)}
            >
              {item.label}
            </button>
          )
        })}
      </nav>
      {children}
    </aside>
  )
}
