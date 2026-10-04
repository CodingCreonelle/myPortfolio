/**
 * Site chrome loader.
 *
 * The backdrop, the header and the footer are the same on every page, so each one
 * lives once, as a component, and is filled in here. A page keeps a mount for each
 * and nothing else, which is what stops the three from drifting apart from page to
 * page the way hand-copied markup does.
 *
 * Depth does not matter: the components address everything from the site root, and
 * this script is always at assets/js/, so its own URL is enough to work that root
 * out. No page has to tell us where it sits.
 */

(function () {
  'use strict';

  const BACKGROUND_COMPONENT = 'assets/js/components/background.html';
  const NAVBAR_COMPONENT = 'assets/js/components/navbar.html';
  const FOOTER_COMPONENT = 'assets/js/components/footer.html';

  const MOUNTS = {
    background: '#site-background',
    navbar: '#site-navbar',
    footer: '#site-footer',
  };

  const SCRIPT_URL = document.currentScript ? document.currentScript.src : '';
  const SITE_ROOT = SCRIPT_URL ? new URL('../../', SCRIPT_URL).href : '';

  // Anything already addressed from somewhere else - a scheme, a protocol-relative
  // path, a bare fragment or a root-relative path - is left alone.
  const ADDRESSED_ELSEWHERE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i;

  /**
   * Reads a component into a fragment, addressing its paths from the site root
   * rather than from the page that happens to be loading it.
   */
  function parseComponent(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();

    template.content.querySelectorAll('[href], [src], [action]').forEach((node) => {
      ['href', 'src', 'action'].forEach((attribute) => {
        const value = node.getAttribute(attribute);
        if (!value || ADDRESSED_ELSEWHERE.test(value)) return;
        node.setAttribute(attribute, SITE_ROOT + value.replace(/\\/g, '/'));
      });
    });

    return template.content;
  }

  function fetchComponent(path) {
    return fetch(SITE_ROOT + path)
      .then((response) => {
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        return response.text();
      })
      .then(parseComponent)
      .catch((error) => {
        console.error('Site chrome could not be loaded:', error);
        return null;
      });
  }

  /** Fills a mount, or falls back to the matching end of the body without one. */
  function fillMount(selector, fragment, fallback) {
    if (!fragment) return;

    const mount = document.querySelector(selector);
    if (mount) {
      mount.append(fragment);
      return;
    }

    if (fallback === 'start') {
      document.body.prepend(fragment);
    } else {
      document.body.append(fragment);
    }
  }

  /**
   * Alternates the two takes of the backdrop. Each one plays to the end and hands
   * over, so the footage cuts on its own last frame rather than on a timer.
   */
  function initializeBackground(background) {
    if (!background) return;

    const videos = Array.from(background.querySelectorAll('.hero-bg__video'));
    if (!videos.length) return;

    let active = 0;
    videos.forEach((video) => {
      video.playbackRate = 0.5;
    });

    function playNext() {
      const current = videos[active];
      const next = videos[(active + 1) % videos.length];

      next.currentTime = 0;
      current.classList.remove('is-active');
      next.classList.add('is-active');
      next.play().catch(() => {});
      active = (active + 1) % videos.length;
    }

    // Only the take that is on screen advances the playlist, so one that ended
    // while it was already fading out cannot cut off the take that replaced it.
    videos.forEach((video, index) => {
      video.addEventListener('ended', () => {
        if (index === active) playNext();
      });
    });

    videos[0].play().catch(() => {});
  }

  /*
   * Marks the active navigation link from the current page, and keeps it in step
   * with the section being read on the one page that has sections to read.
   */
  function initializeNavbarSectionHighlight() {
    const navLinks = document.querySelectorAll('.site-nav a');
    if (!navLinks.length) return;

    const sectionIds = ['hero', 'about', 'experience', 'contact'];
    const sections = sectionIds.map(id => document.getElementById(id)).filter(Boolean);

    const setActiveLink = (link) => {
      navLinks.forEach(navLink => {
        navLink.classList.toggle('active', navLink === link);
      });
    };

    const findLinkForSectionId = (id) => {
      return Array.from(navLinks).find(link => link.getAttribute('href')?.endsWith(`#${id}`));
    };

    /*
     * The links are addressed from the site root, so they are compared as the URLs
     * they resolve to rather than as the text in the attribute.
     */
    const linkPath = (link) => {
      try {
        return new URL(link.href).pathname;
      } catch (error) {
        return null;
      }
    };

    const currentHash = window.location.hash;
    if (currentHash) {
      const initialLink = Array.from(navLinks).find((link) => {
        const url = new URL(link.href);
        return url.pathname === window.location.pathname && url.hash === currentHash;
      });
      if (initialLink) {
        setActiveLink(initialLink);
      }
    }

    const pathLink = Array.from(navLinks).find(link => linkPath(link) === window.location.pathname);
    if (pathLink) {
      setActiveLink(pathLink);
    }

    let pendingActiveSectionId = null;
    let clickLockTimer = null;

    const clearClickLock = () => {
      pendingActiveSectionId = null;
      if (clickLockTimer) {
        clearTimeout(clickLockTimer);
        clickLockTimer = null;
      }
    };

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        setActiveLink(link);

        const href = link.getAttribute('href') || '';
        const hashMatch = href.match(/#(hero|about|experience|contact)$/);
        pendingActiveSectionId = hashMatch ? hashMatch[1] : null;

        if (clickLockTimer) {
          clearTimeout(clickLockTimer);
        }
        clickLockTimer = setTimeout(clearClickLock, 800);
      });
    });

    if (sections.length) {
      const observer = new IntersectionObserver((entries) => {
        const visible = entries
          .filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.35)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;
        const visibleSectionId = visible.target.id;
        if (pendingActiveSectionId && visibleSectionId !== pendingActiveSectionId) {
          return;
        }

        const link = findLinkForSectionId(visibleSectionId);
        if (link) {
          setActiveLink(link);
          if (pendingActiveSectionId === visibleSectionId) {
            clearClickLock();
          }
        }
      }, {
        threshold: [0.35, 0.45, 0.55]
      });

      sections.forEach(section => observer.observe(section));
    }
  }

  function initializeNavbarSearch() {
    const searchBar = document.querySelector('.search-bar');
    const brand = document.querySelector('.brand');
    if (!searchBar) return;

    const searchInput = searchBar.querySelector('.search-bar__input');
    const filterButton = searchBar.querySelector('.search-bar__button:last-child');

    searchBar.addEventListener('pointerenter', () => {
      if (searchInput) {
        searchInput.focus({ preventScroll: true });
      }
      if (brand) {
        brand.classList.add('search-hovered');
      }
    });

    searchBar.addEventListener('pointerleave', () => {
      if (searchInput && document.activeElement === searchInput) {
        searchInput.blur();
      }
        if (brand) {
        brand.classList.remove('search-hovered');
      }
    });

    if (filterButton) {
      filterButton.addEventListener('click', () => {
        const query = searchInput?.value?.trim();
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        params.set('filter', 'true');
        window.location.href = `${SITE_ROOT}projects.html?${params.toString()}`;
      });
    }
  }

  function initializeNavbarBrand() {
    const brand = document.querySelector('.brand');
    if (!brand) return;

    brand.addEventListener('mouseenter', () => {
      brand.classList.add('brand--active');
    });

    brand.addEventListener('mouseleave', () => {
      brand.classList.remove('brand--active');
    });
  }

  async function loadSiteChrome() {
    const [background, navbar, footer] = await Promise.all([
      fetchComponent(BACKGROUND_COMPONENT),
      fetchComponent(NAVBAR_COMPONENT),
      fetchComponent(FOOTER_COMPONENT),
    ]);

    fillMount(MOUNTS.background, background, 'start');
    fillMount(MOUNTS.navbar, navbar, 'start');
    fillMount(MOUNTS.footer, footer, 'end');

    initializeBackground(document.querySelector('.hero-bg'));
    initializeNavbarSearch();
    initializeNavbarBrand();
    initializeNavbarSectionHighlight();
  }

  document.addEventListener('DOMContentLoaded', loadSiteChrome);
})();
