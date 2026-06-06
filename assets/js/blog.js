/**
 * CompoundPro - Blog and Article Interactivity Engine (Dynamic & Unified)
 */

document.addEventListener('DOMContentLoaded', () => {
  BlogSystem.init();
});

const BlogSystem = {
  posts: [],
  categories: [],
  currentPage: 1,
  postsPerPage: 6,
  activeFilter: 'all',
  activeSearchQuery: '',
  isBlogHub: false,
  isCategoryPage: false,
  pageCategory: null,

  async init() {
    // Detect page type and setup environment
    const postsGrid = document.getElementById('blog-posts-grid');
    const categoryGrid = document.getElementById('category-posts-grid');
    
    this.isBlogHub = !!postsGrid;
    this.isCategoryPage = !!categoryGrid;
    
    if (this.isCategoryPage) {
      // Get category filter from a window variable or dataset attribute
      this.pageCategory = window.activeCategory || document.body.dataset.category || null;
      if (!this.pageCategory) {
        // Fallback: parse from URL pathway (e.g. blog/category/fire/ -> fire)
        const pathParts = window.location.pathname.split('/');
        const catIndex = pathParts.indexOf('category');
        if (catIndex !== -1 && pathParts[catIndex + 1]) {
          this.pageCategory = pathParts[catIndex + 1];
        }
      }
    }

    // 1. Initialise dynamic blog database if we are on a list/grid page or article page needing related posts
    const needsPostsDB = this.isBlogHub || this.isCategoryPage || document.getElementById('related-posts-grid');
    if (needsPostsDB) {
      await this.loadBlogDatabase();
    }

    // 2. Main Hub / Category listing initialization
    if (this.isBlogHub) {
      this.initBlogHub();
    } else if (this.isCategoryPage) {
      this.initCategoryPage();
    }

    // 3. Article specific setups (if article elements exist)
    this.setupProgressBar();
    this.setupTOC();
    this.setupHelpfulness();
    this.setupSocialSharing();
    this.setupRelatedPosts();
  },

  /**
   * Fetches JSON database from central assets store
   */
  async loadBlogDatabase() {
    try {
      const response = await fetch('/assets/data/blog-posts.json');
      if (!response.ok) throw new Error('Database response error');
      const data = await response.json();
      this.posts = data.posts || [];
      this.categories = data.categories || [];
    } catch (err) {
      console.error('Failed to load blog posts JSON database:', err);
      // Fail-safe mock fallback if JSON fetch is blocked or failed locally
      this.posts = [];
      this.categories = [];
    }
  },

  /**
   * Initializes Blog Hub search, filters, grids, and sidebars
   */
  initBlogHub() {
    this.initCategoryFilters();
    this.initSearchInput();
    this.updateCategoryCounts();
    
    // Render the featured article banner dynamically if placeholder exists
    this.renderFeaturedPost();
    
    // Initial card rendering
    this.renderGrid();

    // Setup Load More button
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        this.currentPage++;
        this.renderGrid(true); // append cards
      });
    }
  },

  /**
   * Initializes Category specific index pages
   */
  initCategoryPage() {
    this.initSearchInput();
    this.renderGrid();
    
    // Setup Load More button
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        this.currentPage++;
        this.renderGrid(true);
      });
    }
  },

  /**
   * Dynamic featured post renderer
   */
  renderFeaturedPost() {
    const container = document.getElementById('featured-post-container');
    if (!container) return;

    // Find the single post designated as featured
    const featured = this.posts.find(p => p.featured && p.status === 'published');
    if (!featured) {
      container.style.display = 'none';
      return;
    }

    const catInfo = this.categories.find(c => c.id === featured.category) || { color: 'orange', name: featured.categoryName };
    
    container.innerHTML = `
      <div class="featured-card">
        <div class="featured-card-content">
          <span class="badge badge-${catInfo.color}" style="margin-bottom: 16px;">${featured.categoryName}</span>
          <h2 class="display-md" style="margin-bottom: 16px; color: var(--color-text-primary);">${featured.title}</h2>
          <p class="body-md" style="color: var(--color-text-secondary); margin-bottom: 24px; line-height: 1.6;">${featured.excerpt}</p>
          <div class="featured-card-meta" style="margin-bottom: 24px;">
            <span>By ${featured.author}</span>
            <span class="meta-dot">•</span>
            <span>${featured.date}</span>
            <span class="meta-dot">•</span>
            <span>⏱️ ${featured.readTime}</span>
          </div>
          <a href="${featured.url}" class="btn btn-primary">Read Featured Article →</a>
        </div>
      </div>
    `;
  },

  /**
   * Client-side categories filter pills configuration
   */
  initCategoryFilters() {
    const pills = document.querySelectorAll('.category-tab');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        this.activeFilter = pill.getAttribute('data-filter') || 'all';
        this.currentPage = 1; // Reset pagination
        this.renderGrid();
      });
    });
  },

  /**
   * Client-side search input filter configuration
   */
  initSearchInput() {
    const searchInput = document.getElementById('blog-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      this.activeSearchQuery = e.target.value.trim().toLowerCase();
      this.currentPage = 1;
      this.renderGrid();
    });
  },

  /**
   * Side bar categories post counter updater
   */
  updateCategoryCounts() {
    this.categories.forEach(cat => {
      const el = document.querySelector(`.category-count[data-category-id="${cat.id}"]`);
      if (el) {
        const count = this.posts.filter(p => p.category === cat.id && p.status === 'published').length;
        el.textContent = `(${count})`;
      }
    });
  },

  /**
   * Filters and renders grid cards based on page, filter, pagination, and search query
   */
  renderGrid(append = false) {
    const grid = document.getElementById('blog-posts-grid') || document.getElementById('category-posts-grid');
    if (!grid) return;

    // Filter published posts
    let filtered = this.posts.filter(p => p.status === 'published');

    // If it's a category page, strictly restrict to that category
    if (this.isCategoryPage && this.pageCategory) {
      filtered = filtered.filter(p => p.category === this.pageCategory);
    } 
    // If it's the main Blog Hub, apply the category pill filter
    else if (this.isBlogHub && this.activeFilter !== 'all') {
      filtered = filtered.filter(p => p.category === this.activeFilter);
    }

    // Apply active search query filter
    if (this.activeSearchQuery) {
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(this.activeSearchQuery) || 
        p.excerpt.toLowerCase().includes(this.activeSearchQuery)
      );
    }

    // Handle empty results display
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 16px; border: 1px dashed var(--color-border); border-radius: var(--radius-xl); background-color: var(--color-white);">
          <span style="font-size: 40px; display: block; margin-bottom: 12px;">🔍</span>
          <h3 class="heading-md" style="margin-bottom: 8px; color: var(--color-dark);">No Articles Found</h3>
          <p class="body-sm text-muted">We couldn't find any guides matching your search query. Try clearing your filters or testing another keyword.</p>
        </div>
      `;
      const loadMoreBtn = document.getElementById('load-more-btn');
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    // Paginate results
    const indexOfLastPost = this.currentPage * this.postsPerPage;
    const paginatedPosts = filtered.slice(0, indexOfLastPost);

    // Build grid HTML
    let html = '';
    // Sıralı kategori renkleri: yeşil-yeşil, turuncu-turuncu, mavi-mavi, döngüsel
    const colorCycle = ['emerald', 'emerald', 'orange', 'orange', 'sea', 'sea'];
    paginatedPosts.forEach((post, idx) => {
      const catInfo = this.categories.find(c => c.id === post.category) || { color: 'orange', name: post.categoryName };
      // Her 6 post'ta bir renk döngüsü (kullanıcı isteği: yeşil-yeşil, turuncu-turuncu, mavi-mavi)
      const colorName = colorCycle[idx % colorCycle.length];
      html += `
        <a href="${post.url}" class="learn-card" data-category="${post.category}" style="opacity: 0; transform: translateY(8px); animation: cardReveal 0.3s forwards ease;">
          <div>
            <span class="learn-card-category" style="color: var(--color-${colorName}-2); background-color: var(--color-${colorName}-10); border: 1px solid var(--color-${colorName}-20);">${post.categoryName}</span>
            <h3 class="learn-card-title">${post.title}</h3>
            <p class="learn-card-excerpt">${post.excerpt}</p>
          </div>
          <div class="learn-card-meta">
            <span>${post.date}</span>
            <span>⏱️ ${post.readTime}</span>
          </div>
        </a>
      `;
    });

    if (append) {
      grid.innerHTML += html;
    } else {
      grid.innerHTML = html;
    }

    // Toggle Load More button visibility
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      if (indexOfLastPost >= filtered.length) {
        loadMoreBtn.style.display = 'none';
      } else {
        loadMoreBtn.style.display = 'inline-flex';
      }
    }
  },

  /**
   * Generates dynamic related posts cards on article pages
   */
  setupRelatedPosts() {
    const relatedGrid = document.getElementById('related-posts-grid');
    if (!relatedGrid) return;

    // Detect the current slug/pathway
    const currentPath = window.location.pathname;
    
    // Find current post in database
    const currentPost = this.posts.find(p => currentPath.endsWith(p.slug + '.html') || currentPath.includes(p.slug));
    const currentCategory = currentPost ? currentPost.category : 'investing-basics';
    const currentId = currentPost ? currentPost.id : '';

    // Filter matching category, excluding the current article
    let matches = this.posts.filter(p => p.category === currentCategory && p.id !== currentId && p.status === 'published');
    
    // Fallback: if not enough matching category posts, load other recent posts
    if (matches.length < 3) {
      const others = this.posts.filter(p => p.id !== currentId && p.category !== currentCategory && p.status === 'published');
      matches = [...matches, ...others].slice(0, 3);
    } else {
      matches = matches.slice(0, 3);
    }

    let html = '';
    matches.forEach(post => {
      const catInfo = this.categories.find(c => c.id === post.category) || { color: 'orange', name: post.categoryName };
      html += `
        <div class="card" style="display: flex; flex-direction: column; height: 100%;">
          <span class="badge badge-${catInfo.color}" style="align-self: flex-start; margin-bottom: 8px;">${post.categoryName}</span>
          <h3 class="heading-md" style="margin-bottom: 8px; font-size: 1.125rem; line-height: 1.4;">${post.title}</h3>
          <p class="body-sm text-muted" style="margin-bottom: 16px; flex-grow: 1;">${post.excerpt}</p>
          <a href="${post.url}" class="feature-link">Read Guide →</a>
        </div>
      `;
    });

    relatedGrid.innerHTML = html;
  },

  /**
   * Reading progress bar controller
   */
  setupProgressBar() {
    const progressBar = document.querySelector('.progress-bar');
    if (!progressBar) return;

    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      progressBar.style.width = `${pct}%`;
    });
  },

  /**
   * Generates dynamic TOC in sidebar and handles active highlight via IntersectionObserver
   */
  setupTOC() {
    const tocContainer = document.getElementById('sidebar-toc');
    const articleContent = document.querySelector('.article-content');
    if (!tocContainer || !articleContent) return;

    const headings = articleContent.querySelectorAll('h2');
    if (headings.length === 0) {
      const widget = tocContainer.closest('.sidebar-widget');
      if (widget) widget.style.display = 'none';
      return;
    }

    const ol = document.createElement('ol');
    ol.className = 'toc-list';

    headings.forEach((heading, index) => {
      if (!heading.id) {
        heading.id = heading.textContent
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-');
      }

      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `#${heading.id}`;
      a.textContent = heading.textContent.replace(/[✏️💡⚡🏝️🏖️💰🥗🎈☕🏠💎✅❌⚙️🍪🍩📊📈⚖️🚀📌🔥🏁🏆🏛️📚⚖️🛡️🛰️]/g, '').trim();
      a.className = 'toc-link';
      
      li.appendChild(a);
      ol.appendChild(li);
    });

    tocContainer.innerHTML = '';
    tocContainer.appendChild(ol);

    // TOC Smooth scroll offset settings
    const tocLinks = ol.querySelectorAll('.toc-link');
    tocLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          const navOffset = 96;
          const elementPosition = targetEl.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.scrollY - navOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
          
          history.pushState(null, '', `#${targetId}`);
        }
      });
    });

    // Feature detection: Use IntersectionObserver if available, otherwise fallback to scroll listener
    if ('IntersectionObserver' in window) {
      this.setupTOCWithIntersectionObserver(headings, tocLinks);
    } else {
      this.setupTOCWithScrollFallback(headings, tocLinks);
    }
  },

  setupTOCWithIntersectionObserver(headings, tocLinks) {
    const observerOptions = {
      root: null,
      rootMargin: '-100px 0px -65% 0px',
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          tocLinks.forEach(link => {
            if (link.getAttribute('href') === `#${id}`) {
              link.classList.add('active');
            } else {
              link.classList.remove('active');
            }
          });
        }
      });
    }, observerOptions);

    headings.forEach(h => observer.observe(h));
  },

  setupTOCWithScrollFallback(headings, tocLinks) {
    const updateActiveTOC = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      
      // Find the heading that's currently most visible in the viewport
      let activeHeading = null;
      let closestDistance = Infinity;

      headings.forEach(heading => {
        const rect = heading.getBoundingClientRect();
        const headingTop = rect.top + scrollY;
        const distance = Math.abs(scrollY + 100 - headingTop);

        // Prioritize headings that are in the upper part of viewport
        if (rect.top >= -100 && rect.top <= windowHeight * 0.35 && distance < closestDistance) {
          closestDistance = distance;
          activeHeading = heading;
        }
      });

      // Update active state
      tocLinks.forEach(link => {
        if (activeHeading && link.getAttribute('href') === `#${activeHeading.id}`) {
          link.classList.add('active');
        } else {
          link.classList.remove('active');
        }
      });
    };

    // Update on scroll and immediately
    window.addEventListener('scroll', updateActiveTOC, { passive: true });
    updateActiveTOC(); // Initial check
  },

  /**
   * Was this helpful widget
   */
  setupHelpfulness() {
    const key = `helpful-vote-${window.location.pathname}`;
    const voteBlock = document.getElementById('helpful-vote-block');
    const responseBlock = document.getElementById('helpful-thanks-block');
    const yesBtn = document.getElementById('helpful-yes');
    const noBtn = document.getElementById('helpful-no');

    if (!voteBlock || !responseBlock || !yesBtn || !noBtn) return;

    const existingVote = localStorage.getItem(key);
    if (existingVote) {
      voteBlock.style.display = 'none';
      responseBlock.style.display = 'block';
      return;
    }

    const castVote = (voteType) => {
      try {
        localStorage.setItem(key, voteType);
      } catch (e) {
        console.warn('[CompoundPro] Failed to save vote:', e);
        if (e.name === 'QuotaExceededError' && window.showToast) {
          window.showToast('Ayarlarınız kaydedilemedi', 'error');
          return; // Don't proceed with UI updates if storage failed
        }
      }
      
      voteBlock.style.opacity = '0';
      voteBlock.style.transition = 'opacity 0.2s';
      setTimeout(() => {
        voteBlock.style.display = 'none';
        responseBlock.style.display = 'block';
        responseBlock.style.opacity = '0';
        responseBlock.style.transition = 'opacity 0.2s';
        setTimeout(() => {
          responseBlock.style.opacity = '1';
        }, 50);
      }, 200);

      if (window.showToast) {
        window.showToast("Thank you for your feedback!", "success");
      }
    };

    yesBtn.addEventListener('click', () => castVote('yes'));
    noBtn.addEventListener('click', () => castVote('no'));
  },

  /**
   * Social share button click handlers
   */
  setupSocialSharing() {
    const shareBtns = document.querySelectorAll('.share-btn');
    shareBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const platform = btn.getAttribute('data-platform');
        const url = encodeURIComponent(window.location.href);
        const title = encodeURIComponent(document.title);

        if (platform === 'twitter' || platform === 'x') {
          window.open(`https://twitter.com/intent/tweet?url=${url}&text=${title}`, '_blank', 'width=600,height=400');
        } else if (platform === 'linkedin') {
          window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank', 'width=600,height=600');
        } else if (platform === 'copy') {
          navigator.clipboard.writeText(window.location.href)
            .then(() => {
              if (window.showToast) {
                window.showToast("Link copied to clipboard!", "success");
              } else {
                alert("Link copied to clipboard!");
              }
            })
            .catch(err => {
              console.error('Failed to copy text: ', err);
            });
        }
      });
    });
  }
};
