const fs = require('fs');
const path = './src/routes/mediaItems.js';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('async function invalidateMediaItemsCache(pattern)')) {
  // Fix imports
  content = content.replace(
    'const router = express.Router()\nconst upload = multer({ storage: multer.memoryStorage() })\nimport { requireAuth } from \'../middlewares/authMiddleware.js\'',
    `async function invalidateMediaItemsCache(pattern) {
  if (!pattern || !redisClient.isOpen) return
  try {
    const keys = await redisClient.keys(pattern)
    if (Array.isArray(keys) && keys.length > 0) {
      await redisClient.del(keys)
      console.log(\`[REDIS] Invalidated \${keys.length} cache keys matching \${pattern}\`)
    }
  } catch (err) {
    console.error('[REDIS] Error invalidating cache:', err)
  }
}

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })
import { requireAuth } from '../middlewares/authMiddleware.js'`
  );
}

// Replace the upload complex block
const uploadBlock = /redisClient\.keys\(pattern, \(err, keys\) => \{[\s\n]*if \(!err && Array\.isArray\(keys\) && keys\.length > 0\) \{[\s\n]*redisClient\.del\(keys, \(delErr, delCount\) => \{[\s\n]*if \(delErr\) \{[\s\n]*console\.error\('\[REDIS\] Delete error:', delErr\)[\s\n]*\} else \{[\s\n]*console\.log\(`\[REDIS\] Deleted \$\{delCount\} keys:`, keys\)[\s\n]*\}[\s\n]*\}\)[\s\n]*\}[\s\n]*\}\)/g;
content = content.replace(uploadBlock, 'await invalidateMediaItemsCache(pattern)');

// Replace the generic simple blocks
const simpleBlock = /redisClient\.keys\(pattern, \(err, keys\) => \{[\s\n]*if \(!err && Array\.isArray\(keys\) && keys\.length > 0\) \{[\s\n]*redisClient\.del\(keys\)[\s\n]*\}[\s\n]*\}\)/g;
content = content.replace(simpleBlock, 'await invalidateMediaItemsCache(pattern)');

// Add invalidation logic to `doc.save()` (specifically `createdDoc = await doc.save()`)
if (!content.includes('// CACHE_INVALIDATION_ADDED_SAVE_METADATA_DOC')) {
  content = content.replace(
    /const createdDoc = await doc\.save\(\)/g,
    `const createdDoc = await doc.save()
        // CACHE_INVALIDATION_ADDED_SAVE_METADATA_DOC
        if (category) {
          await invalidateMediaItemsCache(\`mediaItems:\${category}*\`)
        }`
  );
}

// Add invalidation logic to `updatedItem = await MediaItem.findByIdAndUpdate(...)` ? No wait, that already has it in the old blocks.
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully patched mediaItems.js!');
