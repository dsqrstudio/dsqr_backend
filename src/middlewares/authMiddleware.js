import { verifyToken } from '../utils/auth.js';

export function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[process.env.COOKIE_NAME || 'dsqr_token'];
    if (!token) return res.status(401).json({ message: 'Not authenticated' });
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}
