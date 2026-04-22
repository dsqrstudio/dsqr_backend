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
import redisClient from '../config/redis.js';
import BeforeAfterPair from '../models/BeforeAfterPair.js';

router.post('/:model', async (req, res) => {
  const { model } = req.params;
  const { order } = req.body; // order: array of item IDs in new order
  const Model = modelMap[model];
  if (!Model) return res.status(400).json({ success: false, message: 'Invalid model' });
  if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'Order must be an array' });
  try {
    await Promise.all(order.map((id, idx) => Model.findByIdAndUpdate(id, { order: idx }, { new: true })));

    // Invalidate Redis cache for all media items (images/videos)
    if (model === 'media-items') {
      // Remove all mediaItems:* keys (all categories)
      redisClient.keys('mediaItems:*', (err, keys) => {
        if (!err && Array.isArray(keys) && keys.length > 0) {
          redisClient.del(keys, (delErr, delCount) => {
            if (delErr) {
              console.error('[REDIS] Delete error (reorder):', delErr);
            } else {
              console.log(`[REDIS] Deleted ${delCount} mediaItems:* keys after reorder`);
            }
          });
        }
      });
    }

    // Invalidate before/after pairs cache
    if (model === 'media-items' || model === 'before-after-pairs') {
      // Remove before_after_pairs:all
      if (redisClient.isOpen) {
        redisClient.del('before_after_pairs:all').then(() => {
          console.log('[REDIS] Invalidated before_after_pairs:all after reorder');
        }).catch((err) => {
          console.error('[REDIS] Error invalidating before_after_pairs:all after reorder:', err);
        });
      }
    }

    res.json({ success: true, message: 'Order updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update order', error: err.message });
  }
});

export default router;
