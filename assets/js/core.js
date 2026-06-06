/**
 * CompoundPro - Core JavaScript Utilities and Controllers
 * Production-ready, ES6+, zero dependencies.
 */

// Global state / exports namespace
window.CompoundPro = window.CompoundPro || {};

// 1. NavbarController
const NavbarController = {
  init() {
    const navbar = document.querySelector('.navbar');
    const hamburger = document.querySelector('.navbar-hamburger');
    const navLinks = document.querySelector('.navbar-nav');
    const dropdowns = document.querySelectorAll('.has-dropdown');

    if (!navbar) return;

    // Task 7.2: Sticky background toggle on scroll
    // Requirement: FR8 - Navbar scroll state changes at scrollY > 50px
    // Changes: opacity, border, box-shadow with --ease-slow transition
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    });

    // Task 7.4: Mobile menu toggle with overlay backdrop
    // Requirements: FR8, FR12 - Hamburger menu with overlay backdrop
    if (hamburger && navLinks) {
      hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = navLinks.classList.toggle('open');
        hamburger.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', isOpen);
        
        // Lock/unlock body scroll
        if (isOpen) {
          document.body.style.overflow = 'hidden';
          // Create overlay backdrop
          const overlay = document.createElement('div');
          overlay.className = 'mobile-menu-overlay';
          overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.4);
            z-index: calc(var(--z-modal) - 1);
            animation: fadeIn 250ms ease forwards;
          `;
          overlay.addEventListener('click', () => {
            navLinks.classList.remove('open');
            hamburger.classList.remove('open');
            hamburger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
            overlay.remove();
          });
          document.body.appendChild(overlay);
        } else {
          document.body.style.overflow = '';
          const overlay = document.querySelector('.mobile-menu-overlay');
          if (overlay) overlay.remove();
        }
      });

      // Close mobile menu on clicking any link
      navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
          navLinks.classList.remove('open');
          hamburger.classList.remove('open');
          hamburger.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
          const overlay = document.querySelector('.mobile-menu-overlay');
          if (overlay) overlay.remove();
        });
      });
    }

    // Task 7.4: Dropdown and mobile menu close on outside click
    // Requirements: FR8 - Close menu on outside click or Escape key
    document.addEventListener('click', (e) => {
      if (navLinks && navLinks.classList.contains('open') && !navLinks.contains(e.target) && !hamburger.contains(e.target)) {
        navLinks.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        const overlay = document.querySelector('.mobile-menu-overlay');
        if (overlay) overlay.remove();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // Close dropdowns
        dropdowns.forEach(dropdown => {
          const menu = dropdown.querySelector('.navbar-dropdown');
          if (menu) menu.style.display = 'none';
        });
        // Close mobile navbar
        if (navLinks && navLinks.classList.contains('open')) {
          navLinks.classList.remove('open');
          hamburger.classList.remove('open');
          hamburger.setAttribute('aria-expanded', 'false');
          document.body.style.overflow = '';
          const overlay = document.querySelector('.mobile-menu-overlay');
          if (overlay) overlay.remove();
        }
      }
    });
  }
};

// 2. ScrollAnimationController
const ScrollAnimationController = {
  init() {
    const animatedElements = document.querySelectorAll('[data-animate]');
    if (animatedElements.length === 0) return;

    // Feature detection: Use IntersectionObserver if available, otherwise fallback to scroll listener
    if ('IntersectionObserver' in window) {
      this.initWithIntersectionObserver(animatedElements);
    } else {
      this.initWithScrollFallback(animatedElements);
    }
  },

  initWithIntersectionObserver(animatedElements) {
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -50px 0px',
      threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target); // Trigger once
        }
      });
    }, observerOptions);

    animatedElements.forEach(el => observer.observe(el));
  },

  initWithScrollFallback(animatedElements) {
    const checkVisibility = () => {
      const windowHeight = window.innerHeight;
      const scrollY = window.scrollY;

      animatedElements.forEach(el => {
        if (el.classList.contains('visible')) return; // Already animated

        const rect = el.getBoundingClientRect();
        const elementTop = rect.top + scrollY;
        const elementVisible = (rect.top < windowHeight - 50) && (rect.bottom > 0);

        if (elementVisible) {
          el.classList.add('visible');
        }
      });
    };

    // Check visibility on scroll and immediately
    window.addEventListener('scroll', checkVisibility, { passive: true });
    checkVisibility(); // Initial check
  }
};

// 3. CounterAnimation
const CounterAnimation = {
  init() {
    const counterElements = document.querySelectorAll('.stat-value[data-count]');
    if (counterElements.length === 0) return;

    // Feature detection: Use IntersectionObserver if available, otherwise fallback to scroll listener
    if ('IntersectionObserver' in window) {
      this.initWithIntersectionObserver(counterElements);
    } else {
      this.initWithScrollFallback(counterElements);
    }
  },

  initWithIntersectionObserver(counterElements) {
    const observerOptions = {
      root: null,
      threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseFloat(el.getAttribute('data-count')) || 0;
          const duration = parseInt(el.getAttribute('data-count-duration')) || 1500;
          const prefix = el.getAttribute('data-count-prefix') || '';
          const suffix = el.getAttribute('data-count-suffix') || '';
          const decimals = parseInt(el.getAttribute('data-count-decimals')) || 0;

          CounterAnimation.animateCounter(el, target, duration, prefix, suffix, decimals);
          obs.unobserve(el);
        }
      });
    }, observerOptions);

    counterElements.forEach(el => observer.observe(el));
  },

  initWithScrollFallback(counterElements) {
    const triggeredCounters = new Set();

    const checkVisibility = () => {
      const windowHeight = window.innerHeight;

      counterElements.forEach(el => {
        if (triggeredCounters.has(el)) return; // Already animated

        const rect = el.getBoundingClientRect();
        const elementVisible = (rect.top < windowHeight * 0.85) && (rect.bottom > 0);

        if (elementVisible) {
          const target = parseFloat(el.getAttribute('data-count')) || 0;
          const duration = parseInt(el.getAttribute('data-count-duration')) || 1500;
          const prefix = el.getAttribute('data-count-prefix') || '';
          const suffix = el.getAttribute('data-count-suffix') || '';
          const decimals = parseInt(el.getAttribute('data-count-decimals')) || 0;

          CounterAnimation.animateCounter(el, target, duration, prefix, suffix, decimals);
          triggeredCounters.add(el);
        }
      });
    };

    // Check visibility on scroll and immediately
    window.addEventListener('scroll', checkVisibility, { passive: true });
    checkVisibility(); // Initial check
  },

  animateCounter(element, targetValue, duration = 1500, prefix = '', suffix = '', decimals = 0) {
    let startTimestamp = null;
    const startValue = 0;

    // Cubic Ease-Out function
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easedProgress = easeOutCubic(progress);
      const currentValue = startValue + easedProgress * (targetValue - startValue);
      
      element.textContent = `${prefix}${formatter.format(currentValue)}${suffix}`;
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        element.textContent = `${prefix}${formatter.format(targetValue)}${suffix}`;
        element.classList.remove('counting');
      }
    };

    element.classList.add('counting');
    window.requestAnimationFrame(step);
  }
};

// 4. FAQAccordion
const FAQAccordion = {
  init() {
    const faqTriggers = document.querySelectorAll('.faq-trigger');
    
    faqTriggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.faq-item');
        const content = item.querySelector('.faq-content');
        const isExpanded = trigger.getAttribute('aria-expanded') === 'true';

        // Close other FAQ items
        const siblings = trigger.closest('.faq-list').querySelectorAll('.faq-item');
        siblings.forEach(sibling => {
          if (sibling !== item) {
            const siblingTrigger = sibling.querySelector('.faq-trigger');
            const siblingContent = sibling.querySelector('.faq-content');
            siblingTrigger.setAttribute('aria-expanded', 'false');
            siblingContent.classList.remove('open');
            siblingContent.style.maxHeight = '0px';
          }
        });

        // Toggle current item
        if (isExpanded) {
          trigger.setAttribute('aria-expanded', 'false');
          content.classList.remove('open');
          content.style.maxHeight = '0px';
        } else {
          trigger.setAttribute('aria-expanded', 'true');
          content.classList.add('open');
          content.style.maxHeight = content.scrollHeight + 'px';
        }
      });
    });
  }
};

// 5. SmoothScroll
const SmoothScroll = {
  init() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          e.preventDefault();
          const navbarHeight = 80;
          const targetPosition = targetEl.getBoundingClientRect().top + window.scrollY - navbarHeight;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  }
};

// 6. ModalController
const ModalController = {
  init() {
    // Overlay clicks close modals
    const overlays = document.querySelectorAll('.modal-overlay');
    overlays.forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          ModalController.closeModal(overlay.id);
        }
      });
    });

    // Close buttons close modals
    const closeBtns = document.querySelectorAll('.modal-close, [data-modal-close]');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.closest('.modal-overlay').id;
        ModalController.closeModal(modalId);
      });
    });

    // Keyboard ESC to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openOverlay = document.querySelector('.modal-overlay.open');
        if (openOverlay) {
          ModalController.closeModal(openOverlay.id);
        }
      }
    });
  },

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
      // If there are no other open modals, unlock scroll
      if (!document.querySelector('.modal-overlay.open')) {
        document.body.style.overflow = '';
      }
    }
  }
};

// Export modal methods to window for inline onclick attributes
window.openModal = ModalController.openModal;
window.closeModal = ModalController.closeModal;

// 7. ThemeController
const ThemeController = {
  init() {
    const savedTheme = localStorage.getItem('cp-theme') || 'light';
    const htmlElement = document.documentElement;

    if (savedTheme === 'dark') {
      htmlElement.classList.add('dark-mode');
    } else {
      htmlElement.classList.remove('dark-mode');
    }

    // Export theme toggle method
    window.toggleTheme = () => {
      const isDark = htmlElement.classList.toggle('dark-mode');
      try {
        localStorage.setItem('cp-theme', isDark ? 'dark' : 'light');
      } catch (e) {
        console.warn('[CompoundPro] Failed to save theme:', e);
        if (e.name === 'QuotaExceededError' && window.showToast) {
          window.showToast('Ayarlarınız kaydedilemedi', 'error');
        }
      }
    };
  }
};

// 7.1 CurrencyController
const CurrencyController = {
  init() {
    const savedCurrency = localStorage.getItem('cp-currency') || 'USD';
    const switcher = document.getElementById('currency-switcher');

    if (switcher) {
      switcher.value = savedCurrency;
      switcher.addEventListener('change', () => {
        const newCurrency = switcher.value;
        try {
          localStorage.setItem('cp-currency', newCurrency);
          // Dispatch custom event to notify calculators to re-render
          const event = new CustomEvent("currencyChanged", { detail: newCurrency });
          document.dispatchEvent(event);
        } catch (e) {
          console.warn('[CompoundPro] Failed to save currency:', e);
          if (e.name === 'QuotaExceededError' && window.showToast) {
            window.showToast('Ayarlarınız kaydedilemedi', 'error');
          }
        }
      });
    }
  }
};

// Export formatting utility immediately to prevent race conditions
window.CompoundPro = window.CompoundPro || {};
window.CompoundPro.getActiveCurrency = () => {
  try {
    return localStorage.getItem('cp-currency') || 'USD';
  } catch (e) {
    return 'USD';
  }
};
window.CompoundPro.formatCurrency = (value) => {
  const active = window.CompoundPro.getActiveCurrency();
  let locale = 'en-US';
  if (active === 'EUR') locale = 'de-DE';
  if (active === 'TRY') locale = 'tr-TR';
  if (active === 'JPY') locale = 'ja-JP';
  if (active === 'GBP') locale = 'en-GB';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: active,
    maximumFractionDigits: 0
  }).format(value);
};

window.CompoundPro.getCurrencyPrefixSuffix = () => {
  const active = window.CompoundPro.getActiveCurrency();
  switch (active) {
    case 'EUR': return { prefix: '', suffix: ' €' };
    case 'TRY': return { prefix: '', suffix: ' ₺' };
    case 'GBP': return { prefix: '£', suffix: '' };
    case 'JPY': return { prefix: '¥', suffix: '' };
    case 'USD':
    default: return { prefix: '$', suffix: '' };
  }
};

// 8. ReadingProgress
const ReadingProgress = {
  init() {
    const progressBar = document.querySelector('.article-progress') || document.querySelector('.progress-bar');
    const article = document.querySelector('.article-content');

    if (!progressBar || !article) return;

    window.addEventListener('scroll', () => {
      const articleRect = article.getBoundingClientRect();
      const articleTop = articleRect.top + window.scrollY;
      const articleHeight = articleRect.height;
      const windowHeight = window.innerHeight;
      const currentScroll = window.scrollY;

      // Start counting when top of article reaches top of screen
      // Stop counting when bottom of article reaches bottom of screen
      const start = articleTop;
      const end = articleTop + articleHeight - windowHeight;
      
      let percentage = 0;
      if (currentScroll > start) {
        percentage = ((currentScroll - start) / (end - start)) * 100;
        percentage = Math.min(Math.max(percentage, 0), 100);
      }

      progressBar.style.width = `${percentage}%`;
    });
  }
};

// 9. TooltipController
const TooltipController = {
  init() {
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(el => {
      el.addEventListener('mouseenter', () => TooltipController.positionTooltip(el));
      el.addEventListener('focusin', () => TooltipController.positionTooltip(el));
    });
  },

  positionTooltip(element) {
    // Basic auto-flip positioning
    const rect = element.getBoundingClientRect();
    if (rect.top < 50) {
      element.classList.add('tooltip-bottom');
    } else {
      element.classList.remove('tooltip-bottom');
    }
  }
};

// 10. SchemaInjector
const SchemaInjector = {
  injectSchema(schemaObject) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(schemaObject);
    document.head.appendChild(script);
  }
};
window.injectSchema = SchemaInjector.injectSchema;

// 11. SearchController
const SearchController = {
  init() {
    const searchModal = document.getElementById('search-modal');
    const searchInput = document.querySelector('.search-input');
    const searchResults = document.querySelector('.search-results');
    const searchTriggers = document.querySelectorAll('.search-trigger');

    if (!searchModal) return;

    // Dynamically load search.js to upgrade mock search with active JSON indexing
    const searchScript = document.createElement('script');
    searchScript.src = '/assets/js/search.js';
    document.body.appendChild(searchScript);

    // Open Search modal on trigger clicks
    searchTriggers.forEach(trigger => {
      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        ModalController.openModal('search-modal');
        setTimeout(() => searchInput.focus(), 150);
      });
    });

    // Keyboard Cmd+K / Ctrl+K handler
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        ModalController.openModal('search-modal');
        setTimeout(() => searchInput.focus(), 150);
      }
    });

    if (searchInput && searchResults) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        SearchController.performSearch(query);
      });

      // Keyboard navigation within search results
      searchInput.addEventListener('keydown', (e) => {
        const items = searchResults.querySelectorAll('.search-result-item');
        let activeIndex = -1;

        items.forEach((item, idx) => {
          if (item.classList.contains('focused')) {
            activeIndex = idx;
          }
        });

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (activeIndex < items.length - 1) {
            if (activeIndex >= 0) items[activeIndex].classList.remove('focused');
            items[activeIndex + 1].classList.add('focused');
            items[activeIndex + 1].scrollIntoView({ block: 'nearest' });
          } else if (items.length > 0) {
            items[activeIndex].classList.remove('focused');
            items[0].classList.add('focused');
            items[0].scrollIntoView({ block: 'nearest' });
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (activeIndex > 0) {
            items[activeIndex].classList.remove('focused');
            items[activeIndex - 1].classList.add('focused');
            items[activeIndex - 1].scrollIntoView({ block: 'nearest' });
          } else if (items.length > 0) {
            if (activeIndex === 0) items[0].classList.remove('focused');
            items[items.length - 1].classList.add('focused');
            items[items.length - 1].scrollIntoView({ block: 'nearest' });
          }
        } else if (e.key === 'Enter') {
          if (activeIndex >= 0) {
            e.preventDefault();
            items[activeIndex].click();
          }
        }
      });
    }
  },

  performSearch(query) {
    const resultsContainer = document.querySelector('.search-results');
    if (!resultsContainer) return;

    if (!query) {
      resultsContainer.innerHTML = '';
      return;
    }

    // Default static indexed files to query (mock search database)
    const mockDatabase = [
      { title: "Compound Interest Calculator", url: "/calculator/compound-interest.html" },
      { title: "Investment Growth Calculator", url: "/calculator/investment-growth.html" },
      { title: "Retirement Calculator", url: "/calculator/retirement.html" },
      { title: "Lump Sum vs DCA", url: "/calculator/lump-sum-vs-monthly.html" },
      { title: "Rule of 72 Calculator", url: "/calculator/rule-of-72.html" },
      { title: "Inflation Calculator", url: "/calculator/inflation.html" },
      { title: "FIRE Number Calculator", url: "/calculator/fire-number.html" },
      { title: "What is Compound Interest?", url: "/learn/what-is-compound-interest.html" },
      { title: "How to Invest", url: "/learn/how-to-invest.html" },
      { title: "Dollar Cost Averaging Guide", url: "/learn/dollar-cost-averaging.html" },
      { title: "Power of Starting Early", url: "/blog/power-of-starting-early.html" }
    ];

    const filtered = mockDatabase.filter(item => 
      item.title.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
      // Sanitize user query before displaying (XSS protection)
      const sanitizedQuery = window.InputSanitizer 
        ? window.InputSanitizer.sanitizeSearchQuery(query)
        : SearchController.escapeHTML(query);
      
      resultsContainer.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--color-muted); font-size: 0.875rem;">
          No results found for "${sanitizedQuery}"
        </div>
      `;
      return;
    }

    // Note: item.title and item.url are from trusted internal database, not user input
    // These are safe to use directly
    resultsContainer.innerHTML = filtered.map((item, idx) => `
      <a href="${item.url}" class="search-result-item ${idx === 0 ? 'focused' : ''}">
        <span class="search-result-title">${item.title}</span>
        <span class="search-result-url">https://compoundpro.com${item.url}</span>
      </a>
    `).join('');
  },

  /**
   * Fallback HTML escape if InputSanitizer not loaded
   * @param {string} text - Text to escape
   * @returns {string} - Escaped HTML
   */
  escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// 12. ShareController
const ShareController = {
  copyToClipboard(text) {
    if (!navigator.clipboard) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        ToastManager.showToast("Copied to clipboard!", "success");
      } catch (err) {
        ToastManager.showToast("Failed to copy link.", "error");
      }
      document.body.removeChild(textarea);
      return;
    }

    navigator.clipboard.writeText(text)
      .then(() => {
        ToastManager.showToast("Copied to clipboard!", "success");
      })
      .catch(() => {
        ToastManager.showToast("Failed to copy link.", "error");
      });
  },

  shareTwitter(title, url) {
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
  },

  shareLinkedIn(url) {
    const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
  }
};

window.copyToClipboard = ShareController.copyToClipboard;
window.shareTwitter = ShareController.shareTwitter;
window.shareLinkedIn = ShareController.shareLinkedIn;

// 13. LocalStorage utilities
const LocalStorageUtils = {
  saveCalcInputs(calcId, inputs) {
    try {
      localStorage.setItem(`cp_calc_${calcId}`, JSON.stringify(inputs));
    } catch (e) {
      console.warn("Could not save inputs to localStorage:", e);
      if (e.name === 'QuotaExceededError' && window.showToast) {
        window.showToast('Ayarlarınız kaydedilemedi', 'error');
      }
    }
  },

  loadCalcInputs(calcId) {
    try {
      const data = localStorage.getItem(`cp_calc_${calcId}`);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn("Could not load inputs from localStorage:", e);
      return null;
    }
  }
};
window.saveCalcInputs = LocalStorageUtils.saveCalcInputs;
window.loadCalcInputs = LocalStorageUtils.loadCalcInputs;

// 14. Toast Notification
const ToastManager = {
  showToast(message, type = "success", duration = 3000) {
    // Remove existing toasts first to prevent stacking overlays
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    const toast = document.createElement('div');
    toast.className = `toast toast-${type} animate-fade-in`;
    
    // Icon Selection
    let icon = "✓";
    if (type === "error") icon = "✕";
    if (type === "info") icon = "ℹ";

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
    `;

    document.body.appendChild(toast);

    // Dynamic styles injected inside body if not loaded
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        .toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 1300;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 20px;
          border-radius: 8px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.875rem;
          font-weight: 500;
          color: #FFFFFF;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
          transition: opacity 150ms ease;
        }
        .toast-success { background-color: #10B981; }
        .toast-error { background-color: #EF4444; }
        .toast-info { background-color: #38BDF8; }
        .toast-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background-color: rgba(255, 255, 255, 0.2);
          font-weight: bold;
          font-size: 0.75rem;
        }
      `;
      document.head.appendChild(style);
    }

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 150);
    }, duration);
  }
};
window.showToast = ToastManager.showToast;

// 15. Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Initialize theme and scroll animations immediately with defensive try-catch wrappers
  const safeInit = (name, controller) => {
    try {
      controller.init();
    } catch (e) {
      console.warn(`[CompoundPro] Failed to initialize ${name} controller:`, e);
    }
  };

  safeInit('Theme', ThemeController);
  safeInit('ScrollAnimation', ScrollAnimationController);
  safeInit('CounterAnimation', CounterAnimation);
  safeInit('FAQAccordion', FAQAccordion);
  safeInit('ReadingProgress', ReadingProgress);
  safeInit('Tooltip', TooltipController);

  const initDynamicComponents = () => {
    safeInit('Navbar', NavbarController);
    safeInit('SmoothScroll', SmoothScroll);
    safeInit('Modal', ModalController);
    safeInit('Search', SearchController);
    safeInit('Currency', CurrencyController);
  };

  // If page uses layout-loader placeholders, wait for them to finish injection.
  // Otherwise, initialize immediately.
  const hasPlaceholders = document.getElementById('navbar-placeholder') || document.getElementById('footer-placeholder');
  if (hasPlaceholders) {
    document.addEventListener('layoutComponentsLoaded', initDynamicComponents);
  } else {
    initDynamicComponents();
  }
  
  // Initialize sliders after a short delay to ensure DOM is ready
  setTimeout(() => {
    if (typeof window.initializeSliders === 'function') {
      window.initializeSliders();
    }
  }, 100);

  // ════════════════════════════════════════════════════════════════
  // CALCULATOR STORAGE HELPERS (compound-interest.js ve diğerleri için)
  // ════════════════════════════════════════════════════════════════
  const CALC_INPUTS_PREFIX = 'cp_calc_inputs_';
  
  window.saveCalcInputs = function(calcId, inputs) {
    try {
      // Free tier: 7 gün, Premium tier: kalıcı
      const tier = window.CompoundPro && window.CompoundPro.TierManager 
        ? window.CompoundPro.TierManager.current 
        : 'free';
      
      const payload = {
        inputs,
        savedAt: Date.now(),
        tier
      };
      window.localStorage.setItem(CALC_INPUTS_PREFIX + calcId, JSON.stringify(payload));
    } catch (e) {
      console.warn('[CompoundPro] Failed to save calc inputs:', e);
      // Show toast notification for QuotaExceededError
      if (e.name === 'QuotaExceededError' && window.showToast) {
        window.showToast('Ayarlarınız kaydedilemedi', 'error');
      }
    }
  };

  window.loadCalcInputs = function(calcId) {
    try {
      const raw = localStorage.getItem(CALC_INPUTS_PREFIX + calcId);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      
      // Free tier: 7 günden eski ise geçersiz
      if (payload.tier === 'free') {
        const ageDays = (Date.now() - payload.savedAt) / (1000 * 60 * 60 * 24);
        if (ageDays > 7) return null;
      }
      
      return payload.inputs;
    } catch (e) {
      console.warn('[CompoundPro] Failed to load calc inputs:', e);
      return null;
    }
  };

  window.clearCalcInputs = function(calcId) {
    try {
      localStorage.removeItem(CALC_INPUTS_PREFIX + calcId);
    } catch (e) {}
  };

  // ════════════════════════════════════════════════════════════════
  // SLIDER HELPERS (Turuncu fill güncelleme ve tooltip)
  // ════════════════════════════════════════════════════════════════
  
  /**
   * Initialize all sliders on page - updates fill and adds tooltips
   */
  window.initializeSliders = function() {
    const sliders = document.querySelectorAll('.calc-slider');
    
    sliders.forEach(slider => {
      // İlk yükleme - fill'i ayarla
      updateSliderFill(slider);
      
      // Input event - kullanıcı kaydırdığında
      slider.addEventListener('input', function() {
        updateSliderFill(this);
        
        // Tooltip göster
        const wrapper = this.closest('.slider-wrapper');
        const tooltip = wrapper ? wrapper.querySelector('.slider-tooltip') : null;
        if (tooltip) {
          tooltip.style.opacity = '1';
        }
      });
      
      // Mouse leave - tooltip gizle
      slider.addEventListener('mouseleave', function() {
        const wrapper = this.closest('.slider-wrapper');
        const tooltip = wrapper ? wrapper.querySelector('.slider-tooltip') : null;
        if (tooltip) {
          tooltip.style.opacity = '0';
        }
      });
    });
  };
  
  /**
   * Update slider fill (turuncu renk) based on current value
   */
  function updateSliderFill(slider) {
    const min = parseFloat(slider.min) || 0;
    const max = parseFloat(slider.max) || 100;
    const value = parseFloat(slider.value) || 0;
    
    // Yüzde hesapla
    const percentage = ((value - min) / (max - min)) * 100;
    
    // CSS custom property ile fill güncelle
    slider.style.setProperty('--slider-fill', percentage + '%');
    
    // Tooltip varsa pozisyon ve değer güncelle
    const wrapper = slider.closest('.slider-wrapper');
    const tooltip = wrapper ? wrapper.querySelector('.slider-tooltip') : null;
    
    if (tooltip) {
      // Tooltip pozisyonu (thumb'ın merkezi)
      const thumbPos = percentage;
      tooltip.style.left = `calc(${thumbPos}% + ${8 - (thumbPos * 0.16)}px)`;
      
      // Tooltip değeri
      const prefix = slider.dataset.prefix || '';
      const suffix = slider.dataset.suffix || '';
      const decimals = parseInt(slider.dataset.decimals) || 0;
      const formattedValue = decimals > 0 ? value.toFixed(decimals) : Math.round(value);
      
      tooltip.textContent = `${prefix}${formattedValue}${suffix}`;
    }
  }
  
  // Export global
  window.updateSliderFill = updateSliderFill;

  /**
   * ════════════════════════════════════════════════════════════════
   * TASK 6.5: SLIDER KEYBOARD NAVIGATION
   * Requirements: FR7 (Range Slider System), NFR2 (Accessibility)
   * 
   * Implements keyboard navigation for range sliders:
   * - Arrow Up/Right: Increment value by step amount
   * - Arrow Down/Left: Decrement value by step amount
   * - Home: Jump to minimum value
   * - End: Jump to maximum value
   * - Page Up: Large increment (10 × step)
   * - Page Down: Large decrement (10 × step)
   * 
   * All changes respect the step attribute for precise value control
   * ════════════════════════════════════════════════════════════════
   */
  function initializeSliderKeyboardNavigation() {
    const sliders = document.querySelectorAll('.calc-slider, .slider-input');
    
    sliders.forEach(slider => {
      slider.addEventListener('keydown', (e) => {
        // Get current slider attributes
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const step = parseFloat(slider.step) || 1;
        let currentValue = parseFloat(slider.value) || 0;
        
        let newValue = currentValue;
        let handled = false;
        
        // Handle keyboard navigation
        switch (e.key) {
          case 'ArrowUp':
          case 'ArrowRight':
            // Increment by step
            newValue = Math.min(currentValue + step, max);
            handled = true;
            break;
            
          case 'ArrowDown':
          case 'ArrowLeft':
            // Decrement by step
            newValue = Math.max(currentValue - step, min);
            handled = true;
            break;
            
          case 'Home':
            // Jump to minimum
            newValue = min;
            handled = true;
            break;
            
          case 'End':
            // Jump to maximum
            newValue = max;
            handled = true;
            break;
            
          case 'PageUp':
            // Large increment (10 × step)
            newValue = Math.min(currentValue + (step * 10), max);
            handled = true;
            break;
            
          case 'PageDown':
            // Large decrement (10 × step)
            newValue = Math.max(currentValue - (step * 10), min);
            handled = true;
            break;
        }
        
        // If we handled a key, update the slider
        if (handled) {
          e.preventDefault(); // Prevent default browser behavior
          
          // Round to step precision to avoid floating point errors
          const decimals = (step.toString().split('.')[1] || '').length;
          newValue = parseFloat(newValue.toFixed(decimals));
          
          // Update slider value
          slider.value = newValue;
          
          // Trigger input event to update linked input field and recalculate
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Update slider fill gradient
          updateSliderFill(slider);
        }
      });
    });
  }
  
  // Initialize keyboard navigation for sliders
  initializeSliderKeyboardNavigation();


  // ════════════════════════════════════════════════════════════════
  // TI ER DEĞİŞTİĞİNDE TÜM CALC'LARI YENİDEN HESAPLA
  // ════════════════════════════════════════════════════════════════
  document.addEventListener('tierChanged', () => {
    // Calculator'lar bu event'i dinleyip recalc yapabilir
    // (örn. premium olunca Compare Mode açılır, recalc tetiklenir)
    console.log('[CompoundPro] Tier changed, triggering recalc...');
    document.dispatchEvent(new Event('recalcAllCalculators'));
  });
});

