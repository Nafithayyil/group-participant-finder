import { signOut } from './session'

const IDLE_LIMIT_MS = 24 * 60 * 60 * 1000 // 1 day
const STORAGE_KEY = 'gpv_last_activity'
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const

let checkTimer: ReturnType<typeof setInterval> | undefined
let lastWrite = 0

function markActivity() {
  const now = Date.now()
  if (now - lastWrite < 30_000) return // avoid hammering localStorage on every mousemove
  lastWrite = now
  try {
    localStorage.setItem(STORAGE_KEY, String(now))
  } catch {
    // localStorage unavailable (private browsing etc.) — inactivity logout just won't apply
  }
}

function checkIdle() {
  let lastActivity: number
  try {
    lastActivity = Number(localStorage.getItem(STORAGE_KEY)) || Date.now()
  } catch {
    return
  }

  if (Date.now() - lastActivity > IDLE_LIMIT_MS) {
    signOut()
  }
}

/** Signs the user out after 24h of no interaction, even across browser restarts. */
export function startInactivityTracker() {
  markActivity()
  ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActivity, { passive: true }))
  checkTimer = setInterval(checkIdle, 60_000)
  checkIdle()
}

export function stopInactivityTracker() {
  ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActivity))
  if (checkTimer) clearInterval(checkTimer)
}
