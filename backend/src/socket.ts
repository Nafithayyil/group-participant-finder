import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { supabase } from './supabase'

let io: Server | undefined

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: process.env.FRONTEND_ORIGIN ?? '*' },
  })

  // Each socket proves who it is with the user's Supabase access token, then
  // joins a room named after their user id. WhatsApp status/QR events are then
  // delivered only to that user, never broadcast to everyone.
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) {
      next(new Error('unauthorized'))
      return
    }
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      next(new Error('unauthorized'))
      return
    }
    socket.data.userId = data.user.id
    next()
  })

  io.on('connection', (socket) => {
    socket.join(socket.data.userId as string)
  })

  return io
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(userId).emit(event, payload)
}
