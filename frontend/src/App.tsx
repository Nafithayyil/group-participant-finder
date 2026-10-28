import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'
import { startInactivityTracker, stopInactivityTracker } from './lib/inactivity'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    startInactivityTracker()
    return () => stopInactivityTracker()
  }, [session])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading…
      </div>
    )
  }

  return session ? <Dashboard /> : <Login />
}
