import { useEffect, useState } from 'react'
import { getSession, onSessionChange, type StoredSession } from './lib/session'
import { startInactivityTracker, stopInactivityTracker } from './lib/inactivity'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [session, setSession] = useState<StoredSession | null>(getSession)

  useEffect(() => onSessionChange(setSession), [])

  useEffect(() => {
    if (!session) return
    startInactivityTracker()
    return () => stopInactivityTracker()
  }, [session])

  return session ? <Dashboard /> : <Login />
}
