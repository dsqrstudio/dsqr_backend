import express from 'express'
import MediaItem from '../models/MediaItem.js'
import { requireAuth } from '../middlewares/authMiddleware.js'
import redisClient from '../config/redis.js'

const router = express.Router()

// GET dashboard statistics (with Redis cache)
router.get('/dashboard-stats', requireAuth, async (req, res) => {
  try {
    redisClient.get('dashboard:stats', async (err, cached) => {
      if (err) console.error('Redis get error:', err)
      if (cached) return res.json(JSON.parse(cached))
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
      redisClient.setex('dashboard:stats', 60, JSON.stringify(response))
      res.json(response)
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard statistics',
    })
  }
})

export default router
