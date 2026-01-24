import express from 'express'
import bcrypt from 'bcrypt'
import User from '../models/User.js'
import { signToken } from '../utils/auth.js'
import { requireAuth } from '../middlewares/authMiddleware.js'

const router = express.Router()
const COOKIE_NAME = process.env.COOKIE_NAME || 'dsqr_token'

// POST /api/auth/register  (optional)
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body
  if (!email || !password)
    return res.status(400).json({ message: 'Missing fields' })
  const existing = await User.findOne({ email })
  if (existing) return res.status(400).json({ message: 'User already exists' })
  const salt = await bcrypt.genSalt(10)
  const passwordHash = await bcrypt.hash(password, salt)
  const user = new User({ name, email, passwordHash, role: role || 'admin' })
  await user.save()
  res.status(201).json({ message: 'User created' })
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' })

    const user = await User.findOne({ email })
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })

    const match = await bcrypt.compare(password, user.passwordHash)
    if (!match) return res.status(401).json({ message: 'Invalid credentials' })

    const token = signToken({
      id: user._id,
      email: user.email,
      role: user.role,
    })

    // --- THE FIX: SET THE COOKIE ON THE SERVER ---
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true, // Prevents XSS attacks
      secure: true,   // Required for Vercel/HTTPS
      sameSite: 'none', // Required if frontend and backend domains differ
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/',
    })

    // Still return the token in JSON so your existing frontend code doesn't break
    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { email: user.email, name: user.name, role: user.role },
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
    })

    return res.json({ success: true, message: 'Logged out' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ message: 'Logout failed' })
  }
})
// POST /api/auth/change-password (protected route)
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    console.log('Password change request received for user:', req.user.id)

    // Validation
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: 'Current password and new password are required' })
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: 'New password must be at least 6 characters' })
    }

    // Get user from database
    const user = await User.findById(req.user.id)
    if (!user) {
      console.error('User not found:', req.user.id)
      return res.status(404).json({ message: 'User not found' })
    }

    console.log('User found:', user.email)

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isMatch) {
      console.log('Current password does not match')
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    console.log('Current password verified successfully')

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const newPasswordHash = await bcrypt.hash(newPassword, salt)

    console.log('New password hashed successfully')

    // Update password in database
    user.passwordHash = newPasswordHash
    await user.save()

    console.log('Password updated in database for user:', user.email)

    res.json({ message: 'Password changed successfully' })
  } catch (error) {
    console.error('Change password error:', error)
    res.status(500).json({ message: 'Server error while changing password' })
  }
})

export default router
