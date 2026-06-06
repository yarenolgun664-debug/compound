/* ==========================================================================
   COMPOUNDPRO MAIN.JS — Emerald Glass Micro-Interactions
   Vanilla JS · No Dependencies · ES6+
   ========================================================================== */

(function () {
  'use strict';

  /* --------------------------------------------------------------------------
     1. SCROLL-REVEAL ANIMATION
     Uses IntersectionObserver to activate .reveal elements when they enter
     the viewport. Supports staggered delays via .delay-1 through .delay-4.
     -------------------------------------------------------------------------- */
  function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal');
    if (!revealElements.length) return;

    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -60px 0px',
      threshold: 0.12
    };

    const revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
          revealObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);

    revealElements.forEach(function (el) {
      revealObserver.observe(el);
    });
  }

  /* --------------------------------------------------------------------------
     2. FAQ ACCORDION TOGGLE
     Toggles `.faq-item` open/closed states with smooth max-height CSS animation.
     Each FAQ item should have:
       - `.faq-question` as the clickable header
       - `.faq-answer` as the collapsible body
     -------------------------------------------------------------------------- */
  function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    if (!faqItems.length) return;

    faqItems.forEach(function (item) {
      const question = item.querySelector('.faq-question');
      const answer = item.querySelector('.faq-answer');
      if (!question || !answer) return;

      // Set initial collapsed state
      answer.style.maxHeight = item.classList.contains('active')
        ? answer.scrollHeight + 'px'
        : '0px';
      answer.style.overflow = 'hidden';
      answer.style.transition = 'max-height 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease';
      answer.style.opacity = item.classList.contains('active') ? '1' : '0';

      question.style.cursor = 'pointer';
      question.setAttribute('role', 'button');
      question.setAttribute('tabindex', '0');
      question.setAttribute('aria-expanded', item.classList.contains('active') ? 'true' : 'false');

      function toggleFaq() {
        const isOpen = item.classList.contains('active');

        if (isOpen) {
          // Collapse
          answer.style.maxHeight = '0px';
          answer.style.opacity = '0';
          item.classList.remove('active');
          question.setAttribute('aria-expanded', 'false');
        } else {
          // Expand
          answer.style.maxHeight = answer.scrollHeight + 'px';
          answer.style.opacity = '1';
          item.classList.add('active');
          question.setAttribute('aria-expanded', 'true');
        }
      }

      question.addEventListener('click', toggleFaq);
      question.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleFaq();
        }
      });
    });
  }

  /* --------------------------------------------------------------------------
     3. ANIMATED STAT COUNTERS
     Animates numeric values from 0 to their target using requestAnimationFrame.
     Elements should have:
       - `.stat-counter` class
       - `data-target` attribute with the target number (e.g. "13")
       - Optionally `data-suffix` (e.g. "+") and `data-prefix` (e.g. "$")
     -------------------------------------------------------------------------- */
  function initStatCounters() {
    const counters = document.querySelectorAll('.stat-counter');
    if (!counters.length) return;

    const counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    counters.forEach(function (counter) {
      counterObserver.observe(counter);
    });
  }

  function animateCounter(el) {
    var target = parseFloat(el.getAttribute('data-target')) || 0;
    var prefix = el.getAttribute('data-prefix') || '';
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1800; // ms
    var startTime = null;
    var isDecimal = target % 1 !== 0;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);

      // Ease out quad
      var easedProgress = 1 - Math.pow(1 - progress, 3);
      var current = easedProgress * target;

      el.textContent = prefix + (isDecimal ? current.toFixed(1) : Math.floor(current)) + suffix;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = prefix + (isDecimal ? target.toFixed(1) : target) + suffix;
      }
    }

    requestAnimationFrame(step);
  }

  /* --------------------------------------------------------------------------
     4. SMOOTH SCROLL FOR ANCHOR LINKS
     Enhances same-page anchor links with smooth scroll behavior, accounting
     for the sticky navbar height.
     -------------------------------------------------------------------------- */
  function initSmoothScroll() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;

      var targetId = link.getAttribute('href');
      if (targetId === '#' || targetId.length < 2) return;

      var targetEl = document.querySelector(targetId);
      if (!targetEl) return;

      e.preventDefault();

      var navbar = document.querySelector('.navbar, header');
      var navbarHeight = navbar ? navbar.offsetHeight : 0;
      var targetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - navbarHeight - 24;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });

      // Update URL hash without jumping
      if (history.pushState) {
        history.pushState(null, null, targetId);
      }
    });
  }

  /* --------------------------------------------------------------------------
     5. NAVBAR SCROLL STATE
     Adds/removes a .scrolled class on the navbar when the user scrolls past
     a threshold. This pairs with design-system.css glassmorphism transitions.
     -------------------------------------------------------------------------- */
  function initNavbarScroll() {
    var navbar = document.querySelector('.navbar');
    if (!navbar) return;

    var scrollThreshold = 32;
    var ticking = false;

    function updateNavbar() {
      if (window.scrollY > scrollThreshold) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(updateNavbar);
        ticking = true;
      }
    }, { passive: true });

    // Initial state check
    updateNavbar();
  }

  /* --------------------------------------------------------------------------
     6. MOBILE HAMBURGER MENU TOGGLE
     Toggles the mobile navigation open/closed state.
     -------------------------------------------------------------------------- */
  function initHamburgerMenu() {
    var hamburger = document.querySelector('.navbar-hamburger');
    var navList = document.querySelector('.navbar-nav');
    if (!hamburger || !navList) return;

    hamburger.addEventListener('click', function () {
      var isOpen = navList.classList.toggle('open');
      hamburger.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close on nav link click (mobile)
    navList.querySelectorAll('.navbar-link').forEach(function (link) {
      link.addEventListener('click', function () {
        navList.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  /* --------------------------------------------------------------------------
     INITIALIZATION
     -------------------------------------------------------------------------- */
  function init() {
    initScrollReveal();
    initFaqAccordion();
    initStatCounters();
    initSmoothScroll();
    initNavbarScroll();
    initHamburgerMenu();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
