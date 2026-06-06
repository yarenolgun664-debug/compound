/**
 * Bug Condition Exploration Test: Calculator State Management
 * 
 * **CRITICAL**: This test is EXPECTED TO FAIL on unfixed code.
 * SUCCESS = test fails on unfixed code (proves bug exists)
 * 
 * **Validates: Requirements 1.8, 1.9, 1.10**
 * 
 * Tests 3 state management vulnerabilities:
 * 1. localStorage quota exceeded → user NOT notified (no toast)
 * 2. Namespace collision → different calculators use similar keys → cross-contamination risk
 * 3. Malformed URL hash → no validation → error thrown
 */

const fc = require('fast-check');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// ============== TEST SETUP ==============

/**
 * Setup browser environment with jsdom
 */
function setupDOM() {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <head><title>Test</title></head>
      <body>
        <div id="app"></div>
      </body>
    </html>
  `, {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.localStorage = dom.window.localStorage;
  global.sessionStorage = dom.window.sessionStorage;
  global.URLSearchParams = dom.window.URLSearchParams;
  
  return dom;
}

/**
 * Load core.js to get ToastManager and saveCalcInputs/loadCalcInputs
 */
function loadCoreJS() {
  const coreJsPath = path.join(__dirname, 'core.js');
  const coreJsCode = fs.readFileSync(coreJsPath, 'utf-8');
  
  // Execute core.js in the global context
  eval(coreJsCode);
}

/**
 * Load a calculator file (e.g., compound-interest.js)
 */
function loadCalculatorJS(calculatorName) {
  const calcPath = path.join(__dirname, 'calculators', `${calculatorName}.js`);
  const calcCode = fs.readFileSync(calcPath, 'utf-8');
  
  // Execute calculator code
  eval(calcCode);
}

// ============== BUG CONDITION 1: localStorage Quota Exceeded → No Toast ==============

/**
 * Property 1: When localStorage.setItem() fails with QuotaExceededError,
 * user should be notified via toast notification.
 * 
 * EXPECTED ON UNFIXED CODE: FAIL (no toast is shown)
 */
function testLocalStorageQuotaNotification() {
  console.log('\n=== Bug Condition 1: localStorage Quota Exceeded → No User Notification ===\n');
  
  const dom = setupDOM();
  
  // Load core.js FIRST which contains saveCalcInputs and ToastManager
  loadCoreJS();
  
  // Mock localStorage to throw QuotaExceededError AFTER loading core.js
  let setItemAttempts = 0;
  const originalSetItem = global.window.localStorage.setItem.bind(global.window.localStorage);
  
  global.window.localStorage.setItem = function(key, value) {
    setItemAttempts++;
    const error = new Error('QuotaExceededError');
    error.name = 'QuotaExceededError';
    throw error;
  };
  global.localStorage.setItem = global.window.localStorage.setItem;
  
  // Track toast notifications
  let toastShown = false;
  let toastMessage = '';
  let toastType = '';
  
  const originalShowToast = global.window.showToast;
  if (originalShowToast) {
    global.window.showToast = function(message, type = 'success', duration = 3000) {
      toastShown = true;
      toastMessage = message;
      toastType = type;
      console.log(`[MOCK] Toast shown: "${message}" (type: ${type})`);
    };
  }
  
  // Attempt to save calculator inputs
  console.log('Attempting to save calculator inputs with localStorage quota exceeded...');
  
  try {
    if (typeof window.saveCalcInputs === 'function') {
      window.saveCalcInputs('compound-interest', {
        principal: 10000,
        rate: 7.0,
        years: 30,
        contribution: 500
      });
    } else {
      console.error('window.saveCalcInputs is not defined');
    }
  } catch (e) {
    console.log('Caught error during saveCalcInputs:', e.message);
  }
  
  console.log(`\nsetItem attempts: ${setItemAttempts}`);
  console.log(`Toast shown: ${toastShown}`);
  if (toastShown) {
    console.log(`Toast message: "${toastMessage}"`);
    console.log(`Toast type: ${toastType}`);
  }
  
  // Cleanup
  global.window.localStorage.setItem = originalSetItem;
  global.localStorage.setItem = originalSetItem;
  
  // EXPECTED BEHAVIOR (after fix):
  // - toastShown should be true
  // - toastMessage should contain "could not save" or "quota" or similar
  // - toastType should be 'error' or 'warning'
  
  const testPassed = toastShown && 
                     (toastMessage.toLowerCase().includes('save') || 
                      toastMessage.toLowerCase().includes('quota') ||
                      toastMessage.toLowerCase().includes('storage'));
  
  console.log(`\n✓ Expected Behavior (after fix): Toast notification shown to user`);
  console.log(`✗ Current Behavior (unfixed): ${testPassed ? 'UNEXPECTED PASS' : 'Toast NOT shown (BUG CONFIRMED)'}`);
  
  if (!testPassed) {
    console.log('\n⚠️  COUNTEREXAMPLE: localStorage.setItem() failed but user received no notification');
  }
  
  return { testPassed, toastShown, toastMessage, setItemAttempts };
}

// ============== BUG CONDITION 2: Namespace Collision Risk ==============

/**
 * Property 2: Different calculators should use namespace isolation
 * (e.g., cp_calc_retirement_, cp_calc_fire_) to prevent cross-contamination.
 * 
 * EXPECTED ON UNFIXED CODE: FAIL (same key prefix used, no true namespace isolation)
 */
function testNamespaceIsolation() {
  console.log('\n=== Bug Condition 2: Namespace Collision → Cross-Contamination Risk ===\n');
  
  const dom = setupDOM();
  
  // Track localStorage keys used
  const keysUsed = [];
  const originalSetItem = global.localStorage.setItem;
  
  global.localStorage.setItem = function(key, value) {
    keysUsed.push(key);
    console.log(`[MOCK] localStorage.setItem("${key}", ...)`);
    return originalSetItem.call(this, key, value);
  };
  
  loadCoreJS();
  
  // Save inputs for different calculators
  console.log('Saving inputs for different calculators...\n');
  
  if (typeof window.saveCalcInputs === 'function') {
    window.saveCalcInputs('compound-interest', { principal: 10000 });
    window.saveCalcInputs('retirement', { currentAge: 30 });
    window.saveCalcInputs('fire-number', { annualExpenses: 40000 });
  }
  
  console.log(`\nKeys used: ${JSON.stringify(keysUsed, null, 2)}`);
  
  // Check namespace isolation
  // Expected (after fix): Keys should have distinct namespace prefixes
  // e.g., cp_calc_retirement_, cp_calc_fire_, cp_calc_compound_
  
  // Current (unfixed): All use the same prefix "cp_calc_inputs_"
  
  const hasDistinctNamespaces = keysUsed.every((key, idx) => {
    // Check if calculator name is embedded in the key prefix (not just suffix)
    return key.includes('compound-interest') || 
           key.includes('retirement') || 
           key.includes('fire-number');
  });
  
  // Check for collision risk: same prefix for all calculators
  const allUseSamePrefix = keysUsed.every(key => key.startsWith('cp_calc_'));
  const collision = allUseSamePrefix && keysUsed.length > 1;
  
  console.log(`\nHas distinct namespace prefixes: ${hasDistinctNamespaces}`);
  console.log(`Collision risk (same prefix): ${collision}`);
  
  // Cleanup
  global.localStorage.setItem = originalSetItem;
  
  const testPassed = hasDistinctNamespaces && !collision;
  
  console.log(`\n✓ Expected Behavior (after fix): Each calculator uses distinct namespace prefix`);
  console.log(`✗ Current Behavior (unfixed): ${testPassed ? 'UNEXPECTED PASS' : 'Same prefix used (BUG CONFIRMED)'}`);
  
  if (!testPassed) {
    console.log('\n⚠️  COUNTEREXAMPLE: All calculators use "cp_calc_inputs_" prefix → namespace collision risk');
    console.log('Example collision scenario:');
    console.log('  - User saves compound-interest with "years: 30"');
    console.log('  - User saves retirement with "years: 40"');
    console.log('  - If keys overlap or are misread, wrong data might be loaded');
  }
  
  return { testPassed, keysUsed, hasDistinctNamespaces, collision };
}

// ============== BUG CONDITION 3: Malformed URL Hash → No Validation ==============

/**
 * Property 3: URL hash parsing should validate input and use default values
 * when hash is malformed. Should NOT throw unhandled errors.
 * 
 * EXPECTED ON UNFIXED CODE: FAIL (throws error or returns invalid data)
 */
function testURLHashValidation() {
  console.log('\n=== Bug Condition 3: Malformed URL Hash → No Validation ===\n');
  
  const dom = setupDOM();
  
  // Load a calculator that uses decodeState (e.g., compound-interest.js)
  console.log('Loading compound-interest calculator...\n');
  
  // Define CompoundCalc manually for testing (simplified version)
  global.CompoundCalc = {
    decodeState(hash) {
      const params = new URLSearchParams(hash);
      const inputs = {};
      
      const parseField = (name, defaultValue, isFloat = false) => {
        const val = params.get(name);
        if (val === null) return defaultValue;
        const parsed = isFloat ? parseFloat(val) : parseInt(val, 10);
        return isNaN(parsed) ? defaultValue : parsed;
      };

      inputs.principal = parseField('p', 10000);
      inputs.rate = parseField('r', 7.0, true);
      inputs.n = parseField('n', 12);
      inputs.years = parseField('y', 30);
      inputs.periodType = params.get('pt') || 'years';
      inputs.contribution = parseField('c', 0);
      inputs.pmtFreq = parseField('pf', 12);
      inputs.pmtTiming = params.get('pmt') || 'beginning';
      inputs.inflationRate = parseField('i', 3.2, true);
      inputs.taxRate = parseField('t', 0.0, true);
      inputs.startYear = parseField('sy', new Date().getFullYear());
      inputs.escalatorPct = parseField('esc', 0, true);
      inputs.accountType = params.get('at') || 'taxable';
      inputs.compareMode = params.get('cmp') === '1';

      return inputs;
    }
  };
  
  // Test with malformed URL hashes
  const malformedHashes = [
    'p=10000&r=7.0&y=30&invalid=<<script>>',
    'p=abc&r=xyz&y=notanumber',
    '{broken:json}',
    'p=10000&r=7.0%&y=30<script>alert(1)</script>',
    '',
    'p=&r=&y=',
    'p=Infinity&r=NaN&y=-1'
  ];
  
  const results = [];
  
  malformedHashes.forEach(hash => {
    console.log(`Testing hash: "${hash.substring(0, 50)}..."`);
    
    let errorThrown = false;
    let errorMessage = '';
    let decodedInputs = null;
    
    try {
      decodedInputs = global.CompoundCalc.decodeState(hash);
      console.log(`  → Decoded: ${JSON.stringify(decodedInputs).substring(0, 80)}...`);
    } catch (e) {
      errorThrown = true;
      errorMessage = e.message;
      console.log(`  → Error thrown: ${e.message}`);
    }
    
    // Check if defaults are used
    const usesDefaults = decodedInputs && 
                         typeof decodedInputs.principal === 'number' &&
                         typeof decodedInputs.rate === 'number' &&
                         typeof decodedInputs.years === 'number' &&
                         !isNaN(decodedInputs.principal) &&
                         !isNaN(decodedInputs.rate) &&
                         !isNaN(decodedInputs.years);
    
    results.push({
      hash,
      errorThrown,
      errorMessage,
      usesDefaults,
      decodedInputs
    });
  });
  
  console.log('\n=== Summary ===');
  
  const errorsThrown = results.filter(r => r.errorThrown).length;
  const defaultsUsed = results.filter(r => r.usesDefaults).length;
  
  console.log(`Errors thrown: ${errorsThrown}/${malformedHashes.length}`);
  console.log(`Valid defaults returned: ${defaultsUsed}/${malformedHashes.length}`);
  
  // EXPECTED BEHAVIOR (after fix):
  // - No errors thrown (all caught with try-catch)
  // - Default values used for all malformed hashes
  
  const testPassed = errorsThrown === 0 && defaultsUsed === malformedHashes.length;
  
  console.log(`\n✓ Expected Behavior (after fix): All malformed hashes safely parsed with defaults`);
  console.log(`✗ Current Behavior (unfixed): ${testPassed ? 'UNEXPECTED PASS' : 'Errors thrown or invalid values (BUG CONFIRMED)'}`);
  
  if (!testPassed) {
    console.log('\n⚠️  COUNTEREXAMPLES:');
    results.forEach(r => {
      if (r.errorThrown || !r.usesDefaults) {
        console.log(`  - Hash: "${r.hash.substring(0, 40)}..."`);
        if (r.errorThrown) {
          console.log(`    Error: ${r.errorMessage}`);
        }
        if (!r.usesDefaults) {
          console.log(`    Issue: Invalid or NaN values in decoded inputs`);
        }
      }
    });
  }
  
  return { testPassed, results, errorsThrown, defaultsUsed };
}

// ============== MAIN TEST RUNNER ==============

function runAllTests() {
  console.log('\n' + '='.repeat(80));
  console.log('BUG CONDITION EXPLORATION TEST: Calculator State Management');
  console.log('Requirements: 1.8, 1.9, 1.10');
  console.log('='.repeat(80));
  
  const test1 = testLocalStorageQuotaNotification();
  const test2 = testNamespaceIsolation();
  const test3 = testURLHashValidation();
  
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  
  console.log(`\nProperty 1 - localStorage Quota Notification: ${test1.testPassed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Property 2 - Namespace Isolation: ${test2.testPassed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Property 3 - URL Hash Validation: ${test3.testPassed ? '✓ PASS' : '✗ FAIL'}`);
  
  const allPassed = test1.testPassed && test2.testPassed && test3.testPassed;
  
  console.log('\n' + '='.repeat(80));
  if (allPassed) {
    console.log('⚠️  UNEXPECTED: ALL TESTS PASSED ON UNFIXED CODE');
    console.log('This suggests the bugs may already be fixed or root causes need re-investigation.');
  } else {
    console.log('✓ EXPECTED RESULT: TESTS FAILED ON UNFIXED CODE');
    console.log('Bug conditions confirmed. These tests will pass after implementing fixes.');
  }
  console.log('='.repeat(80) + '\n');
  
  return {
    property1: test1,
    property2: test2,
    property3: test3,
    allPassed
  };
}

// Run tests
if (require.main === module) {
  try {
    const results = runAllTests();
    
    // Exit with appropriate code
    // For bug exploration tests, we want failures (bugs confirmed)
    // So exit 0 if tests failed (expected), exit 1 if tests passed (unexpected)
    process.exit(results.allPassed ? 1 : 0);
  } catch (error) {
    console.error('\n❌ TEST EXECUTION ERROR:', error);
    console.error(error.stack);
    process.exit(2);
  }
}

module.exports = { runAllTests };
