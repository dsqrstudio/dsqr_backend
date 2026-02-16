import express from 'express'
import BeforeAfterPair from '../models/BeforeAfterPair.js'
import redisClient from '../config/redis.js'
// import { requireAuth } from '../middlewares/authMiddleware.js'

const router = express.Router()

// Create a before/after pair
router.post(
  '/',
  /* requireAuth, */ async (req, res) => {
    try {
      const { before, after, order } = req.body
      if (!before || !after) {
        return res.status(400).json({
          success: false,
          error: 'Both before and after videos are required',
        })
      }
      const pair = new BeforeAfterPair({ before, after, order })
      await pair.save()
      // Invalidate cache after create
      redisClient.del('beforeAfterPairs:all')
      res.json({ success: true, data: pair })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  },
)

// Get all before/after pairs
router.get(
  '/',
  /* requireAuth, */ async (req, res) => {
    try {
      // Ensure Redis client is ready
      if (!redisClient.isOpen) {
        console.warn('[beforeAfterPairs] Redis client not open, connecting...')
        try {
          await redisClient.connect()
          console.log('[beforeAfterPairs] Redis client connected')
        } catch (connectErr) {
          console.error('[beforeAfterPairs] Redis connect error:', connectErr)
        }
      }
      let cached = null
      try {
        console.log(
          '[beforeAfterPairs] Trying Redis GET for beforeAfterPairs:all',
        )
        cached = await redisClient.get('beforeAfterPairs:all')
        console.log(
          '[beforeAfterPairs] Redis GET result:',
          cached ? 'HIT' : 'MISS',
        )
      } catch (redisError) {
        console.error('[beforeAfterPairs] Redis get error:', redisError)
      }
      if (cached) {
        return res.json(JSON.parse(cached))
      }
      const pairs = await BeforeAfterPair.find().sort({
        order: 1,
        createdAt: -1,
      })
      const response = { success: true, data: pairs }
      try {
        console.log('[beforeAfterPairs] Saving to Redis')
        await redisClient.set(
          'beforeAfterPairs:all',
          JSON.stringify(response),
          { EX: 60 },
        )
        console.log('[beforeAfterPairs] Saved to Redis')
      } catch (setErr) {
        console.error('[beforeAfterPairs] Redis set error:', setErr)
      }
      res.json(response)
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  },
)

// Delete a pair
router.delete(
  '/:id',
  /* requireAuth, */ async (req, res) => {
    try {
      const { id } = req.params
      await BeforeAfterPair.findByIdAndDelete(id)
      // Invalidate cache after delete
      redisClient.del('beforeAfterPairs:all')
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  },
)

export default router
