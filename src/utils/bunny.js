/**
 * Fetch all videos from Bunny Stream API for the configured library
 */
export async function fetchAllBunnyStreamVideos(libraryId) {
  const LIB_ID = libraryId || BUNNY_STREAM_LIBRARY_ID
  ensure(LIB_ID, 'BUNNY_STREAM_LIBRARY_ID not set')
  ensure(BUNNY_STREAM_API_KEY, 'BUNNY_STREAM_API_KEY not set')
  const url = `https://video.bunnycdn.com/library/${LIB_ID}/videos?page=1&itemsPerPage=1000`
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      AccessKey: BUNNY_STREAM_API_KEY,
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Bunny stream fetch failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  return Array.isArray(data.items) ? data.items : data
}
import {
  BUNNY_STORAGE_HOST,
  BUNNY_STORAGE_ZONE,
  BUNNY_STORAGE_API_KEY,
  BUNNY_STORAGE_CDN_BASE,
  BUNNY_STREAM_LIBRARY_ID,
  BUNNY_STREAM_API_KEY,
  BUNNY_STREAM_CDN_BASES,
} from '../config/bunny.js'

const ensure = (cond, message) => {
  if (!cond) throw new Error(message)
}

export async function uploadToBunnyStorage(fileBuffer, pathWithFile) {
  ensure(BUNNY_STORAGE_ZONE, 'BUNNY_STORAGE_ZONE not set')
  ensure(BUNNY_STORAGE_API_KEY, 'BUNNY_STORAGE_API_KEY not set')

  const url = `${BUNNY_STORAGE_HOST.replace(/\/$/, '')}/${encodeURIComponent(
    BUNNY_STORAGE_ZONE
  )}/${pathWithFile.replace(/^\/+/, '')}`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      AccessKey: BUNNY_STORAGE_API_KEY,
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Bunny storage upload failed: ${res.status} ${text}`)
  }

  const cdnBase = BUNNY_STORAGE_CDN_BASE.replace(/\/$/, '')
  const cdnUrl = cdnBase ? `${cdnBase}/${pathWithFile.replace(/^\/+/, '')}` : ''

  return { cdnUrl }
}

export async function deleteFromBunnyStorage(pathWithFile) {
  ensure(BUNNY_STORAGE_ZONE, 'BUNNY_STORAGE_ZONE not set')
  ensure(BUNNY_STORAGE_API_KEY, 'BUNNY_STORAGE_API_KEY not set')

  const url = `${BUNNY_STORAGE_HOST.replace(/\/$/, '')}/${encodeURIComponent(
    BUNNY_STORAGE_ZONE
  )}/${pathWithFile.replace(/^\/+/, '')}`

  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      AccessKey: BUNNY_STORAGE_API_KEY,
    },
  })

  if (!res.ok && res.status !== 404) {
    // 404 is ok - file already deleted
    const text = await res.text().catch(() => '')
    throw new Error(`Bunny storage delete failed: ${res.status} ${text}`)
  }

  return { success: true }
}

export async function uploadToBunnyStream(
  fileBuffer,
  title = 'Upload',
  libraryId = null
) {
  ensure(BUNNY_STREAM_LIBRARY_ID, 'BUNNY_STREAM_LIBRARY_ID not set')
  ensure(BUNNY_STREAM_API_KEY, 'BUNNY_STREAM_API_KEY not set')

  // 1) Create video entry
  const createUrl = `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos`
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      AccessKey: BUNNY_STREAM_API_KEY,
    },
    body: JSON.stringify({ title }),
  })
  if (!createRes.ok) {
    const text = await createRes.text().catch(() => '')
    throw new Error(`Bunny stream create failed: ${createRes.status} ${text}`)
  }
  const created = await createRes.json()
  const guid = created?.guid || created?.videoId || created?.id
  if (!guid) throw new Error('Bunny stream: missing video GUID in response')

  // 2) Upload file bytes
  const uploadUrl = `https://video.bunnycdn.com/library/${BUNNY_STREAM_LIBRARY_ID}/videos/${guid}`
  const upRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      AccessKey: BUNNY_STREAM_API_KEY,
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer,
  })
  if (!upRes.ok) {
    const text = await upRes.text().catch(() => '')
    throw new Error(`Bunny stream upload failed: ${upRes.status} ${text}`)
  }

  // 3) Fetch video details from Bunny to get real URLs
  const resolvedLibraryId = libraryId || BUNNY_STREAM_LIBRARY_ID
  const iframeUrl = `https://iframe.mediadelivery.net/embed/${resolvedLibraryId}/${guid}`
  // Fetch video details from Bunny API
  const detailsUrl = `https://video.bunnycdn.com/library/${resolvedLibraryId}/videos/${guid}`
  const detailsRes = await fetch(detailsUrl, {
    method: 'GET',
    headers: {
      AccessKey: BUNNY_STREAM_API_KEY,
    },
  })
  if (!detailsRes.ok) {
    const text = await detailsRes.text().catch(() => '')
    throw new Error(
      `Bunny stream details fetch failed: ${detailsRes.status} ${text}`
    )
  }
  const details = await detailsRes.json()
  const hlsUrl = details.playlistUrl || details.hlsUrl || ''
  const thumbnailUrl = details.thumbnailUrl || ''
  return { guid, iframeUrl, hlsUrl, thumbnailUrl }
}

/**
 * Extract storage path from CDN URL
 * E.g., "https://dsqrstudio.b-cdn.net/Client_logos/123456.png" -> "Client_logos/123456.png"
 */
export function extractStoragePathFromCdnUrl(cdnUrl) {
  if (!cdnUrl || !BUNNY_STORAGE_CDN_BASE) return null

  try {
    const cdnBase = BUNNY_STORAGE_CDN_BASE.replace(/\/$/, '')
    if (!cdnUrl.startsWith(cdnBase)) return null

    // Remove the CDN base to get the path
    const path = cdnUrl.replace(cdnBase + '/', '')
    return path
  } catch (error) {
    console.error('Error extracting storage path:', error)
    return null
  }
}
