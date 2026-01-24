// utils/auth.js or similar
import { verifyToken } from '../utils/auth.js'

export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const decoded = verifyToken(token)
    req.user = decoded
    next() // Proceed to the actual API logic
  } catch (err) {
    return res.status(401).json({ message: 'Session expired. Please login again.' })
  }
}