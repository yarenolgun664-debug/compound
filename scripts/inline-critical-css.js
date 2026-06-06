#!/usr/bin/env node

/**
 * Inline Critical CSS Script
 * 
 * This script extracts critical CSS (navbar, hero, layout) and inlines it
 * in the <head> section of HTML files, then loads non-critical CSS with
 * media="print" onload="this.media='all'" for better FCP performance.
 */

const fs = require('fs');
const path = require('path');

// Critical CSS selectors to extract
const CRITICAL_SELECTORS = [
  // Reset and base styles
  ':root',
  '*, *::before, *::after',
  'html',
  'body',
  
  // Layout containers
  '.container',
  '.grid-2',
  '.grid-3',
  '.grid-4',
  
  // Navbar
  '.navbar',
  '.navbar-container',
  '.navbar-logo',
  '.navbar-link',
  '.navbar-links',
  '.navbar-actions',
  '.navbar-menu-toggle',
  
  // Hero section
  '.hero',
  '.hero-content',
  '.hero-title',
  '.hero-bg-orbs',
  '.hero-orb',
  '.title-highlight',
  
  // Progress bar
  '.progress-bar',
  
  // Essential utilities
  '.animate-slide-up',
  '.animate-fade-in',
  '.badge',
  '.btn',
  '.btn-primary',
  '.btn-ghost',
  '.btn-lg',
  
  // Glass effects (critical for hero)
  '.mirror-glass',
  '.card-glass',
  '.trust-strip',
  
  // Grain overlay
  '.grain-overlay',
];

/**
 * Read CSS file and extract rules matching critical selectors
 */
function extractCriticalCSS(cssFilePath) {
  const css = fs.readFileSync(cssFilePath, 'utf-8');
  const criticalRules = [];
  
  // Extract :root variables (always critical)
  const rootMatch = css.match(/:root\s*\{[^}]+\}/gs);
  if (rootMatch) {
    criticalRules.push(rootMatch[0]);
  }
  
  // Extract font imports
  const fontImports = css.match(/@import[^;]+;/g);
  if (fontImports) {
    criticalRules.push(...fontImports);
  }
  
  // Extract critical selector rules
  CRITICAL_SELECTORS.forEach(selector => {
    // Escape special regex characters
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSelector}[^{]*\\{[^}]*\\})`, 'g');
    const matches = css.match(regex);
    if (matches) {
      criticalRules.push(...matches);
    }
  });
  
  // Extract keyframes animations used in critical components
  const keyframesRegex = /@keyframes\s+(drawPath|trustPulse|searchPulse)[^}]*\{[^}]*\}/gs;
  const keyframesMatches = css.match(keyframesRegex);
  if (keyframesMatches) {
    criticalRules.push(...keyframesMatches);
  }
  
  return criticalRules.join('\n\n');
}

/**
 * Inline critical CSS in an HTML file
 */
function inlineCriticalCSSInFile(htmlFilePath) {
  console.log(`Processing: ${htmlFilePath}`);
  
  let html = fs.readFileSync(htmlFilePath, 'utf-8');
  
  // Check if already processed
  if (html.includes('<!-- CRITICAL CSS INLINED -->')) {
    console.log(`  ✓ Already processed, skipping...`);
    return;
  }
  
  // Extract critical CSS from design-system.css and components.css
  const projectRoot = path.resolve(__dirname, '..');
  const designSystemCSS = path.join(projectRoot, 'assets', 'css', 'design-system.css');
  const componentsCSS = path.join(projectRoot, 'assets', 'css', 'components.css');
  
  let criticalCSS = '';
  
  if (fs.existsSync(designSystemCSS)) {
    criticalCSS += extractCriticalCSS(designSystemCSS);
  }
  
  if (fs.existsSync(componentsCSS)) {
    criticalCSS += '\n\n' + extractCriticalCSS(componentsCSS);
  }
  
  // Minify critical CSS (basic minification)
  criticalCSS = criticalCSS
    .replace(/\/\*[^*]*\*+([^/*][^*]*\*+)*\//g, '') // Remove comments
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\s*([{}:;,])\s*/g, '$1') // Remove space around delimiters
    .trim();
  
  // Find existing stylesheet links
  const stylesheetRegex = /<link\s+rel="stylesheet"\s+href="([^"]+)"/g;
  const stylesheets = [...html.matchAll(stylesheetRegex)];
  
  // Update stylesheet links to use print media with onload
  stylesheets.forEach(match => {
    const [fullMatch, href] = match;
    
    // Skip print.css (already has media="print")
    if (href.includes('print.css')) {
      return;
    }
    
    // Replace with deferred loading
    const deferredLink = `<link rel="preload" href="${href}" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="${href}"></noscript>`;
    
    html = html.replace(fullMatch, deferredLink);
  });
  
  // Insert critical CSS before </head>
  const criticalCSSBlock = `
  <!-- CRITICAL CSS INLINED -->
  <style>
    ${criticalCSS}
  </style>`;
  
  html = html.replace('</head>', `${criticalCSSBlock}\n</head>`);
  
  // Write back to file
  fs.writeFileSync(htmlFilePath, html, 'utf-8');
  console.log(`  ✓ Inlined ${criticalCSS.length} bytes of critical CSS`);
}

/**
 * Main execution
 */
function main() {
  const projectRoot = path.resolve(__dirname, '..');
  
  // Get all HTML files (excluding .ad-backup)
  const htmlFiles = [];
  
  function findHTMLFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip .ad-backup directories
      if (entry.isDirectory() && entry.name === '.ad-backup') {
        continue;
      }
      
      if (entry.isDirectory()) {
        findHTMLFiles(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        // Skip component partials
        if (!fullPath.includes('assets\\components')) {
          htmlFiles.push(fullPath);
        }
      }
    }
  }
  
  findHTMLFiles(projectRoot);
  
  console.log(`Found ${htmlFiles.length} HTML files to process\n`);
  
  // Process each file
  htmlFiles.forEach(inlineCriticalCSSInFile);
  
  console.log(`\n✓ All files processed successfully!`);
}

// Run the script
if (require.main === module) {
  main();
}
