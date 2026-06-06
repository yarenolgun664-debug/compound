#!/usr/bin/env node

/**
 * Comprehensive Ad Slots Cleanup Script
 * 
 * Removes ALL old .ad-slot divs from HTML files (excluding backup directories).
 * The new ads.js system injects slots dynamically at runtime.
 */

const fs = require('fs');
const path = require('path');

// Directories to exclude
const EXCLUDE_DIRS = [
  '.ad-backup',
  '.git',
  '.kiro',
  '.mavis',
  'node_modules',
  'scripts',
  'assets'
];

let stats = {
  scanned: 0,
  processed: 0,
  modified: 0,
  slotsRemoved: 0,
  modifiedFiles: []
};

/**
 * Check if path should be excluded
 */
function shouldExclude(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return EXCLUDE_DIRS.some(dir => normalizedPath.includes(`/${dir}/`) || normalizedPath.includes(`\\${dir}\\`));
}

/**
 * Remove ad-slot divs from content
 */
function removeAdSlots(content) {
  let modified = false;
  let removeCount = 0;

  // Pattern 1: <div class="ad-slot" ...>...</div> (with any attributes)
  const pattern1 = /<div[^>]*class="[^"]*ad-slot[^"]*"[^>]*>[\s\S]*?<\/div>/gi;
  
  // Pattern 2: <!-- Ad slot comments -->
  const pattern2 = /<!--[\s]*[Aa]d[\s]+[Ss]lot[\s]*:?[^>]*-->[\s]*/gi;
  
  // Pattern 3: data-ad-position attributes (standalone divs)
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
    
    // Clean up excessive whitespace (but preserve intentional spacing)
    content = content.replace(/\n\n\n+/g, '\n\n');
    content = content.replace(/^\s+$/gm, ''); // Remove whitespace-only lines
  }

  return { content, modified, removeCount };
}

/**
 * Recursively find all HTML files
 */
function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    
    // Skip excluded directories
    if (shouldExclude(filePath)) {
      return;
    }

    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Process single file
 */
function processFile(filePath) {
  try {
    stats.scanned++;

    // Read file
    const buffer = fs.readFileSync(filePath);
    const originalContent = buffer.toString('utf8');

    // Remove ad slots
    const { content, modified, removeCount } = removeAdSlots(originalContent);

    if (modified) {
      // Write back
      fs.writeFileSync(filePath, content, 'utf8');
      
      stats.modified++;
      stats.slotsRemoved += removeCount;
      
      const relativePath = path.relative(process.cwd(), filePath);
      stats.modifiedFiles.push(relativePath);
      
      console.log(`  ✅ ${relativePath} - Removed ${removeCount} slot(s)`);
    } else {
      stats.processed++;
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
  console.log('🧹 Comprehensive Ad Slots Cleanup');
  console.log('═══════════════════════════════════════════════════════\n');

  // Find all HTML files
  console.log('📂 Scanning for HTML files...\n');
  const htmlFiles = findHtmlFiles(process.cwd());
  
  console.log(`Found ${htmlFiles.length} HTML files (excluding backups)\n`);
  console.log('Processing files...\n');

  // Process each file
  htmlFiles.forEach(file => {
    processFile(file);
  });

  // Print report
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ Cleanup Completed');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`Files scanned         : ${stats.scanned}`);
  console.log(`Files cleaned         : ${stats.modified}`);
  console.log(`Files unchanged       : ${stats.processed}`);
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
