import { NextFunction, Request, Response } from 'express'
import { supabase } from '../supabase'

// Requests that have passed requireAuth carry the authenticated user's id.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined

  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' })
    return
  }

  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) {
    res.status(401).json({ error: 'Invalid or expired session' })
    return
  }

  req.userId = data.user.id
  next()
}
