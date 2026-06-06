const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all HTML files
const htmlFiles = glob.sync('**/*.html', {
  cwd: path.join(__dirname, '..'),
  ignore: ['node_modules/**', '.ad-backup/**']
});

const inconsistencies = [];

htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract Open Graph tags
  const ogTitle = content.match(/<meta\s+property="og:title"\s+content="([^"]*)"/)?.[1];
  const ogDescription = content.match(/<meta\s+property="og:description"\s+content="([^"]*)"/)?.[1];
  const ogImage = content.match(/<meta\s+property="og:image"\s+content="([^"]*)"/)?.[1];
  
  // Extract Twitter Card tags
  const twitterTitle = content.match(/<meta\s+name="twitter:title"\s+content="([^"]*)"/)?.[1];
  const twitterDescription = content.match(/<meta\s+name="twitter:description"\s+content="([^"]*)"/)?.[1];
  const twitterImage = content.match(/<meta\s+name="twitter:image"\s+content="([^"]*)"/)?.[1];
  
  const issues = [];
  
  // Check for inconsistencies
  if (ogTitle && twitterTitle && ogTitle !== twitterTitle) {
    issues.push(`Title mismatch:\n  OG: "${ogTitle}"\n  Twitter: "${twitterTitle}"`);
  }
  
  if (ogDescription && twitterDescription && ogDescription !== twitterDescription) {
    issues.push(`Description mismatch:\n  OG: "${ogDescription}"\n  Twitter: "${twitterDescription}"`);
  }
  
  if (ogImage && twitterImage && ogImage !== twitterImage) {
    issues.push(`Image mismatch:\n  OG: "${ogImage}"\n  Twitter: "${twitterImage}"`);
  }
  
  // Check for missing tags
  if (ogTitle && !twitterTitle) {
    issues.push('Missing twitter:title');
  }
  if (ogDescription && !twitterDescription) {
    issues.push('Missing twitter:description');
  }
  if (ogImage && !twitterImage) {
    issues.push('Missing twitter:image');
  }
  
  if (issues.length > 0) {
    inconsistencies.push({
      file,
      issues
    });
  }
});

// Output results
console.log('='.repeat(80));
console.log('Open Graph vs Twitter Card Consistency Check');
console.log('='.repeat(80));
console.log();

if (inconsistencies.length === 0) {
  console.log('✅ All pages have consistent OG and Twitter Card meta tags!');
} else {
  console.log(`❌ Found ${inconsistencies.length} page(s) with inconsistencies:\n`);
  
  inconsistencies.forEach(({ file, issues }) => {
    console.log(`📄 ${file}`);
    issues.forEach(issue => {
      console.log(`   ${issue}`);
    });
    console.log();
  });
}

// Write to JSON for programmatic access
fs.writeFileSync(
  path.join(__dirname, 'meta-inconsistencies.json'),
  JSON.stringify(inconsistencies, null, 2)
);

console.log(`Results saved to: scripts/meta-inconsistencies.json`);
process.exit(inconsistencies.length > 0 ? 1 : 0);
