/**
 * Script to update CSP headers to allow polyfill.io
 * Task 23.1: Add conditional polyfill loading for ES6+
 */

const fs = require('fs');
const path = require('path');

// Old CSP pattern
const OLD_CSP = `script-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'`;

// New CSP pattern (adds polyfill.io)
const NEW_CSP = `script-src 'self' https://cdnjs.cloudflare.com https://polyfill.io 'unsafe-inline'`;

function findHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (['node_modules', '.ad-backup', '.kiro', '.opencode', '.mavis', '.vscode'].includes(file)) {
        return;
      }
      findHtmlFiles(filePath, fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function updateCspInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file has CSP
    const cspMatch = content.match(/<meta[^>]*Content-Security-Policy[^>]*>/i);
    if (!cspMatch) {
      return false;
    }
    
    const cspTag = cspMatch[0];
    
    // Check if polyfill.io is already in the CSP tag
    if (cspTag.includes('https://polyfill.io')) {
      console.log(`⏭️  Skipping ${filePath} - polyfill.io already in CSP`);
      return false;
    }
    
    // Update CSP
    content = content.replace(OLD_CSP, NEW_CSP);
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated CSP in ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🚀 Updating CSP headers to allow polyfill.io...\n');
  
  const htmlFiles = findHtmlFiles('.');
  console.log(`Found ${htmlFiles.length} HTML files to process\n`);
  
  let successCount = 0;
  let skippedCount = 0;
  
  htmlFiles.forEach(file => {
    const result = updateCspInFile(file);
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
  console.log('\n✨ CSP update complete!');
}

if (require.main === module) {
  main();
}

module.exports = { updateCspInFile };
