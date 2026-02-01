// routes/admin/affiliates.js

import express from 'express'
const router = express.Router()
import AffiliateImage from '../models/AffiliateImage.js'
import { isValidHttpUrl } from '../utils/validators.js'
import redisClient from '../config/redis.js'

// OPTIONAL: auth middleware for admin routes
const requireAdmin = (req, res, next) => {
  // implement your auth check here (JWT/session)
  // if (!req.user || !req.user.isAdmin) return res.status(403).json({ ok: false });
  next()
}

// GET all
router.get('/', requireAdmin, async (req, res) => {
  try {
    // Try to get from Redis cache first
    redisClient.get('affiliates:all', async (err, cached) => {
      if (err) {
        console.error('Redis get error:', err)
      }
      if (cached) {
        // Return cached response
        return res.json(JSON.parse(cached))
      }
      // Not cached, fetch from DB
      const items = await AffiliateImage.find().sort({
        order: 1,
        createdAt: -1,
      })
      const formattedItems = items.map((item) => ({
        _id: item._id,
        src: item.url,
        alt: item.alt,
        order: item.order,
        active: item.active,
      }))
      const response = { ok: true, items: formattedItems }
      // Cache for 60 seconds
      redisClient.setex('affiliates:all', 60, JSON.stringify(response))
      res.json(response)
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Server error' })
  }
})

// GET single item (required by MediaListManager delete/edit)
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const item = await AffiliateImage.findById(req.params.id)
    if (!item)
      return res.status(404).json({ ok: false, error: 'Item not found' })

    // Map 'url' to 'src' for frontend compatibility
    const formattedItem = {
      _id: item._id,
      src: item.url, // Map 'url' to 'src'
      alt: item.alt,
      order: item.order,
      active: item.active,
    }

    res.json({ ok: true, item: formattedItem })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Server error' })
  }
})

/**
 * Bulk replace / save
 * Accepts an array of items: [{ url, alt, order, active, _id? , tempId? }]
 */
router.post('/bulk', async (req, res) => {
  try {
    // MediaListManager sends: [{ id, type, src, poster, ... }]
    // We expect and use: src (mapped to url), alt, order, active.
    const payload = Array.isArray(req.body) ? req.body : req.body.items || []
    if (!Array.isArray(payload))
      return res.status(400).json({ ok: false, error: 'Invalid payload' }) // Validate every URL server-side (using the incoming 'src' which maps to 'url')

    for (const p of payload) {
      if (!p.src || !isValidHttpUrl(p.src)) {
        // Using p.src for validation
        return res
          .status(400)
          .json({ ok: false, error: `Invalid URL: ${p.src}` })
      }
    } // Strategy: upsert each item by _id, then delete leftover items

    const incomingIds = payload.map((p) => p.id).filter(Boolean) // Use 'id' from frontend payload

    const upserted = []
    for (let idx = 0; idx < payload.length; idx++) {
      const p = payload[idx]
      const docData = {
        url: p.src, // FIX 2: Map incoming 'src' to model's 'url'
        alt: p.alt || '',
        order: typeof p.order === 'number' ? p.order : idx,
        active: p.active === undefined ? true : !!p.active,
      }

      if (p.id) {
        // Use p.id from frontend as MongoDB's _id
        // update existing
        const doc = await AffiliateImage.findByIdAndUpdate(p.id, docData, {
          new: true,
        })
        if (doc) upserted.push(doc)
        else {
          // fallback: create new if id not found (Mongoose will ignore the invalid p.id)
          const created = await AffiliateImage.create(docData)
          upserted.push(created)
          incomingIds.push(created._id.toString())
        }
      } else {
        // create new
        const created = await AffiliateImage.create(docData)
        upserted.push(created)
        incomingIds.push(created._id.toString())
      }
    } // delete any DB docs not present in incomingIds

    await AffiliateImage.deleteMany({ _id: { $nin: incomingIds } }) // Fetch and format final list

    const result = await AffiliateImage.find().sort({ order: 1 })
    const formattedResult = result.map((item) => ({
      _id: item._id,
      src: item.url,
      alt: item.alt,
      order: item.order,
      active: item.active,
    }))

    res.json({ ok: true, items: formattedResult })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Save failed' })
  }
})

// DELETE single
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id
    await AffiliateImage.findByIdAndDelete(id)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Delete failed' })
  }
})

// Optional: update single metadata
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const id = req.params.id
    const { alt, order, active } = req.body
    const updated = await AffiliateImage.findByIdAndUpdate(
      id,
      { alt, order, active },
      { new: true },
    )

    // Map response back to frontend expectations
    const formattedUpdated = {
      _id: updated._id,
      src: updated.url, // Map 'url' to 'src'
      alt: updated.alt,
      order: updated.order,
      active: updated.active,
    }

    res.json({ ok: true, item: formattedUpdated })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Update failed' })
  }
})

export default router
