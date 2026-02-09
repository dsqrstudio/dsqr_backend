import express from 'express';
import MediaItem from '../models/MediaItem.js';
import Testimonial from '../models/Testimonial.js';
// Add other models as needed

const router = express.Router();

const modelMap = {
  'media-items': MediaItem,
  'testimonials': Testimonial,
  // Add other models here
};

// Generic reorder endpoint for any model
router.post('/:model', async (req, res) => {
  const { model } = req.params;
  const { order } = req.body; // order: array of item IDs in new order
  const Model = modelMap[model];
  if (!Model) return res.status(400).json({ success: false, message: 'Invalid model' });
  if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'Order must be an array' });
  try {
    await Promise.all(order.map((id, idx) => Model.findByIdAndUpdate(id, { order: idx }, { new: true })));
    res.json({ success: true, message: 'Order updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update order', error: err.message });
  }
});

export default router;
