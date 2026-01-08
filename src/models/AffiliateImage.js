// models/AffiliateImage.js
import mongoose from 'mongoose';

const AffiliateImageSchema = new mongoose.Schema({
  url: { type: String, required: true },        // Bunny CDN URL
  alt: { type: String, default: '' },           // optional alt text
  order: { type: Number, default: 0 },          // ordering for display
  active: { type: Boolean, default: true },     // toggle visible/hidden
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// update `updatedAt` automatically
AffiliateImageSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const AffiliateImage = mongoose.models.AffiliateImage || mongoose.model('AffiliateImage', AffiliateImageSchema);
export default AffiliateImage;
