import express from 'express'
import Settings from '../models/Settings.js'
// import { requireAuth } from '../middlewares/authMiddleware.js'

const router = express.Router()

// GET setting by key
import redisClient from '../config/redis.js'
router.get(
  '/:key',
  /* requireAuth, */ async (req, res) => {
    try {
      const { key } = req.params
      const cacheKey = `settings:${key}`
      redisClient.get(cacheKey, async (err, cached) => {
        if (err) console.error('Redis get error:', err)
        if (cached) return res.json(JSON.parse(cached))
        const setting = await Settings.findOne({ key })
        if (!setting) {
          const defaults = {
            ourWorkStats: {
              videosEdited: '11,000+',
              clientTimeSaved: '54k+',
              organicViews: '22M+',
              timeSavedPerClient: '4h/Day',
            },
            promotionalDiscount: {
              enabled: false,
              percentage: 30,
              name: 'Black Friday Sale',
            },
          }
          const response = { success: true, data: defaults[key] || {} }
          redisClient.setex(cacheKey, 60, JSON.stringify(response))
          return res.json(response)
        }
        const response = { success: true, data: setting.data }
        redisClient.setex(cacheKey, 60, JSON.stringify(response))
        res.json(response)
      })
    } catch (error) {
      console.error('Error fetching setting:', error)
      res.status(500).json({ success: false, error: 'Failed to fetch setting' })
    }
  },
)

// POST/UPDATE setting
router.post(
  '/:key',
  /* requireAuth, */ async (req, res) => {
    try {
      const { key } = req.params
      const { data } = req.body

      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Data is required',
        })
      }

      const setting = await Settings.findOneAndUpdate(
        { key },
        { data },
        { upsert: true, new: true, runValidators: true },
      )
      // Invalidate cache after update
      redisClient.del(`settings:${key}`)
      res.json({ success: true, data: setting.data })
    } catch (error) {
      console.error('Error saving setting:', error)
      res.status(500).json({ success: false, error: 'Failed to save setting' })
    }
  },
)

export default router
