// Script to check media item statistics
// Run with: node src/seed/checkStats.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import MediaItem from '../models/MediaItem.js'

dotenv.config()

async function checkStats() {
  try {
    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB\n')

    // Get total counts
    const totalItems = await MediaItem.countDocuments()
    const totalVideos = await MediaItem.countDocuments({ type: 'video' })
    const totalImages = await MediaItem.countDocuments({ type: 'image' })

    console.log('='.repeat(50))
    console.log('📊 MEDIA ITEMS STATISTICS')
    console.log('='.repeat(50))
    console.log(`📦 Total Items:    ${totalItems}`)
    console.log(`🎬 Total Videos:   ${totalVideos}`)
    console.log(`🖼️  Total Images:   ${totalImages}`)
    console.log('='.repeat(50))
    console.log()

    // Breakdown by category
    console.log('📂 BREAKDOWN BY CATEGORY:')
    console.log('-'.repeat(50))

    const categories = await MediaItem.distinct('category')

    for (const category of categories) {
      const count = await MediaItem.countDocuments({ category })
      const videos = await MediaItem.countDocuments({ category, type: 'video' })
      const images = await MediaItem.countDocuments({ category, type: 'image' })

      console.log(`\n${category}:`)
      console.log(`  Total: ${count} (Videos: ${videos}, Images: ${images})`)

      // Get subsections for this category
      const subsections = await MediaItem.distinct('subsection', { category })
      if (subsections.length > 0 && subsections[0]) {
        for (const subsection of subsections) {
          const subCount = await MediaItem.countDocuments({
            category,
            subsection,
          })
          console.log(`    └─ ${subsection}: ${subCount}`)
        }
      }
    }

    console.log('\n' + '='.repeat(50))

    // Verify the math
    console.log('\n✅ VERIFICATION:')
    console.log(
      `Videos + Images = ${totalVideos} + ${totalImages} = ${
        totalVideos + totalImages
      }`
    )
    console.log(`Total Items = ${totalItems}`)
    console.log(
      `Match: ${totalVideos + totalImages === totalItems ? '✅ YES' : '❌ NO'}`
    )

    await mongoose.disconnect()
    console.log('\n👋 Disconnected from MongoDB')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

checkStats()
