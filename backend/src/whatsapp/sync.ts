import { getSocket } from './client'
import { supabase } from '../supabase'
import { getAdminNumbers } from '../adminNumbers'

// WhatsApp hides real phone numbers behind an anonymous LID (@lid) for many
// group participants as a privacy measure. Baileys only exposes the real
// number when WhatsApp reveals it to us (via participant.jid); otherwise the
// participant's `id` itself is the LID, and no phone number is recoverable.
function extractPhoneNumber(participantId: string, phoneJid: string | undefined): string | null {
  const pnJid = phoneJid ?? (participantId.endsWith('@s.whatsapp.net') ? participantId : null)
  if (!pnJid) return null
  return pnJid.split('@')[0].split(':')[0]
}

export interface NewParticipant {
  id: string
  phone_number: string | null
  participant_jid: string
}

export interface SyncResult {
  status: 'success' | 'error'
  newParticipantsCount: number
  errorMessage: string | null
  newParticipants: NewParticipant[]
}

/**
 * Fetches participants for one tracked group and inserts only rows that
 * don't already exist (group_jid, participant_jid). Purely an import — it
 * never sends anything anywhere; sending to a sales person is a separate,
 * explicit action from the Webhooks page. Used by both the manual per-group
 * "sync now" action and that group's own schedule (identical behavior).
 */
export async function runGroupSync(
  groupJid: string,
  triggerType: 'scheduled' | 'manual',
  userId: string
): Promise<SyncResult> {
  const startedAt = new Date().toISOString()
  let newParticipants: NewParticipant[] = []
  let status: 'success' | 'error' = 'success'
  let errorMessage: string | null = null

  try {
    const sock = getSocket(userId)
    const metadata = await sock.groupMetadata(groupJid)

    // Admin numbers are never imported, so they can't show up in a fetch or be sent.
    const adminNumbers = await getAdminNumbers()
    const rows = metadata.participants
      .map((p) => ({
        group_jid: groupJid,
        phone_number: extractPhoneNumber(p.id, p.jid),
        participant_jid: p.id,
      }))
      .filter((row) => !row.phone_number || !adminNumbers.has(row.phone_number))

    if (rows.length > 0) {
      // ON CONFLICT (group_jid, participant_jid) DO NOTHING RETURNING * — the
      // rows PostgREST hands back are exactly the ones newly inserted, which
      // is the diff we need without a separate read+compare.
      const { data: inserted, error: upsertError } = await supabase
        .from('participants')
        .upsert(rows, { onConflict: 'group_jid,participant_jid', ignoreDuplicates: true })
        .select('id, phone_number, participant_jid')

      if (upsertError) throw new Error(upsertError.message)
      newParticipants = inserted ?? []
    }
  } catch (err) {
    status = 'error'
    errorMessage = err instanceof Error ? err.message : String(err)
  }

  await supabase.from('sync_runs').insert({
    group_jid: groupJid,
    trigger_type: triggerType,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    groups_synced: status === 'success' ? 1 : 0,
    new_participants_count: newParticipants.length,
    status,
    error_message: errorMessage,
  })

  return { status, newParticipantsCount: newParticipants.length, errorMessage, newParticipants }
}
