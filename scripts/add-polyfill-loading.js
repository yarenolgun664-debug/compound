/**
 * Script to add conditional polyfill loading to all HTML files
 * Task 23.1: Add conditional polyfill loading for ES6+
 * 
 * This script adds polyfill.io with conditional loading to ensure:
 * - Old browsers (IE11, Safari < 12, Chrome < 60) get ES6+ polyfills
 * - Modern browsers don't load unnecessary polyfills (preservation requirement)
 */

const fs = require('fs');
const path = require('path');

// Polyfill script that uses User-Agent detection
// polyfill.io automatically detects which polyfills are needed
const POLYFILL_SCRIPT = `  <!-- ES6+ Polyfills (conditional loading for old browsers) -->
  <script crossorigin="anonymous" src="https://polyfill.io/v3/polyfill.min.js?features=es6%2Ces2015%2Ces2016%2Ces2017%2CArray.prototype.includes%2CObject.assign%2CPromise%2Cfetch"></script>
`;

// Pattern to find where to insert the polyfill (before layout-loader.js)
const LAYOUT_LOADER_PATTERN = /(\s*<!-- Layout Loader Component System -->\s*<script src="\/assets\/js\/layout-loader\.js" defer><\/script>)/;

function addPolyfillToFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if polyfill is already added
    if (content.includes('polyfill.io') || content.includes('ES6+ Polyfills')) {
      console.log(`⏭️  Skipping ${filePath} - polyfill already present`);
      return false;
    }
    
    // Check if file has layout-loader.js
    if (!LAYOUT_LOADER_PATTERN.test(content)) {
      console.log(`⚠️  Skipping ${filePath} - no layout-loader.js found`);
      return false;
    }
    
    // Insert polyfill before layout-loader.js
    content = content.replace(
      LAYOUT_LOADER_PATTERN,
      POLYFILL_SCRIPT + '\n$1'
    );
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Added polyfill to ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip certain directories
      if (['node_modules', '.ad-backup', '.kiro', '.opencode', '.mavis', '.vscode'].includes(file)) {
        return;
      }
      findHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html') && !file.startsWith('test-')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function main() {
  console.log('🚀 Starting polyfill addition to HTML files...\n');
  
  // Find all HTML files (excluding test files and backups)
  const htmlFiles = findHtmlFiles('.');
  
  console.log(`Found ${htmlFiles.length} HTML files to process\n`);
  
  let successCount = 0;
  let skippedCount = 0;
  
  htmlFiles.forEach(file => {
    const result = addPolyfillToFile(file);
    if (result) {
      successCount++;
    } else {
      skippedCount++;
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Successfully updated: ${successCount} files`);
  console.log(`⏭️  Skipped: ${skippedCount} files`);
  console.log('='.repeat(50));
  console.log('\n✨ Polyfill addition complete!');
  console.log('\nℹ️  The polyfill.io service will automatically:');
  console.log('   - Detect browser capabilities via User-Agent');
  console.log('   - Only load polyfills for browsers that need them');
  console.log('   - Return an empty response for modern browsers');
  console.log('   - Support ES6+, Array.includes, Object.assign, Promise, fetch');
}

if (require.main === module) {
  main();
}

module.exports = { addPolyfillToFile };
