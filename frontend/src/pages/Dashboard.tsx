import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { getAccessToken, signOut } from '../lib/session'
import api from '../lib/api'
import Navbar from '../components/Navbar'
import WhatsAppConnect from '../components/WhatsAppConnect'
import SendPage from './SendPage'
import WebhooksPage from './WebhooksPage'
import AdminNumbersPage from './AdminNumbersPage'

const SOCKET_URL = import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).origin : undefined

export default function Dashboard() {
  const [status, setStatus] = useState('idle')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [page, setPage] = useState<'send' | 'webhooks' | 'admins'>('send')

  useEffect(() => {
    let socket: Socket | undefined

    api.get<{ status: string; qr: string | null }>('/whatsapp/status').then(({ data }) => {
      setStatus(data.status)
      setQrDataUrl(data.qr)
    })

    // The socket authenticates with the user's token so the backend delivers
    // only this user's WhatsApp status/QR events.
    getAccessToken().then((token) => {
      socket = io(SOCKET_URL, { path: '/socket.io', auth: { token } })
      socket.on('whatsapp:status', (newStatus: string) => {
        setStatus(newStatus)
        if (newStatus === 'open') setQrDataUrl(null)
      })
      socket.on('whatsapp:qr', (dataUrl: string) => setQrDataUrl(dataUrl))
    })

    return () => {
      socket?.disconnect()
    }
  }, [])

  const connected = status === 'open'

  // Until WhatsApp is connected, show nothing but the connect/QR screen — no
  // groups and no webhooks. Removing the connection returns here and forces a
  // fresh QR scan to reconnect.
  if (!connected) {
    return (
      <div className="min-h-screen">
        <nav className="border-b border-slate-800 bg-slate-900">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <span className="font-semibold">Group Participant Viewer</span>
            <button
              onClick={signOut}
              className="text-sm text-slate-400 hover:text-slate-200"
            >
              Sign out
            </button>
          </div>
        </nav>
        <main className="mx-auto max-w-3xl px-4 py-8">
          <WhatsAppConnect status={status} qrDataUrl={qrDataUrl} />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Navbar
        page={page}
        onNavigate={setPage}
        connectionStatus={status}
        onSignOut={signOut}
      />

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        {page === 'send' && <SendPage status={status} qrDataUrl={qrDataUrl} />}
        {page === 'webhooks' && <WebhooksPage />}
        {page === 'admins' && <AdminNumbersPage />}
      </main>
    </div>
  )
}
