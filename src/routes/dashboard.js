import express from 'express'
import MediaItem from '../models/MediaItem.js'
import { requireAuth } from '../middlewares/authMiddleware.js'
import redisClient from '../config/redis.js'

const router = express.Router()

// GET dashboard statistics (with Redis cache)
router.get('/dashboard-stats', requireAuth, async (req, res) => {
  try {
    // Ensure Redis client is ready
    if (!redisClient.isOpen) {
      console.warn('[dashboard] Redis client not open, connecting...')
      try {
        await redisClient.connect()
        console.log('[dashboard] Redis client connected')
      } catch (connectErr) {
        console.error('[dashboard] Redis connect error:', connectErr)
      }
    }
    let cached = null
    try {
      console.log('[dashboard] Trying Redis GET for dashboard:stats')
      cached = await redisClient.get('dashboard:stats')
      console.log('[dashboard] Redis GET result:', cached ? 'HIT' : 'MISS')
    } catch (redisError) {
      console.error('[dashboard] Redis get error:', redisError)
    }
    if (cached) {
      return res.json(JSON.parse(cached))
    }
    // Count total items
    const totalItems = await MediaItem.countDocuments()
    // Count by type
    const totalVideos = await MediaItem.countDocuments({ type: 'video' })
    const totalImages = await MediaItem.countDocuments({ type: 'image' })
    // Count specific categories
    const portfolioVideos = await MediaItem.countDocuments({
      category: 'portfolio_video',
    })
    const beforeAfterVideos = await MediaItem.countDocuments({
      category: 'about_us_before_after',
    })
    // Get recent uploads (last 10)
    const recentUploads = await MediaItem.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('type src poster category createdAt')
      .lean()
    const response = {
      success: true,
      totalItems,
      totalVideos,
      totalImages,
      portfolioVideos,
      beforeAfterVideos,
      recentUploads,
    }
    try {
      console.log('[dashboard] Saving to Redis')
      await redisClient.set('dashboard:stats', JSON.stringify(response), {
        EX: 60,
      })
      console.log('[dashboard] Saved to Redis')
    } catch (setErr) {
      console.error('[dashboard] Redis set error:', setErr)
    }
    res.json(response)
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
    })
  }
})

export default router
