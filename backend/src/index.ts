import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { createServer } from 'http'
import { router } from './api/routes'
import { publicRouter } from './api/public-routes'
import { requireAuth } from './api/auth-middleware'
import { initSocket } from './socket'
import { autoResumeSessions } from './whatsapp/client'

const app = express()
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? '*' }))
app.use(express.json())

// Public endpoints (forgot-password) must be reachable without a session, so
// they are mounted before the auth-protected router.
app.use('/api/public', publicRouter)
app.use('/api', requireAuth, router)

// The frontend is built into ./frontend/dist alongside this compiled backend
// (see the root Dockerfile) so the whole app ships as a single container.
const frontendDist = path.join(__dirname, '../frontend/dist')
app.use(express.static(frontendDist))
app.get('*', (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')))

const server = createServer(app)
initSocket(server)

const port = Number(process.env.PORT ?? 4000)

async function main() {
  await autoResumeSessions()
  server.listen(port, () => console.log(`Server listening on :${port}`))
}

main().catch((err) => {
  console.error('Failed to start server', err)
  process.exit(1)
})
