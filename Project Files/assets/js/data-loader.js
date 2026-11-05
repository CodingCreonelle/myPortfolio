/*
 * The data addresses everything from the site root, and the project cards link to
 * the one project page, so both are resolved from this script's own URL. That
 * keeps them correct whether the page loading this sits at the root or in a
 * folder of its own.
 */

/*
 * Every value that comes from the JSON goes through here before it is
 * interpolated into a template string. escapeHtml from utils.js is the shared
 * implementation; the local copy keeps this file safe on a page that has not
 * loaded utils.js (or loaded it after this script).
 */
function esc(value) {
  const utils = window.PortfolioUtils;
  if (utils && typeof utils.escapeHtml === 'function') {
    return utils.escapeHtml(value);
  }
  const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => escapes[character]);
}

function scriptUrl() {
  if (document.currentScript && document.currentScript.src) {
    return document.currentScript.src;
  }
  const script = document.querySelector('script[src*="data-loader.js"]');
  return script ? script.src : '';
}

const script = scriptUrl();
const SITE_ROOT = script ? new URL('../../', script).href : '';

function projectHref(project) {
  return `${SITE_ROOT}projects/project.html?id=${encodeURIComponent(project.id)}`;
}

async function fetchJSON(path) {
  try {
    const response = await fetch(SITE_ROOT + path);
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
  return template.content.firstChild;
}

/*
 * A project's screenshot is optional: the gallery renders the frame either way
 * and falls back to a styled placeholder so the composition survives until an
 * image is supplied. Relative paths are resolved from the site root, matching
 * the data files' own convention.
 */
function projectImageSrc(project) {
  const image = typeof project.image === 'string' ? project.image.trim() : '';
  if (!image) return '';
  // Protocol-relative, root-relative and plain relative addresses are kept;
  // http(s) is allowed through; anything else carrying a scheme (javascript:,
  // data:, vbscript:, ...) is refused so the card falls back to its placeholder.
  if (/^(?:https?:)?\/\//i.test(image) || image.startsWith('/')) return image;
  if (/^[a-z][a-z0-9+.-]*:/i.test(image)) return '';
  return SITE_ROOT + image.replace(/^\.\//, '');
}

function renderFeaturedProjects(projects) {
  const container = document.querySelector('#featured-projects');
  if (!container || !Array.isArray(projects)) return;
  container.innerHTML = '';

  projects.forEach((project, index) => {
    const src = projectImageSrc(project);
    const visual = src
      ? `<img class="work-card__image" src="${esc(src)}" alt="" loading="lazy" decoding="async">`
      : `<div class="work-card__placeholder" data-index="${String(index + 1).padStart(2, '0')}" aria-hidden="true"></div>`;

    const card = createCard(`
      <article class="work-card">
        <div class="work-card__visual">${visual}</div>
        <div class="work-card__copy">
          <h3 class="work-card__title">${esc(project.title)}</h3>
          <p class="work-card__summary">${esc(project.summary)}</p>
          <a href="${esc(projectHref(project))}" class="work-card__link">
            View project
            <span class="work-card__arrow" aria-hidden="true">&#8594;</span>
          </a>
        </div>
      </article>
    `);
    container.appendChild(card);
  });

  if (window.PortfolioWorkGallery && window.PortfolioWorkGallery.init) {
    window.PortfolioWorkGallery.init();
  }
}

/*
 * Technologies are shown as their skill logo where the site already ships one.
 * Anything without an icon still appears in the stack line, so the row never
 * misrepresents what a project used.
 */
const SKILL_ICONS = {
  html: 'html',
  css: 'css',
  javascript: 'javascript',
  js: 'javascript',
  git: 'git',
  github: 'github',
  vscode: 'vscode',
};

const EXTERNAL_ICON = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
    <path d="M13 4h7v7"></path>
    <path d="M20 4 11 13"></path>
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"></path>
  </svg>
`;

function projectStackIcons(project) {
  const technologies = Array.isArray(project.technologies) ? project.technologies : [];
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
          <img src="${SITE_ROOT}assets/icons/skills/${icon}.svg" alt="" width="22" height="22" loading="lazy" decoding="async">
        </li>`)
    .join('');
}

function renderProjectList(projects) {
  const container = document.querySelector('#project-list');
  if (!container || !Array.isArray(projects)) return;
  container.innerHTML = '';

  projects.forEach((project, index) => {
    const stack = Array.isArray(project.technologies) ? project.technologies.join(' ') : '';
    const icons = projectStackIcons(project);

    const card = createCard(`
      <article class="archive-entry card-entrance" style="animation-delay: ${index * 100}ms;">
        <p class="archive-entry__index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</p>
        <div class="archive-entry__body">
          <h2 class="archive-entry__title"><a href="${esc(projectHref(project))}">${esc(project.title)}</a></h2>
          <p class="archive-entry__summary">${esc(project.summary)}</p>
          ${stack ? `<p class="archive-entry__stack">${esc(stack)}</p>` : ''}
          ${icons ? `<ul class="archive-entry__icons">${icons}</ul>` : ''}
        </div>
        <span class="archive-entry__open" aria-hidden="true">${EXTERNAL_ICON}</span>
      </article>
    `);
    container.appendChild(card);
  });

  // Trigger stagger animation for dynamically added cards
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
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
  }
  return Promise.resolve(fallbackCopyText(text));
}

function fallbackCopyText(text) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = String(text || '');
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch (err) {
    return false;
  }
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

  // Trigger stagger animation for dynamically added cards
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
    if (window.PortfolioTimeline && window.PortfolioTimeline.render) {
      window.PortfolioTimeline.render(experience.timeline);
    }
  }

  if (socials) {
    renderContactCards(socials);
  }
}

document.addEventListener('DOMContentLoaded', loadDynamicData);
