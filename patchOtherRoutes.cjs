const fs = require('fs');
const path = require('path');

const affiliatesPath = path.join(__dirname, 'src/routes/affiliates.js');
const bapPath = path.join(__dirname, 'src/routes/beforeAfterPairs.js');
const pricingPath = path.join(__dirname, 'src/routes/pricing.js');

// 1. Patch affiliates.js
if (fs.existsSync(affiliatesPath)) {
  let content = fs.readFileSync(affiliatesPath, 'utf8');
  if (!content.includes('async function invalidateAffiliatesCache()')) {
    content = content.replace(
      "import redisClient from '../config/redis.js'",
      `import redisClient from '../config/redis.js';

async function invalidateAffiliatesCache() {
  if (redisClient.isOpen) {
    try {
      await redisClient.del('affiliates:all');
      console.log('[REDIS] Invalidated affiliates:all');
    } catch (err) {
      console.error('[REDIS] Error invalidating affiliates cache:', err);
    }
  }
}`
    );
  }
  // Inject into POST /bulk
  content = content.replace(
    /res\.json\(\{ ok: true, items: formattedResult \}\)/,
    "await invalidateAffiliatesCache();\n    res.json({ ok: true, items: formattedResult })"
  );
  // Inject into DELETE /:id
  content = content.replace(
    /res\.json\(\{ ok: true \}\)/,
    "await invalidateAffiliatesCache();\n    res.json({ ok: true })"
  );
  // Inject into PUT /:id
  content = content.replace(
    /res\.json\(\{ ok: true, item: formattedUpdated \}\)/,
    "await invalidateAffiliatesCache();\n    res.json({ ok: true, item: formattedUpdated })"
  );
  fs.writeFileSync(affiliatesPath, content, 'utf8');
}

// 2. Patch beforeAfterPairs.js
if (fs.existsSync(bapPath)) {
  let content = fs.readFileSync(bapPath, 'utf8');
  if (!content.includes('async function invalidateBapCache()')) {
    content = content.replace(
      "import redisClient from '../config/redis.js'",
      `import redisClient from '../config/redis.js';

async function invalidateBapCache() {
  if (redisClient.isOpen) {
    try {
      await redisClient.del('beforeAfterPairs:all');
      console.log('[REDIS] Invalidated beforeAfterPairs:all');
    } catch (err) {
      console.error('[REDIS] Error invalidating beforeAfterPairs cache:', err);
    }
  }
}`
    );
  }
  // Remove naked calls and inject correctly
  content = content.replace(/redisClient\.del\('beforeAfterPairs:all'\)/g, 'await invalidateBapCache()');
  fs.writeFileSync(bapPath, content, 'utf8');
}

// 3. Patch pricing.js
if (fs.existsSync(pricingPath)) {
  let content = fs.readFileSync(pricingPath, 'utf8');
  if (!content.includes('async function invalidatePricingCache()')) {
    content = content.replace(
      "import redisClient from '../config/redis.js'",
      `import redisClient from '../config/redis.js';

async function invalidatePricingCache() {
  if (redisClient.isOpen) {
    try {
      await redisClient.del('pricing:all');
      console.log('[REDIS] Invalidated pricing:all');
    } catch (err) {
      console.error('[REDIS] Error invalidating pricing cache:', err);
    }
  }
}`
    );
  }
  content = content.replace(/redisClient\.del\('pricing:all'\)/g, 'await invalidatePricingCache()');
  // POST / bulk updates both uses generic logic.
  // PUT /:category requires missing cache flush.
  if(!content.includes("await invalidatePricingCache();\n      res.json({")) {
    content = content.replace(
      /res\.json\(\{\s*success: true,\s*message: 'Category pricing updated successfully',\s*\}\)/g,
      "await invalidatePricingCache();\n      res.json({\n        success: true,\n        message: 'Category pricing updated successfully',\n      })"
    );
  }
  fs.writeFileSync(pricingPath, content, 'utf8');
}

console.log('Successfully patched all routes!');
