#!/usr/bin/env node

/**
 * Old Ad Slots Cleanup Script
 * 
 * Removes old .ad-slot divs from HTML files.
 * The new ads.js system injects slots dynamically at runtime.
 */

const fs = require('fs');
const path = require('path');

// Files to clean (specific list)
const FILES_TO_CLEAN = [
  'test-csp-functionality.html',
  'test-io-fallback.html',
  'test-polyfill-loading.html',
  'test-quota-fallback.html',
  'test-xss-sanitization.html',
  'tools/blog-editor.html',
  'tools/reklam-yoneticisi.html',
  'blog/category/fire.html',
  'blog/category/investing-basics.html',
  'blog/category/retirement.html'
];

let stats = {
  processed: 0,
  modified: 0,
  slotsRemoved: 0,
  modifiedFiles: []
};

/**
 * Remove ad-slot divs from content
 */
function removeAdSlots(content) {
  let modified = false;
  let removeCount = 0;

  // Pattern 1: <div class="ad-slot" ...>...</div>
  const pattern1 = /<div[^>]*class="[^"]*ad-slot[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
  
  // Pattern 2: <!-- Ad slots comments -->
  const pattern2 = /<!--[\s]*Ad[\s]+[Ss]lot[\s]*-->[\s\S]*?(?=<!--[\s]*\/[\s]*Ad[\s]+[Ss]lot[\s]*-->|$)/gi;
  
  // Pattern 3: data-ad-position attributes
  const pattern3 = /<div[^>]*data-ad-position="[^"]*"[^>]*>[\s\S]*?<\/div>/gi;

  // Count matches before removal
  const matches1 = content.match(pattern1) || [];
  const matches2 = content.match(pattern2) || [];
  const matches3 = content.match(pattern3) || [];
  
  removeCount = matches1.length + matches2.length + matches3.length;

  if (removeCount > 0) {
    modified = true;
    
    // Remove all patterns
    content = content.replace(pattern1, '');
    content = content.replace(pattern2, '');
    content = content.replace(pattern3, '');
    
    // Clean up excessive whitespace
    content = content.replace(/\n\n\n+/g, '\n\n');
  }

  return { content, modified, removeCount };
}

/**
 * Process single file
 */
function processFile(filePath) {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    console.log(`  ⚠️  File not found: ${filePath}`);
    return;
  }

  try {
    stats.processed++;

    // Read file
    const buffer = fs.readFileSync(absolutePath);
    const originalContent = buffer.toString('utf8');

    // Remove ad slots
    const { content, modified, removeCount } = removeAdSlots(originalContent);

    if (modified) {
      // Write back
      fs.writeFileSync(absolutePath, content, 'utf8');
      
      stats.modified++;
      stats.slotsRemoved += removeCount;
      stats.modifiedFiles.push(filePath);
      
      console.log(`  ✅ ${filePath} - Removed ${removeCount} ad slot(s)`);
    } else {
      console.log(`  ⏭️  ${filePath} - No ad slots found`);
    }

  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
  }
}

/**
 * Main execution
 */
function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧹 Old Ad Slots Cleanup Started');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log(`📂 Processing ${FILES_TO_CLEAN.length} files...\n`);

  // Process each file
  FILES_TO_CLEAN.forEach(file => {
    processFile(file);
  });

  // Print report
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ Cleanup Completed');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`Processed files       : ${stats.processed}`);
  console.log(`Modified              : ${stats.modified}`);
  console.log(`Total slots removed   : ${stats.slotsRemoved}`);
  console.log('───────────────────────────────────────────────────────');

  if (stats.modified > 0) {
    console.log('\n📝 Modified files:');
    stats.modifiedFiles.forEach(file => {
      console.log(`  • ${file}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
}

// Run
main();
