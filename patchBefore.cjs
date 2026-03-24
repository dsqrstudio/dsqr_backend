const fs = require('fs');

try {
  let content = fs.readFileSync('src/routes/mediaItems.js', 'utf8');

  // We are searching for the block where the After video is uploaded and updated.
  // It looks like:
  /*
          if (!updated) {
            return res
              .status(404)
              .json({ success: false, error: 'Before video not found' })
          }
          return res.json({
  */

  const targetParts = content.split("error: 'Before video not found' })");
  if (targetParts.length > 1) {
    const afterPart = targetParts[1];
    if (afterPart.includes('          return res.json({')) {
      // Split on the exact return json line and insert the cache invalidation
      const injection = `
          }
          if (category) {
            await invalidateMediaItemsCache(\`mediaItems:\${category}*\`);
          }
          return res.json({`;

      // Wait, we need to be careful with string replacement.
      content = content.replace(
        "          }\n          return res.json({",
        injection
      );
      
      fs.writeFileSync('src/routes/mediaItems.js', content, 'utf8');
      console.log('Successfully patched beforeId cache invalidation!');
    } else {
      console.log('Could not find the exact return block.');
    }
  } else {
    console.log('Target block not found in mediaItems.js!');
  }
} catch (err) {
  console.error(err);
}
