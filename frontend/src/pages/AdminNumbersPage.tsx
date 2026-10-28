import { FormEvent, useEffect, useState } from 'react'
import api from '../lib/api'
import ConfirmDialog from '../components/ConfirmDialog'

interface AdminNumber {
  phone_number: string
}

function apiError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error) return response.data.error
  }
  return fallback
}

export default function AdminNumbersPage() {
  const [numbers, setNumbers] = useState<AdminNumber[]>([])
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<AdminNumber | null>(null)

  async function load() {
    const { data } = await api.get<{ numbers: AdminNumber[] }>('/admin-numbers')
    setNumbers(data.numbers)
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.post('/admin-numbers', { phone_number: phone })
      setPhone('')
      await load()
    } catch (err) {
      setError(apiError(err, 'Could not save the number.'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(item: AdminNumber) {
    setDeleting(null)
    try {
      await api.delete(`/admin-numbers/${encodeURIComponent(item.phone_number)}`)
      await load()
    } catch (err) {
      setError(apiError(err, 'Could not delete the number.'))
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-medium">Add admin number</h2>
        <p className="text-sm text-slate-500">
          Admin numbers are skipped when fetching and are never sent to a webhook.
        </p>
        <form onSubmit={add} className="space-y-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="With country code, e.g. 919961027338"
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Done'}
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-medium">Admin numbers ({numbers.length})</h2>
        {numbers.length === 0 ? (
          <p className="text-sm text-slate-500">No admin numbers yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {numbers.map((n) => (
              <li key={n.phone_number} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm">{n.phone_number}</span>
                <button
                  onClick={() => setDeleting(n)}
                  className="shrink-0 text-sm text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleting !== null}
        title="Remove admin number?"
        message={`${deleting?.phone_number} will be fetched and sent like any other number.`}
        confirmLabel="Remove"
        danger
        onConfirm={() => deleting && remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
