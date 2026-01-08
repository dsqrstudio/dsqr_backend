import express from 'express'
import MediaItem from '../models/MediaItem.js'
// import { requireAuth } from '../middlewares/authMiddleware.js'

const router = express.Router()

// GET dashboard statistics
router.get(
  '/dashboard-stats',
  /* requireAuth, */ async (req, res) => {
    try {
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

      res.json({
        success: true,
        totalItems,
        totalVideos,
        totalImages,
        portfolioVideos,
        beforeAfterVideos,
        recentUploads,
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard statistics',
      })
    }
  }
)

export default router
