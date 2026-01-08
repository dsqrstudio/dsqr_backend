import express from 'express'
import Settings from '../models/Settings.js'
import { requireAuth } from '../middlewares/authMiddleware.js'

const router = express.Router()

// GET setting by key
router.get('/:key', requireAuth, async (req, res) => {
  try {
    const { key } = req.params
    const setting = await Settings.findOne({ key })

    if (!setting) {
      // Return default values if not found
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

      return res.json({ success: true, data: defaults[key] || {} })
    }

    res.json({ success: true, data: setting.data })
  } catch (error) {
    console.error('Error fetching setting:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch setting' })
  }
})

// POST/UPDATE setting
router.post('/:key', requireAuth, async (req, res) => {
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
      { upsert: true, new: true, runValidators: true }
    )

    res.json({ success: true, data: setting.data })
  } catch (error) {
    console.error('Error saving setting:', error)
    res.status(500).json({ success: false, error: 'Failed to save setting' })
  }
})

export default router
