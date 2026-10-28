import { FormEvent, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import ForgotPassword from './ForgotPassword'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot'>('login')

  if (mode === 'forgot') {
    return <ForgotPassword onBack={() => setMode('login')} />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)

    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6"
      >
        <h1 className="text-lg font-semibold">Group Participant Viewer</h1>

        <div className="space-y-1">
          <label className="text-sm text-slate-400">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-slate-400">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null)
            setMode('forgot')
          }}
          className="w-full text-sm text-slate-400 hover:text-slate-200"
        >
          Forgot password?
        </button>
      </form>
    </div>
  )
}
