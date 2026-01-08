import express from 'express'
import mongoose from 'mongoose'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/authRoutes.js'
import affiliatesRoutes from './routes/affiliates.js'
import homeContentRoutes from './routes/homeContent.js'
import mediaItemsRoutes from './routes/mediaItems.js'
import pricingRoutes from './routes/pricing.js'
import testimonialsRoutes from './routes/testimonials.js'
import dashboardRoutes from './routes/dashboard.js'
import settingsRoutes from './routes/settings.js'

import checkoutRouter from './routes/checkout.js'
import beforeAfterPairsRoutes from './routes/beforeAfterPairs.js'
dotenv.config()

const app = express()
app.use(express.json())
app.use(cookieParser())

// Allow multiple frontend origins for development
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  process.env.FRONTEND_ORIGIN,
].filter(Boolean)

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true)
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true,
  })
)

app.use('/api/auth', authRoutes)
app.use('/api/admin/affiliates', affiliatesRoutes)
app.use('/api/admin/home-content', homeContentRoutes)
app.use('/api/admin/media-items', mediaItemsRoutes)
app.use('/api/admin/pricing', pricingRoutes)
app.use('/api/admin/testimonials', testimonialsRoutes)
app.use('/api/admin/settings', settingsRoutes)
app.use('/api/admin', dashboardRoutes)
app.use('/api/checkout', checkoutRouter)
app.use('/api/admin/before-after-pairs', beforeAfterPairsRoutes)
// protected test route
import { requireAuth } from './middlewares/authMiddleware.js'
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

const PORT = process.env.PORT || 5000
async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    console.log('MongoDB connected')
    app.listen(PORT, () => console.log(`Server running on ${PORT}`))
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

// Global error handlers to prevent server crash and log errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
})
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

start()
