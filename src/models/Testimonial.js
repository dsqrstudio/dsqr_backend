import mongoose from 'mongoose'

const TestimonialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: String, default: '' },
  image: { type: String, required: true },
  text: { type: String, required: true },
  highlight: { type: String, default: '' }, // Single highlight field
  stats: {
    // Remove min validation for editing_time per request
    editing_time: { type: Number, required: true },
    cost: { type: Number, required: true, min: 0 },
    videos: { type: Number, required: true, min: 0 },
  },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

// Update timestamp on save
TestimonialSchema.pre('save', function (next) {
  this.updatedAt = Date.now()
  next()
})

TestimonialSchema.index({ active: 1, order: 1 })

const Testimonial =
  mongoose.models.Testimonial ||
  mongoose.model('Testimonial', TestimonialSchema)
export default Testimonial
