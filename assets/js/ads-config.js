/**
 * Ad Configuration - CompoundPro
 * 
 * This file centralizes all ad-related configuration for future implementation.
 * Currently, the ad system is disabled (enabled: false).
 * 
 * USAGE:
 * ------
 * When ready to enable ads:
 * 1. Set `enabled: true`
 * 2. Choose a network: 'adsense', 'ezoic', 'mediavine', etc.
 * 3. Set your publisherId from the ad network
 * 4. Define ad slot placements in the `adSlots` array
 * 5. Update HTML pages to include ad slot divs with matching IDs
 * 6. Update AdsManager in ads.js to use this config
 * 
 * EXAMPLE HTML AD SLOT:
 * ----------------------
 * <div class="ad-slot" 
 *      id="ad-header" 
 *      data-ad-position="after-body"
 *      data-ad-size="responsive"
 *      aria-label="Advertisement">
 * </div>
 * 
 * AD NETWORKS:
 * ------------
 * - AdSense: Google's display ad network (good for beginners)
 * - Ezoic: AI-optimized ad placements (requires 10k+ monthly visits)
 * - Mediavine: Premium network (requires 50k+ monthly sessions)
 * - AdThrive: Premium network (requires 100k+ monthly pageviews)
 */

const AdsConfig = {
  /**
   * Master switch for the ad system
   * Set to true when ready to display ads
   */
  enabled: false,

  /**
   * Ad network provider
   * Options: 'adsense' | 'ezoic' | 'mediavine' | 'adthrive' | null
   */
  network: null,

  /**
   * Publisher ID from your ad network
   * AdSense format: 'ca-pub-XXXXXXXXXXXXXXXX'
   */
  publisherId: null,

  /**
   * Ad slot placements configuration
   * Define where ads should appear across the site
   * 
   * Slot properties:
   * - id: Unique identifier matching HTML element ID
   * - position: Descriptive location ('header', 'sidebar', 'footer', etc.)
   * - size: Ad dimensions ('responsive', '728x90', '300x250', '160x600', etc.)
   * - pages: Array of page patterns where this slot should appear
   *          Use '*' for all pages, or specific patterns like '/calculator/*'
   */
  adSlots: [
    // Example: Header banner (leaderboard)
    // {
    //   id: 'ad-header',
    //   position: 'after-body',
    //   size: 'responsive', // Or '728x90' for desktop, '320x50' for mobile
    //   pages: ['*'] // Appears on all pages
    // },

    // Example: Sidebar ad (skyscraper)
    // {
    //   id: 'ad-sidebar',
    //   position: 'right-rail',
    //   size: '160x600',
    //   pages: ['/blog/*', '/learn/*'] // Only blog and learn sections
    // },

    // Example: In-content ad (rectangle)
    // {
    //   id: 'ad-content',
    //   position: 'main-start',
    //   size: '300x250',
    //   pages: ['/calculator/*'] // Only calculator pages
    // },

    // Example: Footer ad
    // {
    //   id: 'ad-footer',
    //   position: 'before-footer',
    //   size: 'responsive',
    //   pages: ['*']
    // }
  ],

  /**
   * Ad loading strategy
   * Options:
   * - 'immediate': Load ads as soon as DOM is ready
   * - 'lazy': Load ads when they enter viewport (better for performance)
   * - 'delayed': Load ads after X milliseconds (reduces impact on page speed)
   */
  loadingStrategy: 'lazy',

  /**
   * Delay in milliseconds for 'delayed' strategy
   */
  loadDelay: 3000,

  /**
   * Whether to show placeholder while ads are loading
   */
  showPlaceholder: true,

  /**
   * CSS class for ad containers
   */
  adContainerClass: 'ad-slot',

  /**
   * Whether to log ad-related events to console (useful for debugging)
   */
  debug: false
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdsConfig;
}

// Make available globally
window.AdsConfig = AdsConfig;

