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
    return String(val == null ? '' : val);
  }

  function resolveUrl(href) {
    var raw = String(href || '').trim();
    if (!raw) return '';
    if (/^(?:https?:)?\/\//i.test(raw) || raw.charWith === '/') return raw;
    if (raw.indexOf('/') === 0) return raw;
    if (utils && typeof utils.getSiteRoot === 'function') {
      var root = utils.getSiteRoot();
      if (root) return root + raw.replace(/^\.\//, '');
    }
    return '../' + raw.replace(/^\.\//, '');
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

  function slugify(text, fallbackIndex) {
    var slug = String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return slug || ('section-' + fallbackIndex);
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
    if (Array.isArray(project.metrics) && project.metrics.length > 0) {
      heroVisual += '<div class="project-view__metrics">' +
        project.metrics.map(function (m) {
          return (
            '<div class="project-view__metric">' +
            '  <strong class="project-view__metric-val">' + esc(m.value) + '</strong>' +
            '  <span class="project-view__metric-lbl">' + esc(m.label + (m.note ? ' · ' + m.note : '')) + '</span>' +
            '</div>'
          );
        }).join('') +
        '</div>';
    }
    var visualBlock = heroVisual ? '<div class="project-view__visual">' + heroVisual + '</div>' : '';

    var highlightsBlock = '';
    if (Array.isArray(project.highlights) && project.highlights.length > 0) {
      highlightsBlock =
        '<h2>Architectural Highlights</h2>' +
        '<ul>' +
        project.highlights.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') +
        '</ul>';
    }

    var techList = Array.isArray(project.tech) ? project.tech : (Array.isArray(project.technologies) ? project.technologies : []);
    var techBlock = '';
    if (techList.length > 0) {
      techBlock =
        '<h2>Technology Stack</h2>' +
        '<p class="project-view__tags">' + esc(techList.join(' · ')) + '</p>';
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
      metaRow,
      '<h1>' + esc(project.title || 'Untitled Project') + '</h1>',
      project.summary ? '<p class="project-view__summary">' + esc(project.summary) + '</p>' : '',
      visualBlock,
      '<h2>System Overview</h2>',
      '<p>' + esc(project.description || project.summary || '') + '</p>',
      highlightsBlock,
      techBlock,
      actionsHtml
    ].join('\n');
  }

  function renderDocContentContainer(navEl, contentEl, project) {
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

    var backLink = document.querySelector('.project-view__back a');
    if (backLink) {
      backLink.href = resolveUrl('projects/project.html?id=' + encodeURIComponent(project.id));
      backLink.textContent = '\u2190 Back to ' + (project.title || 'Case Study');
    }

    var sections = Array.isArray(project.documentation) ? project.documentation : [];
    if (navEl) {
      if (sections.length > 0) {
        navEl.innerHTML =
          '<h2>Contents</h2><ul>' +
          sections.map(function (sec, idx) {
            var headingText = (sec && sec.heading) ? sec.heading : ('Section ' + (idx + 1));
            var id = slugify(headingText, idx + 1);
            return '<li><a href="#' + esc(id) + '">' + esc(headingText) + '</a></li>';
          }).join('') +
          '</ul>';
      } else {
        navEl.hidden = true;
      }
    }

    var headerHtml = [
      '<div class="project-view__meta">',
      '  <span class="project-view__status">Architecture Spec</span>',
      project.tech ? '  <span class="project-view__tags">' + esc(project.tech.join(' · ')) + '</span>' : '',
      '</div>',
      '<h1>' + esc((project.title || 'Project') + ' — Technical Documentation') + '</h1>',
      project.summary ? '<p class="project-view__summary">' + esc(project.summary) + '</p>' : ''
    ].join('\n');

    var sectionsHtml = sections.map(function (sec, idx) {
      var headingText = (sec && sec.heading) ? sec.heading : ('Section ' + (idx + 1));
      var id = slugify(headingText, idx + 1);
      var paragraphs = String((sec && sec.body) || '').split(/\n\s*\n/);
      var bodyMarkup = paragraphs.map(function (block) {
        var trimmed = block.trim();
        if (!trimmed) return '';
        var lines = trimmed.split('\n');
        var isBullets = lines.every(function (l) { return /^\s*[-*]\s+/.test(l); });
        if (isBullets) {
          return '<ul>' + lines.map(function (l) {
            return '<li>' + esc(l.replace(/^\s*[-*]\s+/, '')) + '</li>';
          }).join('') + '</ul>';
        }
        return '<p>' + esc(trimmed) + '</p>';
      }).join('\n');

      return (
        '<section class="doc-section" id="' + esc(id) + '">' +
        '  <h2>' + esc(headingText) + '</h2>' +
        '  <div class="doc-section__body">' + bodyMarkup + '</div>' +
        '</section>'
      );
    }).join('\n');

    var caseStudyHref = resolveUrl('projects/project.html?id=' + encodeURIComponent(project.id));
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

    contentEl.innerHTML = headerHtml + '\n' + sectionsHtml + '\n' + footerAction;
  }

  document.addEventListener('DOMContentLoaded', function () {
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
        if (docContentEl) renderDocContentContainer(docNavEl, docContentEl, project);
      })
      .catch(function (err) {
        console.warn('Could not load project data:', err);
        if (projectDetailEl) renderProjectDetailContainer(projectDetailEl, null);
        if (docContentEl) renderDocContentContainer(docNavEl, docContentEl, null);
      });
  });
})();
