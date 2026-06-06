/**
 * Bug Condition Exploration Test - Ad System Placeholders
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * This test uses property-based testing to verify that placeholder ad code is present
 * in the HTML files and ads.js has invalid configuration:
 * 1. HTML files contain CP_AD_START/END comment blocks
 * 2. ads.js has network = null and publisherId = null
 * 3. AdSense script tags have placeholder publisher IDs (ca-pub-XXXXXXXXXXXX)
 * 
 * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS (proves placeholder ad code exists)
 */

const fc = require('fast-check');
const fs = require('fs');
const path = require('path');

/**
 * Property 1: HTML Files Should NOT Have Ad Placeholders
 * 
 * Bug Condition: HTML contains CP_AD_START/END comments and placeholder ad slots
 * Expected Behavior: No ad placeholder comments or invalid ad slots in production HTML
 */
function testHTMLAdPlaceholders() {
  console.log('\n=== Testing Property 1: HTML Ad Placeholder Detection ===');
  
  const htmlFiles = [];
  const placeholderFindings = [];
  
  // Recursively find all HTML files (excluding .ad-backup, node_modules, .git)
  function findHTMLFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip protected directories
      if (entry.isDirectory()) {
        if (['.ad-backup', 'node_modules', '.git', '.kiro', '.mavis', '.vscode', '.opencode'].includes(entry.name)) {
          continue;
        }
        findHTMLFiles(fullPath, files);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        // Skip tool files
        if (!entry.name.includes('reklam-yoneticisi') && 
            !entry.name.includes('blog-editor') && 
            !entry.name.includes('test-')) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }
  
  // Find all HTML files in project root
  const projectRoot = path.join(__dirname, '..', '..');
  const allHTMLFiles = findHTMLFiles(projectRoot);
  
  console.log(`Found ${allHTMLFiles.length} HTML files to scan`);
  
  // Check each HTML file for ad placeholders
  for (const filePath of allHTMLFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(projectRoot, filePath);
    
    // Check for CP_AD_START/END comments
    const adStartMatches = content.match(/<!-- CP_AD_START:[^>]*?-->/g) || [];
    const adEndMatches = content.match(/<!-- CP_AD_END:[^>]*?-->/g) || [];
    
    // Check for placeholder ad slots
    const adSlotMatches = content.match(/<div[^>]*class="[^"]*cp-managed-ad[^"]*"[^>]*>/g) || [];
    
    // Check for AdSense script tags with placeholder publisher ID
    const adsenseScriptMatches = content.match(/data-ad-client="ca-pub-XXXXXXXXXXXX"/g) || [];
    
    if (adStartMatches.length > 0 || adEndMatches.length > 0 || 
        adSlotMatches.length > 0 || adsenseScriptMatches.length > 0) {
      placeholderFindings.push({
        file: relativePath,
        adStartComments: adStartMatches.length,
        adEndComments: adEndMatches.length,
        adSlots: adSlotMatches.length,
        adsenseScripts: adsenseScriptMatches.length
      });
    }
  }
  
  console.log(`\nFiles with ad placeholders: ${placeholderFindings.length}`);
  
  if (placeholderFindings.length > 0) {
    console.log('\nSample findings (first 5 files):');
    placeholderFindings.slice(0, 5).forEach(finding => {
      console.log(`  • ${finding.file}`);
      console.log(`    - CP_AD_START comments: ${finding.adStartComments}`);
      console.log(`    - CP_AD_END comments: ${finding.adEndComments}`);
      console.log(`    - Ad slot divs: ${finding.adSlots}`);
      console.log(`    - AdSense scripts with placeholder ID: ${finding.adsenseScripts}`);
    });
    
    if (placeholderFindings.length > 5) {
      console.log(`  ... and ${placeholderFindings.length - 5} more files`);
    }
  }
  
  // BUG CONDITION: HTML files SHOULD NOT have placeholder ad code
  const testPassed = placeholderFindings.length === 0;
  
  if (!testPassed) {
    console.log('\n❌ COUNTEREXAMPLE FOUND: HTML files contain ad placeholder code');
    console.log(`   Expected: No CP_AD_START/END comments or placeholder ad slots`);
    console.log(`   Actual: Found placeholders in ${placeholderFindings.length} files`);
    console.log('   Note: Placeholder ad code is present in production HTML');
  } else {
    console.log('\n✓ Property holds: No ad placeholders in HTML files');
  }
  
  return { 
    passed: testPassed, 
    filesWithPlaceholders: placeholderFindings.length,
    totalFilesScanned: allHTMLFiles.length,
    findings: placeholderFindings
  };
}

/**
 * Property 2: ads.js Should NOT Have Null Configuration
 * 
 * Bug Condition: ads.js contains network = null and publisherId = null
 * Expected Behavior: Either valid configuration or no ads.js file/no init call
 */
function testAdsJsConfiguration() {
  console.log('\n=== Testing Property 2: ads.js Configuration ===');
  
  const adsJsPath = path.join(__dirname, 'ads.js');
  
  if (!fs.existsSync(adsJsPath)) {
    console.log('✓ ads.js file does not exist (acceptable - no ad system)');
    return { passed: true, fileExists: false };
  }
  
  const adsJsContent = fs.readFileSync(adsJsPath, 'utf-8');
  
  // Check for null network configuration
  const hasNullNetwork = /network:\s*null/.test(adsJsContent);
  const hasNullPublisherId = /publisherId:\s*null/.test(adsJsContent);
  
  // Check if init() is called when network is null
  const hasInitCall = /AdsManager\.init\(\)/.test(adsJsContent) || 
                      /document\.addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*AdsManager\.init\(\)/.test(adsJsContent);
  
  // Check if loadNetwork() is called despite null configuration
  const hasLoadNetworkCall = /this\.loadNetwork\(\)/.test(adsJsContent) && 
                             /if\s*\(\s*this\.network\s*\)/.test(adsJsContent);
  
  console.log(`\nConfiguration analysis:`);
  console.log(`  • network = null: ${hasNullNetwork}`);
  console.log(`  • publisherId = null: ${hasNullPublisherId}`);
  console.log(`  • init() is called: ${hasInitCall}`);
  console.log(`  • loadNetwork() has network check: ${hasLoadNetworkCall}`);
  
  // BUG CONDITION: ads.js should NOT have null config AND call init
  // OR should have warning when network is null
  const hasConsoleWarning = /console\.(warn|log)/.test(adsJsContent);
  
  // Test passes if either:
  // 1. No null configuration (valid config present)
  // 2. Null configuration but no init call
  // 3. Null configuration with clear warning message
  const testPassed = (!hasNullNetwork && !hasNullPublisherId) || 
                     (!hasInitCall) || 
                     (hasConsoleWarning && adsJsContent.includes('TODO'));
  
  // For bug exploration, we expect this to FAIL
  // Current code has null config and DOES call init (via DOMContentLoaded)
  const actuallyHasBug = hasNullNetwork && hasNullPublisherId && hasInitCall;
  
  if (actuallyHasBug) {
    console.log('\n❌ COUNTEREXAMPLE FOUND: ads.js has null configuration but still initializes');
    console.log('   Expected: Either valid config, no init call, or clear warning');
    console.log('   Actual: network=null, publisherId=null, but AdsManager.init() is called');
    console.log('   Note: loadNetwork() runs but does nothing due to null network');
  } else {
    console.log('\n✓ Property holds: ads.js properly configured or doesn\'t init');
  }
  
  return { 
    passed: !actuallyHasBug,
    fileExists: true,
    hasNullNetwork,
    hasNullPublisherId,
    hasInitCall,
    hasConsoleWarning
  };
}

/**
 * Property 3: AdSense Scripts Should NOT Have Placeholder Publisher IDs
 * 
 * Bug Condition: AdSense script tags with ca-pub-XXXXXXXXXXXX placeholder
 * Expected Behavior: Either valid publisher ID or no AdSense scripts
 */
function testAdSenseScriptPlaceholders() {
  console.log('\n=== Testing Property 3: AdSense Script Placeholder Detection ===');
  
  const htmlFiles = [];
  const scriptPlaceholderFindings = [];
  
  // Recursively find all HTML files
  function findHTMLFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (['.ad-backup', 'node_modules', '.git', '.kiro', '.mavis', '.vscode', '.opencode'].includes(entry.name)) {
          continue;
        }
        findHTMLFiles(fullPath, files);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        if (!entry.name.includes('reklam-yoneticisi') && 
            !entry.name.includes('blog-editor') && 
            !entry.name.includes('test-')) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }
  
  const projectRoot = path.join(__dirname, '..', '..');
  const allHTMLFiles = findHTMLFiles(projectRoot);
  
  console.log(`Scanning ${allHTMLFiles.length} HTML files for AdSense placeholders`);
  
  // Check each HTML file for AdSense scripts with placeholder IDs
  for (const filePath of allHTMLFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(projectRoot, filePath);
    
    // Check for AdSense script tags with placeholder publisher ID
    const placeholderMatches = content.match(/data-ad-client="ca-pub-XXXXXXXXXXXX"/g) || [];
    
    // Check for adsbygoogle class (indicates AdSense usage)
    const adsbyGoogleMatches = content.match(/<ins[^>]*class="adsbygoogle"[^>]*>/g) || [];
    
    if (placeholderMatches.length > 0) {
      scriptPlaceholderFindings.push({
        file: relativePath,
        placeholderScripts: placeholderMatches.length,
        totalAdsbyGoogle: adsbyGoogleMatches.length
      });
    }
  }
  
  console.log(`\nFiles with placeholder AdSense scripts: ${scriptPlaceholderFindings.length}`);
  
  if (scriptPlaceholderFindings.length > 0) {
    console.log('\nSample findings (first 5 files):');
    scriptPlaceholderFindings.slice(0, 5).forEach(finding => {
      console.log(`  • ${finding.file}`);
      console.log(`    - Placeholder scripts: ${finding.placeholderScripts}`);
      console.log(`    - Total adsbygoogle elements: ${finding.totalAdsbyGoogle}`);
    });
    
    if (scriptPlaceholderFindings.length > 5) {
      console.log(`  ... and ${scriptPlaceholderFindings.length - 5} more files`);
    }
  }
  
  // BUG CONDITION: Should NOT have placeholder publisher IDs in AdSense scripts
  const testPassed = scriptPlaceholderFindings.length === 0;
  
  if (!testPassed) {
    console.log('\n❌ COUNTEREXAMPLE FOUND: AdSense scripts with placeholder publisher IDs');
    console.log('   Expected: No ca-pub-XXXXXXXXXXXX placeholder IDs');
    console.log(`   Actual: Found placeholder IDs in ${scriptPlaceholderFindings.length} files`);
    console.log('   Note: AdSense scripts will not work with placeholder publisher ID');
  } else {
    console.log('\n✓ Property holds: No AdSense placeholder scripts found');
  }
  
  return { 
    passed: testPassed, 
    filesWithPlaceholders: scriptPlaceholderFindings.length,
    totalFilesScanned: allHTMLFiles.length,
    findings: scriptPlaceholderFindings
  };
}

/**
 * Run all bug condition exploration tests
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║   Bug Condition Exploration Test - Ad System Placeholders     ║');
  console.log('║   **CRITICAL**: This test MUST FAIL on unfixed code           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  const results = {
    property1: null,
    property2: null,
    property3: null
  };
  
  try {
    results.property1 = testHTMLAdPlaceholders();
  } catch (error) {
    console.error('Error in Property 1:', error.message);
    results.property1 = { passed: false, error: error.message };
  }
  
  try {
    results.property2 = testAdsJsConfiguration();
  } catch (error) {
    console.error('Error in Property 2:', error.message);
    results.property2 = { passed: false, error: error.message };
  }
  
  try {
    results.property3 = testAdSenseScriptPlaceholders();
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
  
  console.log(`\nProperty 1 (HTML Ad Placeholders):         ${results.property1?.passed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Property 2 (ads.js Configuration):         ${results.property2?.passed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Property 3 (AdSense Script Placeholders):  ${results.property3?.passed ? '✓ PASS' : '✗ FAIL'}`);
  
  // Additional statistics
  if (results.property1 && !results.property1.passed) {
    console.log(`\n  → HTML files with placeholders: ${results.property1.filesWithPlaceholders} / ${results.property1.totalFilesScanned}`);
  }
  
  if (results.property3 && !results.property3.passed) {
    console.log(`  → Files with AdSense placeholders: ${results.property3.filesWithPlaceholders} / ${results.property3.totalFilesScanned}`);
  }
  
  console.log('\n' + '─'.repeat(64));
  
  if (!allPassed) {
    console.log('\n⚠️  EXPECTED RESULT ON UNFIXED CODE: TEST FAILURES DETECTED ⚠️');
    console.log('\nCounterexamples documented:');
    if (!results.property1?.passed) {
      console.log('  • HTML files contain CP_AD_START/END comment blocks');
      console.log(`    (Found in ${results.property1.filesWithPlaceholders} files)`);
    }
    if (!results.property2?.passed) {
      console.log('  • ads.js has network = null and publisherId = null');
      console.log('    (But still calls AdsManager.init() on page load)');
    }
    if (!results.property3?.passed) {
      console.log('  • AdSense script tags have placeholder publisher IDs');
      console.log(`    (Found ca-pub-XXXXXXXXXXXX in ${results.property3.filesWithPlaceholders} files)`);
    }
    console.log('\n✓ Bug condition exploration SUCCESSFUL - placeholder ad code confirmed');
    console.log('\nNext steps:');
    console.log('  1. Mark this task as complete (test written, run, failures documented)');
    console.log('  2. Proceed to implement fixes in subsequent tasks');
    console.log('  3. Re-run this test after fixes - it should PASS on fixed code');
    console.log('\nRemediation recommendations:');
    console.log('  • Remove all CP_AD_START/END comment blocks from HTML files');
    console.log('  • Remove all cp-managed-ad div elements and AdSense script tags');
    console.log('  • Either configure ads.js with valid network/publisher or remove init call');
    console.log('  • Consider creating ads-config.js for future ad system integration');
  } else {
    console.log('\n⚠️  UNEXPECTED: All tests PASSED on supposedly unfixed code');
    console.log('This may indicate:');
    console.log('  1. The code already has ad placeholders removed');
    console.log('  2. The test needs adjustment to properly detect the bug condition');
    console.log('  3. The bug analysis may need revision');
  }
  
  console.log('\n' + '═'.repeat(64) + '\n');
  
  // Exit with appropriate code
  // For bug exploration tests, FAILURE (exit 1) is the EXPECTED result on unfixed code
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests();
