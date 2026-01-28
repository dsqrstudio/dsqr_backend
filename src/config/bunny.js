// Centralized Bunny configuration and helpers
export const BUNNY_STORAGE_HOST =
  process.env.BUNNY_STORAGE_HOST || 'https://storage.bunnycdn.com'
export const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || ''
export const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY || ''
export const BUNNY_STORAGE_CDN_BASE = process.env.BUNNY_STORAGE_CDN_BASE || ''

export const BUNNY_STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID || ''
export const BUNNY_STREAM_API_KEY = process.env.BUNNY_STREAM_API_KEY || ''
// e.g. https://vz-xxxx.b-cdn.net (no trailing slash)
// e.g. https://vz-xxxx.b-cdn.net (no trailing slash)

export const BUNNY_STREAM_CDN_BASES = {
  571680: 'https://vz-75af00f3-236.b-cdn.net', // test
  588182: 'https://vz-de2e9b55-515.b-cdn.net', // new
}
// Map admin categories to storage folders and to top-level sections
export const CATEGORY_FOLDER_MAP = {
  // Global managers
  graphics: 'Graphics', // Changed to capital G to match Bunny folder
  video: 'videos',
  ai_lab: 'Ai-lab', // Capital A to match Bunny folder
  our_work: 'our-work',
  affiliated: 'Promotional Content', // Exact folder name in Bunny Storage
  client_logos: 'Client_logos', // Exact folder name in Bunny Storage
  why_us: 'why-us',
  testimonials: 'testimonial', // Map to singular folder as requested
  test: 'test', // Map 'test' category to 'test' folder
  team_photos: 'Team_photo', // Exact folder name in Bunny Storage
  extras: "Extra's", // Extras folder (contains About Us and Affiliate extras)

  // Home page sections (images only)
  'home-page': 'Home-page', // Use capital H to match Bunny folder
}

// Map subsections to their specific folder names within categories
export const SUBSECTION_FOLDER_MAP = {
  graphics: {
    'primary-images': 'graphic-header',
    'service-images': 'graphic-service',
  },
  'home-page': {
    'hero-section': 'hero-section',
    123: '123',
    'gallery-section': 'gallery-section',
  },
  ai_lab: {
    primary_graphics: '', // Upload directly to Ai-lab folder
    service_offered: '', // Upload directly to Ai-lab folder
  },
  // client_logos and team_photos don't need subsection mapping
  // They upload directly to their respective folders
}

export function sectionForCategory(category) {
  if (category === 'graphics') return 'Graphics'
  if (category === 'video') return 'Videos'
  if (category === 'ai_lab') return 'AI Lab'
  if (category === 'our_work') return 'Our Work'
  return ''
}
