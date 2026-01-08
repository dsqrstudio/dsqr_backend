import mongoose from 'mongoose';

const HomeContentSchema = new mongoose.Schema({
  section: { 
    type: String, 
    required: true, 
    // ADD THE SUB-SECTION KEYS HERE
    enum: [
      'primary_graphics',         // For Primary Animation Graphics
      'steps_animation_graphics', // New
      'image_gallery_graphics',   // New
      'portfolio_video', 
      'services_offered'
    ]
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
HomeContentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Ensure only one document per section
HomeContentSchema.index({ section: 1 }, { unique: true });

const HomeContent = mongoose.models.HomeContent || mongoose.model('HomeContent', HomeContentSchema);
export default HomeContent;
