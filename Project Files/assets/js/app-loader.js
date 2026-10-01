/**
 * Mark the active navigation link based on the current page path.
 * Called both on initial load and as a fallback for pages without IntersectionObserver sections.
 */
function markActiveLink() {
  const navLinks = document.querySelectorAll('.site-nav a');
  const current = window.location.pathname.split('/').pop() || 'index.html';
  navLinks.forEach(link => {
    if (link.getAttribute('href') === current) {
      link.classList.add('active');
    }
  });
}

async function fallbackNavbarHtml() {
  try {
    const response = await fetch('assets/js/components/navbar.html');
    const headerHtml = await response.text();

    document.body.insertAdjacentHTML('afterbegin', headerHtml);
    initializeNavbarSearch();
    initializeNavbarBrand();
    initializeNavbarSectionHighlight();
  } catch (error) {
    console.error('Failed to load fallback navbar:', error);
  }
};

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

  const currentHash = window.location.hash;
  if (currentHash) {
    const initialLink = Array.from(navLinks).find(link => link.getAttribute('href') === `${window.location.pathname}${currentHash}` || link.getAttribute('href') === currentHash || link.getAttribute('href')?.endsWith(currentHash));
    if (initialLink) {
      setActiveLink(initialLink);
    }
  }

  const path = window.location.pathname.split('/').pop() || 'index.html';
  const pathLink = Array.from(navLinks).find(link => link.getAttribute('href') === path || link.getAttribute('href') === `./${path}`);
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
      window.location.href = `projects.html?${params.toString()}`;
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

document.addEventListener('DOMContentLoaded', fallbackNavbarHtml);
