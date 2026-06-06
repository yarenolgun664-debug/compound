/**
 * Multi-Ad-Network Dormant Advertising Infrastructure
 * Version: 1.0.0
 * 
 * CRITICAL: enabled: false → Zero overhead, zero DOM changes, zero network requests
 * Activation: Set enabled: true (6 months from now)
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════
  // CONFIG
  // ═══════════════════════════════════════════════════════════════════════

  window.AD_CONFIG = {
    // ── MAIN SWITCH ────────────────────────────────────────────────────
    enabled: false,  // ← 6 months later: set to true

    // ── ACTIVE NETWORK ─────────────────────────────────────────────────
    // Supported: 'adsense' | 'ezoic' | 'mediavine' | 'adthrive' | 'amazon'
    //           | 'taboola' | 'outbrain' | 'sovrn' | 'custom' | 'house'
    network: 'adsense',

    // ── CSS SELECTORS (update if theme changes) ───────────────────────
    selectors: {
      navbar:   '.navbar, #navbar-placeholder',  // Support both direct navbar and component placeholder
      article:  '.article-content',
      footer:   'footer, #footer-placeholder'
    },

    // ── PROVIDER CREDENTIALS ───────────────────────────────────────────
    adsense: {
      client: 'ca-pub-XXXXXXXXXXXXXXXX',
      slots: {
        'navbar-bottom': '',
        'post-top':      '',
        'post-middle':   '',
        'footer-top':    ''
      }
    },

    ezoic: {
      accountId: '',
      placeholderIds: {
        'navbar-bottom': '',
        'post-top':      '',
        'post-middle':   '',
        'footer-top':    ''
      }
    },

    mediavine: {
      site: ''
    },

    adthrive: {
      siteId: ''
    },

    amazon: {
      tag: 'yourtag-20',
      region: 'US'  // 'US' | 'UK' | 'DE' | 'JP'
    },

    taboola: {
      publisherId: '',
      widgetId: ''
    },

    outbrain: {
      widgetId: ''
    },

    sovrn: {
      uid: ''
    },

    custom: {
      html: ''  // Direct HTML ad code
    },

    house: {
      // House ads - for local testing and fill rate
      'navbar-bottom': '',
      'post-top':      '',
      'post-middle':   '',
      'footer-top':    ''
    },

    // ── SLOT CONFIGURATION ─────────────────────────────────────────────
    slotConfig: {
      'navbar-bottom': {
        enabled:   true,
        types:     ['display'],
        minHeight: 90,      // px (applied when enabled: true)
        priority:  1        // lower = load first
      },
      'post-top': {
        enabled:   true,
        types:     ['in-article'],
        minHeight: 280,
        priority:  2
      },
      'post-middle': {
        enabled:   true,
        types:     ['in-article'],
        minHeight: 280,
        priority:  3
      },
      'footer-top': {
        enabled:   true,
        types:     ['display'],
        minHeight: 250,
        priority:  4
      }
    },

    // ── PRIVACY SETTINGS ───────────────────────────────────────────────
    privacy: {
      respectDNT:         true,   // navigator.doNotTrack === "1"
      requireGDPRConsent: true,   // check window.gdprConsent
      gdprConsentVar:     'gdprConsent'
    },

    // ── ADVANCED SETTINGS ──────────────────────────────────────────────
    advanced: {
      lazyLoadMargin: '200px 0px',  // IntersectionObserver rootMargin
      noFillTimeout:  3000,          // ms - no-fill detection timeout
      debug:          false          // true → log slot names
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RUNTIME
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * STEP 1: Privacy Guard
   * Exit early if DNT or GDPR consent not given
   */
  function checkPrivacy() {
    var config = window.AD_CONFIG;
    
    if (config.privacy.respectDNT && navigator.doNotTrack === '1') {
      return false;
    }

    if (config.privacy.requireGDPRConsent) {
      var consentVar = config.privacy.gdprConsentVar;
      if (!window[consentVar]) {
        return false;
      }
    }

    return true;
  }

  /**
   * STEP 2: Enabled Check
   * CRITICAL: If disabled, exit immediately with ZERO side effects
   */
  function init() {
    var config = window.AD_CONFIG;

    // RULE-1: Disabled Mode — Absolute Silence
    if (!config.enabled) {
      // No console.log, no DOM changes, no network requests
      return;
    }

    // Privacy check
    if (!checkPrivacy()) {
      return;
    }

    // Continue with ad loading
    loadProvider();
  }

  /**
   * STEP 3: Provider Loader (Dynamic Script Injection)
   */
  function loadProvider() {
    var config = window.AD_CONFIG;
    var network = config.network;

    try {
      switch (network) {
        case 'adsense':
          loadScript('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + config.adsense.client, function() {
            initSlots();
          });
          break;

        case 'ezoic':
          loadScript('https://go.ezodn.com/ezoic-init.js', function() {
            initSlots();
          });
          break;

        case 'mediavine':
          if (config.mediavine.site) {
            loadScript('https://scripts.mediavine.com/tags/' + config.mediavine.site + '/header.js', function() {
              initSlots();
            });
          }
          break;

        case 'adthrive':
          if (config.adthrive.siteId) {
            loadScript('https://ads.adthrive.com/sites/' + config.adthrive.siteId + '/ads.min.js', function() {
              initSlots();
            });
          }
          break;

        case 'amazon':
          loadScript('https://z-na.amazon-adsystem.com/widgets/onejs?MarketPlace=' + config.amazon.region, function() {
            initSlots();
          });
          break;

        case 'taboola':
          if (config.taboola.publisherId) {
            loadScript('https://cdn.taboola.com/libtrc/' + config.taboola.publisherId + '/loader.js', function() {
              initSlots();
            });
          }
          break;

        case 'outbrain':
          loadScript('https://widgets.outbrain.com/outbrain.js', function() {
            initSlots();
          });
          break;

        case 'sovrn':
          if (config.sovrn.uid) {
            loadScript('https://ap.lijit.com/www/delivery/fpi.js?z=' + config.sovrn.uid, function() {
              initSlots();
            });
          }
          break;

        case 'custom':
        case 'house':
          // No external script, direct HTML injection
          initSlots();
          break;

        default:
          if (config.advanced.debug) {
            console.warn('[Ads] Unknown network:', network);
          }
      }
    } catch (e) {
      if (config.advanced.debug) {
        console.warn('[Ads] Provider load error:', e);
      }
    }
  }

  /**
   * Load external script dynamically
   */
  function loadScript(src, callback) {
    var script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;

    script.onload = function() {
      if (callback) callback();
    };

    script.onerror = function() {
      if (window.AD_CONFIG.advanced.debug) {
        console.warn('[Ads] Script load failed:', src);
      }
    };

    document.head.appendChild(script);
  }

  /**
   * STEP 4: Slot Positioning
   * Auto-detect positions based on DOM selectors
   */
  function initSlots() {
    var config = window.AD_CONFIG;
    var slotConfig = config.slotConfig;

    // Sort slots by priority
    var slots = Object.keys(slotConfig).sort(function(a, b) {
      return slotConfig[a].priority - slotConfig[b].priority;
    });

    slots.forEach(function(slotName) {
      var slot = slotConfig[slotName];

      // Skip if disabled
      if (!slot.enabled) {
        return;
      }

      try {
        var targetElement = findSlotPosition(slotName);
        
        if (targetElement) {
          createSlotWrapper(slotName, targetElement);
        } else {
          if (config.advanced.debug) {
            console.warn('[Ads] Position not found for slot:', slotName);
          }
        }
      } catch (e) {
        if (config.advanced.debug) {
          console.warn('[Ads] Slot init error:', slotName, e);
        }
      }
    });
  }

  /**
   * Find DOM position for each slot
   */
  function findSlotPosition(slotName) {
    var config = window.AD_CONFIG;
    var selectors = config.selectors;

    switch (slotName) {
      case 'navbar-bottom':
        return document.querySelector(selectors.navbar);

      case 'post-top':
        return document.querySelector(selectors.article);

      case 'post-middle':
        // Find 3rd <h2> inside article
        var article = document.querySelector(selectors.article);
        if (article) {
          var headings = article.querySelectorAll('h2');
          return headings[2] || headings[1] || null; // Fallback to 2nd or skip
        }
        return null;

      case 'footer-top':
        return document.querySelector(selectors.footer);

      default:
        return null;
    }
  }

  /**
   * Create slot wrapper with lazy loading
   */
  function createSlotWrapper(slotName, targetElement) {
    var config = window.AD_CONFIG;
    var slot = config.slotConfig[slotName];

    // Create wrapper
    var wrapper = document.createElement('div');
    wrapper.className = 'ad-slot-wrapper';
    wrapper.setAttribute('data-slot', slotName);
    wrapper.style.minHeight = slot.minHeight + 'px';
    wrapper.style.margin = '20px 0';
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignItems = 'center';

    // Insert into DOM
    if (slotName === 'navbar-bottom') {
      targetElement.insertAdjacentElement('afterend', wrapper);
    } else if (slotName === 'post-top') {
      targetElement.insertAdjacentElement('afterbegin', wrapper);
    } else if (slotName === 'post-middle') {
      targetElement.insertAdjacentElement('afterend', wrapper);
    } else if (slotName === 'footer-top') {
      targetElement.insertAdjacentElement('beforebegin', wrapper);
    }

    // STEP 5: Lazy Loading with IntersectionObserver
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            renderAd(slotName, wrapper);
            observer.unobserve(entry.target);
          }
        });
      }, {
        rootMargin: config.advanced.lazyLoadMargin
      });

      observer.observe(wrapper);
    } else {
      // Fallback: Load immediately
      renderAd(slotName, wrapper);
    }
  }

  /**
   * STEP 6: Render Ad (Provider-specific)
   */
  function renderAd(slotName, wrapper) {
    var config = window.AD_CONFIG;
    var network = config.network;

    try {
      switch (network) {
        case 'adsense':
          renderAdSense(slotName, wrapper);
          break;

        case 'ezoic':
          renderEzoic(slotName, wrapper);
          break;

        case 'mediavine':
          renderMediavine(slotName, wrapper);
          break;

        case 'adthrive':
          renderAdThrive(slotName, wrapper);
          break;

        case 'amazon':
          renderAmazon(slotName, wrapper);
          break;

        case 'taboola':
          renderTaboola(slotName, wrapper);
          break;

        case 'outbrain':
          renderOutbrain(slotName, wrapper);
          break;

        case 'sovrn':
          renderSovrn(slotName, wrapper);
          break;

        case 'custom':
          renderCustom(slotName, wrapper);
          break;

        case 'house':
          renderHouse(slotName, wrapper);
          break;

        default:
          hideSlot(wrapper);
      }
    } catch (e) {
      if (config.advanced.debug) {
        console.warn('[Ads] Render error:', slotName, e);
      }
      hideSlot(wrapper);
    }
  }

  /**
   * AdSense Renderer
   */
  function renderAdSense(slotName, wrapper) {
    var config = window.AD_CONFIG;
    var slotId = config.adsense.slots[slotName];

    if (!slotId) {
      hideSlot(wrapper);
      return;
    }

    var ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', config.adsense.client);
    ins.setAttribute('data-ad-slot', slotId);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');

    wrapper.appendChild(ins);

    // Push to AdSense
    (window.adsbygoogle = window.adsbygoogle || []).push({});

    // STEP 6: No-Fill Detection
    setTimeout(function() {
      if (ins.offsetHeight === 0) {
        hideSlot(wrapper);
      }
    }, config.advanced.noFillTimeout);
  }

  /**
   * Ezoic Renderer
   */
  function renderEzoic(slotName, wrapper) {
    var config = window.AD_CONFIG;
    var placeholderId = config.ezoic.placeholderIds[slotName];

    if (!placeholderId) {
      hideSlot(wrapper);
      return;
    }

    var div = document.createElement('div');
    div.id = 'ezoic-pub-ad-placeholder-' + placeholderId;
    wrapper.appendChild(div);

    // Ezoic auto-fills placeholders
    setTimeout(function() {
      if (div.offsetHeight === 0) {
        hideSlot(wrapper);
      }
    }, config.advanced.noFillTimeout);
  }

  /**
   * Mediavine Renderer
   */
  function renderMediavine(slotName, wrapper) {
    // Mediavine auto-inserts ads, just provide container
    var div = document.createElement('div');
    div.className = 'mediavine-ad';
    div.setAttribute('data-slot', slotName);
    wrapper.appendChild(div);

    setTimeout(function() {
      if (div.offsetHeight === 0) {
        hideSlot(wrapper);
      }
    }, window.AD_CONFIG.advanced.noFillTimeout);
  }

  /**
   * AdThrive Renderer
   */
  function renderAdThrive(slotName, wrapper) {
    // AdThrive auto-manages ad placement
    var div = document.createElement('div');
    div.className = 'adthrive-ad';
    div.setAttribute('data-slot', slotName);
    wrapper.appendChild(div);

    setTimeout(function() {
      if (div.offsetHeight === 0) {
        hideSlot(wrapper);
      }
    }, window.AD_CONFIG.advanced.noFillTimeout);
  }

  /**
   * Amazon Renderer
   */
  function renderAmazon(slotName, wrapper) {
    var config = window.AD_CONFIG;
    
    var div = document.createElement('div');
    div.id = 'amzn-assoc-ad-' + slotName;
    wrapper.appendChild(div);

    if (window.amzn_assoc_placement_id) {
      // Amazon native shopping ads rendering
      setTimeout(function() {
        if (div.offsetHeight === 0) {
          hideSlot(wrapper);
        }
      }, config.advanced.noFillTimeout);
    } else {
      hideSlot(wrapper);
    }
  }

  /**
   * Taboola Renderer
   */
  function renderTaboola(slotName, wrapper) {
    var config = window.AD_CONFIG;
    
    var div = document.createElement('div');
    div.id = 'taboola-' + slotName;
    wrapper.appendChild(div);

    if (window._taboola) {
      window._taboola.push({
        mode: 'thumbnails-a',
        container: div.id,
        placement: slotName,
        target_type: 'mix'
      });
    }

    setTimeout(function() {
      if (div.offsetHeight === 0) {
        hideSlot(wrapper);
      }
    }, config.advanced.noFillTimeout);
  }

  /**
   * Outbrain Renderer
   */
  function renderOutbrain(slotName, wrapper) {
    var config = window.AD_CONFIG;
    
    var div = document.createElement('div');
    div.className = 'OUTBRAIN';
    div.setAttribute('data-widget-id', config.outbrain.widgetId);
    wrapper.appendChild(div);

    setTimeout(function() {
      if (div.offsetHeight === 0) {
        hideSlot(wrapper);
      }
    }, config.advanced.noFillTimeout);
  }

  /**
   * Sovrn Renderer
   */
  function renderSovrn(slotName, wrapper) {
    var div = document.createElement('div');
    div.id = 'sovrn-' + slotName;
    wrapper.appendChild(div);

    setTimeout(function() {
      if (div.offsetHeight === 0) {
        hideSlot(wrapper);
      }
    }, window.AD_CONFIG.advanced.noFillTimeout);
  }

  /**
   * Custom HTML Renderer
   */
  function renderCustom(slotName, wrapper) {
    var config = window.AD_CONFIG;
    var html = config.custom.html;

    if (html) {
      wrapper.innerHTML = html;
    } else {
      hideSlot(wrapper);
    }
  }

  /**
   * House Ads Renderer
   */
  function renderHouse(slotName, wrapper) {
    var config = window.AD_CONFIG;
    var html = config.house[slotName];

    if (html) {
      wrapper.innerHTML = html;
    } else {
      hideSlot(wrapper);
    }
  }

  /**
   * Hide slot (no-fill or error)
   */
  function hideSlot(wrapper) {
    wrapper.style.minHeight = '0';
    wrapper.style.display = 'none';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
