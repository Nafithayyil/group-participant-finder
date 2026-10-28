import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { createClient } from '@supabase/supabase-js'

export const publicRouter = Router()

// Login goes through the backend so the browser never needs the Supabase URL or
// key. A fresh client is used per call: signing in sets an in-memory user
// session on whichever client runs it, which must never leak between requests.
function authClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// Slows down password guessing: 10 attempts per 15 minutes per IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
})

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again in a few minutes.' },
})

interface SessionPayload {
  access_token: string
  refresh_token: string
  expires_at: number
}

function toPayload(session: {
  access_token: string
  refresh_token: string
  expires_at?: number
}): SessionPayload {
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
  }
}

publicRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email?.trim() || !password) {
    res.status(400).json({ error: 'email and password are required' })
    return
  }

  const { data, error } = await authClient().auth.signInWithPassword({ email: email.trim(), password })
  if (error || !data.session) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }
  res.json(toPayload(data.session))
})

publicRouter.post('/refresh', refreshLimiter, async (req, res) => {
  const { refresh_token } = req.body as { refresh_token?: string }
  if (!refresh_token) {
    res.status(400).json({ error: 'refresh_token is required' })
    return
  }

  const { data, error } = await authClient().auth.refreshSession({ refresh_token })
  if (error || !data.session) {
    res.status(401).json({ error: 'Session expired' })
    return
  }
  res.json(toPayload(data.session))
})
