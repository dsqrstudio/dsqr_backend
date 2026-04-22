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
import reorderRoutes from './routes/reorder.js'
import healthRoutes from './routes/health.js'
dotenv.config()

const app = express()

// CORS for Vercel and local dev: allow production and localhost
const allowedOrigins = [
  'https://dsqr-admin-panel.vercel.app',
  'https://dsqr-check-new-x2m3.vercel.app',
  'https://dsqr-check-new-bc6n.vercel.app',
  'https://dsqr-admin-panel-eta.vercel.app',
  'https://dsqr.studio',
  'https://admin.dsqr.studio',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
]
// app.use(
//   cors({
//     origin: function (origin, callback) {
//       // Allow requests with no origin (like mobile apps, curl, etc.)
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         callback(new Error('Not allowed by CORS'));
//       }
//     },
//     credentials: true,
//   })
// )
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
)

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));   // 🔥 VERY IMPORTANT

app.use(express.json())
app.use(cookieParser())

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
app.use('/api/admin/reorder', reorderRoutes)
app.use('/api/health', healthRoutes)
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
