/**
 * Bug Condition Exploration Test - Browser Compatibility Issues
 * 
 * **Validates: Requirements 1.20, 1.21, 1.22**
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code in old browsers
 * 
 * This test verifies browser compatibility measures for legacy browsers:
 * 1. ES6+ features without polyfills → JavaScript errors in old browsers
 * 2. Intersection Observer without fallback → scroll animations fail in old browsers
 * 3. CSS Grid without @supports fallback → layout breaks in old browsers
 * 
 * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS (proves compatibility issues exist)
 */

const fs = require('fs');
const path = require('path');

/**
 * Property 1: ES6+ Features Should Have Polyfills for Old Browsers
 * 
 * Bug Condition: ES6+ syntax used without polyfill loading
 * Expected Behavior: Polyfill.io or similar should load conditionally
 */
function testES6PolyfillPresence() {
  console.log('\n=== Testing Property 1: ES6+ Polyfill Presence ===');
  
  // Check HTML files for polyfill script
  const htmlFiles = [
    path.join(__dirname, '../../index.html'),
    path.join(__dirname, '../../calculator/compound-interest.html'),
    path.join(__dirname, '../../calculator/retirement.html')
  ];
  
  const polyfillPatterns = [
    /polyfill\.io/i,
    /core-js/i,
    /babel-polyfill/i
  ];
  
  const results = htmlFiles.map(filePath => {
    if (!fs.existsSync(filePath)) {
      return { file: filePath, exists: false, hasPolyfill: false };
    }
    
    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    const hasPolyfill = polyfillPatterns.some(pattern => pattern.test(htmlContent));
    
    return {
      file: path.basename(filePath),
      exists: true,
      hasPolyfill: hasPolyfill
    };
  });
  
  // Check JavaScript files for ES6+ features
  const jsFiles = [
    path.join(__dirname, 'core.js'),
    path.join(__dirname, 'calculators/compound-interest.js'),
    path.join(__dirname, 'calculators/retirement.js')
  ];
  
  const es6Features = {
    'Arrow Functions': /=>\s*{|=>\s*\(/,
    'const/let': /\b(const|let)\b/,
    'Template Literals': /`[^`]*\${/,
    'Spread Operator': /\.\.\./,
    'Destructuring': /\{[^}]*\}\s*=/,
    'Classes': /\bclass\s+\w+/,
    'Promises': /\bnew\s+Promise\b|\.then\(|\.catch\(/,
    'async/await': /\basync\s+function|\bawait\s+/
  };
  
  const es6Usage = {};
  
  jsFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      return;
    }
    
    const jsContent = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    Object.entries(es6Features).forEach(([featureName, pattern]) => {
      if (pattern.test(jsContent)) {
        if (!es6Usage[featureName]) {
          es6Usage[featureName] = [];
        }
        es6Usage[featureName].push(fileName);
      }
    });
  });
  
  const hasES6Features = Object.keys(es6Usage).length > 0;
  const allHavePolyfill = results.every(r => !r.exists || r.hasPolyfill);
  
  console.log('Polyfill check results:');
  results.forEach(r => {
    console.log(`  ${r.file}: ${r.hasPolyfill ? '✓ Polyfill found' : '✗ No polyfill'}`);
  });
  
  console.log('\nES6+ features detected in JavaScript:');
  if (hasES6Features) {
    Object.entries(es6Usage).forEach(([feature, files]) => {
      console.log(`  • ${feature}: used in ${files.join(', ')}`);
    });
  } else {
    console.log('  No ES6+ features detected');
  }
  
  // BUG CONDITION: ES6+ features used WITHOUT polyfill
  const testPassed = !hasES6Features || allHavePolyfill;
  
  if (!testPassed) {
    console.log('\n❌ COUNTEREXAMPLE FOUND: ES6+ features without polyfill');
    console.log('   Expected: Polyfill.io script or similar for old browser support');
    console.log('   Actual: ES6+ syntax used without conditional polyfill loading');
    console.log('   Risk: JavaScript errors in IE11, old Safari, old Chrome');
    console.log('\n   Example fix:');
    console.log('   <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>');
  } else {
    console.log('✓ Property holds: Polyfill present or no ES6+ features');
  }
  
  return { 
    passed: testPassed, 
    hasES6Features, 
    polyfillPresent: allHavePolyfill,
    es6Usage,
    filesChecked: results.length 
  };
}

/**
 * Property 2: Intersection Observer Should Have Fallback for Old Browsers
 * 
 * Bug Condition: IntersectionObserver used without feature detection/fallback
 * Expected Behavior: Feature detection with scroll listener fallback
 */
function testIntersectionObserverFallback() {
  console.log('\n=== Testing Property 2: Intersection Observer Fallback ===');
  
  // Check JavaScript files for Intersection Observer usage
  const jsFiles = [
    path.join(__dirname, 'core.js'),
    path.join(__dirname, 'scroll-reveal.js'),
    path.join(__dirname, 'animations.js')
  ];
  
  let usesIntersectionObserver = false;
  let hasFeatureDetection = false;
  let hasFallback = false;
  const usageFiles = [];
  
  jsFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      return;
    }
    
    const jsContent = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    // Check for IntersectionObserver usage
    if (/IntersectionObserver/.test(jsContent)) {
      usesIntersectionObserver = true;
      usageFiles.push(fileName);
      
      // Check for feature detection
      if (/['"]IntersectionObserver['"]\s+in\s+window|if\s*\(\s*window\.IntersectionObserver/.test(jsContent)) {
        hasFeatureDetection = true;
      }
      
      // Check for fallback implementation
      if (/scroll.*listener|addEventListener.*scroll/.test(jsContent) && hasFeatureDetection) {
        hasFallback = true;
      }
    }
  });
  
  console.log('Intersection Observer analysis:');
  console.log(`  Uses IntersectionObserver: ${usesIntersectionObserver ? 'Yes' : 'No'}`);
  if (usesIntersectionObserver) {
    console.log(`  Files: ${usageFiles.join(', ')}`);
    console.log(`  Has feature detection: ${hasFeatureDetection ? '✓ Yes' : '✗ No'}`);
    console.log(`  Has scroll fallback: ${hasFallback ? '✓ Yes' : '✗ No'}`);
  }
  
  // BUG CONDITION: Uses IO without fallback
  const testPassed = !usesIntersectionObserver || (hasFeatureDetection && hasFallback);
  
  if (!testPassed && usesIntersectionObserver) {
    console.log('\n❌ COUNTEREXAMPLE FOUND: IntersectionObserver without fallback');
    console.log('   Expected: Feature detection with scroll listener fallback');
    console.log('   Actual: IntersectionObserver used without fallback mechanism');
    console.log('   Risk: Scroll animations fail in IE11, old Safari, old Firefox');
    console.log('\n   Example fix:');
    console.log('   if ("IntersectionObserver" in window) {');
    console.log('     // Use IntersectionObserver');
    console.log('   } else {');
    console.log('     // Fallback to scroll event listener');
    console.log('   }');
  } else if (!usesIntersectionObserver) {
    console.log('\n⚠️  Note: IntersectionObserver not currently used');
    console.log('   This is acceptable (no compatibility issue)');
  } else {
    console.log('\n✓ Property holds: IntersectionObserver has fallback');
  }
  
  return { 
    passed: testPassed, 
    usesIntersectionObserver,
    hasFeatureDetection,
    hasFallback,
    usageFiles 
  };
}

/**
 * Property 3: CSS Grid Should Have @supports Fallback for Old Browsers
 * 
 * Bug Condition: CSS Grid used without @supports fallback
 * Expected Behavior: @supports (display: grid) with flexbox fallback
 */
function testCSSGridFallback() {
  console.log('\n=== Testing Property 3: CSS Grid @supports Fallback ===');
  
  // Check CSS files for Grid usage
  const cssFiles = [
    path.join(__dirname, '../css/design-system.css'),
    path.join(__dirname, '../css/components.css'),
    path.join(__dirname, '../css/calculator.css'),
    path.join(__dirname, '../css/blog.css')
  ];
  
  let usesGrid = false;
  let hasSupportsRule = false;
  let hasFallback = false;
  const gridUsageFiles = [];
  
  cssFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      return;
    }
    
    const cssContent = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    // Check for CSS Grid usage
    if (/display\s*:\s*grid/i.test(cssContent)) {
      usesGrid = true;
      gridUsageFiles.push(fileName);
      
      // Check for @supports rule
      if (/@supports\s*\(\s*display\s*:\s*grid\s*\)/i.test(cssContent)) {
        hasSupportsRule = true;
      }
      
      // Check for flexbox fallback (before @supports or as alternative)
      if (/display\s*:\s*flex/i.test(cssContent)) {
        hasFallback = true;
      }
    }
  });
  
  console.log('CSS Grid analysis:');
  console.log(`  Uses CSS Grid: ${usesGrid ? 'Yes' : 'No'}`);
  if (usesGrid) {
    console.log(`  Files: ${gridUsageFiles.join(', ')}`);
    console.log(`  Has @supports rule: ${hasSupportsRule ? '✓ Yes' : '✗ No'}`);
    console.log(`  Has flexbox fallback: ${hasFallback ? '✓ Yes' : '✗ No'}`);
  }
  
  // Check HTML files for inline grid styles
  const htmlFiles = [
    path.join(__dirname, '../../index.html'),
    path.join(__dirname, '../../calculator/compound-interest.html')
  ];
  
  let inlineGridFound = false;
  
  htmlFiles.forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      return;
    }
    
    const htmlContent = fs.readFileSync(filePath, 'utf-8');
    if (/<style[^>]*>[\s\S]*display\s*:\s*grid[\s\S]*<\/style>/i.test(htmlContent)) {
      inlineGridFound = true;
      console.log(`  ⚠️  Inline grid styles found in ${path.basename(filePath)}`);
    }
  });
  
  // BUG CONDITION: Uses Grid without @supports fallback
  const testPassed = !usesGrid || (hasSupportsRule && hasFallback);
  
  if (!testPassed && usesGrid) {
    console.log('\n❌ COUNTEREXAMPLE FOUND: CSS Grid without @supports fallback');
    console.log('   Expected: @supports (display: grid) with flexbox fallback');
    console.log('   Actual: CSS Grid used without progressive enhancement');
    console.log('   Risk: Layout breaks in IE11, old Edge (pre-Chromium)');
    console.log('\n   Example fix:');
    console.log('   /* Fallback for old browsers */');
    console.log('   .container { display: flex; flex-wrap: wrap; }');
    console.log('   ');
    console.log('   /* Grid for modern browsers */');
    console.log('   @supports (display: grid) {');
    console.log('     .container { display: grid; }');
    console.log('   }');
  } else if (!usesGrid) {
    console.log('\n⚠️  Note: CSS Grid not currently used');
    console.log('   This is acceptable (using flexbox for layout)');
  } else {
    console.log('\n✓ Property holds: CSS Grid has @supports fallback');
  }
  
  return { 
    passed: testPassed, 
    usesGrid,
    hasSupportsRule,
    hasFallback,
    gridUsageFiles,
    inlineGridFound 
  };
}

/**
 * Run all bug condition exploration tests
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   Bug Condition Exploration Test - Browser Compatibility      ║');
  console.log('║   **CRITICAL**: This test MUST FAIL on unfixed code           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  const results = {
    property1: null,
    property2: null,
    property3: null
  };
  
  try {
    results.property1 = testES6PolyfillPresence();
  } catch (error) {
    console.error('Error in Property 1:', error.message);
    results.property1 = { passed: false, error: error.message };
  }
  
  try {
    results.property2 = testIntersectionObserverFallback();
  } catch (error) {
    console.error('Error in Property 2:', error.message);
    results.property2 = { passed: false, error: error.message };
  }
  
  try {
    results.property3 = testCSSGridFallback();
  } catch (error) {
    console.error('Error in Property 3:', error.message);
    results.property3 = { passed: false, error: error.message };
  }
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                         TEST SUMMARY                            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  const allPassed = results.property1?.passed && 
                    results.property2?.passed && 
                    results.property3?.passed;
  
  console.log(`\nProperty 1 (ES6+ Polyfills):             ${results.property1?.passed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Property 2 (IntersectionObserver Fallback): ${results.property2?.passed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Property 3 (CSS Grid @supports):         ${results.property3?.passed ? '✓ PASS' : '✗ FAIL'}`);
  
  console.log('\n' + '─'.repeat(64));
  
  if (!allPassed) {
    console.log('\n⚠️  EXPECTED RESULT ON UNFIXED CODE: TEST FAILURES DETECTED ⚠️');
    console.log('\nBrowser compatibility issues documented:');
    if (!results.property1?.passed) {
      console.log('  • ES6+ features without polyfills → JavaScript errors in old browsers');
    }
    if (!results.property2?.passed) {
      console.log('  • IntersectionObserver without fallback → animations fail in old browsers');
    }
    if (!results.property3?.passed) {
      console.log('  • CSS Grid without @supports → layout breaks in IE11');
    }
    console.log('\n✓ Bug condition exploration SUCCESSFUL - compatibility issues confirmed');
    console.log('\nNext steps:');
    console.log('  1. Mark this task as complete (test written, run, failures documented)');
    console.log('  2. Proceed to document preservation requirements (task 22)');
    console.log('  3. Implement compatibility fixes (task 23)');
    console.log('  4. Re-run this test after fixes - should PASS (or accept limitations)');
  } else {
    console.log('\n✓ All tests PASSED');
    console.log('This may indicate:');
    console.log('  1. Compatibility measures already implemented');
    console.log('  2. Modern-only features not used (acceptable)');
    console.log('  3. The codebase targets modern browsers only');
  }
  
  console.log('\n' + '═'.repeat(64) + '\n');
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests();
