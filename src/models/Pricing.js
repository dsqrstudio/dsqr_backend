import mongoose from 'mongoose';

const PricingSchema = new mongoose.Schema({
  category: { 
    type: String, 
    required: true,
    enum: ['Graphic', 'Video', 'Both', 'AI']
  },
  level: { 
    type: Number, 
    required: true,
    min: 1,
    max: 3
  },
  base: {
    USD: { type: Number, required: true },
    CAD: { type: Number, required: true }
  },
  fast: {
    USD: { type: Number, default: null },
    CAD: { type: Number, default: null }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
PricingSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Ensure unique combination of category and level
PricingSchema.index({ category: 1, level: 1 }, { unique: true });

const Pricing = mongoose.models.Pricing || mongoose.model('Pricing', PricingSchema);
export default Pricing;
