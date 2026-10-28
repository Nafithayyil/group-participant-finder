import { useState } from 'react'
import api from '../lib/api'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  status: string
  qrDataUrl: string | null
}

// Phone linked to a laptop — decorative, so it works offline and in any theme.
function LinkIllustration({ connected }: { connected: boolean }) {
  const accent = connected ? '#10b981' : '#64748b'
  return (
    <svg viewBox="0 0 160 110" className="h-24 w-36 shrink-0" aria-hidden="true">
      <rect x="6" y="14" width="44" height="82" rx="8" fill="#0f172a" stroke="#334155" strokeWidth="2" />
      <rect x="12" y="24" width="32" height="58" rx="3" fill="#052e1c" />
      <circle cx="28" cy="53" r="12" fill="#25d366" />
      <path
        d="M22.5 58.5l1.3-4.2a7 7 0 1 1 2.6 2.5z"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <rect x="22" y="87" width="12" height="3" rx="1.5" fill="#334155" />

      <rect x="92" y="26" width="62" height="42" rx="4" fill="#0f172a" stroke="#334155" strokeWidth="2" />
      <rect x="98" y="32" width="50" height="30" rx="2" fill="#020617" />
      <path d="M84 72h78l-6 8H90z" fill="#1e293b" />
      <rect x="104" y="38" width="20" height="3" rx="1.5" fill={accent} />
      <rect x="104" y="45" width="36" height="3" rx="1.5" fill="#334155" />
      <rect x="104" y="52" width="28" height="3" rx="1.5" fill="#334155" />

      <path
        d="M56 55 C68 40, 76 40, 88 48"
        fill="none"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={connected ? undefined : '4 5'}
      />
      <circle cx="72" cy="43" r="7" fill={connected ? '#10b981' : '#1e293b'} stroke={accent} strokeWidth="2" />
      {connected ? (
        <path d="M68.8 43.2l2.2 2.2 4.2-4.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      ) : (
        <path d="M69.5 43h5" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
      )}
    </svg>
  )
}

const STATUS_TEXT: Record<string, string> = {
  idle: 'Not connected',
  logged_out: 'Not connected',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  qr: 'Waiting for scan',
  open: 'Connected',
}

export default function WhatsAppConnect({ status, qrDataUrl }: Props) {
  const [busy, setBusy] = useState<'connect' | 'remove' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  const connected = status === 'open'
  const inProgress = status === 'connecting' || status === 'reconnecting'
  const showQr = status === 'qr' && qrDataUrl

  // Resumes the saved session if there is one; the backend falls back to a
  // QR (pushed over the socket) when there isn't.
  async function connect() {
    setBusy('connect')
    setError(null)
    try {
      await api.post('/whatsapp/connect')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not start the connection.')
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setConfirmingRemove(false)
    setBusy('remove')
    setError(null)
    try {
      await api.post('/whatsapp/remove')
    } catch (err: any) {
      setError(err?.response?.data?.error ?? 'Could not remove the connection.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      className={`rounded-lg border p-4 ${connected ? 'border-emerald-900 bg-emerald-950/30' : 'border-slate-800 bg-slate-900'}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <LinkIllustration connected={connected} />

        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="font-medium">WhatsApp</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                connected ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-800 text-amber-300'
              }`}
            >
              {STATUS_TEXT[status] ?? status}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            {connected
              ? 'Your WhatsApp is linked. Groups and members are read from this account.'
              : showQr
                ? 'Open WhatsApp on your phone → Settings → Linked devices → Link a device, then scan the code.'
                : 'Link your WhatsApp account to read groups and send members to your webhooks.'}
          </p>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2">
          {showQr ? (
            <img src={qrDataUrl!} alt="WhatsApp QR code" className="h-44 w-44 rounded bg-white p-2" />
          ) : connected ? (
            <button
              onClick={() => setConfirmingRemove(true)}
              disabled={busy !== null}
              className="rounded border border-red-900 px-3 py-2 text-sm text-red-400 hover:bg-red-950 disabled:opacity-50"
            >
              {busy === 'remove' ? 'Removing…' : 'Remove connection'}
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={busy !== null || inProgress}
              className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === 'connect' || inProgress ? 'Connecting…' : 'Connect WhatsApp'}
            </button>
          )}
          {showQr && (
            <button
              onClick={remove}
              disabled={busy !== null}
              className="text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmingRemove}
        title="Remove WhatsApp connection?"
        message="This device will be logged out of WhatsApp. You will need to scan a new QR code to connect again."
        confirmLabel="Remove"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmingRemove(false)}
      />
    </section>
  )
}
