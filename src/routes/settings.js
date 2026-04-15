import express from 'express'
import Settings from '../models/Settings.js'
// import { requireAuth } from '../middlewares/authMiddleware.js'

const router = express.Router()

// GET setting by key
import redisClient from '../config/redis.js'
router.get(
  '/:key',
  /* requireAuth, */ async (req, res) => {
    try {
      const { key } = req.params;
      const cacheKey = `settings:${key}`;

      const getDefaults = (k) => {
        const defaults = {
          ourWorkStats: {
            videosEdited: '11,000+',
            clientTimeSaved: '54k+',
            organicViews: '22M+',
            timeSavedPerClient: '4h/Day',
          },
          promotionalDiscount: {
            enabled: false,
            percentage: 30,
            name: 'Black Friday Sale',
          },
        };
        return defaults[k] || {};
      };

      try {
        if (!redisClient.isReady) {
          throw new Error('Redis not ready');
        }
        const cached = await Promise.race([
          redisClient.get(cacheKey),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis Timeout')), 1000))
        ]);
        if (cached) {
          return res.json(JSON.parse(cached));
        }
      } catch (redisErr) {
        console.error('Redis get error / skip:', redisErr.message || redisErr);
      }

      // Fallback to DB
      const setting = await Settings.findOne({ key });
      let response;

      if (!setting) {
        response = { success: true, data: getDefaults(key) };
      } else {
        response = { success: true, data: setting.data };
      }

      // Cache it
      redisClient.setEx(cacheKey, 60, JSON.stringify(response)).catch(console.error);

      res.json(response);
    } catch (error) {
      console.error('Error fetching setting:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch setting' });
    }
  }
)

// POST/UPDATE setting
router.post(
  '/:key',
  /* requireAuth, */ async (req, res) => {
    try {
      const { key } = req.params;
      const { data } = req.body;

      if (!data) {
        console.error(`[settings] POST missing data for key: ${key}`);
        return res.status(400).json({
          success: false,
          error: 'Data is required',
        });
      }

      console.log(`[settings] Attempting to upsert key: ${key} with data:`, data);
      const setting = await Settings.findOneAndUpdate(
        { key },
        { data },
        { upsert: true, new: true, runValidators: true },
      );
      if (!setting) {
        console.error(`[settings] Upsert failed for key: ${key}`);
        return res.status(500).json({ success: false, error: 'Upsert failed' });
      }
      console.log(`[settings] Upserted key: ${key} with data:`, setting.data);
      // Invalidate cache after update
      redisClient.del(`settings:${key}`)
        .then(() => console.log(`[settings] Redis cache invalidated for key: ${key}`))
        .catch((err) => console.error(`[settings] Redis cache invalidate error for key: ${key}`, err));
      res.json({ success: true, data: setting.data });
    } catch (error) {
      console.error(`[settings] Error saving setting for key: ${req.params.key}`, error);
      res.status(500).json({ success: false, error: 'Failed to save setting' });
    }
  },
)

export default router