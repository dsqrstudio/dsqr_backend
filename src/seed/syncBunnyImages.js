// Script to sync existing Bunny CDN images to MongoDB
// Run with: node src/seed/syncBunnyImages.js
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import MediaItem from '../models/MediaItem.js'

dotenv.config()

const BUNNY_CDN_BASE =
  process.env.BUNNY_STORAGE_CDN_BASE || 'https://dsqrstudio.b-cdn.net'

// Define your existing images that are already in Bunny Storage
// Format: { folder: 'Graphics/graphic-header', filename: 'image1.jpg', category: 'graphics', subsection: 'primary-images' }
const EXISTING_IMAGES = [
  // ============================================
  // GRAPHICS - Primary Images (graphic-header folder)
  // ============================================
  {
    folder: 'Graphics/graphic-header',
    filename: '165e621e3efc9521dccceebf7abb7957b0a291f2.png',
    category: 'graphics',
    subsection: 'primary-images',
  },
  {
    folder: 'Graphics/graphic-header',
    filename: '2733ba736a8070ca0289d8b3692e8d240fa05d98.png',
    category: 'graphics',
    subsection: 'primary-images',
  },
  {
    folder: 'Graphics/graphic-header',
    filename: '943eb6689c3acbb92c2323f31f8d7fc470658000.png',
    category: 'graphics',
    subsection: 'primary-images',
  },
  {
    folder: 'Graphics/graphic-header',
    filename: '9aed5621570c63dbe9a6255a386d146f82729055.png',
    category: 'graphics',
    subsection: 'primary-images',
  },
  {
    folder: 'Graphics/graphic-header',
    filename: 'c73a133bfef8e852a189178b54e2d3417619da91.png',
    category: 'graphics',
    subsection: 'primary-images',
  },
  {
    folder: 'Graphics/graphic-header',
    filename: 'c9516044ba93b195bed30437a462460761dfe6a3.png',
    category: 'graphics',
    subsection: 'primary-images',
  },
  {
    folder: 'Graphics/graphic-header',
    filename: 'eb1ff97fa09df547fab2f6db9e247168ce8e4296.png',
    category: 'graphics',
    subsection: 'primary-images',
  },
  // Add more images here...

  // ============================================
  // GRAPHICS - Service Offered Images (graphic-service folder)
  // ============================================
  // Example:
  // { folder: 'Graphics/graphic-service', filename: 'service-1.jpg', category: 'graphics', subsection: 'service-images' },

  // ============================================
  // CLIENT LOGOS
  // ============================================
  {
    folder: 'Client_logos',
    filename: '10 (1).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '11 (1).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '12 (1).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '13 (1).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '14 (1).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '15 (1).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '16 (1).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '17 (1).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '18 (1).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '19.png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '2 (3).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '20.png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '3 (3).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '4 (2).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '5 (2).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '6 (2).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '7 (1).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '8 (1).png',
    category: 'client_logos',
    subsection: 'default',
  },
  {
    folder: 'Client_logos',
    filename: '9 (1).png',
    category: 'client_logos',
    subsection: 'default',
  },

  // ============================================
  // AI LAB - Primary Graphics
  // ============================================
  {
    folder: 'Ai-lab',
    filename:
      'krix.ai_10904_a_fashion_beautifull_girl_model_wearing_silver__94be5493-65a1-44c3-8cf5-d413e15f937a_1.png',
    category: 'ai_lab',
    subsection: 'primary_graphics',
  },
  {
    folder: 'Ai-lab',
    filename:
      'krix.ai_10904_a_white_balaclava_ski_mask_adorned_with_colorful__7771e62a-4a55-498d-9a20-2ca45c0e20f1.png',
    category: 'ai_lab',
    subsection: 'primary_graphics',
  },
  {
    folder: 'Ai-lab',
    filename:
      'krix.ai_10904_httpss.mj.runbafG49D2LWM_A_joyful_8-year-old_Kore_41e05f27-278f-4c95-9dd7-121f7b20ca47.png',
    category: 'ai_lab',
    subsection: 'primary_graphics',
  },
  {
    folder: 'Ai-lab',
    filename:
      'krix.ai_10904_httpss.mj.runBtNPhh_xojQ_A_humorous_and_hyper-det_c57c3605-7e6f-4727-9a00-67f97b3cb65b.png',
    category: 'ai_lab',
    subsection: 'primary_graphics',
  },
  {
    folder: 'Ai-lab',
    filename:
      'krix.ai_10904_httpss.mj.runKcgTybghK44_A_whimsical_illustration_965c2929-f739-4584-bfc2-fb98a50a1a61.png',
    category: 'ai_lab',
    subsection: 'primary_graphics',
  },
  {
    folder: 'Ai-lab',
    filename:
      'krix.ai_10904_httpss.mj.runpgBvQUzu8mA_women_brown_model_as_a_f_e32ef085-f308-4c9e-ad5b-ebb9a432a151.png',
    category: 'ai_lab',
    subsection: 'primary_graphics',
  },
  {
    folder: 'Ai-lab',
    filename:
      'krix.ai_10904_httpss.mj.runrvGw6wySRrc_fantasy_realistic_art_A__55b6db8a-108c-4632-b274-ae948d4ac418.png',
    category: 'ai_lab',
    subsection: 'primary_graphics',
  },
  {
    folder: 'Ai-lab',
    filename:
      'krix.ai_10904_lookbook_fashion_photography_of_a_woman_in_a_chic_31b13e94-9135-43da-b787-570ae7917743.png',
    category: 'ai_lab',
    subsection: 'primary_graphics',
  },
  {
    folder: 'Ai-lab',
    filename:
      'krix.ai_10904_tatting_lace_on_a_nordic_model_writting_in_a_book_bf62191a-5ef3-49b3-9910-86868af97049.png',
    category: 'ai_lab',
    subsection: 'primary_graphics',
  },
  {
    folder: 'Ai-lab',
    filename:
      'krix.ai_10904_two_red-haired_women_standing_in_a_pink_and_purpl_13212f0c-cdf3-4565-8747-65b91e132e0a.png',
    category: 'ai_lab',
    subsection: 'primary_graphics',
  },

  // ============================================
  // AFFILIATES - Promotional Content
  // ============================================
  {
    folder: 'Promotional Content',
    filename: '2 (2).png',
    category: 'affiliated',
    subsection: 'default',
  },
  {
    folder: 'Promotional Content',
    filename: '3 (2).png',
    category: 'affiliated',
    subsection: 'default',
  },
  {
    folder: 'Promotional Content',
    filename: '6 (1).png',
    category: 'affiliated',
    subsection: 'default',
  },
  {
    folder: 'Promotional Content',
    filename: '7.png',
    category: 'affiliated',
    subsection: 'default',
  },
  {
    folder: 'Promotional Content',
    filename: 'DSQR Linkedin Logo.png',
    category: 'affiliated',
    subsection: 'default',
  },
  {
    folder: 'Promotional Content',
    filename: 'imp (2).png',
    category: 'affiliated',
    subsection: 'default',
  },
  {
    folder: 'Promotional Content',
    filename: 'imp (3).png',
    category: 'affiliated',
    subsection: 'default',
  },
  {
    folder: 'Promotional Content',
    filename: 'imp (4).png',
    category: 'affiliated',
    subsection: 'default',
  },
  {
    folder: 'Promotional Content',
    filename: 'imp.png',
    category: 'affiliated',
    subsection: 'default',
  },
  {
    folder: 'Promotional Content',
    filename: 'Logo Final.png',
    category: 'affiliated',
    subsection: 'default',
  },
  {
    folder: 'Promotional Content',
    filename: 'LOGO-BLACK (1).png',
    category: 'affiliated',
    subsection: 'default',
  },
  {
    folder: 'Promotional Content',
    filename: 'LOGO-GLOW.png',
    category: 'affiliated',
    subsection: 'default',
  },

  // ============================================
  // TEAM PHOTOS
  // ============================================
  {
    folder: 'Team_photo',
    filename: '10.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '11.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '12.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '13.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '14.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '15.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '18.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '19.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '20.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '21.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '22.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '23.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '24.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '25.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '26.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '27.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '28.webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '3 (2).webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '4 (1).webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '5 (1).webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '6 (4).webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '7 (1).webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '8 (5).webp',
    category: 'team_photos',
    subsection: 'default',
  },
  {
    folder: 'Team_photo',
    filename: '9.webp',
    category: 'team_photos',
    subsection: 'default',
  },

  // ============================================
  // HOME PAGE - Hero Section (Primary Images)
  // ============================================
  {
    folder: 'Home-page/hero-section',
    filename: '1.png',
    category: 'home-page',
    subsection: 'hero-section',
  },
  {
    folder: 'Home-page/hero-section',
    filename: '3.png',
    category: 'home-page',
    subsection: 'hero-section',
  },
  {
    folder: 'Home-page/hero-section',
    filename: '4.png',
    category: 'home-page',
    subsection: 'hero-section',
  },
  {
    folder: 'Home-page/hero-section',
    filename: '5.png',
    category: 'home-page',
    subsection: 'hero-section',
  },
  {
    folder: 'Home-page/hero-section',
    filename: '6.png',
    category: 'home-page',
    subsection: 'hero-section',
  },
  {
    folder: 'Home-page/hero-section',
    filename: '7.png',
    category: 'home-page',
    subsection: 'hero-section',
  },
  {
    folder: 'Home-page/hero-section',
    filename: 'e4da6fd9ce2746a0b0e15f9de9169dab1a795993.png',
    category: 'home-page',
    subsection: 'hero-section',
  },

  // ============================================
  // HOME PAGE - 123 Steps Animation Graphics
  // ============================================
  {
    folder: 'Home-page/123',
    filename: '061780c5664329f83d61fadcb765573947ebc977.png',
    category: 'home-page',
    subsection: '123',
  },
  {
    folder: 'Home-page/123',
    filename: '2ee7eff48c6e6734d335428432f4a0965a50894e.png',
    category: 'home-page',
    subsection: '123',
  },
  {
    folder: 'Home-page/123',
    filename: '5e8c962a01ee616271366e1acdba49859744fb21.png',
    category: 'home-page',
    subsection: '123',
  },
  {
    folder: 'Home-page/123',
    filename: '64061c7faea6a130e4ec88d8a356e950e99bacf4.png',
    category: 'home-page',
    subsection: '123',
  },
  {
    folder: 'Home-page/123',
    filename: '7c056c3328239e4c7d0cab746b62529a510e991f.png',
    category: 'home-page',
    subsection: '123',
  },
  {
    folder: 'Home-page/123',
    filename: 'aab63ab841a54061f2856c3e930de006656fe5d3.png',
    category: 'home-page',
    subsection: '123',
  },
  {
    folder: 'Home-page/123',
    filename: 'ac97621c8c5708204e4ae9633df1bf198ce82b8a.png',
    category: 'home-page',
    subsection: '123',
  },

  // ============================================
  // HOME PAGE - Gallery Section (Image Gallery)
  // ============================================
  {
    folder: 'Home-page/gallery-section',
    filename: '10.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: '11.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: '12.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: '13.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: '14.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: '2.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: '3.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: '4.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: '5.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: '6.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: '7.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: '8.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: '9.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },
  {
    folder: 'Home-page/gallery-section',
    filename: 'Main-Middle Image.png',
    category: 'home-page',
    subsection: 'gallery-section',
  },

  // ADD YOUR EXISTING IMAGES BELOW THIS LINE
  // ============================================
  // EXTRAS - About Us (Extra Graphics)
  {
    folder: "Extra's",
    filename: 'TV Web Final-PS Good Size.png',
    category: 'extras',
    subsection: 'about_us',
    title: 'Mission Vision Graphic',
  },
  {
    folder: "Extra's",
    filename: 'painting.jpg',
    category: 'extras',
    subsection: 'about_us',
    title: 'Creativity Graphic',
  },
  // EXTRAS - Affiliate
  {
    folder: "Extra's",
    filename: 'ref.jpg',
    category: 'extras',
    subsection: 'affiliate',
    title: 'Affiliate Graphic',
  },
]

async function syncImages() {
  try {
    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(process.env.MONGO_URI)
    console.log('✅ Connected to MongoDB\n')

    if (EXISTING_IMAGES.length === 0) {
      console.log('⚠️  No images defined in EXISTING_IMAGES array.')
      console.log(
        '📝 Please edit this file and add your existing Bunny images.\n'
      )
      console.log('Example format:')
      console.log(
        '  { folder: "Graphics/graphic-header", filename: "my-image.jpg", category: "graphics", subsection: "primary-images" },\n'
      )
      await mongoose.disconnect()
      process.exit(0)
    }

    console.log(`📦 Found ${EXISTING_IMAGES.length} images to sync\n`)

    let created = 0
    let skipped = 0
    let errors = 0

    for (const [index, img] of EXISTING_IMAGES.entries()) {
      const cdnUrl = `${BUNNY_CDN_BASE}/${img.folder}/${img.filename}`

      // Check if already exists
      const existing = await MediaItem.findOne({ src: cdnUrl })
      if (existing) {
        console.log(
          `⏭️  [${index + 1}/${
            EXISTING_IMAGES.length
          }] Skipped (already exists): ${img.filename}`
        )
        skipped++
        continue
      }

      // Determine file type
      const ext = img.filename.split('.').pop().toLowerCase()
      const isVideo = ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)
      const type = isVideo ? 'video' : 'image'

      try {
        const mediaItem = new MediaItem({
          type,
          src: cdnUrl,
          category: img.category,
          subsection: img.subsection || 'default',
          section: img.section || '',
          order: index,
          active: true,
          poster: img.poster || '',
          title: img.title || '',
        })

        await mediaItem.save()
        console.log(
          `✅ [${index + 1}/${EXISTING_IMAGES.length}] Created: ${img.filename}`
        )
        created++
      } catch (error) {
        console.error(
          `❌ [${index + 1}/${EXISTING_IMAGES.length}] Error creating ${
            img.filename
          }:`,
          error.message
        )
        errors++
      }
    }

    console.log('\n' + '='.repeat(50))
    console.log('📊 SYNC SUMMARY')
    console.log('='.repeat(50))
    console.log(`✅ Created: ${created}`)
    console.log(`⏭️  Skipped: ${skipped}`)
    console.log(`❌ Errors: ${errors}`)
    console.log(`📦 Total processed: ${EXISTING_IMAGES.length}`)
    console.log('='.repeat(50) + '\n')

    await mongoose.disconnect()
    console.log('👋 Disconnected from MongoDB')
    process.exit(0)
  } catch (error) {
    console.error('❌ Fatal error:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

// Run the script
syncImages()
