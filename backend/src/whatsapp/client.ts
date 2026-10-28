import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, WASocket } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import qrcode from 'qrcode'
import pino from 'pino'
import { clearSession, hasRegisteredSession, listRegisteredUserIds, useSupabaseAuthState } from './authState'
import { emitToUser } from '../socket'

type Status = 'idle' | 'connecting' | 'qr' | 'open' | 'reconnecting' | 'logged_out'

// One independent WhatsApp session per app user, so each user links their own
// phone while sharing the same database. Keyed by Supabase user id.
interface Session {
  sock?: WASocket
  status: Status
  starting: boolean
  latestQr: string | null
}

const sessions = new Map<string, Session>()

function getSession(userId: string): Session {
  let session = sessions.get(userId)
  if (!session) {
    session = { sock: undefined, status: 'idle', starting: false, latestQr: null }
    sessions.set(userId, session)
  }
  return session
}

export function getSocket(userId: string): WASocket {
  const session = sessions.get(userId)
  if (!session || !session.sock || session.status !== 'open') {
    throw new Error('WhatsApp is not connected yet')
  }
  return session.sock
}

export function getConnectionStatus(userId: string): Status {
  return sessions.get(userId)?.status ?? 'idle'
}

/** The current QR (as a data URL) while waiting for a scan, so a page opened mid-pairing can show it. */
export function getLatestQr(userId: string): string | null {
  const session = sessions.get(userId)
  return session && session.status === 'qr' ? session.latestQr : null
}

/** Called at server boot: silently reconnects every user who already has a paired session. */
export async function autoResumeSessions(): Promise<void> {
  const userIds = await listRegisteredUserIds()
  for (const userId of userIds) {
    await startWhatsApp(userId).catch((err) => console.error(`Failed to resume WhatsApp for ${userId}`, err))
  }
}

export async function startWhatsApp(userId: string): Promise<void> {
  const session = getSession(userId)
  if (session.starting || session.status === 'open') return
  session.starting = true
  session.status = 'connecting'
  emitToUser(userId, 'whatsapp:status', session.status)

  const { state, saveCreds } = await useSupabaseAuthState(userId)
  const { version } = await fetchLatestBaileysVersion()

  const thisSock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  })
  session.sock = thisSock

  thisSock.ev.on('creds.update', saveCreds)

  thisSock.ev.on('connection.update', async (update) => {
    // Ignore late events from a socket that removeWhatsApp() already discarded.
    if (session.sock !== thisSock) return

    const { connection, lastDisconnect, qr } = update

    if (qr) {
      session.status = 'qr'
      const qrDataUrl = await qrcode.toDataURL(qr)
      session.latestQr = qrDataUrl
      emitToUser(userId, 'whatsapp:qr', qrDataUrl)
      emitToUser(userId, 'whatsapp:status', session.status)
    }

    if (connection === 'open') {
      session.status = 'open'
      session.latestQr = null
      emitToUser(userId, 'whatsapp:status', session.status)
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut

      console.error('WhatsApp connection closed', { userId, statusCode, shouldReconnect, error: lastDisconnect?.error })

      session.status = shouldReconnect ? 'reconnecting' : 'logged_out'
      emitToUser(userId, 'whatsapp:status', session.status)

      if (shouldReconnect) {
        startWhatsApp(userId).catch((err) => console.error('Failed to reconnect WhatsApp', err))
      } else {
        // Unlinked from the phone: the stored keys are dead, so drop them and
        // the next "Connect" goes straight to a fresh QR.
        session.sock = undefined
        clearSession(userId).catch((err) => console.error('Failed to clear WhatsApp session', err))
      }
    }
  })

  session.starting = false
}

/**
 * Unlinks one user's device from WhatsApp and deletes their stored session, so
 * the only way back in is a new QR scan. Works whether or not the socket is
 * currently open.
 */
export async function removeWhatsApp(userId: string): Promise<void> {
  const session = getSession(userId)
  const current = session.sock
  session.sock = undefined
  session.latestQr = null
  session.starting = false

  if (current) {
    if (session.status === 'open') {
      await current.logout().catch((err) => console.error('WhatsApp logout failed', err))
    } else {
      current.end(undefined)
    }
  }

  await clearSession(userId)
  session.status = 'logged_out'
  emitToUser(userId, 'whatsapp:status', session.status)
}
