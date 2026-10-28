import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'

export const publicRouter = Router()

// A client kept separate from the shared service-role `supabase` client used for
// DB access. verifyOtp() sets an in-memory user session on whichever client runs
// it, and if that happened on the shared client its PostgREST calls would start
// using the recovery user's token instead of the service role, so every
// RLS-protected query would break until a restart. Admin calls (listUsers /
// updateUserById) are session-independent and stay on the shared client.
const authClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserByEmail(email: string) {
  const target = email.trim().toLowerCase()
  const perPage = 1000
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message)
    const match = data.users.find((u) => u.email?.toLowerCase() === target)
    if (match) return match
    if (data.users.length < perPage) return null
    page++
  }
}

// Step 1: only email a recovery code if the account actually exists, so the UI
// can show "no account found" instead of silently doing nothing (Supabase's own
// reset call never reveals whether the email matched).
publicRouter.post('/forgot-password/request', async (req, res) => {
  const { email } = req.body as { email?: string }
  if (!email?.trim()) {
    res.status(400).json({ error: 'email is required' })
    return
  }

  try {
    const user = await findUserByEmail(email)
    if (!user) {
      res.json({ exists: false })
      return
    }

    const { error } = await authClient.auth.resetPasswordForEmail(email.trim())
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ exists: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// Step 2: verify the emailed 6-digit code and set the new password. Both run on
// the server so the browser never holds a recovery session — the user just signs
// in normally with the new password afterwards.
publicRouter.post('/forgot-password/confirm', async (req, res) => {
  const { email, code, password } = req.body as { email?: string; code?: string; password?: string }

  if (!email?.trim() || !code?.trim() || !password) {
    res.status(400).json({ error: 'email, code and password are required' })
    return
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  try {
    const { data, error } = await authClient.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    })
    if (error || !data.user) {
      res.status(400).json({ error: 'Invalid or expired code' })
      return
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(data.user.id, { password })
    if (updateError) {
      res.status(400).json({ error: updateError.message })
      return
    }

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})
