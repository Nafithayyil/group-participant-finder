import axios from 'axios'

// Login is handled by our own backend, so the browser never holds a Supabase
// URL or key — only the user's session tokens.

export interface StoredSession {
  access_token: string
  refresh_token: string
  expires_at: number // seconds since epoch
}

const STORAGE_KEY = 'gpv_session'
const REFRESH_MARGIN_SECONDS = 60

// Plain client (no auth interceptor) for the public login/refresh endpoints.
const publicApi = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api' })

type Listener = (session: StoredSession | null) => void
const listeners = new Set<Listener>()
let refreshing: Promise<StoredSession | null> | null = null

export function getSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

function setSession(session: StoredSession | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage unavailable — the session just won't survive a reload
  }
  listeners.forEach((listener) => listener(session))
}

export function onSessionChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function signIn(email: string, password: string): Promise<void> {
  try {
    const { data } = await publicApi.post<StoredSession>('/public/login', { email, password })
    setSession(data)
  } catch (err) {
    const message = (err as { response?: { data?: { error?: string } } }).response?.data?.error
    throw new Error(message ?? 'Could not sign in. Is the server running?')
  }
}

export function signOut() {
  setSession(null)
}

async function refresh(session: StoredSession): Promise<StoredSession | null> {
  try {
    const { data } = await publicApi.post<StoredSession>('/public/refresh', {
      refresh_token: session.refresh_token,
    })
    setSession(data)
    return data
  } catch {
    setSession(null)
    return null
  }
}

/** A valid access token, refreshing it first if it is about to expire. */
export async function getAccessToken(): Promise<string | null> {
  const session = getSession()
  if (!session) return null
  if (session.expires_at - Date.now() / 1000 > REFRESH_MARGIN_SECONDS) return session.access_token

  refreshing ??= refresh(session).finally(() => {
    refreshing = null
  })
  const next = await refreshing
  return next?.access_token ?? null
}
