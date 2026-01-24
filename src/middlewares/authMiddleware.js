import { verifyToken } from '../utils/auth.js';

export function requireAuth(req, res, next) {
  try {
    // 1. Check Authorization Header (Bearer <token>)
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];

    // 2. Fallback: Check Cookies (Required for your Middleware/Vercel)
    if (!token && req.cookies) {
      token = req.cookies['dsqr_token'];
    }

    if (!token) {
      console.warn('[Auth] No token found in headers or cookies');
      return res.status(401).json({ message: 'Authentication required' });
    }

    // 3. Verify the token
    const decoded = verifyToken(token);
    
    // Attach user to request
    req.user = decoded;
    
    next(); 
  } catch (err) {
    console.error('[Auth] Token verification failed:', err.message);
    return res.status(401).json({ 
      message: 'Session expired or invalid. Please login again.' 
    });
  }
}