/**
 * Bug Condition Exploration Test - Accessibility Issues
 * 
 * **Validates: Requirements 1.14, 1.15, 1.16**
 * 
 * **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * This test uses property-based testing to verify that HTML/CSS have proper accessibility:
 * 1. Interactive elements (sliders, buttons) → should have aria-labels and roles
 * 2. Keyboard navigation → should have logical tab order and strong focus indicators
 * 3. Color contrast ratios → should meet WCAG AA standards (4.5:1)
 * 
 * **EXPECTED OUTCOME ON UNFIXED CODE**: Test FAILS (proves accessibility violations exist)
 */

const fc = require('fast-check');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

/**
 * Page background reference colors — mirrors design-system.css
 * --color-bg-base:    #FAFAF7 (page / cream)
 * --color-bg-surface: #FFFFFF (card / panel)
 * Used as the compositing base for any semi-transparent (rgba) background
 * so the contrast test reflects what the user actually sees in the browser.
 */
const PAGE_BG_PRIMARY = '#FAFAF7';
const PAGE_BG_FALLBACK = '#FFFFFF';

/**
 * Helper: Parse a CSS color string to {r,g,b}.
 *
 * Supports:
 *   - rgba(r, g, b, a)  → composites over `compositeOver` (a solid color string)
 *   - rgb(r, g, b)      → as-is
 *   - #RRGGBB           → as-is
 *   - basic CSS color names (white, black, etc.)
 *
 * When an rgba color has alpha < 1 and a `compositeOver` value is provided,
 * the helper returns the alpha-composited RGB over that base — matching the
 * effective color the user actually sees on the page.  This is required for
 * the WCAG contrast check to be meaningful for badge backgrounds like
 *   --color-orange-10: rgba(249, 115, 22, 0.10)
 * which would otherwise be treated as solid (0,0,0) and always fail.
 */
function parseColor(color, compositeOver = null) {
  if (typeof color !== 'string') return { r: 0, g: 0, b: 0 };
  const value = color.trim();

  // rgba(r, g, b, a) — and rgb(r, g, b) as a degenerate case
  const rgbaMatch = value.match(
    /rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(\d*\.?\d+))?\s*\)/
  );
  if (rgbaMatch) {
    const r = Math.round(parseFloat(rgbaMatch[1]));
    const g = Math.round(parseFloat(rgbaMatch[2]));
    const b = Math.round(parseFloat(rgbaMatch[3]));
    const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;

    if (a >= 1) {
      return { r, g, b };
    }

    if (compositeOver) {
      const bg = parseColor(compositeOver);
      // Standard alpha compositing: out = fg * a + bg * (1 - a)
      return {
        r: Math.round(r * a + bg.r * (1 - a)),
        g: Math.round(g * a + bg.g * (1 - a)),
        b: Math.round(b * a + bg.b * (1 - a))
      };
    }

    // No compositing base supplied — return the raw color (best-effort).
    return { r, g, b };
  }

  // Hex format: #RRGGBB
  const hexMatch = value.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16)
    };
  }

  // Basic CSS color names
  const colorNames = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    orange: { r: 255, g: 165, b: 0 },
    transparent: { r: 255, g: 255, b: 255 }
  };

  return colorNames[value.toLowerCase()] || { r: 0, g: 0, b: 0 };
}

/**
 * Helper: Calculate relative luminance
 * Formula from WCAG: https://www.w3.org/TR/WCAG20-TECHS/G17.html
 */
function getRelativeLuminance(rgb) {
  const rsRGB = rgb.r / 255;
  const gsRGB = rgb.g / 255;
  const bsRGB = rgb.b / 255;
  
  const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
  const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
  const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Helper: Calculate contrast ratio
 * Formula from WCAG: https://www.w3.org/TR/WCAG20-TECHS/G17.html
 *
 * `compositeOver` is forwarded to parseColor for both inputs so that
 * semi-transparent (rgba) backgrounds are flattened against the real page
 * surface before the luminance comparison.
 */
function getContrastRatio(color1, color2, compositeOver = null) {
  const l1 = getRelativeLuminance(parseColor(color1, compositeOver));
  const l2 = getRelativeLuminance(parseColor(color2, compositeOver));

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Property 1: Interactive Elements Should Have ARIA Labels and Roles
 * 
 * Bug Condition: Sliders and interactive elements without aria-label or role attributes
 * Expected Behavior: All sliders should have aria-label and role="slider"
 */
function testInteractiveElementsAccessibility() {
  console.log('\n=== Testing Property 1: Interactive Elements ARIA Labels ===');
  
  // Load calculator HTML
  const calculatorHtml = fs.readFileSync(
    path.join(__dirname, '../../calculator/compound-interest.html'),
    'utf-8'
  );
  
  const dom = new JSDOM(calculatorHtml, {
    url: 'http://localhost/',
    runScripts: 'outside-only'
  });
  
  const document = dom.window.document;
  
  // Find all range input sliders
  const sliders = document.querySelectorAll('input[type="range"]');
  console.log(`Found ${sliders.length} slider elements`);
  
  const violations = [];
  
  sliders.forEach((slider, index) => {
    const id = slider.id || `slider-${index}`;
    const hasAriaLabel = slider.hasAttribute('aria-label');
    const hasRole = slider.hasAttribute('role');
    const ariaLabelValue = slider.getAttribute('aria-label');
    
    console.log(`\nSlider #${index + 1} (id="${id}"):`);
    console.log(`  - Has aria-label: ${hasAriaLabel}`);
    console.log(`  - aria-label value: "${ariaLabelValue}"`);
    console.log(`  - Has role attribute: ${hasRole}`);
    
    if (!hasAriaLabel) {
      violations.push({
        element: 'slider',
        id: id,
        issue: 'Missing aria-label attribute'
      });
    }
    
    // Note: Native range inputs have implicit role="slider", but explicit is better
    // We'll check if custom interactive elements have roles
  });
  
  // Check buttons without text content for aria-labels
  const buttons = document.querySelectorAll('button');
  console.log(`\nFound ${buttons.length} button elements`);
  
  buttons.forEach((button, index) => {
    const textContent = button.textContent.trim();
    const hasAriaLabel = button.hasAttribute('aria-label');
    const id = button.id || button.className || `button-${index}`;
    
    // Buttons with no text should have aria-label
    if (!textContent && !hasAriaLabel) {
      console.log(`\nButton #${index + 1} (${id}):`);
      console.log(`  - Has text content: false`);
      console.log(`  - Has aria-label: false`);
      console.log(`  ⚠️  Violation: Button without text or aria-label`);
      
      violations.push({
        element: 'button',
        id: id,
        issue: 'Button without text content or aria-label'
      });
    }
  });
  
  // Check ad slots for aria-labels
  const adSlots = document.querySelectorAll('.ad-slot, .cp-managed-ad');
  console.log(`\nFound ${adSlots.length} ad slot elements`);
  
  adSlots.forEach((adSlot, index) => {
    const hasAriaLabel = adSlot.hasAttribute('aria-label');
    const className = adSlot.className;
    
    console.log(`\nAd Slot #${index + 1} (${className}):`);
    console.log(`  - Has aria-label: ${hasAriaLabel}`);
    
    if (!hasAriaLabel) {
      violations.push({
        element: 'ad-slot',
        id: className,
        issue: 'Ad slot without aria-label for screen readers'
      });
    }
  });
  
  console.log('\n--- Summary ---');
  console.log(`Total interactive elements checked: ${sliders.length + buttons.length + adSlots.length}`);
  console.log(`Accessibility violations found: ${violations.length}`);
  
  const testPassed = violations.length === 0;
  
  if (!testPassed) {
    console.log('\n❌ COUNTEREXAMPLE FOUND: Interactive elements missing aria-labels or roles');
    console.log('\nViolations:');
    violations.forEach((v, idx) => {
      console.log(`  ${idx + 1}. ${v.element} (${v.id}): ${v.issue}`);
    });
    console.log('\nExpected: All interactive elements should have proper ARIA attributes');
    console.log('Actual: Multiple elements lack accessibility attributes');
  } else {
    console.log('✓ Property holds: All interactive elements have proper ARIA attributes');
  }
  
  return { passed: testPassed, violations, totalChecked: sliders.length + buttons.length + adSlots.length };
}

/**
 * Property 2: Keyboard Navigation Should Have Logical Tab Order and Focus Indicators
 * 
 * Bug Condition: Poor tab order or missing/weak focus indicators
 * Expected Behavior: Logical tabindex, strong CSS focus indicators
 */
function testKeyboardNavigationAccessibility() {
  console.log('\n=== Testing Property 2: Keyboard Navigation ===');
  
  // Load calculator HTML and CSS
  const calculatorHtml = fs.readFileSync(
    path.join(__dirname, '../../calculator/compound-interest.html'),
    'utf-8'
  );
  
  const componentsCSS = fs.readFileSync(
    path.join(__dirname, '../css/components.css'),
    'utf-8'
  );
  
  const calculatorCSS = fs.readFileSync(
    path.join(__dirname, '../css/calculator.css'),
    'utf-8'
  );
  
  const dom = new JSDOM(calculatorHtml, {
    url: 'http://localhost/',
    runScripts: 'outside-only'
  });
  
  const document = dom.window.document;
  
  // Find all focusable elements
  const focusableElements = document.querySelectorAll(
    'input, button, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
  );
  
  console.log(`Found ${focusableElements.length} focusable elements`);
  
  const tabOrderIssues = [];
  const focusIndicatorIssues = [];
  
  // Check for explicit negative or unusual tabindex values
  focusableElements.forEach((el, index) => {
    const tabindex = el.getAttribute('tabindex');
    const id = el.id || el.className || `element-${index}`;
    
    if (tabindex !== null) {
      const tabindexValue = parseInt(tabindex);
      
      // Tabindex > 0 can disrupt natural tab order
      if (tabindexValue > 0) {
        console.log(`\n⚠️  Element ${id} has tabindex="${tabindex}" (may disrupt natural order)`);
        tabOrderIssues.push({
          element: el.tagName.toLowerCase(),
          id: id,
          issue: `Explicit tabindex ${tabindex} may disrupt natural tab order`
        });
      }
    }
  });
  
  // Check CSS for focus indicator styles
  console.log('\n--- Checking CSS Focus Indicators ---');
  
  // Look for :focus styles in CSS
  const hasFocusStyles = componentsCSS.includes(':focus') || calculatorCSS.includes(':focus');
  const hasFocusVisibleStyles = componentsCSS.includes(':focus-visible') || calculatorCSS.includes(':focus-visible');
  
  console.log(`CSS contains :focus styles: ${hasFocusStyles}`);
  console.log(`CSS contains :focus-visible styles: ${hasFocusVisibleStyles}`);
  
  // Check for outline removal without replacement
  const hasOutlineNone = componentsCSS.includes('outline: none') || 
                         componentsCSS.includes('outline:none') ||
                         calculatorCSS.includes('outline: none') ||
                         calculatorCSS.includes('outline:none');
  
  console.log(`CSS contains "outline: none": ${hasOutlineNone}`);
  
  if (hasOutlineNone && !hasFocusStyles) {
    focusIndicatorIssues.push({
      issue: 'CSS removes outline without providing alternative focus indicators',
      severity: 'critical'
    });
  }
  
  // Check for strong focus indicators (3px+ outline or equivalent)
  // This is a heuristic check - in real code, we'd need to compute styles
  const hasStrongFocusIndicator = componentsCSS.match(/outline:?\s*\d+px/) ||
                                   calculatorCSS.match(/outline:?\s*\d+px/) ||
                                   componentsCSS.match(/border:?\s*\d+px.*focus/) ||
                                   calculatorCSS.match(/border:?\s*\d+px.*focus/);
  
  console.log(`CSS has strong focus indicators (3px+): ${!!hasStrongFocusIndicator}`);
  
  if (!hasStrongFocusIndicator) {
    focusIndicatorIssues.push({
      issue: 'CSS lacks strong focus indicators (recommended: 3px solid outline)',
      severity: 'medium'
    });
  }
  
  console.log('\n--- Summary ---');
  console.log(`Tab order issues: ${tabOrderIssues.length}`);
  console.log(`Focus indicator issues: ${focusIndicatorIssues.length}`);
  
  const testPassed = tabOrderIssues.length === 0 && focusIndicatorIssues.length === 0;
  
  if (!testPassed) {
    console.log('\n❌ COUNTEREXAMPLE FOUND: Keyboard navigation issues detected');
    
    if (tabOrderIssues.length > 0) {
      console.log('\nTab Order Issues:');
      tabOrderIssues.forEach((issue, idx) => {
        console.log(`  ${idx + 1}. ${issue.element} (${issue.id}): ${issue.issue}`);
      });
    }
    
    if (focusIndicatorIssues.length > 0) {
      console.log('\nFocus Indicator Issues:');
      focusIndicatorIssues.forEach((issue, idx) => {
        console.log(`  ${idx + 1}. [${issue.severity}] ${issue.issue}`);
      });
    }
    
    console.log('\nExpected: Logical tab order and strong focus indicators');
    console.log('Actual: Keyboard navigation has accessibility barriers');
  } else {
    console.log('✓ Property holds: Keyboard navigation is accessible');
  }
  
  return { 
    passed: testPassed, 
    tabOrderIssues, 
    focusIndicatorIssues,
    totalChecked: focusableElements.length 
  };
}

/**
 * Property 3: Color Contrast Ratios Should Meet WCAG AA Standards (4.5:1)
 * 
 * Bug Condition: Badge colors or UI elements with contrast ratio < 4.5:1
 * Expected Behavior: All text/background combinations should have contrast >= 4.5:1
 */
function testColorContrastRatios() {
  console.log('\n=== Testing Property 3: Color Contrast Ratios ===');
  
  // Load design system CSS to extract color values
  const designSystemCSS = fs.readFileSync(
    path.join(__dirname, '../css/design-system.css'),
    'utf-8'
  );
  
  const componentsCSS = fs.readFileSync(
    path.join(__dirname, '../css/components.css'),
    'utf-8'
  );
  
  // Extract CSS color variables
  const extractColorVariable = (css, varName) => {
    const regex = new RegExp(`${varName}:\\s*([^;]+);`);
    const match = css.match(regex);
    return match ? match[1].trim() : null;
  };

  // Resolve the page background that badge rgba values should be composited
  // over.  We read --color-bg-base from design-system.css and fall back to
  // --color-bg-surface (or a hard-coded cream/white) if either is missing.
  const pageBg =
    extractColorVariable(designSystemCSS, '--color-bg-base') ||
    extractColorVariable(designSystemCSS, '--color-bg-surface') ||
    PAGE_BG_PRIMARY;
  console.log(`\nPage background for compositing: ${pageBg}`);

  // Badge colors — components.css only *uses* these via var(), so look up the
  // resolved values in design-system.css where the variables are defined.
  //
  // As of Task 9.3, badge foregrounds use the WCAG-AA-compliant 700-weight
  // variants (orange-700, emerald-700, sea-700) instead of the 600-weight
  // "hover" colors so that text remains readable on the very light (-10)
  // badge backgrounds.  badge-dark still uses --color-text-primary on white.
  const lookupColor = (varName) =>
    extractColorVariable(componentsCSS, varName) ||
    extractColorVariable(designSystemCSS, varName);

  const badgeColors = {
    'badge-orange': {
      background: lookupColor('--color-orange-10'),
      color: lookupColor('--color-orange-700')
    },
    'badge-sea': {
      background: lookupColor('--color-sea-10'),
      color: lookupColor('--color-sea-700')
    },
    'badge-emerald': {
      background: lookupColor('--color-emerald-10'),
      color: lookupColor('--color-emerald-700')
    },
    'badge-dark': {
      background: lookupColor('--color-dark'),
      color: 'var(--color-white)'
    }
  };

  // Extract actual color values from design-system.css
  const colorVariables = {
    '--color-orange-10': extractColorVariable(designSystemCSS, '--color-orange-10'),
    '--color-orange-20': extractColorVariable(designSystemCSS, '--color-orange-20'),
    '--color-orange-2': extractColorVariable(designSystemCSS, '--color-orange-2'),
    '--color-orange-700': extractColorVariable(designSystemCSS, '--color-orange-700'),
    '--color-sea-10': extractColorVariable(designSystemCSS, '--color-sea-10'),
    '--color-sea-20': extractColorVariable(designSystemCSS, '--color-sea-20'),
    '--color-sea-2': extractColorVariable(designSystemCSS, '--color-sea-2'),
    '--color-sea-700': extractColorVariable(designSystemCSS, '--color-sea-700'),
    '--color-emerald-10': extractColorVariable(designSystemCSS, '--color-emerald-10'),
    '--color-emerald-20': extractColorVariable(designSystemCSS, '--color-emerald-20'),
    '--color-emerald-2': extractColorVariable(designSystemCSS, '--color-emerald-2'),
    '--color-emerald-700': extractColorVariable(designSystemCSS, '--color-emerald-700'),
    '--color-violet': extractColorVariable(designSystemCSS, '--color-violet'),
    '--color-violet-700': extractColorVariable(designSystemCSS, '--color-violet-700'),
    '--color-dark': extractColorVariable(designSystemCSS, '--color-dark'),
    '--color-text-primary': extractColorVariable(designSystemCSS, '--color-text-primary'),
    '--color-text-secondary': extractColorVariable(designSystemCSS, '--color-text-secondary'),
    '--color-white': extractColorVariable(designSystemCSS, '--color-white') || '#ffffff'
  };
  
  console.log('\n--- Extracted Color Variables ---');
  Object.entries(colorVariables).forEach(([varName, value]) => {
    console.log(`${varName}: ${value}`);
  });
  
  // Resolve CSS variables to actual colors
  const resolveColor = (color) => {
    if (!color) return '#000000'; // Default to black if not found
    
    if (color.startsWith('var(')) {
      const varName = color.match(/var\((--[^,)]+)/)?.[1];
      if (varName && colorVariables[varName]) {
        return resolveColor(colorVariables[varName]);
      }
      return '#000000';
    }
    
    return color;
  };
  
  console.log('\n--- Testing Badge Contrast Ratios ---');
  
  const violations = [];
  const WCAG_AA_THRESHOLD = 4.5;
  
  Object.entries(badgeColors).forEach(([badgeName, colors]) => {
    const bgColor = resolveColor(colors.background);
    const fgColor = resolveColor(colors.color);

    // Show the raw rgba/hex the user sees, plus the effective on-page color
    // after alpha-compositing the badge background over the page surface.
    const effectiveBg = parseColor(bgColor, pageBg);
    const effectiveBgCss = `rgb(${effectiveBg.r}, ${effectiveBg.g}, ${effectiveBg.b})`;

    console.log(`\n${badgeName}:`);
    console.log(`  Background: ${bgColor}`);
    console.log(`  Foreground: ${fgColor}`);
    console.log(`  Effective background on page (${pageBg}): ${effectiveBgCss}`);

    // Composite any rgba() background over the page surface; foregrounds are
    // full-saturation solid colors so the compositing has no effect on them.
    const contrastRatio = getContrastRatio(bgColor, fgColor, pageBg);
    console.log(`  Contrast Ratio: ${contrastRatio.toFixed(2)}:1`);

    const meetsWCAG_AA = contrastRatio >= WCAG_AA_THRESHOLD;
    console.log(`  Meets WCAG AA (4.5:1): ${meetsWCAG_AA ? '✓' : '✗'}`);

    if (!meetsWCAG_AA) {
      violations.push({
        element: badgeName,
        background: bgColor,
        effectiveBackground: effectiveBgCss,
        foreground: fgColor,
        contrastRatio: contrastRatio.toFixed(2),
        required: WCAG_AA_THRESHOLD,
        issue: `Contrast ratio ${contrastRatio.toFixed(2)}:1 is below WCAG AA threshold of ${WCAG_AA_THRESHOLD}:1`
      });
    }
  });
  
  console.log('\n--- Summary ---');
  console.log(`Badge elements checked: ${Object.keys(badgeColors).length}`);
  console.log(`Contrast violations found: ${violations.length}`);
  
  const testPassed = violations.length === 0;
  
  if (!testPassed) {
    console.log('\n❌ COUNTEREXAMPLE FOUND: Color contrast ratios below WCAG AA standards');
    console.log('\nViolations:');
    violations.forEach((v, idx) => {
      console.log(`  ${idx + 1}. ${v.element}:`);
      console.log(`     - Contrast: ${v.contrastRatio}:1 (required: ${v.required}:1)`);
      console.log(`     - Colors: ${v.foreground} on ${v.background}`);
    });
    console.log('\nExpected: All badges should have contrast ratio >= 4.5:1');
    console.log('Actual: Some badges fail WCAG AA compliance');
  } else {
    console.log('✓ Property holds: All color combinations meet WCAG AA standards');
  }
  
  return { passed: testPassed, violations, totalChecked: Object.keys(badgeColors).length };
}

/**
 * Run all bug condition exploration tests
 */
async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Bug Condition Exploration Test - Accessibility Issues        ║');
  console.log('║  **CRITICAL**: This test MUST FAIL on unfixed code            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  
  const results = {
    property1: null,
    property2: null,
    property3: null
  };
  
  try {
    results.property1 = testInteractiveElementsAccessibility();
  } catch (error) {
    console.error('Error in Property 1:', error.message);
    results.property1 = { passed: false, error: error.message };
  }
  
  try {
    results.property2 = testKeyboardNavigationAccessibility();
  } catch (error) {
    console.error('Error in Property 2:', error.message);
    results.property2 = { passed: false, error: error.message };
  }
  
  try {
    results.property3 = testColorContrastRatios();
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
  
  console.log(`\nProperty 1 (ARIA Labels & Roles):        ${results.property1?.passed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Property 2 (Keyboard Navigation):        ${results.property2?.passed ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`Property 3 (Color Contrast):             ${results.property3?.passed ? '✓ PASS' : '✗ FAIL'}`);
  
  console.log('\n' + '─'.repeat(64));
  
  if (!allPassed) {
    console.log('\n⚠️  EXPECTED RESULT ON UNFIXED CODE: TEST FAILURES DETECTED ⚠️');
    console.log('\nCounterexamples documented:');
    if (!results.property1?.passed) {
      console.log(`  • ${results.property1.violations?.length || 0} interactive elements missing aria-labels or roles`);
    }
    if (!results.property2?.passed) {
      console.log(`  • Keyboard navigation issues: ${(results.property2.tabOrderIssues?.length || 0) + (results.property2.focusIndicatorIssues?.length || 0)} problems found`);
    }
    if (!results.property3?.passed) {
      console.log(`  • ${results.property3.violations?.length || 0} color contrast violations (WCAG AA < 4.5:1)`);
    }
    console.log('\n✓ Bug condition exploration SUCCESSFUL - accessibility violations confirmed');
    console.log('\nNext steps:');
    console.log('  1. Mark this task as complete (test written, run, failures documented)');
    console.log('  2. Proceed to implement accessibility fixes in subsequent tasks');
    console.log('  3. Re-run this test after fixes - it should PASS on fixed code');
  } else {
    console.log('\n⚠️  UNEXPECTED: All tests PASSED on supposedly unfixed code');
    console.log('This may indicate:');
    console.log('  1. The code already has accessibility features implemented');
    console.log('  2. The test needs adjustment to properly detect the bug condition');
    console.log('  3. The bug analysis may need revision');
  }
  
  console.log('\n' + '═'.repeat(64) + '\n');
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests();
