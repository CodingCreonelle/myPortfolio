/**
 * Central data loader for `projects.json`, `experience.json`, and `socials.json`.
 *
 * Connects the JSON data files to:
 *  - `window.initWorkGallery(projects)` on `index.html`
 *  - `renderProjectList(projects)` on `projects.html`
 *  - `window.initTimeline(entries)` on `index.html`
 *  - `renderContactCards(socials)` on `contact.html`
 */
function esc(value) {
  if (window.PortfolioUtils && typeof window.PortfolioUtils.escapeHtml === 'function') {
    return window.PortfolioUtils.escapeHtml(value);
  }
  return String(value == null ? '' : value);
}

const SITE_ROOT = (typeof window !== 'undefined' && window.PortfolioUtils && typeof window.PortfolioUtils.getSiteRoot === 'function')
  ? window.PortfolioUtils.getSiteRoot()
  : (function () {
      if (typeof document === 'undefined') return '';
      const script = document.currentScript || document.querySelector('script[src*="data-loader.js"]');
      return script && script.src ? new URL('../../', script.src).href : '';
    })();

function projectHref(project) {
  return `${SITE_ROOT}projects/project.html?id=${encodeURIComponent(project.id)}`;
}

async function fetchJSON(path) {
  if (window.PortfolioUtils && typeof window.PortfolioUtils.fetchJSON === 'function') {
    return window.PortfolioUtils.fetchJSON(path);
  }
  const fullUrl = SITE_ROOT + path;
  try {
    const response = await fetch(fullUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

function createCard(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function projectImageSrc(project) {
  const image = typeof project.image === 'string' ? project.image.trim() : '';
  if (!image) return '';
  if (/^(?:https?:)?\/\//i.test(image) || image.startsWith('/')) return image;
  if (/^[a-z][a-z0-9+.-]*:/i.test(image)) return '';
  return SITE_ROOT + image.replace(/^\.\//, '');
}

function renderFeaturedProjects(projects) {
  if (typeof window.initWorkGallery === 'function') {
    window.initWorkGallery(projects);
    return;
  }
}

const SKILL_ICONS = {
  html: 'html',
  html5: 'html',
  css: 'css',
  css3: 'css',
  javascript: 'javascript',
  js: 'javascript',
  git: 'git',
  github: 'github',
  vscode: 'vscode',
  'vs code': 'vscode',
};

const EXTERNAL_ICON = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
    <path d="M13 4h7v7"></path>
    <path d="M20 4 11 13"></path>
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>
  </svg>
`;

function getProjectTechList(project) {
  if (!project || typeof project !== 'object') return [];
  if (Array.isArray(project.tech) && project.tech.length > 0) return project.tech;
  if (Array.isArray(project.technologies) && project.technologies.length > 0) return project.technologies;
  if (Array.isArray(project.stack) && project.stack.length > 0) return project.stack;
  return [];
}

function getLanguageNames(projects, experience) {
  const seen = new Set();
  const list = [];

  function pushName(raw) {
    const label = String(raw || '').trim();
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(label);
  }

  if (experience && Array.isArray(experience.languages)) {
    experience.languages.forEach((lang) => {
      if (lang && typeof lang === 'object') pushName(lang.name);
      else pushName(lang);
    });
  }

  if (Array.isArray(projects)) {
    projects.forEach((project) => {
      getProjectTechList(project).forEach(pushName);
    });
  }

  return list;
}

function getCustomSortOptions(experience) {
  if (!experience || !Array.isArray(experience.projectSortOptions)) return [];
  return experience.projectSortOptions
    .filter((opt) => opt && (opt.label || opt.id))
    .map((opt, idx) => ({
      id: String(opt.id || `custom-${idx + 1}`),
      label: String(opt.label || opt.id || `Custom Sort ${idx + 1}`).trim(),
      by: String(opt.by || 'language').trim(),
      target: String(opt.target || '').trim(),
    }));
}

function projectLanguageRank(project, targetLower) {
  const tech = getProjectTechList(project).map((t) => String(t).trim().toLowerCase());
  const tags = Array.isArray(project && project.tags)
    ? project.tags.map((t) => String(t).trim().toLowerCase())
    : [];
  const techIdx = tech.indexOf(targetLower);
  if (techIdx !== -1) return techIdx;
  if (tags.includes(targetLower)) return tech.length;
  return Number.POSITIVE_INFINITY;
}

function sortProjects(projects, sortSpec, languages) {
  if (!Array.isArray(projects)) return [];
  const spec = sortSpec && typeof sortSpec === 'object' ? sortSpec : { by: 'default', target: '' };
  const by = String(spec.by || 'default').toLowerCase();
  const targetLower = String(spec.target || '').trim().toLowerCase();
  const skillOrder = Array.isArray(languages)
    ? languages.map((l) => String(l).trim().toLowerCase()).filter(Boolean)
    : [];

  const decorated = projects.map((item, idx) => ({ item, idx }));

  if (by === 'default') {
    return decorated.map((d) => d.item);
  }

  if (by === 'reverse') {
    return decorated.reverse().map((d) => d.item);
  }

  decorated.sort((a, b) => {
    const pa = a.item || {};
    const pb = b.item || {};

    if (by === 'title-asc') {
      const cmp = String(pa.title || '').localeCompare(String(pb.title || ''));
      return cmp !== 0 ? cmp : a.idx - b.idx;
    }

    if (by === 'title-desc') {
      const cmp = String(pb.title || '').localeCompare(String(pa.title || ''));
      return cmp !== 0 ? cmp : a.idx - b.idx;
    }

    if (by === 'featured') {
      const fa = pa.featured ? 0 : 1;
      const fb = pb.featured ? 0 : 1;
      return fa !== fb ? fa - fb : a.idx - b.idx;
    }

    if (by === 'tech-count') {
      const diff = getProjectTechList(pb).length - getProjectTechList(pa).length;
      return diff !== 0 ? diff : a.idx - b.idx;
    }

    if (by === 'status') {
      const wanted = targetLower || 'live';
      const sa = String(pa.status || '').trim().toLowerCase() === wanted ? 0 : 1;
      const sb = String(pb.status || '').trim().toLowerCase() === wanted ? 0 : 1;
      if (sa !== sb) return sa - sb;
      const cmp = String(pa.status || '').localeCompare(String(pb.status || ''));
      return cmp !== 0 ? cmp : a.idx - b.idx;
    }

    if (by === 'language') {
      if (targetLower) {
        const ra = projectLanguageRank(pa, targetLower);
        const rb = projectLanguageRank(pb, targetLower);
        if (ra !== rb) return ra - rb;
        return a.idx - b.idx;
      }

      const techA = getProjectTechList(pa).map((t) => String(t).trim().toLowerCase());
      const techB = getProjectTechList(pb).map((t) => String(t).trim().toLowerCase());

      let bestA = Number.POSITIVE_INFINITY;
      let matchesA = 0;
      skillOrder.forEach((lang, i) => {
        if (techA.includes(lang)) {
          if (i < bestA) bestA = i;
          matchesA += 1;
        }
      });

      let bestB = Number.POSITIVE_INFINITY;
      let matchesB = 0;
      skillOrder.forEach((lang, i) => {
        if (techB.includes(lang)) {
          if (i < bestB) bestB = i;
          matchesB += 1;
        }
      });

      if (bestA !== bestB) return bestA - bestB;
      if (matchesA !== matchesB) return matchesB - matchesA;
      return a.idx - b.idx;
    }

    return a.idx - b.idx;
  });

  return decorated.map((d) => d.item);
}

const projectToolbarState = {
  filterTech: 'All',
  sortId: 'default',
  experience: null,
};

function attachToolbarFocusFallback(toolbar) {
  if (!toolbar || (typeof HTMLElement !== 'undefined' && 'focusGroup' in HTMLElement.prototype)) {
    return;
  }
  const items = Array.from(toolbar.querySelectorAll('button'));
  if (!items.length) return;
  items.forEach((btn, i) => {
    btn.tabIndex = i === 0 ? 0 : -1;
  });
  toolbar.addEventListener('focusin', (event) => {
    const target = event.target;
    if (items.includes(target)) {
      items.forEach((btn) => {
        btn.tabIndex = btn === target ? 0 : -1;
      });
    }
  });
  toolbar.addEventListener('keydown', (event) => {
    const current = items.indexOf(document.activeElement);
    if (current === -1) return;
    const rtl = typeof getComputedStyle === 'function' && getComputedStyle(toolbar).direction === 'rtl';
    let next = -1;
    if (event.key === 'ArrowRight') next = (current + (rtl ? -1 : 1) + items.length) % items.length;
    else if (event.key === 'ArrowLeft') next = (current + (rtl ? 1 : -1) + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next !== -1) {
      event.preventDefault();
      items[next].focus();
    }
  });
}

function projectStackIcons(project) {
  const technologies = getProjectTechList(project);
  const used = new Set();

  return technologies
    .map((technology) => SKILL_ICONS[String(technology).trim().toLowerCase()])
    .filter((icon) => {
      if (!icon || used.has(icon)) return false;
      used.add(icon);
      return true;
    })
    .map((icon) => `
        <li>
          <img src="${SITE_ROOT}assets/icons/skills/${icon}.svg" alt="${esc(icon)}" width="20" height="20" loading="lazy" decoding="async">
        </li>`)
    .join('');
}

function buildSortOptionsList(languages, customOptions) {
  const options = [
    { id: 'default', label: 'Default Order', by: 'default', target: '' },
  ];
  const seenKeys = new Set(options.map((o) => `${o.by}|${o.target}`));

  customOptions.forEach((opt, idx) => {
    const by = opt.by || 'language';
    const target = opt.target || '';
    const key = `${by}|${target}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    options.push({
      id: `custom:${opt.id || idx}`,
      label: opt.label,
      by,
      target,
    });
  });

  return options;
}

function renderProjectList(projects, resetFilters, experience) {
  const container = document.querySelector('#project-list');
  if (!container || !Array.isArray(projects)) return;

  if (experience !== undefined) {
    projectToolbarState.experience = experience;
  }
  const activeExp = projectToolbarState.experience;
  const languages = getLanguageNames(projects, activeExp);
  const customOptions = getCustomSortOptions(activeExp);
  const sortOptions = buildSortOptionsList(languages, customOptions);

  if (!sortOptions.some((opt) => opt.id === projectToolbarState.sortId)) {
    projectToolbarState.sortId = 'default';
  }
  if (
    projectToolbarState.filterTech !== 'All' &&
    !languages.some((l) => l.toLowerCase() === projectToolbarState.filterTech.toLowerCase())
  ) {
    projectToolbarState.filterTech = 'All';
  }

  if (resetFilters) {
    const existingToolbar = document.getElementById('project-filters');
    if (existingToolbar && existingToolbar.parentNode) {
      existingToolbar.parentNode.removeChild(existingToolbar);
    }
    const existingStatus = document.getElementById('project-toolbar-status');
    if (existingStatus && existingStatus.parentNode) {
      existingStatus.parentNode.removeChild(existingStatus);
    }
    delete container.dataset.filtersBuilt;
  }

  if (!container.dataset.filtersBuilt && container.parentNode) {
    const allProjects = projects.slice();
    const toolbar = document.createElement('div');
    toolbar.id = 'project-filters';
    toolbar.className = 'project-filters project-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('focusgroup', 'toolbar wrap');
    toolbar.setAttribute('aria-label', 'Sort and filter projects');
    toolbar.setAttribute('aria-controls', 'project-list');

    const statusNode = document.createElement('p');
    statusNode.id = 'project-toolbar-status';
    statusNode.className = 'sr-only';
    statusNode.setAttribute('role', 'status');
    statusNode.setAttribute('aria-live', 'polite');

    const headerBar = document.createElement('div');
    headerBar.className = 'project-toolbar__header';

    const countEl = document.createElement('span');
    countEl.id = 'project-count';
    countEl.className = 'project-toolbar__count';
    countEl.textContent = `${allProjects.length} ${allProjects.length === 1 ? 'project' : 'projects'}`;

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.id = 'project-toolbar-reset';
    resetBtn.className = 'project-toolbar__reset';
    resetBtn.textContent = 'Reset';
    resetBtn.setAttribute('aria-disabled', 'true');

    headerBar.appendChild(countEl);
    headerBar.appendChild(resetBtn);
    toolbar.appendChild(headerBar);

    function syncToolbarMeta(visibleCount) {
      const total = allProjects.length;
      countEl.textContent =
        visibleCount === total
          ? `${total} ${total === 1 ? 'project' : 'projects'}`
          : `${visibleCount} of ${total} projects`;
      const isDefault = projectToolbarState.sortId === 'default' && projectToolbarState.filterTech === 'All';
      resetBtn.setAttribute('aria-disabled', isDefault ? 'true' : 'false');
    }

    function applyToolbarView(announceText) {
      const selectedSort =
        sortOptions.find((opt) => opt.id === projectToolbarState.sortId) || sortOptions[0];
      const filterLower = projectToolbarState.filterTech.toLowerCase();
      const filtered =
        projectToolbarState.filterTech === 'All'
          ? allProjects
          : allProjects.filter((item) =>
              getProjectTechList(item).some((t) => String(t).trim().toLowerCase() === filterLower)
            );
      const sorted = sortProjects(filtered, selectedSort, languages);
      syncToolbarMeta(sorted.length);
      renderProjectList(sorted, false, activeExp);
      if (announceText) {
        statusNode.textContent = announceText;
      }
    }

    const sortGroup = document.createElement('div');
    sortGroup.id = 'project-sort-group';
    sortGroup.className = 'project-toolbar__group';
    sortGroup.setAttribute('role', 'group');
    sortGroup.setAttribute('aria-label', 'Sort projects');

    const sortLabel = document.createElement('span');
    sortLabel.className = 'project-toolbar__label';
    sortLabel.innerHTML =
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3 4h10M5 8h6M7 12h2"/></svg>Sort';
    sortGroup.appendChild(sortLabel);

    const sortPills = document.createElement('div');
    sortPills.className = 'project-toolbar__pills';

    sortOptions.forEach((opt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'project-sort-pill';
      btn.dataset.sortId = opt.id;
      btn.dataset.sortBy = opt.by;
      btn.dataset.sortTarget = opt.target;
      btn.setAttribute('aria-pressed', opt.id === projectToolbarState.sortId ? 'true' : 'false');
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        projectToolbarState.sortId = opt.id;
        sortPills.querySelectorAll('.project-sort-pill').forEach((pill) => {
          pill.setAttribute('aria-pressed', pill === btn ? 'true' : 'false');
        });
        applyToolbarView(`Sorted projects by ${opt.label}`);
      });
      sortPills.appendChild(btn);
    });

    sortGroup.appendChild(sortPills);
    toolbar.appendChild(sortGroup);

    const sep = document.createElement('span');
    sep.className = 'project-toolbar__sep';
    sep.setAttribute('role', 'separator');
    sep.setAttribute('aria-orientation', 'horizontal');
    toolbar.appendChild(sep);

    const filterGroup = document.createElement('div');
    filterGroup.id = 'project-filter-group';
    filterGroup.className = 'project-toolbar__group';
    filterGroup.setAttribute('role', 'group');
    filterGroup.setAttribute('aria-label', 'Filter projects by language');

    const filterLabel = document.createElement('span');
    filterLabel.className = 'project-toolbar__label';
    filterLabel.innerHTML =
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h12l-4.5 5.2v4.3l-3 1.5V8.2z"/></svg>Language';
    filterGroup.appendChild(filterLabel);

    const filterPills = document.createElement('div');
    filterPills.className = 'project-toolbar__pills';

    ['All'].concat(languages).forEach((label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'project-filter-pill';
      btn.dataset.tech = label;
      const isActive = label.toLowerCase() === projectToolbarState.filterTech.toLowerCase();
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      btn.textContent = label;
      btn.addEventListener('click', () => {
        projectToolbarState.filterTech = label;
        filterPills.querySelectorAll('.project-filter-pill').forEach((pill) => {
          pill.setAttribute('aria-pressed', pill === btn ? 'true' : 'false');
        });
        applyToolbarView(label === 'All' ? 'Showing all projects' : `Filtered projects by ${label}`);
      });
      filterPills.appendChild(btn);
    });

    filterGroup.appendChild(filterPills);
    toolbar.appendChild(filterGroup);

    resetBtn.addEventListener('click', () => {
      if (resetBtn.getAttribute('aria-disabled') === 'true') return;
      projectToolbarState.sortId = 'default';
      projectToolbarState.filterTech = 'All';
      sortPills.querySelectorAll('.project-sort-pill').forEach((pill) => {
        pill.setAttribute('aria-pressed', pill.dataset.sortId === 'default' ? 'true' : 'false');
      });
      filterPills.querySelectorAll('.project-filter-pill').forEach((pill) => {
        pill.setAttribute('aria-pressed', pill.dataset.tech === 'All' ? 'true' : 'false');
      });
      applyToolbarView('Reset sort and language filters');
    });

    container.parentNode.insertBefore(toolbar, container);
    container.parentNode.insertBefore(statusNode, container);
    attachToolbarFocusFallback(toolbar);
    syncToolbarMeta(allProjects.length);
    container.dataset.filtersBuilt = 'true';

    if (projectToolbarState.sortId !== 'default' || projectToolbarState.filterTech !== 'All') {
      applyToolbarView('');
      return;
    }
  }

  container.innerHTML = '';

  projects.forEach((project, index) => {
    const icons = projectStackIcons(project);
    const thumbSrc = projectImageSrc(project);

    const card = createCard(`
      <article class="archive-entry card-entrance" style="animation-delay: ${index * 100}ms;">
        <p class="archive-entry__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</p>
        ${thumbSrc ? `<div class="archive-entry__thumb"><img src="${esc(thumbSrc)}" alt="${esc(project.imageAlt || project.title)}" loading="lazy" decoding="async"></div>` : ''}
        <div class="archive-entry__body">
          <div class="archive-entry__title-row">
            <h2 class="archive-entry__title"><a href="${esc(projectHref(project))}">${esc(project.title)}</a></h2>
            ${project.status ? `<span class="archive-entry__status">${esc(project.status)}</span>` : ''}
          </div>
          <p class="archive-entry__summary">${esc(project.summary)}</p>
          ${icons ? `<ul class="archive-entry__icons">${icons}</ul>` : ''}
        </div>
        <span class="archive-entry__open" aria-hidden="true">${EXTERNAL_ICON}</span>
      </article>
    `);
    container.appendChild(card);
  });

  if (window.AnimationObserver && window.AnimationObserver.triggerStagger) {
    window.AnimationObserver.triggerStagger(container, 'card-entrance', 100);
  }
}

const CONTACT_ICONS = {
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 6.5h18v11H3z"></path><path d="M3 7l9 6 9-6"></path></svg>',
  github: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 19c-4 1.2-4-2.2-6-2.8m12 5.3v-3.6a3 3 0 0 0-.9-2.4c3-.3 5-1.9 5-6a4.7 4.7 0 0 0-1.3-3.2 4.4 4.4 0 0 0-.1-3.3s-1.4-.4-4.6 1.7a11 11 0 0 0-6 0C3.9 2.6 2.5 3 2.5 3a4.4 4.4 0 0 0-.1 3.3A4.7 4.7 0 0 0 1 9.5c0 4.1 2 5.7 5 6a3 3 0 0 0-.9 2.3V21"></path></svg>',
  linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 9v10M5 5.5v.01M10 19v-5.5a3 3 0 0 1 6 0V19"></path><path d="M10 9v10"></path></svg>',
  discord: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8.5 17.5S7 19 5.5 19.5c0 0-2.5-3.5-2.5-8a13 13 0 0 1 4-3l1 1.5a11 11 0 0 1 4 0L13 8.5a13 13 0 0 1 4 3c0 4.5-2.5 8-2.5 8-1.5-.5-3-2-3-2"></path><path d="M9.5 13v.01M14.5 13v.01"></path></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="9" y="9" width="11" height="11" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
};

function copyTextToClipboard(text) {
  if (window.PortfolioUtils && typeof window.PortfolioUtils.copyToClipboard === 'function') {
    return window.PortfolioUtils.copyToClipboard(text);
  }
  return Promise.resolve(false);
}

function renderContactCards(socials) {
  const container = document.querySelector('#contact-cards');
  if (!container || !socials) return;
  container.innerHTML = '';

  const items = [
    {
      label: 'Email',
      value: socials.email,
      displayValue: socials.email,
      href: socials.email ? `mailto:${socials.email}` : null,
      icon: 'mail',
      hint: 'Direct inbox for project inquiries & roles',
      copyValue: socials.email,
      copyLabel: 'Copy email',
    },
    {
      label: 'GitHub',
      value: socials.github,
      displayValue: String(socials.github || '').replace(/^https?:\/\//i, '').replace(/\/$/, ''),
      href: socials.github,
      icon: 'github',
      hint: 'Source code, repositories & commit history',
      external: true,
    },
    {
      label: 'LinkedIn',
      value: socials.linkedin,
      displayValue: String(socials.linkedin || '').replace(/^https?:\/\//i, '').replace(/\/$/, ''),
      href: socials.linkedin,
      icon: 'linkedin',
      hint: 'Professional background & network',
      external: true,
    },
    {
      label: 'Discord',
      value: socials.discord,
      displayValue: socials.discord,
      href: null,
      icon: 'discord',
      hint: 'Quick developer chat & community handle',
      copyValue: socials.discord,
      copyLabel: 'Copy handle',
    },
  ];

  const coreKeys = ['email', 'github', 'linkedin', 'discord'];
  Object.keys(socials).forEach((key) => {
    if (coreKeys.indexOf(key) !== -1) return;
    const rawVal = String(socials[key] || '').trim();
    if (!rawVal) return;
    const isHttp = /^https?:\/\//i.test(rawVal);
    const isMailto = /^mailto:/i.test(rawVal);
    const displayValue = isHttp
      ? rawVal.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')
      : (isMailto ? rawVal.replace(/^mailto:/i, '') : rawVal);
    items.push({
      label: key,
      value: rawVal,
      displayValue,
      href: (isHttp || isMailto) ? rawVal : null,
      icon: 'ext',
      hint: isHttp ? 'External profile & social channel' : 'Social & contact channel',
      copyValue: (isHttp || isMailto) ? null : rawVal,
      copyLabel: `Copy ${key}`,
      external: isHttp,
    });
  });

  let validIndex = 0;
  items.forEach((item) => {
    if (!item.value) return;
    const indexStr = String(validIndex + 1).padStart(2, '0');
    const linkMarkup = item.href
      ? `<p class="contact-card__value"><a href="${esc(item.href)}" ${item.external ? 'target="_blank" rel="noreferrer"' : ''}>${esc(item.displayValue)}</a></p>`
      : `<p class="contact-card__value">${esc(item.displayValue)}</p>`;

    let actionsMarkup = '';
    if (item.copyValue) {
      actionsMarkup = `
        <div class="contact-card__actions">
          <button type="button" class="contact-card__action-btn" data-copy-value="${esc(item.copyValue)}" data-copy-default="${esc(item.copyLabel)}" aria-label="${esc(item.copyLabel)} ${esc(item.displayValue)}">
            ${CONTACT_ICONS.copy}
            <span data-copy-text>${esc(item.copyLabel)}</span>
          </button>
        </div>`;
    } else if (item.href && item.external) {
      actionsMarkup = `
        <div class="contact-card__actions">
          <a class="contact-card__open-link" href="${esc(item.href)}" target="_blank" rel="noreferrer" aria-label="Open ${esc(item.label)} profile">
            <span>Open</span>
            ${EXTERNAL_ICON}
          </a>
        </div>`;
    }

    const card = createCard(`
      <article class="contact-card card-entrance" style="animation-delay: ${validIndex * 100}ms;">
        <span class="contact-card__icon" aria-hidden="true">${CONTACT_ICONS[item.icon] || EXTERNAL_ICON}</span>
        <div class="contact-card__body">
          <div class="contact-card__top">
            <span class="contact-card__index" aria-hidden="true">${indexStr}</span>
            <h3 class="contact-card__title">${esc(item.label)}</h3>
          </div>
          ${linkMarkup}
          ${item.hint ? `<p class="contact-card__hint">${esc(item.hint)}</p>` : ''}
        </div>
        ${actionsMarkup}
      </article>
    `);

    container.appendChild(card);
    validIndex++;
  });

  container.querySelectorAll('[data-copy-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-copy-value') || '';
      const defaultLabel = btn.getAttribute('data-copy-default') || 'Copy';
      const labelNode = btn.querySelector('[data-copy-text]');
      copyTextToClipboard(value).then(() => {
        btn.classList.add('is-copied');
        if (labelNode) labelNode.textContent = 'Copied';
        setTimeout(() => {
          btn.classList.remove('is-copied');
          if (labelNode) labelNode.textContent = defaultLabel;
        }, 2000);
      });
    });
  });

  if (window.AnimationObserver && window.AnimationObserver.triggerStagger) {
    window.AnimationObserver.triggerStagger(container, 'card-entrance', 100);
  }
}

async function loadDynamicData() {
  const [projects, experience, socials] = await Promise.all([
    fetchJSON('data/projects.json'),
    fetchJSON('data/experience.json'),
    fetchJSON('data/socials.json'),
  ]);

  if (projects) {
    renderFeaturedProjects(projects);
    renderProjectList(projects, true, experience);
  }

  if (experience) {
    const entries = Array.isArray(experience) ? experience : (experience.timeline || []);
    if (typeof window.initTimeline === 'function') {
      window.initTimeline(entries);
    } else if (window.PortfolioTimeline && typeof window.PortfolioTimeline.render === 'function') {
      window.PortfolioTimeline.render(entries);
    }
  }

  if (socials) {
    renderContactCards(socials);
  }

  if (window.AnimationObserver && typeof window.AnimationObserver.refresh === 'function') {
    window.AnimationObserver.refresh();
  }
}

const projectSortApi = {
  sortProjects,
  getLanguageNames,
  getCustomSortOptions,
  buildSortOptionsList,
};

if (typeof window !== 'undefined') {
  window.PortfolioProjectSort = projectSortApi;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = projectSortApi;
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', loadDynamicData);
  document.addEventListener('portfolio:data-updated', loadDynamicData);
}
