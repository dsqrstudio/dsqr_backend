import express from 'express'
import Testimonial from '../models/Testimonial.js'
import mongoose from 'mongoose'
// import { requireAuth } from '../middlewares/authMiddleware.js'
import { isValidHttpUrl } from '../utils/validators.js'
import multer from 'multer'
import path from 'path'
import { CATEGORY_FOLDER_MAP } from '../config/bunny.js'
import {
  uploadToBunnyStorage,
  deleteFromBunnyStorage,
  extractStoragePathFromCdnUrl,
} from '../utils/bunny.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// GET all testimonials
// GET all testimonials in frontend-friendly format
import redisClient from '../config/redis.js'
// GET all testimonials with Redis cache
router.get(
  '/',
  /* requireAuth, */ async (req, res) => {
    try {
      // Redis caching temporarily disabled for debugging
      // redisClient.get('testimonials:all', async (err, cached) => {
      //   if (err) console.error('Redis get error:', err)
      //   if (cached) return res.json(JSON.parse(cached))
        const testimonials = await Testimonial.find({ active: true })
          .sort({ order: 1, createdAt: -1 })
          .lean()
        const mapped = testimonials.map((t) => ({
          id: t._id,
          name: t.name,
          company: t.company,
          image: t.image,
          text: t.text,
          highlight: t.highlight || '',
          stats: {
            editing_time: t.stats?.editing_time?.toString() ?? '',
            cost: t.stats?.cost?.toString() ?? '',
            videos: t.stats?.videos?.toString() ?? '',
          },
        }))
        const response = { success: true, data: mapped }
        // redisClient.setex('testimonials:all', 60, JSON.stringify(response))
        res.json(response)
      // })
    } catch (error) {
      console.error('Error fetching testimonials:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to fetch testimonials' })
    }
  },
)

// POST upload a testimonial image (no DB write). Returns CDN URL
router.post(
  '/upload',
  /* requireAuth, */ upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file
      if (!file)
        return res
          .status(400)
          .json({ success: false, error: 'File is required' })

      const ext = path.extname(file.originalname || '').toLowerCase()
      const isImage =
        file.mimetype?.startsWith('image/') ||
        ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)
      if (!isImage)
        return res
          .status(400)
          .json({ success: false, error: 'Only image files are supported' })

      const folderBase = CATEGORY_FOLDER_MAP['testimonials'] || 'testimonial'
      const safeName = (file.originalname || 'image').replace(
        /[^a-z0-9-_\.]/gi,
        '-',
      )
      const storagePath = `${folderBase}/${Date.now()}-${safeName}`
      const { cdnUrl } = await uploadToBunnyStorage(file.buffer, storagePath)
      if (!cdnUrl)
        throw new Error('Missing BUNNY_STORAGE_CDN_BASE to form CDN URL')

      // Invalidate cache after upload
      redisClient.del('testimonials:all')
      return res.json({ success: true, url: cdnUrl })
    } catch (error) {
      console.error('Upload testimonial image error:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to upload image',
        details: error.message,
      })
    }
  },
)

// POST replace a testimonial image by ID and update DB
router.post(
  '/:id/replace-image',
  // requireAuth,
  upload.single('file'),
  async (req, res) => {
    try {
      const { id } = req.params
      const file = req.file
      if (!file)
        return res
          .status(400)
          .json({ success: false, error: 'File is required' })

      const existing = await Testimonial.findById(id)
      if (!existing)
        return res
          .status(404)
          .json({ success: false, error: 'Testimonial not found' })

      const ext = path.extname(file.originalname || '').toLowerCase()
      const isImage =
        file.mimetype?.startsWith('image/') ||
        ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)
      if (!isImage)
        return res
          .status(400)
          .json({ success: false, error: 'Only image files are supported' })

      const folderBase = CATEGORY_FOLDER_MAP['testimonials'] || 'testimonial'
      const safeName = (file.originalname || 'image').replace(
        /[^a-z0-9-_\.]/gi,
        '-',
      )
      const storagePath = `${folderBase}/${Date.now()}-${safeName}`

      // If old image is in Bunny, delete it
      if (existing.image) {
        const oldPath = extractStoragePathFromCdnUrl(existing.image)
        if (oldPath) {
          try {
            await deleteFromBunnyStorage(oldPath)
          } catch (e) {
            console.warn('Could not delete old image:', e.message)
          }
        }
      }

      const { cdnUrl } = await uploadToBunnyStorage(file.buffer, storagePath)
      if (!cdnUrl)
        throw new Error('Missing BUNNY_STORAGE_CDN_BASE to form CDN URL')

      existing.image = cdnUrl
      await existing.save()
      res.json({ success: true, data: existing })
    } catch (error) {
      console.error('Replace testimonial image error:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to replace image',
        details: error.message,
      })
    }
  },
)

// POST create new testimonial
router.post(
  '/',
  /* requireAuth, */ async (req, res) => {
    try {
      const { name, company, image, text, highlight, stats, order, active } =
        req.body

      // Validate required fields
      if (!name || !image || !text || !stats) {
        return res.status(400).json({
          success: false,
          error: 'Name, image, text, and stats are required',
        })
      }

      // Validate image URL
      if (!isValidHttpUrl(image)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid image URL',
        })
      }

      // Validate stats
      if (!stats.editing_time || !stats.cost || !stats.videos) {
        return res.status(400).json({
          success: false,
          error: 'All stats fields are required',
        })
      }

      const testimonial = new Testimonial({
        name,
        company: company || '',
        image,
        text,
        highlight: highlight || '',
        stats: {
          editing_time: Number(stats.editing_time),
          cost: Number(stats.cost),
          videos: Number(stats.videos),
        },
        order: order || 0,
        active: active !== undefined ? active : true,
      })

      await testimonial.save()
      res.status(201).json({ success: true, data: testimonial })
    } catch (error) {
      console.error('Error creating testimonial:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to create testimonial' })
    }
  },
)

// PUT update testimonial
router.put(
  '/:id',
  /* requireAuth, */ async (req, res) => {
    try {
      const { id } = req.params
      const updateData = req.body

      // Validate image URL if provided
      if (updateData.image && !isValidHttpUrl(updateData.image)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid image URL',
        })
      }

      // Validate stats if provided (editing_time range removed)
      if (updateData.stats) {
        if (updateData.stats.cost !== undefined && updateData.stats.cost < 0) {
          return res.status(400).json({
            success: false,
            error: 'Cost must be a positive number',
          })
        }
        if (
          updateData.stats.videos !== undefined &&
          updateData.stats.videos < 0
        ) {
          return res.status(400).json({
            success: false,
            error: 'Videos must be a positive number',
          })
        }
      }

      // Guard against invalid ObjectId (e.g., temp IDs from client)
      if (!mongoose.isValidObjectId(id)) {
        return res
          .status(404)
          .json({ success: false, error: 'Testimonial not found' })
      }

      // If highlight is not provided, set to empty string (for PATCH-like updates)
      if (updateData.highlight === undefined) {
        updateData.highlight = ''
      }
      const testimonial = await Testimonial.findByIdAndUpdate(id, updateData, {
        new: true,
      })

      if (!testimonial) {
        return res
          .status(404)
          .json({ success: false, error: 'Testimonial not found' })
      }

      res.json({ success: true, data: testimonial })
    } catch (error) {
      console.error('Error updating testimonial:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to update testimonial' })
    }
  },
)

// POST bulk update testimonials
router.post(
  '/bulk',
  /* requireAuth, */ async (req, res) => {
    try {
      const testimonials = req.body

      if (!Array.isArray(testimonials)) {
        return res.status(400).json({
          success: false,
          error: 'Testimonials must be an array',
        })
      }

      // Validate all testimonials
      for (const testimonial of testimonials) {
        if (
          !testimonial.name ||
          !testimonial.image ||
          !testimonial.text ||
          !testimonial.stats
        ) {
          return res.status(400).json({
            success: false,
            error: 'All testimonials must have name, image, text, and stats',
          })
        }

        if (!isValidHttpUrl(testimonial.image)) {
          return res.status(400).json({
            success: false,
            error: `Invalid image URL: ${testimonial.image}`,
          })
        }
      }

      // Delete existing testimonials
      await Testimonial.deleteMany({})

      // Create new testimonials
      const newTestimonials = testimonials.map((testimonial, index) => ({
        name: testimonial.name,
        company: testimonial.company || '',
        image: testimonial.image,
        text: testimonial.text,
        highlight: testimonial.highlight || '',
        stats: {
          editing_time: Number(testimonial.stats.editing_time),
          cost: Number(testimonial.stats.cost),
          videos: Number(testimonial.stats.videos),
        },
        order: testimonial.order || index,
        active: testimonial.active !== undefined ? testimonial.active : true,
      }))

      const createdTestimonials = await Testimonial.insertMany(newTestimonials)

      res.json({ success: true, data: createdTestimonials })
    } catch (error) {
      console.error('Error bulk updating testimonials:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to bulk update testimonials' })
    }
  },
)

// DELETE testimonial
router.delete(
  '/:id',
  /* requireAuth, */ async (req, res) => {
    try {
      const { id } = req.params
      // If the ID is not a Mongo ObjectId, treat as a no-op (item was never saved)
      if (!mongoose.isValidObjectId(id)) {
        return res.json({
          success: true,
          message: 'No-op: temporary item removed client-side',
        })
      }
      const testimonial = await Testimonial.findById(id)
      if (!testimonial) {
        return res
          .status(404)
          .json({ success: false, error: 'Testimonial not found' })
      }
      // Attempt to delete image from Bunny Storage
      if (testimonial.image) {
        const oldPath = extractStoragePathFromCdnUrl(testimonial.image)
        if (oldPath) {
          try {
            await deleteFromBunnyStorage(oldPath)
          } catch (e) {
            console.warn('Could not delete testimonial image:', e.message)
          }
        }
      }
      await Testimonial.findByIdAndDelete(id)

      res.json({ success: true, message: 'Testimonial deleted successfully' })
    } catch (error) {
      console.error('Error deleting testimonial:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to delete testimonial' })
    }
  },
)

export default router
