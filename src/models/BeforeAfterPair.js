import mongoose from 'mongoose'

const BeforeAfterPairSchema = new mongoose.Schema({
  type: { type: String, default: 'before-after' },
  before: {
    videoId: { type: String, required: true },
    hlsUrl: { type: String, required: true },
    poster: { type: String, default: '' },
    title: { type: String, default: '' },
  },
  after: {
    videoId: { type: String, required: true },
    hlsUrl: { type: String, required: true },
    poster: { type: String, default: '' },
    title: { type: String, default: '' },
  },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

BeforeAfterPairSchema.pre('save', function (next) {
  this.updatedAt = Date.now()
  next()
})

const BeforeAfterPair =
  mongoose.models.BeforeAfterPair ||
  mongoose.model('BeforeAfterPair', BeforeAfterPairSchema)
export default BeforeAfterPair
