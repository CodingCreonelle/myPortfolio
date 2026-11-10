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

const SITE_ROOT = (window.PortfolioUtils && typeof window.PortfolioUtils.getSiteRoot === 'function')
  ? window.PortfolioUtils.getSiteRoot()
  : (function () {
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
  if (Array.isArray(project.tech) && project.tech.length > 0) return project.tech;
  if (Array.isArray(project.technologies) && project.technologies.length > 0) return project.technologies;
  return [];
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

function renderProjectList(projects) {
  const container = document.querySelector('#project-list');
  if (!container || !Array.isArray(projects)) return;
  container.innerHTML = '';

  projects.forEach((project, index) => {
    const techList = getProjectTechList(project);
    const stack = techList.length > 0 ? techList.join(' · ') : '';
    const icons = projectStackIcons(project);
    const thumbSrc = projectImageSrc(project);
    const metricsMarkup = Array.isArray(project.metrics) && project.metrics.length > 0
      ? `<p class="archive-entry__metrics">${project.metrics.map((m) => `<span><strong>${esc(m.value)}</strong> ${esc(m.label)}</span>`).join(' · ')}</p>`
      : '';

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
          ${metricsMarkup}
          ${stack ? `<p class="archive-entry__stack">${esc(stack)}</p>` : ''}
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
        <span class="contact-card__icon" aria-hidden="true">${CONTACT_ICONS[item.icon] || ''}</span>
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
    renderProjectList(projects);
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
}

document.addEventListener('DOMContentLoaded', loadDynamicData);
