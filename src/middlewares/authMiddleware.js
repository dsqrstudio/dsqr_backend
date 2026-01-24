import { verifyToken } from '../utils/auth.js'

export function requireAuth(req, res, next) {
  try {
    // Read JWT from Authorization header: Bearer <token>
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (!token) return res.status(401).json({ message: 'Not authenticated' })
    const decoded = verifyToken(token)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}
