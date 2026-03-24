import express from 'express';
import mongoose from 'mongoose';
import MediaItem from '../models/MediaItem.js';
import redisClient from '../config/redis.js';

const router = express.Router();

const modelMap = {
  'media-items': MediaItem,
  // Add other models here
};

// Generic reorder endpoint for any model
router.post('/:model', async (req, res) => {
  const { model } = req.params;
  const { order } = req.body; // order: array of item IDs in new order
  console.log(`[REORDER ROUTE STARTED] Model: ${model}, Order payload:`, order);
  
  const Model = modelMap[model];
  if (!Model) {
    console.log('[REORDER ROUTE] Invalid model:', model);
    return res.status(400).json({ success: false, message: 'Invalid model' });
  }
  
  if (!Array.isArray(order)) {
    console.log('[REORDER ROUTE] Invalid order array:', order);
    return res.status(400).json({ success: false, message: 'Order must be an array' });
  }
  
  try {
    const promises = order.map(async (id, idx) => {
      console.log(`[REORDER ROUTE] Updating ${id} with order ${idx}`);
      return Model.findByIdAndUpdate(id, { order: idx }, { new: true });
    });
    
    await Promise.all(promises);
    console.log('[REORDER ROUTE] Database update successful for', order.length, 'items');

    // Invalidate Redis cache for this model to prevent stale data
    let cachePattern = '';
    if (model === 'media-items') cachePattern = 'mediaItems:*';
    if (model === 'testimonials') cachePattern = 'testimonials:*';
    
    if (cachePattern && redisClient.isOpen) {
      try {
        const keys = await redisClient.keys(cachePattern);
        if (Array.isArray(keys) && keys.length > 0) {
          const delCount = await redisClient.del(keys);
          console.log(`[REDIS] Reorder invalidated ${delCount} keys matching ${cachePattern}`);
        } else {
          console.log(`[REDIS] No keys matching ${cachePattern} found to invalidate.`);
        }
      } catch (redisErr) {
        console.error('[REDIS] Delete error on reorder:', redisErr);
      }
    }

    res.json({ success: true, message: 'Order updated' });
  } catch (err) {
    console.error('[REORDER ROUTE] Catch error:', err);
    res.status(500).json({ success: false, message: 'Failed to update order', error: err.message });
  }
});

export default router;
