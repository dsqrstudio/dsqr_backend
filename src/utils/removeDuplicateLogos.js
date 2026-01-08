import mongoose from 'mongoose'
import MediaItem from '../models/MediaItem.js'
import dotenv from 'dotenv'

dotenv.config()

/**
 * Remove duplicate client logos from database
 * Keeps only unique items based on 'src' URL
 */
async function removeDuplicateLogos() {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✓ Connected to MongoDB')

    // Find all client logos
    const allLogos = await MediaItem.find({ category: 'client_logos' })
      .sort({ createdAt: 1 })
      .lean()

    console.log(`\nFound ${allLogos.length} total client logos`)

    if (allLogos.length === 0) {
      console.log('No client logos found. Exiting.')
      process.exit(0)
    }

    // Track unique logos by src URL
    const seenSrcs = new Set()
    const duplicateIds = []
    const uniqueLogos = []

    allLogos.forEach((logo) => {
      if (seenSrcs.has(logo.src)) {
        // This is a duplicate
        duplicateIds.push(logo._id)
        console.log(`✗ Duplicate found: ${logo.src}`)
      } else {
        // First occurrence - keep it
        seenSrcs.add(logo.src)
        uniqueLogos.push(logo)
        console.log(`✓ Keeping: ${logo.src}`)
      }
    })

    console.log(`\n--- Summary ---`)
    console.log(`Total logos: ${allLogos.length}`)
    console.log(`Unique logos: ${uniqueLogos.length}`)
    console.log(`Duplicates to remove: ${duplicateIds.length}`)

    if (duplicateIds.length > 0) {
      console.log(`\nRemoving ${duplicateIds.length} duplicate(s)...`)
      const result = await MediaItem.deleteMany({
        _id: { $in: duplicateIds },
      })
      console.log(`✓ Deleted ${result.deletedCount} duplicate logo(s)`)

      // Update order for remaining logos
      console.log(`\nReordering remaining logos...`)
      for (let i = 0; i < uniqueLogos.length; i++) {
        await MediaItem.findByIdAndUpdate(uniqueLogos[i]._id, { order: i })
      }
      console.log(`✓ Updated order for ${uniqueLogos.length} logos`)
    } else {
      console.log('\n✓ No duplicates found!')
    }

    console.log('\n✅ Cleanup complete!')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

removeDuplicateLogos()
