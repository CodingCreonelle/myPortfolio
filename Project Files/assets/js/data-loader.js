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

function renderContactCards(socials) {
  const container = document.querySelector('#contact-cards');
  if (!container || !socials) return;
  container.innerHTML = '';

  const items = [
    { label: 'Email', value: socials.email, href: socials.email ? `mailto:${socials.email}` : null },
    { label: 'GitHub', value: socials.github, href: socials.github },
    { label: 'LinkedIn', value: socials.linkedin, href: socials.linkedin },
    { label: 'Discord', value: socials.discord, href: null },
  ];

  let validIndex = 0;
  items.forEach((item) => {
    if (!item.value) return;
    const linkMarkup = item.href
      ? `<p><a href="${esc(item.href)}" ${item.href.startsWith('http') ? 'target="_blank" rel="noreferrer"' : ''}>${esc(item.value)}</a></p>`
      : `<p>${esc(item.value)}</p>`;

    const card = createCard(`
      <div class="contact-card card-entrance" style="animation-delay: ${validIndex * 100}ms;">
        <h2>${esc(item.label)}</h2>
        ${linkMarkup}
      </div>
    `);

    container.appendChild(card);
    validIndex++;
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
