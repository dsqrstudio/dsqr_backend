// Script to clear Redis cache for a specific category
// Run with: node clearRedisCategoryCache.js

import dotenv from 'dotenv'
dotenv.config()
import redisClient from './src/config/redis.js'

const CATEGORY = 'about_us_before_after'

async function clearCategoryCache() {
  const pattern = `mediaItems:${CATEGORY}*`
  redisClient.keys(pattern, (err, keys) => {
    if (err) {
      console.error('Redis error:', err)
      process.exit(1)
    }
    if (Array.isArray(keys) && keys.length > 0) {
      redisClient.del(keys, (delErr, delCount) => {
        if (delErr) {
          console.error('Delete error:', delErr)
        } else {
          console.log(
            `Deleted ${delCount} Redis keys for category '${CATEGORY}'.`,
          )
        }
        process.exit(0)
      })
    } else {
      console.log(`No Redis keys found for category '${CATEGORY}'.`)
      process.exit(0)
    }
  })
}

clearCategoryCache()
