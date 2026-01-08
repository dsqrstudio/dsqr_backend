import express from 'express'
import MediaItem from '../models/MediaItem.js'
import { requireAuth } from '../middlewares/authMiddleware.js'
import { isValidHttpUrl } from '../utils/validators.js' // Assuming this utility exists
import multer from 'multer'
import path from 'path'
import {
  CATEGORY_FOLDER_MAP,
  SUBSECTION_FOLDER_MAP,
  sectionForCategory,
  BUNNY_STREAM_CDN_BASES,
} from '../config/bunny.js'
import {
  uploadToBunnyStorage,
  uploadToBunnyStream,
  deleteFromBunnyStorage,
  extractStoragePathFromCdnUrl,
  fetchAllBunnyStreamVideos,
} from '../utils/bunny.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// GET portfolio video from a specific Bunny Stream library
router.get('/portfolio-video', requireAuth, async (req, res) => {
  try {
    const { library } = req.query
    console.log('[PortfolioVideo] Endpoint hit with library:', library)
    if (!library) {
      return res
        .status(400)
        .json({ success: false, error: 'Missing library parameter' })
    }
    // Fetch all videos from the specified Bunny Stream library
    let bunnyVideos = await fetchAllBunnyStreamVideos(library)
    console.log(
      '[PortfolioVideo] Bunny API Response:',
      JSON.stringify(bunnyVideos, null, 2)
    )
    // Remove all filtering: return all videos from the Bunny library
    if (!Array.isArray(bunnyVideos) || bunnyVideos.length === 0) {
      console.log('[PortfolioVideo] No videos found for library:', library)
      return res.json({ success: true, data: [] })
    }
    // Always use Bunny's real playlistUrl/hlsUrl and thumbnailUrl for src and poster
    const videosWithUrls = bunnyVideos.map((bunny) => {
      const guid = bunny.guid || bunny.id || bunny.videoId
      let hlsUrl = bunny.playlistUrl || bunny.hlsUrl || ''
      // If missing, construct from CDN base and guid
      if (!hlsUrl && guid) {
        let cdnBase =
          BUNNY_STREAM_CDN_BASES &&
          BUNNY_STREAM_CDN_BASES[`${BUNNY_STREAM_LIBRARY_ID}`]
        if (!cdnBase && process.env.BUNNY_STREAM_CDN_BASE) {
          cdnBase = process.env.BUNNY_STREAM_CDN_BASE.replace(/\/$/, '')
        }
        if (cdnBase) {
          hlsUrl = `${cdnBase}/${guid}/playlist.m3u8`
        }
      }
      // Always set poster to Bunny's thumbnailUrl if available
      let poster = ''
      if (
        bunny.thumbnailUrl &&
        typeof bunny.thumbnailUrl === 'string' &&
        bunny.thumbnailUrl.startsWith('http')
      ) {
        poster = bunny.thumbnailUrl
      }
      return {
        ...bunny,
        src: hlsUrl || bunny.videoUrl || '',
        hlsUrl,
        poster,
      }
    })
    console.log(
      '[PortfolioVideo] Returning ALL videos with real URLs:',
      JSON.stringify(videosWithUrls, null, 2)
    )
    return res.json({ success: true, data: videosWithUrls })
  } catch (error) {
    console.error('[PortfolioVideo] Error fetching portfolio video:', error)
    return res.status(500).json({ success: false, error: error.message })
  }
})

// GET Service Offered videos: merge Bunny Stream API and DB
router.get('/service-offered/merged', requireAuth, async (req, res) => {
  try {
    // 1. Fetch all videos from Bunny Stream API
    let bunnyVideos = await fetchAllBunnyStreamVideos()
    // 1a. Debug: Print all Bunny API video objects for troubleshooting
    if (Array.isArray(bunnyVideos)) {
      console.log('DEBUG: Full Bunny Stream API video objects:')
      bunnyVideos.forEach((v, idx) => {
        console.log(`[${idx}]`, JSON.stringify(v, null, 2))
      })
      // Filter to only those with '[service-offered]' in the description
      bunnyVideos = bunnyVideos.filter(
        (v) =>
          typeof v.description === 'string' &&
          v.description.includes('[service-offered]')
      )
    }

    // 2. Fetch all MediaItems for Service Offered (category: our_work, subsection: Home Videos, type: video)
    const dbVideos = await MediaItem.find({
      category: 'our_work',
      subsection: 'Home Videos',
      type: 'video',
    }).lean()

    // 3. Merge: Prefer DB info if guid matches, else add Bunny-only videos
    const dbByGuid = {}
    dbVideos.forEach((item) => {
      if (item.guid) dbByGuid[item.guid] = item
    })
    const merged = []
    // Use direct import for BUNNY_STREAM_CDN_BASES (ESM fix)
    bunnyVideos.forEach((bunny) => {
      const guid = bunny.guid || bunny.id || bunny.videoId
      let hlsUrl = ''
      let playlistUrl = ''
      const videoUrl = bunny.videoUrl || ''
      let cdnBase =
        BUNNY_STREAM_CDN_BASES &&
        BUNNY_STREAM_CDN_BASES[`${BUNNY_STREAM_LIBRARY_ID}`]
      if (!cdnBase && process.env.BUNNY_STREAM_CDN_BASE) {
        cdnBase = process.env.BUNNY_STREAM_CDN_BASE.replace(/\/$/, '')
      }
      if (guid && cdnBase) {
        hlsUrl = `${cdnBase}/${guid}/playlist.m3u8`
        playlistUrl = hlsUrl
      }
      // Always set poster to Bunny's thumbnailUrl if available, otherwise construct it
      let poster = ''
      if (
        bunny.thumbnailUrl &&
        typeof bunny.thumbnailUrl === 'string' &&
        bunny.thumbnailUrl.startsWith('http')
      ) {
        poster = bunny.thumbnailUrl
      } else if (guid && cdnBase) {
        poster = `${cdnBase}/${guid}/thumbnail.jpg`
      }
      if (dbByGuid[guid]) {
        merged.push({
          ...bunny,
          ...dbByGuid[guid],
          src: dbByGuid[guid].src || playlistUrl || hlsUrl || videoUrl,
          poster: dbByGuid[guid].poster || poster,
          hlsUrl,
          playlistUrl,
          videoUrl,
        })
      } else {
        merged.push({
          guid,
          title: bunny.title,
          src: playlistUrl || hlsUrl || videoUrl,
          poster,
          type: 'video',
          category: 'our_work',
          subsection: 'Home Videos',
          hlsUrl,
          playlistUrl,
          videoUrl,
          ...bunny,
        })
      }
    })
    // Add DB-only videos (not in Bunny API)
    dbVideos.forEach((item) => {
      if (
        !item.guid ||
        !bunnyVideos.find((b) => (b.guid || b.id || b.videoId) === item.guid)
      ) {
        // Ensure src and poster are present
        merged.push({
          ...item,
          src: item.src || '',
          poster: item.poster || '',
        })
      }
    })
    res.json({ success: true, data: merged })
  } catch (error) {
    console.error('Error merging Service Offered videos:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})
// mediaItemRoutes.js (The one that MediaListManager uses)
// import MediaItem from '../models/MediaItem.js'
// import { requireAuth } from '../middlewares/authMiddleware.js'
// import { isValidHttpUrl } from '../utils/validators.js' // Assuming this utility exists
// import multer from 'multer'
// import path from 'path'
// import {
//   CATEGORY_FOLDER_MAP,
//   SUBSECTION_FOLDER_MAP,
//   sectionForCategory,
// } from '../config/bunny.js'
// import {
//   uploadToBunnyStorage,
//   uploadToBunnyStream,
//   deleteFromBunnyStorage,
//   extractStoragePathFromCdnUrl,
// } from '../utils/bunny.js'

// const router = express.Router()
// const upload = multer({ storage: multer.memoryStorage() })

// GET media items by category
router.get('/category/:category', requireAuth, async (req, res) => {
  try {
    const { category } = req.params
    const { subsection } = req.query
    const filter = { category }
    if (subsection) filter.subsection = subsection
    // NOTE: .lean() is added here for reliable fetching
    const items = await MediaItem.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .lean()
    // Returns { success: true, data: [items] }
    res.json({ success: true, data: items })
  } catch (error) {
    console.error('Error fetching media items by category:', error)
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch media items' })
  }
})

// POST bulk update media items (for category management)
// This is the CRITICAL route for saving/updating arrays from the frontend.
router.post('/bulk/:category', requireAuth, async (req, res) => {
  try {
    const { category } = req.params
    const items = req.body // Array of media items

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'Items must be an array',
      })
    }

    // --- Validation ---
    for (const item of items) {
      // Validate required fields based on the MediaItem model
      if (!item.type || !item.src || !item.category || !item.subsection) {
        return res.status(400).json({
          success: false,
          error: 'Type, src, category, and subsection are required',
        })
      }
      if (item.type === 'video') {
        // Only allow Bunny's real URLs for video src/poster
        const isBunnyUrl =
          typeof item.src === 'string' &&
          (item.src.includes('bunnycdn.com') ||
            item.src.includes('bunnyvideo.com'))
        if (!isBunnyUrl) {
          return res.status(400).json({
            success: false,
            error: `Video src must be a Bunny-provided URL: ${item.src}`,
          })
        }
      } else if (item.src && !isValidHttpUrl(item.src)) {
        return res
          .status(400)
          .json({ success: false, error: `Invalid src URL: ${item.src}` })
      }
      // Mongoose will handle the rest of the validation (enums, etc.) on insertMany
    }

    // --- Bulk Operation ---
    // 1. Delete all existing items for this category
    await MediaItem.deleteMany({ category })

    // 2. Create new items with updated order/data
    const newItems = items.map((item, index) => ({
      title: item.title || '',
      type: item.type,
      src: item.src,
      poster: item.poster || '',
      before: item.before || '',
      after: item.after || '',
      beforePoster: item.beforePoster || '',
      afterPoster: item.afterPoster || '',
      section: item.section || category,
      subsection: item.subsection, // Ensure subsection is included
      category: category,
      order: item.order !== undefined ? item.order : index,
      active: item.active !== undefined ? item.active : true,
    }))

    // 3. Insert new items (returns plain JS objects due to bulk nature)
    const createdDocs = await MediaItem.insertMany(newItems)

    // Return the newly created documents
    res.json({ success: true, data: createdDocs })
  } catch (error) {
    // If an item fails validation (e.g., bad enum value), it will land here
    console.error('Error bulk updating media items:', error)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
    })
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update media items',
      details: error.message,
    })
  }
})

// Other CRUD routes (POST /, PUT /:id, DELETE /:id) remain the same...

// POST create single media item
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      title,
      type,
      src,
      poster,
      before,
      after,
      category,
      section,
      subsection,
      order,
      active,
    } = req.body

    if (!type || !src || !category) {
      return res
        .status(400)
        .json({ success: false, error: 'Type, src, and category are required' })
    }
    if (type === 'video') {
      // Only allow Bunny's real URLs for video src/poster
      const isBunnyUrl =
        typeof src === 'string' &&
        (src.includes('bunnycdn.com') || src.includes('bunnyvideo.com'))
      if (!isBunnyUrl) {
        return res.status(400).json({
          success: false,
          error: `Video src must be a Bunny-provided URL: ${src}`,
        })
      }
    } else if (!isValidHttpUrl(src)) {
      return res
        .status(400)
        .json({ success: false, error: `Invalid src URL: ${src}` })
    }

    const mediaItem = new MediaItem({
      title: title || '',
      type,
      src,
      poster: poster || '',
      before: before || '',
      after: after || '',
      category,
      section: section || '',
      subsection: subsection || '',
      order: order || 0,
      active: active !== undefined ? active : true,
    })

    const savedItem = await mediaItem.save()
    res.json({ success: true, data: savedItem })
  } catch (error) {
    console.error('Error creating media item:', error)
    res
      .status(500)
      .json({ success: false, error: 'Failed to create media item' })
  }
})

// PUT update single media item
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const updateData = req.body

    if (updateData.src) {
      if (updateData.type === 'video') {
        // Only allow Bunny's real URLs for video src/poster
        const isBunnyUrl =
          typeof updateData.src === 'string' &&
          (updateData.src.includes('bunnycdn.com') ||
            updateData.src.includes('bunnyvideo.com'))
        if (!isBunnyUrl) {
          return res.status(400).json({
            success: false,
            error: `Video src must be a Bunny-provided URL: ${updateData.src}`,
          })
        }
      } else if (!isValidHttpUrl(updateData.src)) {
        return res
          .status(400)
          .json({ success: false, error: `Invalid src URL: ${updateData.src}` })
      }
    }

    const updatedItem = await MediaItem.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })

    if (!updatedItem) {
      return res
        .status(404)
        .json({ success: false, error: 'Media item not found' })
    }

    res.json({ success: true, data: updatedItem })
  } catch (error) {
    console.error('Error updating media item:', error)
    res
      .status(500)
      .json({ success: false, error: 'Failed to update media item' })
  }
})

// DELETE single media item
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const item = await MediaItem.findById(id)

    if (!item) {
      return res
        .status(404)
        .json({ success: false, error: 'Media item not found' })
    }

    // Delete from Bunny Storage if it's an image stored there
    if (item.type === 'image' && item.src) {
      const storagePath = extractStoragePathFromCdnUrl(item.src)
      if (storagePath) {
        try {
          await deleteFromBunnyStorage(storagePath)
          console.log(`✓ Deleted from Bunny Storage: ${storagePath}`)
        } catch (error) {
          console.error('Failed to delete from Bunny Storage:', error)
          // Continue with database deletion even if Bunny deletion fails
        }
      }
    }

    // Delete from database
    await MediaItem.findByIdAndDelete(id)

    res.json({ success: true, message: 'Media item deleted successfully' })
  } catch (error) {
    console.error('Error deleting media item:', error)
    res
      .status(500)
      .json({ success: false, error: 'Failed to delete media item' })
  }
})

// GET single media item
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params
    const item = await MediaItem.findById(id)

    if (!item) {
      return res
        .status(404)
        .json({ success: false, error: 'Media item not found' })
    }

    res.json({ success: true, data: item })
  } catch (error) {
    console.error('Error fetching media item:', error)
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch media item' })
  }
})

export default router

// Upload raw image/video and create MediaItem
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    const { category, subsection = 'default' } = req.body || {}
    console.log(
      '[UPLOAD ROUTE] Received category:',
      category,
      'subsection:',
      subsection
    )
    if (!file)
      return res.status(400).json({ success: false, error: 'File is required' })
    if (!category)
      return res
        .status(400)
        .json({ success: false, error: 'category is required' })

    const ext = path.extname(file.originalname || '').toLowerCase()
    const isImage =
      file.mimetype?.startsWith('image/') ||
      ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)
    const isVideo =
      file.mimetype?.startsWith('video/') ||
      ['.mp4', '.mov', '.webm', '.mkv'].includes(ext)
    if (!isImage && !isVideo) {
      return res.status(400).json({
        success: false,
        error: 'Only image or video files are supported',
      })
    }

    // Use Bunny folder with subsection mapping
    const folderBase = CATEGORY_FOLDER_MAP[category] || category

    // Check if this category has subsection mappings
    const hasSubsectionMapping = SUBSECTION_FOLDER_MAP[category] !== undefined

    let uploadPath
    if (hasSubsectionMapping) {
      // Use mapped subsection folder (e.g., graphics, home-page)
      // Use ?? instead of || to handle empty string correctly
      const subsectionFolder =
        SUBSECTION_FOLDER_MAP[category]?.[subsection] ?? subsection
      // If subsectionFolder is empty string, upload directly to folderBase
      uploadPath = subsectionFolder
        ? `${folderBase}/${subsectionFolder}`
        : folderBase
    } else {
      // No subsection mapping - upload directly to category folder (e.g., Client_logos, Team_photo)
      uploadPath = folderBase
    }

    console.log('📁 Upload path debug:', {
      category,
      subsection,
      folderBase,
      hasSubsectionMapping,
      uploadPath,
      fileType: file.mimetype,
      originalName: file.originalname,
    })

    const filenameBase = (
      file.originalname || (isImage ? 'image' : 'video')
    ).replace(/[^a-z0-9-_\.]/gi, '-')

    let createdDoc = null

    if (isImage) {
      const storagePath = `${uploadPath}/${Date.now()}-${filenameBase}`
      const { cdnUrl } = await uploadToBunnyStorage(file.buffer, storagePath)
      if (!cdnUrl)
        throw new Error('Missing BUNNY_STORAGE_CDN_BASE to form CDN URL')

      // Determine order as next index in category+subsection
      const nextOrder = await MediaItem.countDocuments({ category, subsection })
      const doc = new MediaItem({
        type: 'image',
        src: cdnUrl,
        poster: '',
        category,
        section: sectionForCategory(category),
        subsection,
        order: nextOrder,
        active: true,
      })
      createdDoc = await doc.save()
      return res.json({ success: true, data: createdDoc })
    }

    if (isVideo) {
      // Import config here to avoid ReferenceError
      const { BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_CDN_BASES } = await import(
        '../config/bunny.js'
      )
      const title = filenameBase.replace(ext, '') || 'Upload'
      // Determine libraryId for Service Offered videos
      let libraryId = null
      let description = ''
      if (category === 'our_work' && subsection === 'Home Videos') {
        // Use our_work library ID (571680)
        libraryId = '571680'
        description = '[service-offered]'
      }
      const {
        guid,
        iframeUrl,
        hlsUrl: bunnyHlsUrl,
        thumbnailUrl,
      } = await uploadToBunnyStream(file.buffer, title, libraryId)
      // Always construct HLS URL if missing
      let hlsUrl = bunnyHlsUrl || ''
      let cdnBase =
        BUNNY_STREAM_CDN_BASES &&
        BUNNY_STREAM_CDN_BASES[`${libraryId || BUNNY_STREAM_LIBRARY_ID}`]
      if (!cdnBase && process.env.BUNNY_STREAM_CDN_BASE) {
        cdnBase = process.env.BUNNY_STREAM_CDN_BASE.replace(/\/$/, '')
      }
      if (!hlsUrl && guid && cdnBase) {
        hlsUrl = `${cdnBase}/${guid}/playlist.m3u8`
      }
      // Always construct poster (thumbnail) URL if missing
      let poster = ''
      if (
        thumbnailUrl &&
        typeof thumbnailUrl === 'string' &&
        thumbnailUrl.startsWith('http')
      ) {
        poster = thumbnailUrl
      } else if (guid && cdnBase) {
        poster = `${cdnBase}/${guid}/thumbnail.jpg`
      }
      const src = hlsUrl || ''
      console.log('[Video Upload Result]', {
        guid,
        iframeUrl,
        hlsUrl,
        thumbnailUrl,
        src,
        poster,
      })
      const nextOrder = await MediaItem.countDocuments({ category, subsection })
      const doc = new MediaItem({
        type: 'video',
        src,
        poster,
        category,
        section: sectionForCategory(category),
        subsection,
        order: nextOrder,
        active: true,
        guid,
        description,
      })
      createdDoc = await doc.save()
      // Always return constructed hlsUrl and poster in response
      createdDoc.src = hlsUrl || ''
      createdDoc.poster = poster
      console.log('[Saved MediaItem]', createdDoc)
      return res.json({
        success: true,
        data: createdDoc,
        meta: { iframeUrl, hlsUrl, guid },
      })
    }

    return res
      .status(400)
      .json({ success: false, error: 'Unsupported file type' })
  } catch (err) {
    console.error('Upload error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

// Replace existing media item file (image or video)
router.post(
  '/:id/replace',
  requireAuth,
  upload.single('file'),
  async (req, res) => {
    try {
      const { id } = req.params
      const file = req.file
      if (!file)
        return res
          .status(400)
          .json({ success: false, error: 'File is required' })

      const existing = await MediaItem.findById(id)
      if (!existing)
        return res
          .status(404)
          .json({ success: false, error: 'Media item not found' })

      const ext = path.extname(file.originalname || '').toLowerCase()
      const isImage =
        file.mimetype?.startsWith('image/') ||
        ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)
      const isVideo =
        file.mimetype?.startsWith('video/') ||
        ['.mp4', '.mov', '.webm', '.mkv'].includes(ext)
      if (!isImage && !isVideo) {
        return res.status(400).json({
          success: false,
          error: 'Only image or video files are supported',
        })
      }

      const category = existing.category
      const subsection = existing.subsection || 'default'

      // Use Bunny folder with subsection mapping
      const folderBase = CATEGORY_FOLDER_MAP[category] || category

      // Check if this category has subsection mappings
      const hasSubsectionMapping = SUBSECTION_FOLDER_MAP[category] !== undefined

      let uploadPath
      let subsectionFolder = subsection // Default to subsection name

      if (hasSubsectionMapping) {
        // Use mapped subsection folder (e.g., graphics, home-page)
        // Use ?? instead of || to handle empty string correctly
        subsectionFolder =
          SUBSECTION_FOLDER_MAP[category]?.[subsection] ?? subsection
        // If subsectionFolder is empty string, upload directly to folderBase
        uploadPath = subsectionFolder
          ? `${folderBase}/${subsectionFolder}`
          : folderBase
      } else {
        // No subsection mapping - upload directly to category folder (e.g., Client_logos, Team_photo)
        uploadPath = folderBase
      }

      console.log('📁 Replace path debug:', {
        category,
        subsection,
        folderBase,
        hasSubsectionMapping,
        subsectionFolder,
        uploadPath,
      })

      const filenameBase = (
        file.originalname || (isImage ? 'image' : 'video')
      ).replace(/[^a-z0-9-_\.]/gi, '-')

      if (isImage) {
        // Delete old image from Bunny Storage before uploading new one
        if (existing.type === 'image' && existing.src) {
          const oldPath = extractStoragePathFromCdnUrl(existing.src)
          if (oldPath) {
            try {
              await deleteFromBunnyStorage(oldPath)
              console.log(`✓ Deleted old file from Bunny: ${oldPath}`)
            } catch (error) {
              console.error('Failed to delete old file from Bunny:', error)
              // Continue with upload even if deletion fails
            }
          }
        }

        const storagePath = `${uploadPath}/${Date.now()}-${filenameBase}`
        const { cdnUrl } = await uploadToBunnyStorage(file.buffer, storagePath)
        if (!cdnUrl)
          throw new Error('Missing BUNNY_STORAGE_CDN_BASE to form CDN URL')

        existing.type = 'image'
        // For image, update src as before (not Bunny video)
        // For video, always use Bunny's hlsUrl and thumbnailUrl (handled below)
        await existing.save()
        return res.json({ success: true, data: existing })
      }

      if (isVideo) {
        // Delete old video from Bunny Stream before uploading new one
        if (existing.type === 'video' && existing.guid) {
          try {
            const { BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY } =
              await import('../config/bunny.js')
            const deleteUrl = `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${existing.guid}`
            const delRes = await fetch(deleteUrl, {
              method: 'DELETE',
              headers: { AccessKey: BUNNY_STREAM_API_KEY },
            })
            if (!delRes.ok && delRes.status !== 404) {
              const text = await delRes.text().catch(() => '')
              console.error(
                `Failed to delete old Bunny Stream video: ${delRes.status} ${text}`
              )
            } else {
              console.log(`✓ Deleted old Bunny Stream video: ${existing.guid}`)
            }
          } catch (err) {
            console.error('Error deleting old Bunny Stream video:', err)
          }
        }

        const title = filenameBase.replace(ext, '') || 'Upload'
        const { guid, iframeUrl } = await uploadToBunnyStream(
          file.buffer,
          title
        )

        // Poll Bunny Stream for HLS URL and thumbnail
        const { BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY } = await import(
          '../config/bunny.js'
        )
        let hlsUrl = ''
        let thumbnailUrl = ''
        const maxTries = 10
        const delayMs = 3000
        for (let i = 0; i < maxTries; i++) {
          const detailsUrl = `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${guid}`
          const detailsRes = await fetch(detailsUrl, {
            method: 'GET',
            headers: { AccessKey: BUNNY_STREAM_API_KEY },
          })
          if (detailsRes.ok) {
            const details = await detailsRes.json()
            hlsUrl = details.playlistUrl || details.hlsUrl || ''
            thumbnailUrl = details.thumbnailUrl || ''
            if (hlsUrl && thumbnailUrl) break
          }
          if (i < maxTries - 1) await new Promise((r) => setTimeout(r, delayMs))
        }

        existing.type = 'video'
        existing.guid = guid
        existing.src = hlsUrl || ''
        existing.poster = thumbnailUrl || ''
        await existing.save()
        return res.json({
          success: true,
          data: existing,
          meta: { guid, iframeUrl, hlsUrl },
        })
      }

      return res
        .status(400)
        .json({ success: false, error: 'Unsupported file type' })
    } catch (err) {
      console.error('Replace error:', err)
      return res.status(500).json({ success: false, error: err.message })
    }
  }
)

// Replace poster (thumbnail) for a video item via image upload
router.post(
  '/:id/replace-poster',
  requireAuth,
  upload.single('poster'),
  async (req, res) => {
    try {
      const { id } = req.params
      const file = req.file
      if (!file)
        return res
          .status(400)
          .json({ success: false, error: 'Poster image is required' })

      const existing = await MediaItem.findById(id)
      if (!existing)
        return res
          .status(404)
          .json({ success: false, error: 'Media item not found' })
      if (existing.type !== 'video')
        return res.status(400).json({
          success: false,
          error: 'Poster can be set only for video items',
        })

      const ext = path.extname(file.originalname || '').toLowerCase()
      const isImage =
        file.mimetype?.startsWith('image/') ||
        ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)
      if (!isImage)
        return res
          .status(400)
          .json({ success: false, error: 'Poster must be an image' })

      const category = existing.category
      const subsection = existing.subsection || 'default'
      const folderBase = CATEGORY_FOLDER_MAP[category] || category
      const subsectionFolder =
        SUBSECTION_FOLDER_MAP[category]?.[subsection] || subsection
      const uploadPath = `${folderBase}/${subsectionFolder}`

      const filenameBase = (file.originalname || 'poster').replace(
        /[^a-z0-9-_\.]/gi,
        '-'
      )
      const storagePath = `${uploadPath}/${Date.now()}-${filenameBase}`
      const { cdnUrl } = await uploadToBunnyStorage(file.buffer, storagePath)
      if (!cdnUrl)
        throw new Error('Missing BUNNY_STORAGE_CDN_BASE to form CDN URL')

      existing.poster = cdnUrl
      await existing.save()
      return res.json({ success: true, data: existing })
    } catch (err) {
      console.error('Replace poster error:', err)
      return res.status(500).json({ success: false, error: err.message })
    }
  }
)
