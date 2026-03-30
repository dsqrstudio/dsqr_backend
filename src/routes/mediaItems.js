// Replace only the after video for a before/after pair
// router.post(
//   '/:id/replace-after',
//   upload.single('file'),
//   async (req, res) => {
//     try {
//       const { id } = req.params;
//       const file = req.file;
//       if (!file)
//         return res.status(400).json({ success: false, error: 'File is required' });

//       const existing = await MediaItem.findById(id);
//       if (!existing)
//         return res.status(404).json({ success: false, error: 'Media item not found' });

//       const ext = path.extname(file.originalname || '').toLowerCase();
//       const isVideo = file.mimetype?.startsWith('video/') || ['.mp4', '.mov', '.webm', '.mkv'].includes(ext);
//       if (!isVideo) {
//         return res.status(400).json({ success: false, error: 'Only video files are supported' });
//       }

//       // Upload to Bunny Stream
//       const title = (file.originalname || 'after').replace(ext, '') || 'After';
//       const { guid, hlsUrl: bunnyHlsUrl, thumbnailUrl } = await uploadToBunnyStream(file.buffer, title);
//       const { BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_CDN_BASES } = await import('../config/bunny.js');
//       let hlsUrl = bunnyHlsUrl || '';
//       let cdnBase = BUNNY_STREAM_CDN_BASES && BUNNY_STREAM_CDN_BASES[`${BUNNY_STREAM_LIBRARY_ID}`];
//       if (!cdnBase && process.env.BUNNY_STREAM_CDN_BASE) {
//         cdnBase = process.env.BUNNY_STREAM_CDN_BASE.replace(/\/$/, '');
//       }
//       if (!hlsUrl && guid && cdnBase) {
//         hlsUrl = `${cdnBase}/${guid}/playlist.m3u8`;
//       }
//       let poster = '';
//       if (thumbnailUrl && typeof thumbnailUrl === 'string' && thumbnailUrl.startsWith('http')) {
//         poster = thumbnailUrl;
//       } else if (guid && cdnBase) {
//         poster = `${cdnBase}/${guid}/thumbnail.jpg`;
//       }

//       // Update only after/afterPoster fields
//       existing.after = hlsUrl || '';
//       existing.afterPoster = poster || '';
//       await existing.save();
//       return res.json({ success: true, data: existing });
//     } catch (err) {
//       console.error('Replace after error:', err);
//       return res.status(500).json({ success: false, error: err.message });
//     }
//   }
// );

import express from 'express'
import MediaItem from '../models/MediaItem.js'
// import { requireAuth } from '../middlewares/authMiddleware.js'
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
import redisClient from '../config/redis.js'

async function invalidateMediaItemsCache(pattern) {
  if (!pattern || !redisClient.isOpen) return
  try {
    const keys = await redisClient.keys(pattern)
    if (Array.isArray(keys) && keys.length > 0) {
      await redisClient.del(keys)
      console.log(`[REDIS] Invalidated ${keys.length} cache keys matching ${pattern}`)
    }
  } catch (err) {
    console.error('[REDIS] Error invalidating cache:', err)
  }
}

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })
import { requireAuth } from '../middlewares/authMiddleware.js'

// Helper to generate UUID (if not already imported)
import { v4 as uuidv4 } from 'uuid'
// POST /api/admin/media-items/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { type, category, subsection, beforeId } = req.body
    const file = req.file
    if (!file || !type || !category) {
      return res.status(400).json({
        success: false,
        error: 'file, type, and category are required',
      })
    }
    // Upload to Bunny Stream (video)
    let src = '',
      poster = '',
      guid = '',
      pairId = '',
      role = ''
    if (type === 'video') {
      const title = file.originalname || 'video'
      const {
        guid: newGuid,
        hlsUrl,
        thumbnailUrl,
      } = await uploadToBunnyStream(file.buffer, title)
      guid = newGuid
      const { BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_CDN_BASES } =
        await import('../config/bunny.js')
      let cdnBase =
        BUNNY_STREAM_CDN_BASES &&
        BUNNY_STREAM_CDN_BASES[`${BUNNY_STREAM_LIBRARY_ID}`]
      if (!cdnBase && process.env.BUNNY_STREAM_CDN_BASE) {
        cdnBase = process.env.BUNNY_STREAM_CDN_BASE.replace(/\/$/, '')
      }
      src =
        hlsUrl || (cdnBase && guid ? `${cdnBase}/${guid}/playlist.m3u8` : '')
      poster =
        thumbnailUrl ||
        (cdnBase && guid ? `${cdnBase}/${guid}/thumbnail.jpg` : '')
      // Determine pairId and role
      if (beforeId) {
        // This is an after video, link to before's pairId
        const beforeDoc = await MediaItem.findById(beforeId)
        if (!beforeDoc || !beforeDoc.pairId) {
          return res.status(400).json({
            success: false,
            error: 'Invalid beforeId or before video missing pairId',
          })
        }
        pairId = beforeDoc.pairId
        role = 'after'
        console.log('[UPLOAD] AFTER VIDEO', {
          beforeId,
          pairId,
          role,
          src,
          poster,
          guid,
          subsection,
        })
      } else {
        // This is a before video, generate new pairId
        pairId = uuidv4()
        role = 'before'
        console.log('[UPLOAD] BEFORE VIDEO', {
          pairId,
          role,
          src,
          poster,
          guid,
          subsection,
        })
      }
    } else {
      // Handle image upload if needed (not shown here)
      return res
        .status(400)
        .json({ success: false, error: 'Only video upload supported here' })
    }
    // Save new MediaItem
    const doc = new MediaItem({
      type,
      src,
      poster,
      category,
      subsection,
      pairId,
      role,
      guid,
    })
    const saved = await doc.save()
    // Invalidate Redis cache for this category and all subsections
    if (category) {
      const pattern = `mediaItems:${category}*`;
      await invalidateMediaItemsCache(pattern);
    }
    console.log('[UPLOAD] SAVED', saved);
    return res.json({ success: true, data: saved });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
})

// Endpoint to save file metadata after direct BunnyCDN upload
// POST /api/admin/media-items/save-metadata
// GET Bunny config (library ID, API key) for frontend direct upload
router.get('/config', requireAuth, async (req, res) => {
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

// POST /api/admin/media-items/save (store only final video URL and GUID)
router.post('/save', requireAuth, async (req, res) => {
  try {
    const { guid, category, description } = req.body || {}
    if (!guid || !category) {
      return res
        .status(400)
        .json({ success: false, error: 'guid and category are required' })
    }
    // Build HLS and thumbnail URLs for Bunny Stream
    const { BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_CDN_BASES } =
      await import('../config/bunny.js')
    let cdnBase =
      BUNNY_STREAM_CDN_BASES &&
      BUNNY_STREAM_CDN_BASES[`${BUNNY_STREAM_LIBRARY_ID}`]
    if (!cdnBase && process.env.BUNNY_STREAM_CDN_BASE) {
      cdnBase = process.env.BUNNY_STREAM_CDN_BASE.replace(/\/$/, '')
    }
    const src = `${cdnBase}/${guid}/playlist.m3u8`
    const poster = `${cdnBase}/${guid}/thumbnail.jpg`
    const doc = new MediaItem({
      type: 'video',
      src,
      poster,
      category,
      guid,
      description: description || '',
    })
    const createdDoc = await doc.save()
    if (category) {
      await invalidateMediaItemsCache(`mediaItems:${category}*`)
    }
    return res.json({ success: true, data: createdDoc })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message })
  }
})

// Legacy save-metadata route (keep for compatibility, but requireAuth)
router.post('/save-metadata', requireAuth, async (req, res) => {
  try {
    const {
      type,
      src,
      poster,
      category,
      section,
      subsection,
      order,
      active,
      guid,
      description,
    } = req.body || {}
    if (!type || !category) {
      return res
        .status(400)
        .json({ success: false, error: 'type and category are required' })
    }
    const nextOrder =
      order !== undefined
        ? order
        : await MediaItem.countDocuments({ category, subsection })
    let finalSrc = src || ''
    let finalPoster = poster || ''
    if (type === 'video' && guid) {
      // Build HLS and thumbnail URLs for Bunny Stream
      const { BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_CDN_BASES } =
        await import('../config/bunny.js')
      let cdnBase =
        BUNNY_STREAM_CDN_BASES &&
        BUNNY_STREAM_CDN_BASES[`${BUNNY_STREAM_LIBRARY_ID}`]
      if (!cdnBase && process.env.BUNNY_STREAM_CDN_BASE) {
        cdnBase = process.env.BUNNY_STREAM_CDN_BASE.replace(/\/$/, '')
      }
      if (cdnBase) {
        finalSrc = `${cdnBase}/${guid}/playlist.m3u8`
        finalPoster = `${cdnBase}/${guid}/thumbnail.jpg`
      }
    }
    const doc = new MediaItem({
      type,
      src: finalSrc,
      poster: finalPoster,
      category,
      section:
        section || (sectionForCategory ? sectionForCategory(category) : ''),
      subsection: subsection || 'default',
      order: nextOrder,
      active: active !== undefined ? active : true,
      guid,
      description,
    })
    const createdDoc = await doc.save()
    if (category) {
      await invalidateMediaItemsCache(`mediaItems:${category}*`)
    }
    return res.json({ success: true, data: createdDoc })
  } catch (err) {
    console.error('[SAVE METADATA ERROR]', err)
    return res.status(500).json({
      success: false,
      error: 'Failed to save metadata',
      details: err.message,
    })
  }
})
// Endpoint to generate a BunnyCDN Storage upload URL for direct client upload
import crypto from 'crypto'
import {
  BUNNY_STORAGE_HOST,
  BUNNY_STORAGE_ZONE,
  BUNNY_STORAGE_API_KEY,
  BUNNY_STORAGE_CDN_BASE,
} from '../config/bunny.js'

// POST /api/admin/media-items/generate-upload-url
router.post('/generate-upload-url', async (req, res) => {
  try {
    const {
      category,
      subsection = 'default',
      originalName,
      type,
    } = req.body || {}
    if (!category || !originalName) {
      return res.status(400).json({
        success: false,
        error: 'category and originalName are required',
      })
    }
    const ext = originalName.split('.').pop()?.toLowerCase() || ''
    const isVideo =
      type === 'video' || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)
    if (isVideo) {
      // Bunny Stream: return info for direct upload
      const {
        BUNNY_STREAM_LIBRARY_ID,
        BUNNY_STREAM_API_KEY,
        BUNNY_STREAM_CDN_BASES,
      } = await import('../config/bunny.js')
      if (!BUNNY_STREAM_LIBRARY_ID || !BUNNY_STREAM_API_KEY) {
        return res
          .status(500)
          .json({ success: false, error: 'Bunny Stream not configured' })
      }
      // Bunny Stream direct upload endpoint
      const uploadUrl = `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos` // POST
      return res.json({
        success: true,
        isVideo: true,
        uploadUrl,
        uploadHeaders: {
          AccessKey: BUNNY_STREAM_API_KEY,
        },
        // The client must POST a FormData with file, title, and optionally collectionId, etc.
        // The backend will need to fetch the video info after upload to get the CDN URL.
      })
    } else {
      // Bunny Storage: as before
      const folderBase = CATEGORY_FOLDER_MAP[category] || category
      const hasSubsectionMapping = SUBSECTION_FOLDER_MAP[category] !== undefined
      let uploadPath
      if (hasSubsectionMapping) {
        const subsectionFolder =
          SUBSECTION_FOLDER_MAP[category]?.[subsection] ?? subsection
        uploadPath = subsectionFolder
          ? `${folderBase}/${subsectionFolder}`
          : folderBase
      } else {
        uploadPath = folderBase
      }
      const filenameBase = originalName.replace(/[^a-z0-9-_\.]/gi, '-')
      const unique = crypto.randomBytes(6).toString('hex')
      const storagePath = `${uploadPath}/${Date.now()}-${unique}-${filenameBase}`
      const uploadUrl = `${BUNNY_STORAGE_HOST.replace(/\/$/, '')}/${encodeURIComponent(BUNNY_STORAGE_ZONE)}/${storagePath.replace(/^\/+/, '')}`
      const cdnUrl = BUNNY_STORAGE_CDN_BASE
        ? `${BUNNY_STORAGE_CDN_BASE.replace(/\/$/, '')}/${storagePath.replace(/^\/+/, '')}`
        : ''
      return res.json({
        success: true,
        isVideo: false,
        uploadUrl,
        uploadHeaders: {
          AccessKey: BUNNY_STORAGE_API_KEY,
          'Content-Type': 'application/octet-stream',
        },
        cdnUrl,
        storagePath,
      })
    }
  } catch (err) {
    console.error('[GENERATE UPLOAD URL ERROR]', err)
    return res.status(500).json({
      success: false,
      error: 'Failed to generate upload URL',
      details: err.message,
    })
  }
})

// Replace only the after video for a before/after pair
router.post('/:id/replace-after', upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params
    const file = req.file
    if (!file)
      return res.status(400).json({ success: false, error: 'File is required' })

    const existing = await MediaItem.findById(id)
    if (!existing)
      return res
        .status(404)
        .json({ success: false, error: 'Media item not found' })

    const ext = path.extname(file.originalname || '').toLowerCase()
    const isVideo =
      file.mimetype?.startsWith('video/') ||
      ['.mp4', '.mov', '.webm', '.mkv'].includes(ext)
    if (!isVideo) {
      return res
        .status(400)
        .json({ success: false, error: 'Only video files are supported' })
    }

    // Upload to Bunny Stream
    const title = (file.originalname || 'after').replace(ext, '') || 'After'
    const {
      guid,
      hlsUrl: bunnyHlsUrl,
      thumbnailUrl,
    } = await uploadToBunnyStream(file.buffer, title)
    const { BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_CDN_BASES } =
      await import('../config/bunny.js')
    let hlsUrl = bunnyHlsUrl || ''
    let cdnBase =
      BUNNY_STREAM_CDN_BASES &&
      BUNNY_STREAM_CDN_BASES[`${BUNNY_STREAM_LIBRARY_ID}`]
    if (!cdnBase && process.env.BUNNY_STREAM_CDN_BASE) {
      cdnBase = process.env.BUNNY_STREAM_CDN_BASE.replace(/\/$/, '')
    }
    if (!hlsUrl && guid && cdnBase) {
      hlsUrl = `${cdnBase}/${guid}/playlist.m3u8`
    }
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

    // Update only after/afterPoster fields
    existing.after = hlsUrl || ''
    existing.afterPoster = poster || ''
    await existing.save()
    return res.json({ success: true, data: existing })
  } catch (err) {
    console.error('Replace after error:', err)
    return res.status(500).json({ success: false, error: err.message })
  }
})

// GET portfolio video from a specific Bunny Stream library
router.get(
  '/portfolio-video',
  /* requireAuth, */ async (req, res) => {
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
        JSON.stringify(bunnyVideos, null, 2),
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
        JSON.stringify(videosWithUrls, null, 2),
      )
      return res.json({ success: true, data: videosWithUrls })
    } catch (error) {
      console.error('[PortfolioVideo] Error fetching portfolio video:', error)
      return res.status(500).json({ success: false, error: error.message })
    }
  },
)

// GET Service Offered videos: merge Bunny Stream API and DB
router.get(
  '/service-offered/merged',
  /* requireAuth, */ async (req, res) => {
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
            v.description.includes('[service-offered]'),
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
  },
)
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
router.get(
  '/category/:category',
  /* requireAuth, */ async (req, res) => {
    try {
      const { category } = req.params
      const { subsection } = req.query
      const filter = { category }
      if (subsection) filter.subsection = subsection

      const cacheKey = subsection
        ? `mediaItems:${category}:${subsection}`
        : `mediaItems:${category}`
      // Ensure Redis client is ready
      if (!redisClient.isOpen) {
        console.warn('[mediaItems] Redis client not open, connecting...')
        try {
          await redisClient.connect()
          console.log('[mediaItems] Redis client connected')
        } catch (connectErr) {
          console.error('[mediaItems] Redis connect error:', connectErr)
        }
      }
      let cached = null
      try {
        console.log(`[mediaItems] Trying Redis GET for key: ${cacheKey}`)
        cached = await redisClient.get(cacheKey)
        console.log('[mediaItems] Redis GET result:', cached ? 'HIT' : 'MISS')
      } catch (redisError) {
        console.error(
          `[mediaItems] Redis get error for key ${cacheKey}:`,
          redisError,
        )
      }
      if (cached) {
        return res.json(JSON.parse(cached))
      }
      console.log(
        `[mediaItems] Cache miss for key: ${cacheKey}, querying MongoDB...`,
      )
      const items = await MediaItem.find(filter).lean()
        .sort({ order: 1, createdAt: -1 })
        .lean()
      const response = { success: true, data: items }
      try {
        console.log('[mediaItems] Saving to Redis')
        await redisClient.set(cacheKey, JSON.stringify(response), { EX: 86400 })
        console.log('[mediaItems] Saved to Redis')
      } catch (setErr) {
        console.error('[mediaItems] Redis set error:', setErr)
      }
      res.json(response)
    } catch (error) {
      console.error('Error fetching media items by category:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to fetch media items' })
    }
  },
)

// POST bulk update media items (for category management)
// This is the CRITICAL route for saving/updating arrays from the frontend.
router.post(
  '/bulk/:category',
  /* requireAuth, */ async (req, res) => {
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
      // For portfolio videos, use unique categories
      let deleteQuery = { category }
      if (
        category === 'home_portfolio_video' ||
        category === 'video_portfolio_video'
      ) {
        // Only delete items for this unique category
        await MediaItem.deleteMany(deleteQuery)
      } else {
        // For other categories, keep previous logic
        await MediaItem.deleteMany(deleteQuery)
      }

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

      // Invalidate Redis cache for this category and all subsections
      const pattern = `mediaItems:${category}*`
      await invalidateMediaItemsCache(pattern)

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
  },
)

// Other CRUD routes (POST /, PUT /:id, DELETE /:id) remain the same...

// POST create single media item
router.post(
  '/',
  /* requireAuth, */ async (req, res) => {
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
        return res.status(400).json({
          success: false,
          error: 'Type, src, and category are required',
        })
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
      // Invalidate Redis cache for this category and all subsections
      if (category) {
        const pattern = `mediaItems:${category}*`
        await invalidateMediaItemsCache(pattern)
      }
      res.json({ success: true, data: savedItem })
    } catch (error) {
      console.error('Error creating media item:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to create media item' })
    }
  },
)

// PUT update single media item
router.put(
  '/:id',
  /* requireAuth, */ async (req, res) => {
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
          return res.status(400).json({
            success: false,
            error: `Invalid src URL: ${updateData.src}`,
          })
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

      // Invalidate Redis cache for this category and all subsections
      if (updatedItem.category) {
        const pattern = `mediaItems:${updatedItem.category}*`
        await invalidateMediaItemsCache(pattern)
      }

      res.json({ success: true, data: updatedItem })
    } catch (error) {
      console.error('Error updating media item:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to update media item' })
    }
  },
)

// DELETE single media item
router.delete(
  '/:id',
  /* requireAuth, */ async (req, res) => {
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

      // Invalidate Redis cache for this category and all subsections
      if (item.category) {
        const pattern = `mediaItems:${item.category}*`
        await invalidateMediaItemsCache(pattern)
      }

      res.json({ success: true, message: 'Media item deleted successfully' })
    } catch (error) {
      console.error('Error deleting media item:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to delete media item' })
    }
  },
)

// GET single media item
router.get(
  '/:id',
  /* requireAuth, */ async (req, res) => {
    try {
      const { id } = req.params
      const cacheKey = `mediaItems:item:${id}`
      redisClient.get(cacheKey, async (err, cached) => {
        if (err) {
          console.error('Redis get error:', err)
        }
        if (cached) {
          return res.json(JSON.parse(cached))
        }
        const item = await MediaItem.findById(id)
        if (!item) {
          return res
            .status(404)
            .json({ success: false, error: 'Media item not found' })
        }
        const response = { success: true, data: item }
        redisClient.setex(cacheKey, 86400, JSON.stringify(response))
        res.json(response)
      })
    } catch (error) {
      console.error('Error fetching media item:', error)
      res
        .status(500)
        .json({ success: false, error: 'Failed to fetch media item' })
    }
  },
)

export default router

// Upload raw image/video and create MediaItem
// requireAuth temporarily disabled for testing CORS and upload
router.post(
  '/upload',
  /* requireAuth, */ upload.single('file'),
  async (req, res) => {
    try {
      const file = req.file
      const { category, subsection = 'default' } = req.body || {}
      console.log(
        '[UPLOAD ROUTE] Received category:',
        category,
        'subsection:',
        subsection,
      )
      if (!file)
        return res
          .status(400)
          .json({ success: false, error: 'File is required' })
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
        const nextOrder = await MediaItem.countDocuments({
          category,
          subsection,
        })
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
        const { BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_CDN_BASES } =
          await import('../config/bunny.js')
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
        // --- Handle after video upload ---
        const { beforeId } = req.body || {}
        if (beforeId) {
          // Update the existing MediaItem with after/afterPoster
          const updated = await MediaItem.findByIdAndUpdate(
            beforeId,
            {
              after: src,
              afterPoster: poster,
            },
            { new: true },
          )
          if (!updated) {
            return res
              .status(404)
              .json({ success: false, error: 'Before video not found' })
          }
          return res.json({
            success: true,
            data: updated,
            meta: { iframeUrl, hlsUrl, guid },
          })
        }
        // --- Normal before video upload ---
        const nextOrder = await MediaItem.countDocuments({
          category,
          subsection,
        })
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
  },
)

// Replace existing media item file (image or video)
router.post(
  '/:id/replace',
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
        const oldName = existing.src ? existing.src.split('/').pop() : ''
        const newName = cdnUrl.split('/').pop()
        existing.src = cdnUrl
        await existing.save()
        // Invalidate Redis cache for this category and all subsections
        if (category) {
          const pattern = `mediaItems:${category}*`
          await invalidateMediaItemsCache(pattern)
        }
        console.log(
          `[REPLACE] Image replaced: old file = ${oldName}, new file = ${newName}`,
        )
        return res.json({ success: true, data: existing })
      }

      if (isVideo) {
        // Invalidate Redis cache for this category and all subsections
        if (category) {
          const pattern = `mediaItems:${category}*`
          await invalidateMediaItemsCache(pattern)
        }
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
                `Failed to delete old Bunny Stream video: ${delRes.status} ${text}`,
              )
            } else {
              console.log(`✓ Deleted old Bunny Stream video: ${existing.guid}`)
            }
          } catch (err) {
            console.error('Error deleting old Bunny Stream video:', err)
          }
        }

        const title = filenameBase.replace(ext, '') || 'Upload'
        const {
          guid,
          iframeUrl,
          hlsUrl: bunnyHlsUrl,
          thumbnailUrl,
        } = await uploadToBunnyStream(file.buffer, title)
        // Import config for CDN base
        const {
          BUNNY_STREAM_LIBRARY_ID,
          BUNNY_STREAM_CDN_BASES,
          BUNNY_STREAM_API_KEY,
        } = await import('../config/bunny.js')
        // Try to get HLS and thumbnail from Bunny API, fallback to CDN base if needed
        let hlsUrl = bunnyHlsUrl || ''
        let cdnBase =
          BUNNY_STREAM_CDN_BASES &&
          BUNNY_STREAM_CDN_BASES[`${BUNNY_STREAM_LIBRARY_ID}`]
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
        // Poll Bunny Stream for HLS URL and thumbnail if still missing
        if ((!hlsUrl || !poster) && guid) {
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
              if (!hlsUrl)
                hlsUrl = details.playlistUrl || details.hlsUrl || hlsUrl
              if (!poster) poster = details.thumbnailUrl || poster
              if (hlsUrl && poster) break
            }
            if (i < maxTries - 1)
              await new Promise((r) => setTimeout(r, delayMs))
          }
        }
        existing.type = 'video'
        existing.guid = guid
        existing.src = hlsUrl || ''
        existing.poster = poster || ''
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
  },
)

// Replace poster (thumbnail) for a video item via image upload
router.post(
  '/:id/replace-poster',
  // requireAuth,
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
        '-',
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
  },
)
