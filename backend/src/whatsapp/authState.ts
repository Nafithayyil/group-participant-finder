import { AuthenticationCreds, AuthenticationState, BufferJSON, initAuthCreds } from '@whiskeysockets/baileys'
import { supabase } from '../supabase'

const TABLE = 'whatsapp_auth_state'

// Every stored key is namespaced by the app user who owns the WhatsApp session,
// e.g. "<userId>:creds" or "<userId>:pre-key-7". This lets many users each keep
// their own independent WhatsApp login in the same shared table. A userId is a
// Supabase UUID, so it never contains the ':' separator.
function scopedKey(userId: string, key: string): string {
  return `${userId}:${key}`
}

const CREDS_SUFFIX = ':creds'

async function readData(key: string): Promise<any> {
  const { data, error } = await supabase.from(TABLE).select('value').eq('key', key).maybeSingle()
  if (error) throw error
  if (!data) return null
  return JSON.parse(JSON.stringify(data.value), BufferJSON.reviver)
}

async function writeData(key: string, value: unknown): Promise<void> {
  const serialized = JSON.parse(JSON.stringify(value, BufferJSON.replacer))
  const { error } = await supabase.from(TABLE).upsert({ key, value: serialized })
  if (error) throw error
}

async function removeData(key: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('key', key)
  if (error) throw error
}

/** Wipes one user's stored session so their next connect pairs via a fresh QR scan. */
export async function clearSession(userId: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().like('key', `${userId}:%`)
  if (error) throw error
}

export async function hasRegisteredSession(userId: string): Promise<boolean> {
  const creds = await readData(scopedKey(userId, 'creds'))
  return Boolean(creds?.registered)
}

/** Every user who has a paired session, used at boot to resume them all. */
export async function listRegisteredUserIds(): Promise<string[]> {
  const { data, error } = await supabase.from(TABLE).select('key, value').like('key', `%${CREDS_SUFFIX}`)
  if (error) throw error

  const userIds: string[] = []
  for (const row of data ?? []) {
    const creds = JSON.parse(JSON.stringify(row.value), BufferJSON.reviver)
    if (creds?.registered) {
      userIds.push((row.key as string).slice(0, -CREDS_SUFFIX.length))
    }
  }
  return userIds
}

/**
 * Baileys auth state (creds + signal keys) for one user, persisted in Supabase
 * instead of the filesystem so the WhatsApp login survives restarts even without
 * a guaranteed persistent volume. Keys are namespaced per user.
 */
export async function useSupabaseAuthState(userId: string): Promise<{
  state: AuthenticationState
  saveCreds: () => Promise<void>
}> {
  const storedCreds = await readData(scopedKey(userId, 'creds'))
  const creds: AuthenticationCreds = storedCreds ?? initAuthCreds()

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: Record<string, any> = {}
          await Promise.all(
            ids.map(async (id) => {
              const value = await readData(scopedKey(userId, `${type}-${id}`))
              data[id] = value
            })
          )
          return data
        },
        set: async (data) => {
          const tasks: Promise<void>[] = []
          for (const category of Object.keys(data)) {
            const entries = (data as Record<string, Record<string, unknown>>)[category]
            for (const id of Object.keys(entries)) {
              const value = entries[id]
              const key = scopedKey(userId, `${category}-${id}`)
              tasks.push(value ? writeData(key, value) : removeData(key))
            }
          }
          await Promise.all(tasks)
        },
      },
    },
    saveCreds: () => writeData(scopedKey(userId, 'creds'), creds),
  }
}
