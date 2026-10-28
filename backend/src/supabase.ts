import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
}

// Backend always uses the service-role key so it bypasses RLS; the frontend
// only ever talks to Supabase Auth directly with the anon key.
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})
