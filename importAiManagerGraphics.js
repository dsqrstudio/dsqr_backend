//]}]]]]]] Script to bulk import AI Manager primary graphics into MediaItem collection
// Usage: node importAiManagerGraphics.js

import mongoose from 'mongoose'
import MediaItem from './src/models/MediaItem.js'
import dotenv from 'dotenv'

dotenv.config()

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db-name'

const imageUrls = [
  'https://dsqrstudio.b-cdn.net/Ai-lab/1769691074138-f890138c883a-7c056c3328239e4c7d0cab746b62529a510e991f.png',
  'https://dsqrstudio.b-cdn.net/Ai-lab/krix.ai_10904_a_fashion_beautifull_girl_model_wearing_silver__94be5493-65a1-44c3-8cf5-d413e15f937a_1.png',
  'https://dsqrstudio.b-cdn.net/Ai-lab/krix.ai_10904_a_white_balaclava_ski_mask_adorned_with_colorful__7771e62a-4a55-498d-9a20-2ca45c0e20f1.png',
  'https://dsqrstudio.b-cdn.net/Ai-lab/krix.ai_10904_httpss.mj.runbafG49D2LWM_A_joyful_8-year-old_Kore_41e05f27-278f-4c95-9dd7-121f7b20ca47.png',
  'https://dsqrstudio.b-cdn.net/Ai-lab/krix.ai_10904_httpss.mj.runBtNPhh_xojQ_A_humorous_and_hyper-det_c57c3605-7e6f-4727-9a00-67f97b3cb65b.png',
  'https://dsqrstudio.b-cdn.net/Ai-lab/krix.ai_10904_httpss.mj.runKcgTybghK44_A_whimsical_illustration_965c2929-f739-4584-bfc2-fb98a50a1a61.png',
  'https://dsqrstudio.b-cdn.net/Ai-lab/krix.ai_10904_httpss.mj.runpgBvQUzu8mA_women_brown_model_as_a_f_e32ef085-f308-4c9e-ad5b-ebb9a432a151.png',
  'https://dsqrstudio.b-cdn.net/Ai-lab/krix.ai_10904_httpss.mj.runrvGw6wySRrc_fantasy_realistic_art_A__55b6db8a-108c-4632-b274-ae948d4ac418.png',
  'https://dsqrstudio.b-cdn.net/Ai-lab/krix.ai_10904_lookbook_fashion_photography_of_a_woman_in_a_chic_31b13e94-9135-43da-b787-570ae7917743.png',
  'https://dsqrstudio.b-cdn.net/Ai-lab/krix.ai_10904_tatting_lace_on_a_nordic_model_writting_in_a_book_bf62191a-5ef3-49b3-9910-86868af97049.png',
  'https://dsqrstudio.b-cdn.net/Ai-lab/krix.ai_10904_two_red-haired_women_standing_in_a_pink_and_purpl_13212f0c-cdf3-4565-8747-65b91e132e0a.png',
]

async function main() {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  const docs = imageUrls.map((url, idx) => ({
    type: 'image',
    src: url,
    category: 'primary_graphics',
    section: 'AI Lab',
    subsection: 'AI Manager',
    order: idx,
    active: true,
  }))

  await MediaItem.insertMany(docs)
  console.log('Imported AI Manager primary graphics!')
  await mongoose.disconnect()
}

main().catch((e) => {
  console.error(e)
  mongoose.disconnect()
})
