import { FormEvent, useState } from 'react'
import api from '../lib/api'

type Step = 'email' | 'code' | 'done'

function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error) return response.data.error
  }
  return fallback
}

export default function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleRequest(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { data } = await api.post('/public/forgot-password/request', { email })
      if (!data.exists) {
        setError('No account found with that email.')
        return
      }
      setStep('code')
    } catch (err) {
      setError(errorMessage(err, 'Could not send the code. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirm(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/public/forgot-password/confirm', { email, code, password })
      setStep('done')
    } catch (err) {
      setError(errorMessage(err, 'Could not reset the password. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-lg font-semibold">Reset password</h1>

        {step === 'email' && (
          <form onSubmit={handleRequest} className="space-y-4">
            <p className="text-sm text-slate-400">
              Enter your account email and we&apos;ll send you a verification code.
            </p>
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

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Send code'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleConfirm} className="space-y-4">
            <p className="text-sm text-slate-400">
              Enter the code sent to <span className="text-slate-200">{email}</span> and choose a new
              password.
            </p>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Verification code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm tracking-widest"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">New password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Confirm new password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? 'Updating…' : 'Reset password'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setStep('email')
              }}
              className="w-full text-xs text-slate-400 hover:text-slate-200"
            >
              Use a different email
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="space-y-4">
            <p className="text-sm text-emerald-400">
              Your password has been updated. You can now sign in with your new password.
            </p>
            <button
              onClick={onBack}
              className="w-full rounded bg-emerald-600 px-3 py-2 text-sm font-medium hover:bg-emerald-500"
            >
              Back to sign in
            </button>
          </div>
        )}

        {step !== 'done' && (
          <button
            type="button"
            onClick={onBack}
            className="w-full text-sm text-slate-400 hover:text-slate-200"
          >
            Back to sign in
          </button>
        )}
      </div>
    </div>
  )
}
