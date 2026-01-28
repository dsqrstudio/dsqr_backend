import express from 'express'
import HomeContent from '../models/HomeContent.js'
import mongoose from 'mongoose'
import { requireAuth } from '../middlewares/authMiddleware.js'

const router = express.Router()

// GET Bunny config for direct upload (libraryId, apiKey)
router.get('/services_offered/config', requireAuth, async (req, res) => {
  try {
    const { BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY } =
      await import('../config/bunny.js')
    if (!BUNNY_STREAM_LIBRARY_ID || !BUNNY_STREAM_API_KEY) {
      return res
        .status(500)
        .json({ success: false, error: 'Bunny Stream not configured' })
    }
    return res.json({
      success: true,
      libraryId: BUNNY_STREAM_LIBRARY_ID,
      apiKey: BUNNY_STREAM_API_KEY,
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

// POST save a new Service Offered video (after direct upload)
router.post('/services_offered/save', requireAuth, async (req, res) => {
  try {
    const { guid, url, poster } = req.body || {}
    if (!guid || !url) {
      return res
        .status(400)
        .json({ success: false, error: 'guid and url are required' })
    }
    // Add to videos array in HomeContent
    const update = {
      $push: {
        'data.videos': {
          url,
          poster: poster || '',
          guid,
          uploadedAt: new Date(),
        },
      },
    }
    await HomeContent.findOneAndUpdate(
      { section: 'services_offered' },
      update,
      { upsert: true, new: true },
    ).lean()
    res.json({ success: true })
  } catch (error) {
    console.error('Error saving Service Offered video:', error)
    res.status(500).json({ success: false, error: 'Failed to save video' })
  }
})

// GET all home content sections
router.get(
  '/',
  /* requireAuth, */ async (req, res) => {
    try {
      const sections = await HomeContent.find().sort({ section: 1 }).lean()
      res.json({ success: true, data: sections })
    } catch (error) {
      console.error('Error fetching home content:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to fetch home content' })
    }
  },
)

// GET specific section (FIXED: Uses native driver to ensure data is retrieved)
router.get(
  '/:section',
  /* requireAuth, */ async (req, res) => {
    try {
      const { section } = req.params

      // Use the native MongoDB collection to find the document.
      // This is the most reliable way to retrieve Schema.Types.Mixed content.
      const collection = mongoose.connection.collection(
        HomeContent.collection.name,
      )
      const content = await collection.findOne({ section: section })

      if (!content) {
        return res
          .status(404)
          .json({ success: false, error: 'Section not found' })
      }

      // Return the native MongoDB object, which correctly serializes the array.
      // This still conforms to the frontend's expected format: { success: true, data: { ...document... } }
      res.json({ success: true, data: content })
    } catch (error) {
      console.error('Error fetching section with native driver:', error)
      res.status(500).json({ success: false, error: 'Failed to fetch section' })
    }
  },
)

// POST/PUT update section (FIXED: Uses .lean() for consistency)
router.post(
  '/:section',
  /* requireAuth, */ async (req, res) => {
    try {
      const { section } = req.params
      const { data } = req.body

      if (!data) {
        return res
          .status(400)
          .json({ success: false, error: 'Data is required' })
      }

      // Use .lean() to ensure the returned document is correctly structured
      const content = await HomeContent.findOneAndUpdate(
        { section },
        { data },
        { upsert: true, new: true },
      ).lean()

      res.json({ success: true, data: content })
    } catch (error) {
      console.error('Error updating section:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to update section' })
    }
  },
)

// DELETE section
router.delete(
  '/:section',
  /* requireAuth, */ async (req, res) => {
    try {
      const { section } = req.params
      await HomeContent.findOneAndDelete({ section })
      res.json({ success: true, message: 'Section deleted successfully' })
    } catch (error) {
      console.error('Error deleting section:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to delete section' })
    }
  },
)

export default router
