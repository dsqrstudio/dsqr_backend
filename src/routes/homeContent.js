import express from 'express'
import HomeContent from '../models/HomeContent.js'
import { requireAuth } from '../middlewares/authMiddleware.js'
import mongoose from 'mongoose' // Import mongoose for native driver access
import multer from 'multer'
import { uploadToBunnyStream } from '../utils/bunny.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })
// GET all Service Offered videos (returns array of video objects)
router.get('/services_offered/videos', requireAuth, async (req, res) => {
  try {
    const doc = await HomeContent.findOne({
      section: 'services_offered',
    }).lean()
    const videos = Array.isArray(doc?.data?.videos) ? doc.data.videos : []
    res.json({ success: true, data: videos })
  } catch (error) {
    console.error('Error fetching Service Offered videos:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch videos' })
  }
})

// POST upload a new Service Offered video (adds to array)
router.post(
  '/services_offered/upload',
  requireAuth,
  upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file
      if (!file)
        return res
          .status(400)
          .json({ success: false, error: 'File is required' })
      // Upload to Bunny Stream
      const { hlsUrl, thumbnailUrl, guid } = await uploadToBunnyStream(
        file.buffer,
        file.originalname
      )
      if (!hlsUrl)
        return res
          .status(500)
          .json({ success: false, error: 'Bunny upload failed' })
      // Add to videos array in HomeContent
      const update = {
        $push: {
          'data.videos': {
            url: hlsUrl,
            poster: thumbnailUrl,
            guid,
            uploadedAt: new Date(),
          },
        },
      }
      const doc = await HomeContent.findOneAndUpdate(
        { section: 'services_offered' },
        update,
        { upsert: true, new: true }
      ).lean()
      res.json({
        success: true,
        data: { url: hlsUrl, poster: thumbnailUrl, guid },
      })
    } catch (error) {
      console.error('Error uploading Service Offered video:', error)
      res.status(500).json({ success: false, error: 'Failed to upload video' })
    }
  }
)

// GET all home content sections
router.get('/', requireAuth, async (req, res) => {
  try {
    const sections = await HomeContent.find().sort({ section: 1 }).lean()
    res.json({ success: true, data: sections })
  } catch (error) {
    console.error('Error fetching home content:', error)
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch home content' })
  }
})

// GET specific section (FIXED: Uses native driver to ensure data is retrieved)
router.get('/:section', requireAuth, async (req, res) => {
  try {
    const { section } = req.params

    // Use the native MongoDB collection to find the document.
    // This is the most reliable way to retrieve Schema.Types.Mixed content.
    const collection = mongoose.connection.collection(
      HomeContent.collection.name
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
})

// POST/PUT update section (FIXED: Uses .lean() for consistency)
router.post('/:section', requireAuth, async (req, res) => {
  try {
    const { section } = req.params
    const { data } = req.body

    if (!data) {
      return res.status(400).json({ success: false, error: 'Data is required' })
    }

    // Use .lean() to ensure the returned document is correctly structured
    const content = await HomeContent.findOneAndUpdate(
      { section },
      { data },
      { upsert: true, new: true }
    ).lean()

    res.json({ success: true, data: content })
  } catch (error) {
    console.error('Error updating section:', error)
    res.status(500).json({ success: false, error: 'Failed to update section' })
  }
})

// DELETE section
router.delete('/:section', requireAuth, async (req, res) => {
  try {
    const { section } = req.params
    await HomeContent.findOneAndDelete({ section })
    res.json({ success: true, message: 'Section deleted successfully' })
  } catch (error) {
    console.error('Error deleting section:', error)
    res.status(500).json({ success: false, error: 'Failed to delete section' })
  }
})

export default router
