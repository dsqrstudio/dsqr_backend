import express from 'express'
import BeforeAfterPair from '../models/BeforeAfterPair.js'
import { requireAuth } from '../middlewares/authMiddleware.js'

const router = express.Router()

// Create a before/after pair
router.post('/', requireAuth, async (req, res) => {
  try {
    const { before, after, order } = req.body
    if (!before || !after) {
      return res
        .status(400)
        .json({
          success: false,
          error: 'Both before and after videos are required',
        })
    }
    const pair = new BeforeAfterPair({ before, after, order })
    await pair.save()
    res.json({ success: true, data: pair })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Get all before/after pairs
router.get('/', requireAuth, async (req, res) => {
  try {
    const pairs = await BeforeAfterPair.find().sort({ order: 1, createdAt: -1 })
    res.json({ success: true, data: pairs })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Delete a pair
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    await BeforeAfterPair.findByIdAndDelete(id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
