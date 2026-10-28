import { supabase } from './supabase'

/** Keeps digits only, so "+91 99610 27338" and "919961027338" are the same number. */
export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

export async function getAdminNumbers(): Promise<Set<string>> {
  const { data, error } = await supabase.from('admin_numbers').select('phone_number')
  if (error) throw new Error(`Could not load admin numbers: ${error.message}`)
  return new Set((data ?? []).map((row) => row.phone_number))
}
