import { FormEvent, useEffect, useState } from 'react'
import api from '../lib/api'
import ConfirmDialog from '../components/ConfirmDialog'

interface Webhook {
  id: string
  name: string
  url: string
}

function apiError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error) return response.data.error
  }
  return fallback
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Webhook | null>(null)

  async function load() {
    const { data } = await api.get<{ webhooks: Webhook[] }>('/webhooks')
    setWebhooks(data.webhooks)
  }

  useEffect(() => {
    load().catch(() => {})
  }, [])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await api.post('/webhooks', { name, url })
      setName('')
      setUrl('')
      await load()
    } catch (err) {
      setError(apiError(err, 'Could not save the webhook.'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(webhook: Webhook) {
    setDeleting(null)
    try {
      await api.delete(`/webhooks/${webhook.id}`)
      await load()
    } catch (err) {
      setError(apiError(err, 'Could not delete the webhook.'))
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-medium">Add webhook</h2>
        <form onSubmit={add} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm text-slate-400">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Sales team"
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-400">Webhook URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              type="url"
              placeholder="https://…"
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add webhook'}
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-medium">Your webhooks</h2>
        {webhooks.length === 0 ? (
          <p className="text-sm text-slate-500">No webhooks yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {webhooks.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{w.name}</p>
                  <p className="truncate text-xs text-slate-500">{w.url}</p>
                </div>
                <button
                  onClick={() => setDeleting(w)}
                  className="shrink-0 text-sm text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete webhook?"
        message={`"${deleting?.name}" will be removed.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => deleting && remove(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
