/**
 * Single project case study and documentation page renderer.
 *
 * Supports both `#project-detail` (`[data-view="project"]`) and `#project-article`
 * on `projects/project.html`, and both `#doc-content` (`[data-view="docs"]`) and
 * `#doc-article` on `docs/doc.html`.
 */
(function () {
  var utils = window.PortfolioUtils;

  function esc(val) {
    if (utils && typeof utils.escapeHtml === 'function') {
      return utils.escapeHtml(val);
    }
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveUrl(href) {
    var raw = String(href || '').trim();
    if (!raw) return '';
    if (/^(?:https?:)?\/\//i.test(raw) || raw.indexOf('/') === 0) return raw;
    if (window.PortfolioUtils && typeof window.PortfolioUtils.getSiteRoot === 'function') {
      var root = PortfolioUtils.getSiteRoot();
      if (root) return root + raw.replace(/^\.\//, '');
    }
    return '../' + raw.replace(/^\.\//, '');
  }

  function sanitizeProse(html) {
    if (window.PortfolioUtils && typeof window.PortfolioUtils.sanitizeHtml === 'function') {
      return window.PortfolioUtils.sanitizeHtml(html);
    }
    return html;
  }

  function renderError(container, title, message) {
    if (!container) return;
    container.innerHTML =
      '<div class="project-view__error"><h2>' + esc(title) + '</h2><p>' + esc(message) + '</p></div>';
  }

  function findProject(projects, id) {
    if (!Array.isArray(projects) || !id) return null;
    var target = String(id);
    for (var i = 0; i < projects.length; i += 1) {
      if (projects[i] && String(projects[i].id) === target) {
        return projects[i];
      }
    }
    return null;
  }

  function pad2(n) {
    if (window.PortfolioUtils && typeof window.PortfolioUtils.pad2 === 'function') {
      return window.PortfolioUtils.pad2(n);
    }
    return String(n == null ? 0 : n).padStart(2, '0');
  }

  function slugify(text, fallbackIndex) {
    if (window.PortfolioUtils && typeof window.PortfolioUtils.slugify === 'function') {
      return window.PortfolioUtils.slugify(text, 'section-' + fallbackIndex);
    }
    var slug = String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || ('section-' + fallbackIndex);
  }

  function formatInlineMarkdown(text) {
    var escaped = esc(text);
    escaped = escaped.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return escaped;
  }

  function renderBodyBlocks(rawBody) {
    var paragraphs = String(rawBody || '').split(/\n\s*\n/);
    var html = paragraphs.map(function (block) {
      var trimmed = block.trim();
      if (!trimmed) return '';
      var lines = trimmed.split('\n');
      var isBullets = lines.every(function (l) { return /^\s*[-*]\s+/.test(l); });
      if (isBullets) {
        return '<ul>' + lines.map(function (l) {
          return '<li>' + formatInlineMarkdown(l.replace(/^\s*[-*]\s+/, '')) + '</li>';
        }).join('') + '</ul>';
      }
      var isOrdered = lines.every(function (l) { return /^\s*\d+\.\s+/.test(l); });
      if (isOrdered) {
        return '<ol>' + lines.map(function (l) {
          return '<li>' + formatInlineMarkdown(l.replace(/^\s*\d+\.\s+/, '')) + '</li>';
        }).join('') + '</ol>';
      }
      return '<p>' + formatInlineMarkdown(trimmed) + '</p>';
    }).join('\n');
    return sanitizeProse(html);
  }

  function buildMetricsMarkup(metrics) {
    if (!Array.isArray(metrics) || metrics.length === 0) return '';
    return '<div class="project-view__metrics">' +
      metrics.map(function (m) {
        return (
          '<div class="project-view__metric">' +
          '  <strong class="project-view__metric-val">' + esc(m.value) + '</strong>' +
          '  <span class="project-view__metric-lbl">' + esc(m.label + (m.note ? ' · ' + m.note : '')) + '</span>' +
          '</div>'
        );
      }).join('') +
      '</div>';
  }

  function initDocScrollspy(navEl, contentEl) {
    if (!navEl || !contentEl) return;
    var navLinks = Array.prototype.slice.call(navEl.querySelectorAll('.doc-nav__list a'));
    var sections = Array.prototype.slice.call(contentEl.querySelectorAll('.doc-section[id]'));
    if (navLinks.length === 0 || sections.length === 0) return;

    var setActiveLink = function (targetLink) {
      navLinks.forEach(function (link) {
        var isActive = link === targetLink;
        link.classList.toggle('target-current', isActive);
        link.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    };

    var supportsScrollTargetGroup =
      typeof CSS !== 'undefined' &&
      typeof CSS.supports === 'function' &&
      CSS.supports('scroll-target-group: auto');

    if (supportsScrollTargetGroup) {
      var syncAriaCurrent = function () {
        var currentLink = navEl.querySelector('.doc-nav__list a:target-current');
        if (!currentLink) currentLink = navLinks[0];
        navLinks.forEach(function (link) {
          link.setAttribute('aria-current', link === currentLink ? 'true' : 'false');
        });
      };
      syncAriaCurrent();
      document.addEventListener('scrollend', syncAriaCurrent, { passive: true });
      return;
    }

    setActiveLink(navLinks[0]);
    if (typeof IntersectionObserver !== 'function') return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.getAttribute('id');
        if (!id) return;
        for (var i = 0; i < navLinks.length; i += 1) {
          if (navLinks[i].getAttribute('href') === '#' + id) {
            setActiveLink(navLinks[i]);
            break;
          }
        }
      });
    }, { rootMargin: '-25% 0px -60% 0px', threshold: 0 });

    sections.forEach(function (section) {
      observer.observe(section);
    });
  }

  function renderProjectDetailContainer(container, project) {
    if (!project) {
      document.title = 'Project Not Found - Charles Portfolio';
      container.innerHTML = [
        '<div class="project-view__empty">',
        '  <h1>Project not found</h1>',
        '  <p class="project-view__hint">The requested case study could not be located. Return to <a class="text-link" href="../projects.html">All projects</a>.</p>',
        '</div>'
      ].join('\n');
      return;
    }

    document.title = (project.title || 'Project') + ' - Charles Portfolio';

    var statusHtml = project.status
      ? '<span class="project-view__status">' + esc(project.status) + '</span>'
      : '';
    var tagsHtml = Array.isArray(project.tags) && project.tags.length > 0
      ? '<span class="project-view__tags">' + esc(project.tags.join(' · ')) + '</span>'
      : '';
    var metaRow = (statusHtml || tagsHtml)
      ? '<div class="project-view__meta">' + statusHtml + tagsHtml + '</div>'
      : '';

    var heroVisual = '';
    if (project.image) {
      heroVisual += '<img class="project-view__hero-img" src="' + esc(resolveUrl(project.image)) + '" alt="' + esc(project.imageAlt || project.title || '') + '" />';
    }
    heroVisual += buildMetricsMarkup(project.metrics);
    var visualBlock = heroVisual ? '<div class="project-view__visual">' + heroVisual + '</div>' : '';

    var highlightsBlock = '';
    if (Array.isArray(project.highlights) && project.highlights.length > 0) {
      highlightsBlock =
        '<section class="project-view__section" data-animate="animate-entrance" data-animate-replay="true">' +
        '<h2 data-typewriter>Architectural Highlights</h2>' +
        sanitizeProse('<ul>' + project.highlights.map(function (item) {
          return '<li>' + formatInlineMarkdown(item) + '</li>';
        }).join('') + '</ul>') +
        '</section>';
    }

    var techList = Array.isArray(project.tech) ? project.tech : (Array.isArray(project.technologies) ? project.technologies : []);
    var techBlock = '';
    if (techList.length > 0) {
      techBlock =
        '<section class="project-view__section" data-animate="animate-entrance" data-animate-replay="true">' +
        '<h2 data-typewriter>Technology Stack</h2>' +
        '<p class="project-view__tags">' + esc(techList.join(' · ')) + '</p>' +
        '</section>';
    }

    var links = project.links || {};
    var hasDocs = Array.isArray(project.documentation) && project.documentation.length > 0;
    var docsHref = links.docs
      ? resolveUrl(links.docs)
      : (hasDocs ? resolveUrl('docs/doc.html?id=' + encodeURIComponent(project.id)) : '');

    var discussHref = resolveUrl(
      'contact.html?topic=' +
        encodeURIComponent('Project collaboration') +
        '&subject=' +
        encodeURIComponent('[Architecture Inquiry] ' + (project.title || 'Project')) +
        '&message=' +
        encodeURIComponent(
          'Hi Charles,\n\nI just reviewed the case study for "' +
            (project.title || 'Project') +
            '" and would like to discuss your implementation and potential opportunities.'
        )
    );

    var actionsHtml = '<div class="project-view__action">';
    if (docsHref) {
      actionsHtml += '<a class="button button-primary" href="' + esc(docsHref) + '">Read Technical Documentation &rarr;</a>';
    }
    actionsHtml += '<a class="button button-secondary" href="' + esc(discussHref) + '">Discuss This Architecture &rarr;</a>';
    if (links.repo) {
      actionsHtml += '<a class="button button-secondary" href="' + esc(resolveUrl(links.repo)) + '" target="_blank" rel="noopener noreferrer">Source Repository</a>';
    }
    actionsHtml += '</div>';

    container.innerHTML = [
      '<section class="project-view__section" data-animate="animate-entrance" data-animate-replay="true">',
      metaRow,
      '<h1 data-typewriter>' + esc(project.title || 'Untitled Project') + '</h1>',
      project.summary ? '<p class="project-view__summary">' + esc(project.summary) + '</p>' : '',
      visualBlock,
      '</section>',
      '<section class="project-view__section" data-animate="animate-entrance" data-animate-replay="true">',
      '<h2 data-typewriter>System Overview</h2>',
      sanitizeProse('<p>' + formatInlineMarkdown(project.description || project.summary || '') + '</p>'),
      '</section>',
      highlightsBlock,
      techBlock,
      actionsHtml
    ].join('\n');

    if (window.Typewriter && typeof window.Typewriter.init === 'function') {
      window.Typewriter.init();
    }
    if (window.AnimationObserver && typeof window.AnimationObserver.refresh === 'function') {
      window.AnimationObserver.refresh();
    }
  }

  function renderDocContentContainer(navEl, contentEl, project, allProjects) {
    if (!project) {
      document.title = 'Documentation Not Found - Charles Portfolio';
      if (navEl) navEl.hidden = true;
      contentEl.innerHTML = [
        '<div class="project-view__empty">',
        '  <h1>Documentation not found</h1>',
        '  <p class="project-view__hint">Return to <a class="text-link" href="../projects.html">All projects</a>.</p>',
        '</div>'
      ].join('\n');
      return;
    }

    document.title = (project.title || 'Project') + ' Docs - Charles Portfolio';

    var caseStudyHref = resolveUrl('projects/project.html?id=' + encodeURIComponent(project.id));
    var backLink = document.querySelector('.project-view__back a');
    if (backLink) {
      backLink.href = caseStudyHref;
      backLink.textContent = '\u2190 Back to ' + (project.title || 'Case Study');
    }

    var sections = Array.isArray(project.documentation) ? project.documentation : [];
    var links = project.links || {};

    if (navEl) {
      navEl.innerHTML = '';
      if (sections.length > 0) {
        navEl.hidden = false;
        var resourceLinks = '<a class="doc-nav__meta-link" href="' + esc(caseStudyHref) + '">Case Study Overview</a>';
        if (links.live) {
          resourceLinks += '<a class="doc-nav__meta-link" href="' + esc(resolveUrl(links.live)) + '">Live Experience</a>';
        }
        if (links.repo) {
          resourceLinks += '<a class="doc-nav__meta-link" href="' + esc(resolveUrl(links.repo)) + '" target="_blank" rel="noopener noreferrer">Source Repository</a>';
        }

        navEl.innerHTML =
          '<p class="doc-nav__title">On this page</p>' +
          '<ul class="doc-nav__list">' +
          sections.map(function (sec, idx) {
            var headingText = (sec && sec.heading) ? sec.heading : ('Section ' + (idx + 1));
            var id = slugify(headingText, idx + 1);
            var numLabel = pad2(idx + 1);
            return (
              '<li><a href="#' + esc(id) + '">' +
              '<span class="doc-nav__num" aria-hidden="true">' + numLabel + '</span>' +
              '<span class="doc-nav__label">' + esc(headingText) + '</span>' +
              '</a></li>'
            );
          }).join('') +
          '</ul>' +
          '<div class="doc-nav__meta">' +
          '  <p class="doc-nav__title">Resources</p>' +
          '  <div class="doc-nav__meta-links">' + resourceLinks + '</div>' +
          '</div>';
      } else {
        navEl.hidden = true;
      }
    }

    var docProjects = Array.isArray(allProjects)
      ? allProjects.filter(function (p) { return p && Array.isArray(p.documentation) && p.documentation.length > 0; })
      : [];

    var switcherHtml = '';
    if (docProjects.length > 1) {
      switcherHtml =
        '<nav class="doc-switcher" aria-label="Switch project documentation">' +
        docProjects.map(function (p, idx) {
          var isActive = String(p.id) === String(project.id);
          var href = resolveUrl('docs/doc.html?id=' + encodeURIComponent(p.id));
          return (
            '<a class="doc-switcher__pill' + (isActive ? ' is-active' : '') + '" href="' + esc(href) + '"' +
            (isActive ? ' aria-current="page"' : '') + '>' +
            '<span class="doc-switcher__num" aria-hidden="true">' + pad2(idx + 1) + '</span>' +
            '<span>' + esc(p.title) + '</span>' +
            '</a>'
          );
        }).join('') +
        '</nav>';
    }

    var techList = Array.isArray(project.tech) ? project.tech : (Array.isArray(project.technologies) ? project.technologies : []);
    var techChipsHtml = techList.length > 0
      ? '<ul class="doc-tech-list" aria-label="Technology stack">' +
        techList.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
        '</ul>'
      : '';

    var specIndex = pad2(project.id || '1');
    var headerHtml = [
      '<header class="project-view__section doc-hero" data-animate="animate-entrance" data-animate-replay="true">',
      '<div class="project-view__meta">',
      '  <span class="project-view__status">Architecture Spec // ' + esc(specIndex) + '</span>',
      project.status ? '  <span class="project-view__badge">' + esc(project.status) + '</span>' : '',
      '</div>',
      '<h1 data-typewriter>' + esc(project.title || 'Project') + '</h1>',
      '<p class="doc-hero__subtitle">Technical Architecture &amp; Implementation Specification</p>',
      project.summary ? '<p class="project-view__summary">' + esc(project.summary) + '</p>' : '',
      techChipsHtml,
      buildMetricsMarkup(project.metrics),
      '</header>'
    ].join('\n');

    var sectionsHtml = sections.map(function (sec, idx) {
      var headingText = (sec && sec.heading) ? sec.heading : ('Section ' + (idx + 1));
      var id = slugify(headingText, idx + 1);
      var numLabel = pad2(idx + 1);
      var bodyMarkup = renderBodyBlocks(sec && sec.body);

      return (
        '<section class="doc-section" id="' + esc(id) + '" tabindex="-1" data-animate="animate-entrance" data-animate-replay="true">' +
        '  <div class="doc-section__header">' +
        '    <span class="doc-section__index" aria-hidden="true">' + numLabel + '</span>' +
        '    <h2 data-typewriter>' + esc(headingText) + '</h2>' +
        '  </div>' +
        '  <div class="doc-section__body">' + bodyMarkup + '</div>' +
        '</section>'
      );
    }).join('\n');

    var paginationHtml = '';
    if (docProjects.length > 1) {
      var currentIdx = -1;
      for (var i = 0; i < docProjects.length; i += 1) {
        if (String(docProjects[i].id) === String(project.id)) {
          currentIdx = i;
          break;
        }
      }
      if (currentIdx !== -1) {
        var prevProj = currentIdx > 0 ? docProjects[currentIdx - 1] : null;
        var nextProj = currentIdx < docProjects.length - 1 ? docProjects[currentIdx + 1] : null;
        if (prevProj || nextProj) {
          paginationHtml = '<nav class="doc-pagination" aria-label="Documentation pagination">';
          if (prevProj) {
            paginationHtml +=
              '<a class="doc-pagination__card doc-pagination__card--prev" href="' + esc(resolveUrl('docs/doc.html?id=' + encodeURIComponent(prevProj.id))) + '">' +
              '  <span class="doc-pagination__dir">&larr; Previous Spec</span>' +
              '  <span class="doc-pagination__title">' + esc(prevProj.title) + '</span>' +
              '</a>';
          }
          if (nextProj) {
            paginationHtml +=
              '<a class="doc-pagination__card doc-pagination__card--next" href="' + esc(resolveUrl('docs/doc.html?id=' + encodeURIComponent(nextProj.id))) + '">' +
              '  <span class="doc-pagination__dir">Next Spec &rarr;</span>' +
              '  <span class="doc-pagination__title">' + esc(nextProj.title) + '</span>' +
              '</a>';
          }
          paginationHtml += '</nav>';
        }
      }
    }

    var discussHref = resolveUrl(
      'contact.html?topic=' +
        encodeURIComponent('Technical question') +
        '&subject=' +
        encodeURIComponent('[Documentation Inquiry] ' + (project.title || 'Project'))
    );

    var footerAction =
      '<div class="project-view__action">' +
      '  <a class="button button-primary" href="' + esc(caseStudyHref) + '">&larr; Back to Case Study Overview</a>' +
      '  <a class="button button-secondary" href="' + esc(discussHref) + '">Ask a Technical Question &rarr;</a>' +
      '</div>';

    contentEl.innerHTML = switcherHtml + '\n' + headerHtml + '\n' + sectionsHtml + '\n' + paginationHtml + '\n' + footerAction;

    initDocScrollspy(navEl, contentEl);

    if (window.Typewriter && typeof window.Typewriter.init === 'function') {
      window.Typewriter.init();
    }
    if (window.AnimationObserver && typeof window.AnimationObserver.refresh === 'function') {
      window.AnimationObserver.refresh();
    }
  }

  function loadProjectPageData() {
    if (!utils) return;

    var projectDetailEl = document.getElementById('project-detail') || document.getElementById('project-article');
    var docContentEl = document.getElementById('doc-content') || document.getElementById('doc-article');
    var docNavEl = document.getElementById('doc-nav');

    if (!projectDetailEl && !docContentEl) return;

    var params = new URLSearchParams(window.location.search);
    var id = params.get('id') || '1';

    utils
      .fetchJSON(resolveUrl('data/projects.json'))
      .then(function (projects) {
        var project = findProject(projects, id);
        if (projectDetailEl) renderProjectDetailContainer(projectDetailEl, project);
        if (docContentEl) renderDocContentContainer(docNavEl, docContentEl, project, projects);
      })
      .catch(function (err) {
        console.warn('Could not load project data:', err);
        if (projectDetailEl) renderError(projectDetailEl, 'Unable to load project', 'Please return to the projects archive and try again.');
        if (docContentEl) renderError(docContentEl, 'Unable to load documentation', 'Please return to the projects archive and try again.');
      });
  }

  document.addEventListener('DOMContentLoaded', loadProjectPageData);
  document.addEventListener('portfolio:data-updated', function (event) {
    var ds = event && event.detail && event.detail.dataset;
    if (!ds || ds === 'projects' || ds === 'all') {
      loadProjectPageData();
    }
  });
})();
