/**
 * CompoundPro - Layout Loader Component System
 * Aggressive caching via localStorage (24h) + sessionStorage fallback
 * Inline critical layout placeholder to prevent CLS
 */

document.addEventListener("DOMContentLoaded", () => {
  const CACHE_KEY_PREFIX = 'cp_layout_';
  const CACHE_VERSION = 'v7'; // Layout cache versiyonu - değişince invalidate (v7: Button style, no underline)
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 saat

  /**
   * Placeholder fallback HTML (inline, JS yüklenene kadar boş göstermemek için)
   * Gerçek layout fetch başarısız olursa bu render edilir.
   */
  const FALLBACK_NAVBAR = `
    <header class="navbar">
      <div class="navbar-inner container">
        <a href="/" class="navbar-logo exponent-marquee" aria-label="Compound Pro">
          <span class="exponent-track">
            <span class="exponent-text">Compound Pro</span>
          </span>
        </a>
        <nav><ul class="navbar-nav"></ul></nav>
      </div>
    </header>
  `;
  
  const FALLBACK_FOOTER = `
    <footer class="footer" style="padding: 64px 0 32px; text-align: center;">
      <p class="footer-bottom-text">&copy; 2026 CompoundPro. All rights reserved.</p>
      <div style="display: flex; gap: 16px; justify-content: center; margin-top: 16px; flex-wrap: wrap;">
        <a href="/" class="footer-link">Home</a>
        <a href="/calculator/index.html" class="footer-link">Calculators</a>
        <a href="/learn/index.html" class="footer-link">Learn</a>
        <a href="/blog/index.html" class="footer-link">Blog</a>
        <a href="/about.html" class="footer-link">About</a>
        <a href="/contact.html" class="footer-link">Contact</a>
        <a href="/privacy-policy.html" class="footer-link">Privacy</a>
        <a href="/terms-of-use.html" class="footer-link">Terms</a>
        <a href="/disclaimer.html" class="footer-link">Disclaimer</a>
      </div>
    </footer>
  `;

  /**
   * Fetch with retry logic and exponential backoff
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @param {number} retries - Number of retries remaining (default: 3)
   * @param {number} delay - Initial delay in milliseconds (default: 1000ms = 1s)
   * @returns {Promise<Response>}
   */
  const fetchWithRetry = async (url, options = {}, retries = 3, delay = 1000) => {
    const timeout = 3000; // 3-second timeout per request
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { 
        ...options, 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (retries > 0) {
        console.log(`[CompoundPro] Fetch failed for ${url}, retrying in ${delay}ms... (${retries} retries left)`);
        
        // Wait for exponential backoff delay
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Retry with exponential backoff (1s, 2s, 3s)
        return fetchWithRetry(url, options, retries - 1, delay + 1000);
      } else {
        // All retries exhausted
        console.error(`[CompoundPro] All retries exhausted for ${url}`);
        throw error;
      }
    }
  };

  const loadComponent = (placeholderId, filePath, fallbackHTML) => {
    return new Promise((resolve) => {
      const placeholder = document.getElementById(placeholderId);
      if (!placeholder) {
        resolve();
        return;
      }

      const cacheKey = CACHE_KEY_PREFIX + placeholderId;
      let cached = null;
      let cacheTime = 0;
      
      // localStorage (kalıcı, 24h)
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.version === CACHE_VERSION && parsed.html) {
            const age = Date.now() - (parsed.time || 0);
            if (age < CACHE_DURATION) {
              cached = parsed.html;
              cacheTime = parsed.time;
            }
          }
        }
      } catch (e) {
        // localStorage blocked
      }

      // sessionStorage fallback (hızlı erişim)
      if (!cached) {
        try {
          cached = sessionStorage.getItem(cacheKey);
        } catch (e) {}
      }

      if (cached) {
        placeholder.innerHTML = cached;
        // Highlight active link (synchronously, çünkü cached)
        highlightActiveLink();
        resolve();
        return;
      }

      // Loading indicator logic: show after 1 second if fetch takes longer
      let loadingIndicatorTimer = null;
      let loadingIndicator = null;
      
      const showLoadingIndicator = () => {
        loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'cp-loading-indicator';
        loadingIndicator.innerHTML = `
          <div class="cp-loading-spinner"></div>
          <span class="cp-loading-text">Loading...</span>
        `;
        placeholder.appendChild(loadingIndicator);
        
        // Trigger fade-in animation (with fallback for environments without requestAnimationFrame)
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            loadingIndicator.classList.add('cp-loading-visible');
          });
        } else {
          // Fallback for test environments
          setTimeout(() => {
            loadingIndicator.classList.add('cp-loading-visible');
          }, 0);
        }
      };
      
      const hideLoadingIndicator = () => {
        if (loadingIndicatorTimer) {
          clearTimeout(loadingIndicatorTimer);
          loadingIndicatorTimer = null;
        }
        
        if (loadingIndicator) {
          loadingIndicator.classList.remove('cp-loading-visible');
          // Remove element after fade-out animation completes (300ms)
          setTimeout(() => {
            if (loadingIndicator && loadingIndicator.parentNode) {
              loadingIndicator.parentNode.removeChild(loadingIndicator);
            }
          }, 300);
          loadingIndicator = null;
        }
      };
      
      // Set timer to show loading indicator after 1 second
      loadingIndicatorTimer = setTimeout(showLoadingIndicator, 1000);

      // Fetch from server with retry logic (with cache-buster based on version)
      fetchWithRetry(filePath + '?v=' + CACHE_VERSION, { cache: 'no-cache' })
        .then(response => response.text())
        .then(html => {
          hideLoadingIndicator();
          
          // Save to localStorage (24h) with sessionStorage fallback
          try {
            localStorage.setItem(cacheKey, JSON.stringify({
              version: CACHE_VERSION,
              time: Date.now(),
              html
            }));
          } catch (e) {
            // Fallback to sessionStorage if localStorage quota exceeded
            if (e.name === 'QuotaExceededError') {
              console.log(`[CompoundPro] localStorage quota exceeded for ${cacheKey}, attempting sessionStorage fallback`);
              try {
                sessionStorage.setItem(cacheKey, html);
              } catch (sessionError) {
                console.error(`[CompoundPro] Both localStorage and sessionStorage failed for ${cacheKey}:`, sessionError);
              }
            } else {
              console.warn(`[CompoundPro] localStorage error for ${cacheKey}:`, e);
            }
          }
          
          placeholder.innerHTML = html;
          highlightActiveLink();
          resolve();
        })
        .catch(err => {
          hideLoadingIndicator();
          console.warn('[CompoundPro] Layout fetch failed after retries, using fallback:', err);
          placeholder.innerHTML = fallbackHTML;
          resolve();
        });
    });
  };

  function highlightActiveLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll(".navbar-link");
    navLinks.forEach(link => {
      const linkPath = link.getAttribute("href");
      if (linkPath === currentPath || 
         (currentPath === "/" && linkPath === "/index.html") ||
         (currentPath !== "/" && linkPath !== "/" && currentPath.startsWith(linkPath.replace(".html", "").replace(/\/$/, "")))) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  // Critical placeholder boyutları (CLS önleme)
  const navbarPh = document.getElementById('navbar-placeholder');
  if (navbarPh) {
    navbarPh.style.minHeight = '64px';
  }
  const footerPh = document.getElementById('footer-placeholder');
  if (footerPh) {
    footerPh.style.minHeight = '120px';
  }

  // Load navbar and footer concurrently
  Promise.all([
    loadComponent("navbar-placeholder", "/assets/components/navbar.html", FALLBACK_NAVBAR),
    loadComponent("footer-placeholder", "/assets/components/footer.html", FALLBACK_FOOTER)
  ]).then(() => {
    // Make sure navbar-init.js is loaded once. It is idempotent and
    // provides the search modal fallback + currency switcher feedback.
    if (!document.getElementById("cp-navbar-init-script")) {
      const s = document.createElement("script");
      s.id = "cp-navbar-init-script";
      s.src = "/assets/js/navbar-init.js";
      s.defer = true;
      document.body.appendChild(s);
    }
    // Dispatch custom event
    document.dispatchEvent(new CustomEvent("layoutComponentsLoaded"));
  });
});
