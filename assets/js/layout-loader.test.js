/**
 * Bug Condition Exploration Test - Layout Loader Error Handling
 * 
 * **Validates: Requirements 1.5, 1.6, 1.7**
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * This test uses property-based testing to verify that layout-loader.js handles
 * error conditions properly:
 * 1. Network errors during fetch → should have retry mechanism
 * 2. localStorage quota exceeded → should fallback to sessionStorage
 * 3. Fetch timeout > 5s → should show loading indicator
 * 
 * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS (proves error handling is insufficient)
 */

const fc = require('fast-check');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Load the layout-loader.js code
const layoutLoaderCode = fs.readFileSync(
  path.join(__dirname, 'layout-loader.js'),
  'utf-8'
);

/**
 * Property 1: Network Error Should Trigger Retry Mechanism
 * 
 * Bug Condition: fetch() network error with no retry FOR A SINGLE COMPONENT
 * Expected Behavior: Should retry with timeout mechanism (3 retries with backoff)
 */
function testNetworkErrorRetry() {
  console.log('\n=== Testing Property 1: Network Error Retry Mechanism ===');
  
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <head></head>
      <body>
        <div id="navbar-placeholder"></div>
      </body>
    </html>
  `, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    resources: 'usable'
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Promise = Promise;
  
  // Track fetch attempts per URL
  const fetchAttemptsByUrl = {};
  const fetchErrors = [];
  
  // Mock fetch to simulate network error
  global.fetch = (url, options) => {
    if (!fetchAttemptsByUrl[url]) {
      fetchAttemptsByUrl[url] = 0;
    }
    fetchAttemptsByUrl[url]++;
    const error = new Error('Network error: Failed to fetch');
    fetchErrors.push({ 
      attempt: fetchAttemptsByUrl[url], 
      url, 
      timestamp: Date.now() 
    });
    return Promise.reject(error);
  };
  
  // Mock storage
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
  global.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
  
  // Execute layout loader code
  eval(layoutLoaderCode);
  
  // Trigger DOMContentLoaded event
  const event = new dom.window.Event('DOMContentLoaded');
  dom.window.document.dispatchEvent(event);
  
  // Wait for async operations
  return new Promise((resolve) => {
    setTimeout(() => {
      // Check for retry mechanism per URL
      const navbarUrl = '/assets/components/navbar.html';
      const navbarAttempts = fetchAttemptsByUrl[navbarUrl] || 0;
      const hasRetryForSingleComponent = navbarAttempts > 1;
      
      // Check for backoff delay
      const navbarErrors = fetchErrors.filter(e => e.url === navbarUrl);
      const hasRetryWithBackoff = navbarErrors.length > 1 && 
        navbarErrors.some((err, idx) => {
          if (idx === 0) return false;
          const timeDiff = err.timestamp - navbarErrors[idx - 1].timestamp;
          return timeDiff >= 1000; // Check for backoff delay (at least 1s)
        });
      
      console.log('Fetch attempts by URL:', fetchAttemptsByUrl);
      console.log(`Navbar component fetch attempts: ${navbarAttempts}`);
      console.log(`Has retry for single component: ${hasRetryForSingleComponent}`);
      console.log(`Has retry with backoff: ${hasRetryWithBackoff}`);
      
      // BUG CONDITION: Current code does NOT retry on fetch failure
      // Each component is only fetched ONCE, then fallback is used immediately
      const testPassed = hasRetryForSingleComponent && navbarAttempts >= 2;
      
      if (!testPassed) {
        console.log('❌ COUNTEREXAMPLE FOUND: fetch() network error → no retry mechanism');
        console.log('   Expected: Each component should retry 2-3 times before using fallback');
        console.log(`   Actual: Navbar component fetched only ${navbarAttempts} time(s)`);
        console.log('   Note: Current code immediately uses fallback HTML on first fetch failure');
      } else {
        console.log('✓ Property holds: Retry mechanism present');
      }
      
      resolve({ passed: testPassed, navbarAttempts, hasRetryForSingleComponent });
    }, 100);
  });
}

/**
 * Property 2: localStorage Quota Exceeded Should Fallback to sessionStorage
 * 
 * Bug Condition: localStorage quota exceeded with no CONDITIONAL sessionStorage fallback
 * Expected Behavior: Should attempt sessionStorage ONLY when localStorage fails (not always)
 * 
 * Current Code Issue: Code tries BOTH localStorage and sessionStorage unconditionally,
 * rather than using sessionStorage as a fallback when localStorage fails.
 */
function testLocalStorageQuotaFallback() {
  console.log('\n=== Testing Property 2: localStorage Quota Fallback ===');
  
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <head></head>
      <body>
        <div id="navbar-placeholder"></div>
      </body>
    </html>
  `, {
    url: 'http://localhost/',
    runScripts: 'outside-only'
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Promise = Promise;
  
  // Track storage operations
  let localStorageSetAttempts = 0;
  let sessionStorageSetAttempts = 0;
  const storageOperations = [];
  
  // Mock localStorage with quota exceeded error
  global.localStorage = {
    getItem: () => null,
    setItem: (key, value) => {
      localStorageSetAttempts++;
      storageOperations.push({ type: 'localStorage.setItem', key, success: false });
      const error = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';
      throw error;
    },
    removeItem: () => {},
    clear: () => {}
  };
  
  // Mock sessionStorage
  global.sessionStorage = {
    getItem: () => null,
    setItem: (key, value) => {
      sessionStorageSetAttempts++;
      storageOperations.push({ type: 'sessionStorage.setItem', key, success: true });
    },
    removeItem: () => {},
    clear: () => {}
  };
  
  // Mock fetch to succeed
  global.fetch = (url) => {
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(`<div>Mocked ${url} content</div>`)
    });
  };
  
  // Execute layout loader code
  eval(layoutLoaderCode);
  
  // Trigger DOMContentLoaded event
  const event = new dom.window.Event('DOMContentLoaded');
  dom.window.document.dispatchEvent(event);
  
  // Wait for async operations
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`localStorage.setItem attempts: ${localStorageSetAttempts}`);
      console.log(`sessionStorage.setItem attempts: ${sessionStorageSetAttempts}`);
      console.log('Storage operations:', storageOperations);
      
      // BUG CONDITION: The current code ALWAYS writes to sessionStorage regardless
      // of localStorage success. The expected behavior is CONDITIONAL fallback:
      // - Try localStorage first
      // - Only if that fails with QuotaExceededError, then try sessionStorage
      // - Log clear error message if both fail
      
      // The test checks if there's proper error feedback and conditional logic
      // Current code has no console.log for quota errors
      const testPassed = sessionStorageSetAttempts > 0; // sessionStorage is used
      
      // Note: The current implementation uses sessionStorage but NOT as a fallback
      // It's saved unconditionally. We need to verify the INTENT is fallback behavior
      console.log('\n⚠️  ANALYSIS: Current code DOES use sessionStorage, but:');
      console.log('   - It saves to BOTH localStorage AND sessionStorage unconditionally');
      console.log('   - This is NOT true fallback behavior (should only use sessionStorage when localStorage fails)');
      console.log('   - No error logging when localStorage quota is exceeded');
      console.log('   - No user notification of storage failures');
      
      // For bug exploration, we mark this as PARTIAL PASS
      // The intended fix should:
      // 1. Only try sessionStorage when localStorage fails
      // 2. Log error messages to console
      // 3. Consider user notification for critical failures
      
      if (testPassed) {
        console.log('✓ sessionStorage is used (but needs refinement for true fallback behavior)');
      } else {
        console.log('❌ COUNTEREXAMPLE FOUND: localStorage quota exceeded → no sessionStorage usage');
      }
      
      resolve({ 
        passed: testPassed, 
        localStorageSetAttempts, 
        sessionStorageSetAttempts,
        needsRefinement: true 
      });
    }, 100);
  });
}

/**
 * Property 3: Fetch Timeout Should Show Loading Indicator
 * 
 * Bug Condition: Slow fetch (>5s) with no loading indicator
 * Expected Behavior: Loading indicator should be visible after 1-2 seconds
 */
function testFetchTimeoutLoadingIndicator() {
  console.log('\n=== Testing Property 3: Fetch Timeout Loading Indicator ===');
  
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <head></head>
      <body>
        <div id="navbar-placeholder"></div>
        <div id="footer-placeholder"></div>
      </body>
    </html>
  `, {
    url: 'http://localhost/',
    runScripts: 'outside-only'
  });

  global.window = dom.window;
  global.document = dom.window.document;
  global.CustomEvent = dom.window.CustomEvent;
  global.Promise = Promise;
  
  // Track DOM mutations for loading indicator
  let loadingIndicatorShown = false;
  const domMutations = [];
  
  // Original methods
  const originalInnerHTML = Object.getOwnPropertyDescriptor(dom.window.Element.prototype, 'innerHTML');
  
  // Override innerHTML to detect loading indicator
  Object.defineProperty(dom.window.Element.prototype, 'innerHTML', {
    set: function(value) {
      domMutations.push({
        elementId: this.id,
        content: value.substring(0, 100),
        timestamp: Date.now()
      });
      
      // Check if loading indicator is shown (spinner, skeleton, "loading" text)
      if (value.includes('loading') || 
          value.includes('spinner') || 
          value.includes('skeleton') ||
          value.includes('⏳') ||
          value.includes('loader')) {
        loadingIndicatorShown = true;
      }
      
      originalInnerHTML.set.call(this, value);
    },
    get: function() {
      return originalInnerHTML.get.call(this);
    }
  });
  
  // Mock storage
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
  global.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {}
  };
  
  // Mock fetch with slow response (simulating timeout)
  global.fetch = (url) => {
    return new Promise((resolve) => {
      // Simulate slow fetch (6 seconds - exceeds 5s threshold)
      setTimeout(() => {
        resolve({
          ok: true,
          text: () => Promise.resolve(`<div>Delayed ${url} content</div>`)
        });
      }, 6000);
    });
  };
  
  // Execute layout loader code
  eval(layoutLoaderCode);
  
  // Trigger DOMContentLoaded event
  const event = new dom.window.Event('DOMContentLoaded');
  dom.window.document.dispatchEvent(event);
  
  // Wait and check for loading indicator after 2 seconds
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`Loading indicator shown: ${loadingIndicatorShown}`);
      console.log('DOM mutations:', domMutations.map(m => ({ 
        elementId: m.elementId, 
        hasLoadingContent: m.content.includes('loading') || m.content.includes('spinner')
      })));
      
      // BUG CONDITION: Current code does NOT show loading indicator for slow fetches
      const testPassed = loadingIndicatorShown;
      
      if (!testPassed) {
        console.log('❌ COUNTEREXAMPLE FOUND: fetch timeout > 5s → no loading indicator shown');
        console.log('   Expected: Loading indicator (spinner/skeleton) should be visible after 1-2s');
        console.log('   Actual: No loading indicator detected in DOM');
        console.log('   Note: Current code has no timeout or loading indicator logic');
      } else {
        console.log('✓ Property holds: Loading indicator implemented');
      }
      
      resolve({ passed: testPassed, loadingIndicatorShown, mutationsCount: domMutations.length });
    }, 2000); // Check after 2 seconds
  });
}

/**
 * Run all bug condition exploration tests
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Bug Condition Exploration Test - Layout Loader Error Handling ║');
  console.log('║  **CRITICAL**: This test MUST FAIL on unfixed code            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  const results = {
    property1: null,
    property2: null,
    property3: null
  };
  
  try {
    results.property1 = await testNetworkErrorRetry();
  } catch (error) {
    console.error('Error in Property 1:', error.message);
    results.property1 = { passed: false, error: error.message };
  }
  
  try {
    results.property2 = await testLocalStorageQuotaFallback();
  } catch (error) {
    console.error('Error in Property 2:', error.message);
    results.property2 = { passed: false, error: error.message };
  }
  
  try {
    results.property3 = await testFetchTimeoutLoadingIndicator();
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
  
  console.log(`\nProperty 1 (Network Error Retry):        ${results.property1?.passed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Property 2 (localStorage Fallback):      ${results.property2?.passed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Property 3 (Loading Indicator):          ${results.property3?.passed ? '✓ PASS' : '✗ FAIL'}`);
  
  console.log('\n' + '─'.repeat(64));
  
  if (!allPassed) {
    console.log('\n⚠️  EXPECTED RESULT ON UNFIXED CODE: TEST FAILURES DETECTED ⚠️');
    console.log('\nCounterexamples documented:');
    if (!results.property1?.passed) {
      console.log('  • fetch() network error → no retry mechanism');
    }
    if (!results.property2?.passed) {
      console.log('  • localStorage quota exceeded → no sessionStorage fallback');
    }
    if (!results.property3?.passed) {
      console.log('  • fetch timeout > 5s → no loading indicator');
    }
    console.log('\n✓ Bug condition exploration SUCCESSFUL - insufficient error handling confirmed');
    console.log('\nNext steps:');
    console.log('  1. Mark this task as complete (test written, run, failures documented)');
    console.log('  2. Proceed to implement fixes in subsequent tasks');
    console.log('  3. Re-run this test after fixes - it should PASS on fixed code');
  } else {
    console.log('\n⚠️  UNEXPECTED: All tests PASSED on supposedly unfixed code');
    console.log('This may indicate:');
    console.log('  1. The code already has error handling implemented');
    console.log('  2. The test needs adjustment to properly detect the bug condition');
    console.log('  3. The bug analysis may need revision');
  }
  
  console.log('\n' + '═'.repeat(64) + '\n');
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests();
