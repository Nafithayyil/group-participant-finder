import { Router } from 'express'
import { supabase } from '../supabase'
import { getConnectionStatus, getLatestQr, getSocket, removeWhatsApp, startWhatsApp } from '../whatsapp/client'
import { runGroupSync } from '../whatsapp/sync'
import { sendGroupUnsentToWebhook } from '../webhookSend'
import { normalizePhone } from '../adminNumbers'

export const router = Router()

// --- WhatsApp connection (one session per logged-in user) ---

router.get('/whatsapp/status', (req, res) => {
  const userId = req.userId!
  res.json({ status: getConnectionStatus(userId), qr: getLatestQr(userId) })
})

router.post('/whatsapp/connect', async (req, res) => {
  const userId = req.userId!
  try {
    await startWhatsApp(userId)
    res.json({ ok: true, status: getConnectionStatus(userId) })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

router.post('/whatsapp/remove', async (req, res) => {
  const userId = req.userId!
  try {
    await removeWhatsApp(userId)
    res.json({ ok: true, status: getConnectionStatus(userId) })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// --- Groups ---

router.get('/groups', async (req, res) => {
  const userId = req.userId!
  try {
    const sock = getSocket(userId)
    const groups = await sock.groupFetchAllParticipating()
    const list = Object.values(groups).map((g) => ({ id: g.id, subject: g.subject }))
    res.json({ groups: list })
  } catch {
    res.status(503).json({ error: 'WhatsApp is not connected yet' })
  }
})

// Groups the user has fetched before, so the picker still works (and remembers
// names) even when WhatsApp isn't connected to provide the live list.
router.get('/groups/tracked', async (_req, res) => {
  const { data, error } = await supabase
    .from('tracked_groups')
    .select('group_jid, group_name')
    .eq('is_active', true)
    .order('group_name')

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ groups: data })
})

// Fetch new members of a group: remember the group, then import only members
// not seen before. Returns just the brand-new numbers from this fetch.
router.post('/groups/:groupJid/fetch', async (req, res) => {
  const userId = req.userId!
  const { groupJid } = req.params
  const { group_name } = req.body as { group_name?: string }

  const { error: trackError } = await supabase
    .from('tracked_groups')
    .upsert(
      { group_jid: groupJid, group_name: group_name?.trim() ?? null, is_active: true },
      { onConflict: 'group_jid' }
    )

  if (trackError) {
    res.status(500).json({ error: trackError.message })
    return
  }

  const result = await runGroupSync(groupJid, 'manual', userId)
  if (result.status === 'error') {
    res.status(502).json({ error: result.errorMessage ?? 'Could not fetch the group' })
    return
  }

  res.json({
    newCount: result.newParticipantsCount,
    newNumbers: result.newParticipants.map((p) => p.phone_number ?? p.participant_jid),
    newIds: result.newParticipants.map((p) => p.id),
  })
})

// Send only the numbers from the latest fetch (by participant id) to a chosen webhook.
router.post('/groups/:groupJid/send', async (req, res) => {
  const { webhookId, participantIds } = req.body as { webhookId?: string; participantIds?: string[] }
  if (!webhookId) {
    res.status(400).json({ error: 'webhookId is required' })
    return
  }

  try {
    const result = await sendGroupUnsentToWebhook(
      req.params.groupJid,
      webhookId,
      Array.isArray(participantIds) ? participantIds : []
    )
    res.json({ ok: true, count: result.count })
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) })
  }
})

// --- Webhooks (just a name + URL) ---

router.get('/webhooks', async (_req, res) => {
  const { data, error } = await supabase.from('webhooks').select('id, name, url').order('name')
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ webhooks: data })
})

router.post('/webhooks', async (req, res) => {
  const { name, url } = req.body as { name?: string; url?: string }
  if (!name?.trim() || !url?.trim()) {
    res.status(400).json({ error: 'name and url are required' })
    return
  }

  const { data, error } = await supabase
    .from('webhooks')
    .insert({ name: name.trim(), url: url.trim() })
    .select('id, name, url')
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ webhook: data })
})

router.put('/webhooks/:id', async (req, res) => {
  const { name, url } = req.body as { name?: string; url?: string }
  if (!name?.trim() || !url?.trim()) {
    res.status(400).json({ error: 'name and url are required' })
    return
  }

  const { data, error } = await supabase
    .from('webhooks')
    .update({ name: name.trim(), url: url.trim() })
    .eq('id', req.params.id)
    .select('id, name, url')
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ webhook: data })
})

router.delete('/webhooks/:id', async (req, res) => {
  const { error } = await supabase.from('webhooks').delete().eq('id', req.params.id)
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ ok: true })
})

// --- Admin numbers (never fetched, never sent) ---

router.get('/admin-numbers', async (_req, res) => {
  const { data, error } = await supabase
    .from('admin_numbers')
    .select('phone_number, created_at')
    .order('created_at', { ascending: false })
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ numbers: data })
})

router.post('/admin-numbers', async (req, res) => {
  const { phone_number } = req.body as { phone_number?: string }
  const phone = normalizePhone(phone_number ?? '')
  if (phone.length < 8 || phone.length > 15) {
    res.status(400).json({ error: 'Enter a valid number with country code, e.g. 919961027338' })
    return
  }

  const { error } = await supabase
    .from('admin_numbers')
    .upsert({ phone_number: phone }, { onConflict: 'phone_number', ignoreDuplicates: true })
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ ok: true, phone_number: phone })
})

router.delete('/admin-numbers/:phone', async (req, res) => {
  const { error } = await supabase.from('admin_numbers').delete().eq('phone_number', req.params.phone)
  if (error) {
    res.status(500).json({ error: error.message })
    return
  }
  res.json({ ok: true })
})
