import axios from 'axios'
import { supabase } from './supabase'
import { getAdminNumbers } from './adminNumbers'

export interface WebhookSendResult {
  count: number
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 1500): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (attempt < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw lastErr
}

const MARK_SENT_BATCH_SIZE = 100

/**
 * Sends every not-yet-sent participant of one group to a chosen webhook, then
 * marks them sent. "Not yet sent" means sent_at is null, so a number is only
 * ever delivered once no matter how many times the group is fetched.
 */
export async function sendGroupUnsentToWebhook(
  groupJid: string,
  webhookId: string,
  participantIds: string[]
): Promise<WebhookSendResult> {
  if (participantIds.length === 0) return { count: 0 }

  const { data: webhook, error: webhookError } = await supabase
    .from('webhooks')
    .select('id, name, url')
    .eq('id', webhookId)
    .single()

  if (webhookError || !webhook) throw new Error('Webhook not found')

  const { data: group } = await supabase
    .from('tracked_groups')
    .select('group_name')
    .eq('group_jid', groupJid)
    .single()

  // Only the ids from the latest fetch are looked up (in batches, since the id
  // filter goes in the URL), and still only if they haven't been sent yet.
  const rows: { id: string; phone_number: string | null; participant_jid: string }[] = []
  for (let i = 0; i < participantIds.length; i += MARK_SENT_BATCH_SIZE) {
    const { data, error: rowsError } = await supabase
      .from('participants')
      .select('id, phone_number, participant_jid')
      .eq('group_jid', groupJid)
      .is('sent_at', null)
      .in('id', participantIds.slice(i, i + MARK_SENT_BATCH_SIZE))
    if (rowsError) throw new Error(rowsError.message)
    rows.push(...(data ?? []))
  }

  // Rows imported before a number was added as an admin are skipped here too.
  const adminNumbers = await getAdminNumbers()
  const participants = rows.filter((p) => !p.phone_number || !adminNumbers.has(p.phone_number))
  if (participants.length === 0) return { count: 0 }

  // Real phone numbers go out with a leading "+"; anonymous @lid ids have no
  // number, so they're sent as-is.
  const numbers = participants.map((p) => (p.phone_number ? `+${p.phone_number}` : p.participant_jid))
  try {
    await withRetry(() =>
      axios.post(webhook.url, {
        group_name: group?.group_name ?? groupJid,
        numbers,
      })
    )
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const body =
        typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data)
      throw new Error(`Webhook rejected the request (${err.response.status}): ${body}`)
    }
    throw err
  }

  // The id filter goes in the request URL, so a whole group's worth of UUIDs
  // overflows it and PostgREST rejects the request — update in batches.
  const sentAt = new Date().toISOString()
  const ids = participants.map((p) => p.id)
  for (let i = 0; i < ids.length; i += MARK_SENT_BATCH_SIZE) {
    const { error } = await withRetry(async () =>
      supabase
        .from('participants')
        .update({
          sent_via_webhook_id: webhook.id,
          status: 'sent',
          sent_at: sentAt,
        })
        .in('id', ids.slice(i, i + MARK_SENT_BATCH_SIZE))
    )
    if (error) throw new Error(`Numbers were sent, but marking them as sent failed: ${error.message}`)
  }

  return { count: numbers.length }
}
