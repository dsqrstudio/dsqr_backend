// Add pairId and role for before/after video linking
import { v4 as uuidv4 } from 'uuid'
import mongoose from 'mongoose'

const MediaItemSchema = new mongoose.Schema({
  title: { type: String, default: '' }, // Optional display title/label
  type: {
    type: String,
    required: true,
    enum: ['image', 'video'], // Used to store file type
  },
  src: {
    type: String,
    required: function () {
      return this.type === 'image'
    },
  },
  poster: { type: String, default: '' }, // for videos
  // before/after fields are deprecated; use pairId/role instead
  pairId: { type: String, default: '' }, // Unique ID to link before/after
  role: { type: String, enum: ['before', 'after', ''], default: '' }, // before/after
  order: { type: Number, default: 0 }, // for drag-and-drop ordering

  beforePoster: { type: String, default: '' }, // Poster/thumbnail for 'before' video
  afterPoster: { type: String, default: '' }, // Poster/thumbnail for 'after' video

  // Three-level hierarchy fields
  section: {
    type: String,
    enum: ['Graphics', 'Videos', 'AI Lab', 'Our Work', ''], // Top-level keys
    default: '',
    required: function () {
      return this.category === 'our_work'
    },
  },
  subsection: {
    type: String,
    default: '',
    // 💡 UPDATED: Required if category is 'our_work', 'graphics', 'ai_lab', or 'video'
    required: function () {
      return (
        this.category === 'our_work' ||
        this.category === 'graphics' ||
        this.category === 'ai_lab' ||
        this.category === 'video'
      )
    },
  },
  category: {
    type: String,
    required: true,
    enum: [
      'about_us_before_after',
      'testimonials',
      'our_work',
      'graphics', // Used for Graphics Manager
      'video', // Used for Videos Manager
      'why_us',
      'ai_lab', // Used for AI Lab Manager
      'client_logos',
      'affiliated',
      'team_photos', // Used for Team Photos Manager
      'extras', // Extras (About Us, Affiliate)
      // HomeContent categories (for compatibility)
      'primary_graphics',
      'steps_animation_graphics',
      'image_gallery_graphics',
      'services_offered',
      'portfolio_video',
      'home-page',
      'test', // Allow test category
      // Unique categories for portfolio videos
      'home_portfolio_video',
      'video_portfolio_video',
    ],
  },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

// Update timestamp on save
MediaItemSchema.pre('save', function (next) {
  this.updatedAt = Date.now()
  // If this is a before/after video and no pairId, generate one
  if ((this.role === 'before' || this.role === 'after') && !this.pairId) {
    this.pairId = uuidv4()
  }
  next()
})

const MediaItem =
  mongoose.models.MediaItem || mongoose.model('MediaItem', MediaItemSchema)
export default MediaItem
