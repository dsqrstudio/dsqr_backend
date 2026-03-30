import express from 'express'
import Pricing from '../models/Pricing.js'
// import { requireAuth } from '../middlewares/authMiddleware.js';

const router = express.Router()

// GET all pricing data
import redisClient from '../config/redis.js';

async function invalidatePricingCache() {
  if (redisClient.isOpen) {
    try {
      await redisClient.del('pricing:all');
      console.log('[REDIS] Invalidated pricing:all');
    } catch (err) {
      console.error('[REDIS] Error invalidating pricing cache:', err);
    }
  }
}
router.get('/', async (req, res) => {
  try {
    console.log('[pricing] Route hit')
    // Check if Redis client is ready
    if (!redisClient.isOpen) {
      console.warn('[pricing] Redis client not open, connecting...')
      try {
        await redisClient.connect()
        console.log('[pricing] Redis client connected')
      } catch (connectErr) {
        console.error('[pricing] Redis connect error:', connectErr)
      }
    }

    let cached = null
    try {
      console.log('[pricing] Trying Redis GET for pricing:all')
      cached = await redisClient.get('pricing:all')
      console.log('[pricing] Redis GET result:', cached ? 'HIT' : 'MISS')
    } catch (redisError) {
      console.error('[pricing] Redis get error:', redisError)
    }

    if (cached) {
      console.log('[pricing] Returning cached data')
      return res.json(JSON.parse(cached))
    }

    console.log('[pricing] Querying MongoDB for pricing')
    const pricing = await Pricing.find().sort({ category: 1, level: 1 }).lean()
    console.log('[pricing] MongoDB result count:', pricing.length)
    const formattedPricing = {}
    pricing.forEach((item) => {
      if (!formattedPricing[item.category]) {
        formattedPricing[item.category] = {}
      }
      formattedPricing[item.category][item.level] = {
        base: { USD: item.base.USD, CAD: item.base.CAD },
      }
      if (item.fast.USD !== null || item.fast.CAD !== null) {
        formattedPricing[item.category][item.level].fast = {
          USD: item.fast.USD,
          CAD: item.fast.CAD,
        }
      }
    })

    const response = { success: true, data: formattedPricing }

    try {
      console.log('[pricing] Saving to Redis')
      await redisClient.set('pricing:all', JSON.stringify(response), { EX: 86400 })
      console.log('[pricing] Saved to Redis')
    } catch (setErr) {
      console.error('[pricing] Redis set error:', setErr)
    }

    res.json(response)
  } catch (error) {
    console.error('[pricing] Error fetching pricing:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch pricing' })
  }
})

// POST/PUT update all pricing data
router.post(
  '/',
  /* requireAuth, */ async (req, res) => {
    try {
      const pricingData = req.body
      if (!pricingData || typeof pricingData !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Invalid pricing data',
        })
      }
      await Pricing.deleteMany({})
      const pricingItems = []
      for (const [category, levels] of Object.entries(pricingData)) {
        for (const [level, data] of Object.entries(levels)) {
          const levelNum = parseInt(level)
          if (isNaN(levelNum) || levelNum < 1 || levelNum > 3) {
            continue
          }
          const pricingItem = {
            category,
            level: levelNum,
            base: {
              USD: data.base?.USD || 0,
              CAD: data.base?.CAD || 0,
            },
            fast: {
              USD: data.fast?.USD || null,
              CAD: data.fast?.CAD || null,
            },
          }
          pricingItems.push(pricingItem)
        }
      }
      if (pricingItems.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid pricing data provided',
        })
      }
      await Pricing.insertMany(pricingItems)
      // Invalidate cache after update
      await invalidatePricingCache()
      res.json({ success: true, message: 'Pricing updated successfully' })
    } catch (error) {
      console.error('Error updating pricing:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to update pricing' })
    }
  },
)

// GET specific category pricing
router.get(
  '/:category',
  /* requireAuth, */ async (req, res) => {
    try {
      const { category } = req.params
      const pricing = await Pricing.find({ category }).sort({ level: 1 }).lean()

      if (pricing.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Pricing not found for this category',
        })
      }

      // Transform to match frontend structure
      const formattedPricing = {}
      pricing.forEach((item) => {
        formattedPricing[item.level] = {
          base: {
            USD: item.base.USD,
            CAD: item.base.CAD,
          },
        }

        if (item.fast.USD !== null || item.fast.CAD !== null) {
          formattedPricing[item.level].fast = {
            USD: item.fast.USD,
            CAD: item.fast.CAD,
          }
        }
      })

      res.json({ success: true, data: formattedPricing })
    } catch (error) {
      console.error('Error fetching category pricing:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to fetch category pricing' })
    }
  },
)

// PUT update specific category pricing
router.put(
  '/:category',
  /* requireAuth, */ async (req, res) => {
    try {
      const { category } = req.params
      const levelsData = req.body

      if (!levelsData || typeof levelsData !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Invalid levels data',
        })
      }

      // Delete existing pricing for this category
      await Pricing.deleteMany({ category })

      // Insert new pricing for this category
      const pricingItems = []

      for (const [level, data] of Object.entries(levelsData)) {
        const levelNum = parseInt(level)

        if (isNaN(levelNum) || levelNum < 1 || levelNum > 3) {
          continue
        }

        const pricingItem = {
          category,
          level: levelNum,
          base: {
            USD: data.base?.USD || 0,
            CAD: data.base?.CAD || 0,
          },
          fast: {
            USD: data.fast?.USD || null,
            CAD: data.fast?.CAD || null,
          },
        }

        pricingItems.push(pricingItem)
      }

      if (pricingItems.length > 0) {
        await Pricing.insertMany(pricingItems)
      }

      await invalidatePricingCache();
      res.json({
        success: true,
        message: 'Category pricing updated successfully',
      })
    } catch (error) {
      console.error('Error updating category pricing:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to update category pricing' })
    }
  },
)

export default router
