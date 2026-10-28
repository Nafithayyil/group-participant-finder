type Page = 'send' | 'webhooks' | 'admins'

interface Props {
  page: Page
  onNavigate: (page: Page) => void
  connectionStatus: string
  onSignOut: () => void
}

export default function Navbar({ page, onNavigate, connectionStatus, onSignOut }: Props) {
  const linkClass = (target: Page) =>
    `text-sm ${page === target ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`

  return (
    <nav className="border-b border-slate-800 bg-slate-900">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold">Group Participant Viewer</span>
          <button onClick={() => onNavigate('send')} className={linkClass('send')}>
            Send
          </button>
          <button onClick={() => onNavigate('webhooks')} className={linkClass('webhooks')}>
            Webhooks
          </button>
          <button onClick={() => onNavigate('admins')} className={linkClass('admins')}>
            Admin numbers
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span
            className={`text-xs uppercase tracking-wide ${connectionStatus === 'open' ? 'text-emerald-400' : 'text-amber-400'}`}
          >
            {connectionStatus}
          </span>
          <button onClick={onSignOut} className="text-sm text-slate-400 hover:text-slate-200">
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
