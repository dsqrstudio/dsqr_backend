import { verifyToken } from '../utils/auth.js'

export function requireAuth(req, res, next) {
  try {
    // Extract cookie from headers for Vercel compatibility
    const cookieHeader = req.headers['cookie'] || ''
    const cookieName = process.env.COOKIE_NAME || 'dsqr_token'
    let token = ''
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`${cookieName}=([^;]+)`))
      if (match) token = match[1]
    }
    if (!token) return res.status(401).json({ message: 'Not authenticated' })
    const decoded = verifyToken(token)
    req.user = decoded
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' })
  }
}
