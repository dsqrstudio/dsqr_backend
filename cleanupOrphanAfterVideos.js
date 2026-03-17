// Script to find and delete orphan after videos in MediaItem collection
// Run with: node cleanupOrphanAfterVideos.js

import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()
import MediaItem from './src/models/MediaItem.js'

const MONGO_URI = process.env.MONGO_URI

async function cleanupOrphanAfterVideos() {
  await mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })

  // Find all after videos
  const afterVideos = await MediaItem.find({ role: 'after' })
  let deletedCount = 0

  for (const after of afterVideos) {
    // Check if there is a before video with the same pairId
    const before = await MediaItem.findOne({
      pairId: after.pairId,
      role: 'before',
    })
    if (!before) {
      // Orphan after video, delete it
      await MediaItem.deleteOne({ _id: after._id })
      console.log(
        `Deleted orphan after video: ${after._id} (pairId: ${after.pairId})`,
      )
      deletedCount++
    }
  }

  console.log(`Cleanup complete. Deleted ${deletedCount} orphan after videos.`)
  await mongoose.disconnect()
}

cleanupOrphanAfterVideos().catch((err) => {
  console.error('Error during cleanup:', err)
  process.exit(1)
})
