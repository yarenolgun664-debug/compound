#!/usr/bin/env node

/**
 * Ads System Injector
 * 
 * Recursively scans all HTML files and injects ads.js script tag
 * before </body> tag. Idempotent: runs multiple times safely.
 * 
 * Usage: node scripts/inject-ads.js [root_directory]
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

const SCRIPT_TAG = `
<!-- Ads System (Dormant - Activate in 6 months) -->
<script src="/assets/js/ads.js" defer></script>
</body>`;

const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'scripts',
  'assets',
  'dist',
  'build',
  '.cache',
  'vendor',
  '.ad-backup',
  '.kiro',
  '.mavis',
  '.opencode',
  '.vscode',
  'tests'
];

const VALID_EXTENSIONS = ['.html', '.htm'];

// ═══════════════════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════════════════

let stats = {
  scanned: 0,
  modified: 0,
  skippedAlreadyHas: 0,
  skippedExcluded: 0,
  modifiedFiles: []
};

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Check if path should be excluded
 */
function isExcluded(filePath) {
  const normalized = path.normalize(filePath).split(path.sep);
  
  for (const dir of EXCLUDED_DIRS) {
    if (normalized.includes(dir)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if file has valid extension
 */
function hasValidExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return VALID_EXTENSIONS.includes(ext);
}

/**
 * Recursively get all HTML files
 */
function getAllHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    
    // Skip if excluded
    if (isExcluded(filePath)) {
      stats.skippedExcluded++;
      return;
    }

    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllHtmlFiles(filePath, fileList);
    } else if (hasValidExtension(filePath)) {
      fileList.push(filePath);
      stats.scanned++;
    }
  });

  return fileList;
}

/**
 * Check if file already has ads.js
 */
function hasAdsScript(content) {
  return content.includes('ads.js');
}

/**
 * Inject script tag before </body>
 */
function injectScript(content) {
  // Find </body> tag (case insensitive)
  const bodyCloseRegex = /<\/body>/i;
  
  if (!bodyCloseRegex.test(content)) {
    console.warn('  ⚠️  No </body> tag found, skipping');
    return null;
  }

  // Replace </body> with script tag + </body>
  return content.replace(bodyCloseRegex, SCRIPT_TAG);
}

/**
 * Process single file
 */
function processFile(filePath) {
  try {
    // Read file (preserve encoding)
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');

    // Check if already has ads.js
    if (hasAdsScript(content)) {
      stats.skippedAlreadyHas++;
      return;
    }

    // Inject script
    const modifiedContent = injectScript(content);
    
    if (!modifiedContent) {
      return;
    }

    // Write back (preserve encoding and line endings)
    fs.writeFileSync(filePath, modifiedContent, 'utf8');

    stats.modified++;
    stats.modifiedFiles.push(filePath);

  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════

function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🚀 Ads System Injection Started');
  console.log('═══════════════════════════════════════════════════════\n');

  // Get root directory from args or use current
  const rootDir = process.argv[2] || '.';
  const absolutePath = path.resolve(rootDir);

  console.log(`📂 Root directory: ${absolutePath}\n`);
  console.log('🔍 Scanning for HTML files...\n');

  // Get all HTML files
  const htmlFiles = getAllHtmlFiles(absolutePath);

  console.log(`Found ${htmlFiles.length} HTML files\n`);
  console.log('💉 Injecting ads.js script tag...\n');

  // Process each file
  htmlFiles.forEach(file => {
    const relativePath = path.relative(absolutePath, file);
    process.stdout.write(`  Processing: ${relativePath}...`);
    
    processFile(file);
    
    if (stats.modifiedFiles.includes(file)) {
      console.log(' ✅ Modified');
    } else {
      console.log(' ⏭️  Skipped');
    }
  });

  // Print report
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('✅ Injection Completed');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`Scanned files         : ${stats.scanned}`);
  console.log(`Modified              : ${stats.modified}`);
  console.log(`Skipped (already has) : ${stats.skippedAlreadyHas}`);
  console.log(`Skipped (excluded)    : ${stats.skippedExcluded}`);
  console.log('───────────────────────────────────────────────────────');

  if (stats.modified > 0) {
    console.log('\n📝 Modified files:');
    stats.modifiedFiles.forEach(file => {
      const relativePath = path.relative(absolutePath, file);
      console.log(`  • ${relativePath}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════\n');
}

// Run
main();
