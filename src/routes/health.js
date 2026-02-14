import express from 'express'
import redisClient from '../config/redis.js'

const router = express.Router()

// Health check endpoint for Redis
router.get('/redis', async (req, res) => {
  try {
    // Try a simple ping command
    const pong = await redisClient.ping()
    res.json({ status: 'ok', message: pong })
  } catch (error) {
    res
      .status(500)
      .json({ status: 'error', error: error.message, details: error })
  }
})

export default router
