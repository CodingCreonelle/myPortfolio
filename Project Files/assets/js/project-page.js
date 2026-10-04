/**
 * Single-page projects.
 *
 * projects/project.html and docs/doc.html are one file each for every project:
 * which project they show comes from the `id` query parameter, and everything
 * they render comes from data/projects.json. Adding a project is an entry in that
 * file rather than another page.
 *
 * The data holds a project's prose as HTML. It ships with the site and is written
 * in the same repository as the markup it replaces, so it is inserted as markup
 * rather than escaped into text.
 */
(() => {
  const ID_PARAM = 'id';
  const PROJECT_PATH = 'projects/project.html';
  const DOCS_PATH = 'docs/doc.html';
  const DATA_PATH = 'data/projects.json';
  const SCRIPT_NAME = 'project-page.js';

  /*
   * Resolved from this script's own URL rather than the page's, so one set of
   * addresses in the data works from either template, at any depth.
   */
  function scriptUrl() {
    if (document.currentScript && document.currentScript.src) {
      return document.currentScript.src;
    }
    const script = document.querySelector(`script[src*="${SCRIPT_NAME}"]`);
    return script ? script.src : '';
  }

  const script = scriptUrl();
  const SITE_ROOT = script ? new URL('../../', script).href : '';

  /*
   * A value is only site-relative when it is not already addressed from somewhere
   * else: a scheme (https:, mailto:), a protocol-relative path, a bare fragment or
   * a root-relative path.
   */
  const ADDRESSED_ELSEWHERE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i;

  function resolveUrl(url) {
    return ADDRESSED_ELSEWHERE.test(url) ? url : SITE_ROOT + url;
  }

  function projectHref(id) {
    return `${SITE_ROOT}${PROJECT_PATH}?${ID_PARAM}=${encodeURIComponent(id)}`;
  }

  function docsHref(id) {
    return `${SITE_ROOT}${DOCS_PATH}?${ID_PARAM}=${encodeURIComponent(id)}`;
  }

  function requestedId() {
    return new URLSearchParams(window.location.search).get(ID_PARAM) || '';
  }

  function addText(parent, tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function addHtml(parent, tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.innerHTML = html;
    parent.appendChild(node);
    return node;
  }

  function addAnchor(parent, tag, className, href, label) {
    const anchor = addText(parent, tag, className, label);
    anchor.href = href;
    return anchor;
  }

  function addList(parent, heading, values) {
    if (!Array.isArray(values) || !values.length) return;
    if (heading) addText(parent, 'h3', null, heading);
    const list = document.createElement('ul');
    values.forEach((value) => addText(list, 'li', null, value));
    parent.appendChild(list);
  }

  /*
   * The demo is a YouTube embed. It is built on demand rather than shipped with
   * the page so a project without one costs nothing.
   */
  function addDemo(parent, demo) {
    if (!demo || !demo.videoId) return;

    const figure = document.createElement('figure');
    figure.className = 'project-view__demo';

    const frame = document.createElement('iframe');
    frame.className = 'project-view__demo-frame';
    frame.src = `https://www.youtube.com/embed/${encodeURIComponent(demo.videoId)}`;
    frame.title = demo.label || 'Project demo';
    frame.loading = 'lazy';
    frame.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    frame.allowFullscreen = true;
    figure.appendChild(frame);

    if (demo.label) {
      addText(figure, 'figcaption', 'project-view__demo-caption', demo.label);
    }
    parent.appendChild(figure);
  }

  function addLinks(parent, links) {
    if (!Array.isArray(links) || !links.length) return;
    addText(parent, 'h3', 'project-view__links-heading', 'Links');

    const list = document.createElement('ul');
    list.className = 'project-view__links';
    links.forEach((link) => {
      const item = document.createElement('li');
      const anchor = addAnchor(item, 'a', null, resolveUrl(link.url), link.label || link.url);
      if (/^https?:/i.test(anchor.href)) {
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
      }
      list.appendChild(item);
    });
    parent.appendChild(list);
  }

  function addMeta(parent, project) {
    const meta = document.createElement('p');
    meta.className = 'project-view__meta';
    if (project.status) addText(meta, 'span', 'project-view__status', project.status);
    if (Array.isArray(project.tags) && project.tags.length) {
      addText(meta, 'span', 'project-view__tags', project.tags.join(' \u00b7 '));
    }
    if (meta.childElementCount) parent.appendChild(meta);
  }

  function hasDocs(project) {
    return Array.isArray(project.docs) && project.docs.length > 0;
  }

  function renderProject(project) {
    document.title = `${project.title} | Charles Portfolio`;

    const mount = document.querySelector('[data-view="project"]');
    if (!mount) return;
    mount.textContent = '';

    addText(mount, 'h1', null, project.title);
    addMeta(mount, project);
    if (project.summary) addText(mount, 'p', 'project-view__summary', project.summary);

    addDemo(mount, project.demo);
    if (project.detail) addHtml(mount, 'div', 'project-view__body', project.detail);
    addList(mount, 'Technologies', project.technologies);
    addLinks(mount, project.links);

    if (hasDocs(project)) {
      const action = document.createElement('p');
      action.className = 'project-view__action';
      addAnchor(action, 'a', 'button button-secondary', docsHref(project.id), 'Read the documentation');
      mount.appendChild(action);
    }
  }

  /*
   * Every documentation section is stacked in one view and addressed by its slug,
   * so the navigation is anchors within the page and no section can 404.
   */
  function renderDocs(project) {
    document.title = `${project.title} Docs | Charles Portfolio`;

    const mount = document.querySelector('[data-view="docs"]');
    const nav = document.querySelector('#doc-nav');
    if (!mount) return;
    mount.textContent = '';
    if (nav) nav.textContent = '';

    addText(mount, 'h1', null, `${project.title} documentation`);
    if (project.summary) addText(mount, 'p', 'project-view__summary', project.summary);

    (project.docs || []).forEach((section) => {
      const article = document.createElement('section');
      article.className = 'doc-section';
      article.id = section.slug;

      if (nav) addAnchor(nav, 'a', null, `#${section.slug}`, section.title);
      addText(article, 'h2', null, section.title);
      if (section.body) addHtml(article, 'div', 'doc-section__body', section.body);
      mount.appendChild(article);
    });

    markCurrentSection();
    revealHashTarget();
  }

  /*
   * A deep link such as ?id=project1#api is followed when the document loads, which
   * is before the sections exist, so the browser has nothing to scroll to. Once
   * they are in place the hash is honoured again.
   */
  function revealHashTarget() {
    const hash = window.location.hash;
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target) target.scrollIntoView();
  }

  /** Keeps the navigation showing which section the reader is looking at. */
  function markCurrentSection() {
    const nav = document.querySelector('#doc-nav');
    if (!nav) return;
    const current = window.location.hash;
    Array.prototype.forEach.call(nav.querySelectorAll('a'), (anchor) => {
      if (current && anchor.getAttribute('href') === current) {
        anchor.setAttribute('aria-current', 'page');
      } else {
        anchor.removeAttribute('aria-current');
      }
    });
  }

  /*
   * A missing or unknown id is a normal thing to arrive at from a stale link, so
   * it explains itself and offers the way back rather than showing an empty page.
   */
  function renderMissing(isDocs, id) {
    document.title = 'Project not found | Charles Portfolio';

    const mount = document.querySelector('[data-view]');
    const nav = document.querySelector('#doc-nav');
    if (nav) nav.textContent = '';
    if (!mount) return;
    mount.textContent = '';

    const panel = document.createElement('div');
    panel.className = 'project-view__empty';
    addText(panel, 'h1', null, 'Project not found');
    addText(panel, 'p', null, id
      ? `No project is registered under the id "${id}".`
      : 'No project was selected. Pick one from the project list.');
    const action = document.createElement('p');
    addAnchor(action, 'a', 'button button-secondary', `${SITE_ROOT}projects.html`, 'Back to all projects');
    panel.appendChild(action);
    mount.appendChild(panel);

    if (isDocs) {
      addText(mount, 'p', 'project-view__hint', 'Documentation is available once a project is selected.');
    }
  }

  async function loadProjects() {
    const response = await fetch(`${SITE_ROOT}${DATA_PATH}`);
    if (!response.ok) throw new Error(`${DATA_PATH}: ${response.status}`);
    return response.json();
  }

  async function init() {
    const mount = document.querySelector('[data-view]');
    if (!mount) return;

    const isDocs = mount.dataset.view === 'docs';
    const id = requestedId();

    let projects = null;
    try {
      projects = await loadProjects();
    } catch (error) {
      console.error('Project data could not be loaded:', error);
    }

    const project = Array.isArray(projects) ? projects.find((entry) => entry.id === id) : null;
    if (!project) {
      renderMissing(isDocs, id);
      return;
    }

    if (isDocs) {
      renderDocs(project);
    } else {
      renderProject(project);
    }
  }

  window.addEventListener('hashchange', markCurrentSection);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
