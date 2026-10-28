import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useGroupOptions } from '../lib/useGroupOptions'
import GroupSelect from '../components/GroupSelect'
import WhatsAppConnect from '../components/WhatsAppConnect'

interface Webhook {
  id: string
  name: string
  url: string
}

interface FetchResult {
  newCount: number
  newNumbers: string[]
  newIds: string[]
}

function apiError(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err && 'response' in err) {
    const response = (err as { response?: { data?: { error?: string } } }).response
    if (response?.data?.error) return response.data.error
  }
  return fallback
}

export default function SendPage({
  status,
  qrDataUrl,
}: {
  status: string
  qrDataUrl: string | null
}) {
  // SendPage only renders while WhatsApp is connected, so groups are always
  // loaded from the live connection.
  const { groupOptions } = useGroupOptions(true)
  const [groupJid, setGroupJid] = useState('')
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [webhookId, setWebhookId] = useState('')

  const [fetching, setFetching] = useState(false)
  const [sending, setSending] = useState(false)
  const [fetchResult, setFetchResult] = useState<FetchResult | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ webhooks: Webhook[] }>('/webhooks')
      .then(({ data }) => setWebhooks(data.webhooks))
      .catch(() => {})
  }, [])

  const groupName = groupOptions.find((g) => g.id === groupJid)?.subject ?? null

  function resetFeedback() {
    setFetchResult(null)
    setMessage(null)
    setError(null)
  }

  async function fetchNumbers() {
    if (!groupJid) return
    setFetching(true)
    resetFeedback()
    try {
      const { data } = await api.post<FetchResult>(`/groups/${encodeURIComponent(groupJid)}/fetch`, {
        group_name: groupName,
      })
      setFetchResult(data)
      setMessage(
        data.newCount > 0
          ? `${data.newCount} new number${data.newCount === 1 ? '' : 's'} fetched.`
          : 'No new numbers since the last fetch.'
      )
    } catch (err) {
      setError(apiError(err, 'Could not fetch numbers. Is WhatsApp connected?'))
    } finally {
      setFetching(false)
    }
  }

  async function send() {
    if (!groupJid || !webhookId) return
    setSending(true)
    setMessage(null)
    setError(null)
    try {
      const { data } = await api.post<{ count: number }>(`/groups/${encodeURIComponent(groupJid)}/send`, {
        webhookId,
        participantIds: fetchResult?.newIds ?? [],
      })
      setMessage(
        data.count > 0
          ? `Sent ${data.count} number${data.count === 1 ? '' : 's'} to the webhook.`
          : 'Nothing to send — fetch new numbers first.'
      )
    } catch (err) {
      setError(apiError(err, 'Could not send to the webhook.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <WhatsAppConnect status={status} qrDataUrl={qrDataUrl} />

      <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h2 className="font-medium">Send numbers</h2>

        {/* 1. Choose the group */}
        <div className="space-y-1">
          <label className="text-sm text-slate-400">1. Group</label>
          <GroupSelect
            value={groupJid}
            onChange={(v) => {
              setGroupJid(v)
              resetFeedback()
            }}
            options={groupOptions}
            currentName={groupName}
          />
        </div>

        {/* 2. Fetch new numbers */}
        <div className="space-y-1">
          <label className="text-sm text-slate-400">2. Fetch new numbers</label>
          <button
            onClick={fetchNumbers}
            disabled={!groupJid || fetching}
            className="w-full rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
          >
            {fetching ? 'Fetching…' : 'Fetch new numbers'}
          </button>
        </div>

        {/* 3. Send to a webhook */}
        <div className="space-y-1">
          <label className="text-sm text-slate-400">3. Send to webhook</label>
          <select
            value={webhookId}
            onChange={(e) => setWebhookId(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            <option value="">Choose a webhook…</option>
            {webhooks.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          {webhooks.length === 0 && (
            <p className="text-xs text-slate-500">No webhooks yet — add one on the Webhooks page.</p>
          )}
        </div>

        <button
          onClick={send}
          disabled={!groupJid || !webhookId || sending || !fetchResult?.newIds?.length}
          className="w-full rounded bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send to webhook'}
        </button>

        {message && <p className="text-sm text-emerald-400">{message}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {fetchResult && fetchResult.newNumbers.length > 0 && (
          <div className="rounded border border-slate-800 bg-slate-950 p-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
              New numbers ({fetchResult.newCount})
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-300">
              {fetchResult.newNumbers.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
