/**
 * Featured work deck — stacked card carousel + heading typewriter.
 *
 * `initWorkGallery(projects)` is called by `data-loader.js` once
 * `data/projects.json` resolves. Filtering prefers entries with
 * `featured: true` and falls back to the full list so the stage is never
 * left empty while projects exist.
 */
(function () {
  var SLOTS = ['active', 'next', 'prev', 'hidden'];
  var TYPE_SPEED = 55;
  var SWIPE_THRESHOLD = 44;

  var SKILL_ICON_BASE = 'assets/icons/skills/';
  var SKILL_ICONS = {
    html:       { file: 'html.svg',       label: 'HTML5' },
    html5:      { file: 'html.svg',       label: 'HTML5' },
    css:        { file: 'css.svg',        label: 'CSS3' },
    css3:       { file: 'css.svg',        label: 'CSS3' },
    javascript: { file: 'javascript.svg', label: 'JavaScript' },
    js:         { file: 'javascript.svg', label: 'JavaScript' },
    git:        { file: 'git.svg',        label: 'Git' },
    github:     { file: 'github.svg',     label: 'GitHub' },
    vscode:     { file: 'vscode.svg',     label: 'VS Code' },
    'vs code':  { file: 'vscode.svg',     label: 'VS Code' }
  };

  var prefersReducedMotion = function () {
    if (window.PortfolioUtils && typeof window.PortfolioUtils.reduceMotion === 'function') {
      return window.PortfolioUtils.reduceMotion();
    }
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  };

  var pad2 = function (n) {
    return String(n).padStart(2, '0');
  };

  function resolveSkillIcons(tech) {
    if (!Array.isArray(tech)) return [];
    var seen = {};
    var out = [];
    tech.forEach(function (name) {
      var key = String(name || '').trim().toLowerCase();
      var hit = SKILL_ICONS[key];
      if (hit && !seen[hit.file]) {
        seen[hit.file] = true;
        out.push(hit);
      }
    });
    return out;
  }

  function buildCard(project, index, total) {
    var article = document.createElement('article');
    article.className = 'work-card';
    article.dataset.index = String(index);
    article.setAttribute('role', 'group');
    article.setAttribute('aria-roledescription', 'slide');
    article.setAttribute(
      'aria-label',
      (index + 1) + ' of ' + total + ': ' + (project.title || 'Project')
    );

    var media = document.createElement('div');
    media.className = 'work-card__media';
    if (project.image) {
      var img = document.createElement('img');
      img.src = project.image;
      img.alt = project.imageAlt || project.title || '';
      img.loading = 'lazy';
      media.appendChild(img);
    } else {
      var placeholder = document.createElement('div');
      placeholder.className = 'work-card__media-placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      var num = document.createElement('span');
      num.className = 'work-card__media-num';
      num.textContent = pad2(index + 1);
      placeholder.appendChild(num);
      media.appendChild(placeholder);
    }

    var body = document.createElement('div');
    body.className = 'work-card__body';

    var topMeta = document.createElement('div');
    topMeta.className = 'work-card__top-meta';

    var indexLabel = document.createElement('p');
    indexLabel.className = 'work-card__index';
    indexLabel.textContent = pad2(index + 1) + ' / ' + pad2(total);
    topMeta.appendChild(indexLabel);

    if (project && project.status) {
      var statusBadge = document.createElement('span');
      statusBadge.className = 'work-card__status';
      statusBadge.textContent = project.status;
      topMeta.appendChild(statusBadge);
    }

    var title = document.createElement('h3');
    title.className = 'work-card__title';
    title.textContent = project.title || 'Untitled project';

    var summary = document.createElement('p');
    summary.className = 'work-card__summary';
    summary.textContent = project.summary || project.description || '';

    var stack = document.createElement('p');
    stack.className = 'work-card__stack';
    stack.textContent =
      Array.isArray(project.tech) && project.tech.length > 0
        ? project.tech.join(' \u00B7 ')
        : '';

    var icons = resolveSkillIcons(project.tech);
    var iconsRow = null;
    if (icons.length > 0) {
      iconsRow = document.createElement('ul');
      iconsRow.className = 'work-card__icons';
      iconsRow.setAttribute('aria-label', 'Technologies used');
      icons.forEach(function (icon) {
        var item = document.createElement('li');
        item.className = 'work-card__icon';
        item.title = icon.label;

        var iconImg = document.createElement('img');
        iconImg.src = SKILL_ICON_BASE + icon.file;
        iconImg.alt = icon.label;
        iconImg.width = 20;
        iconImg.height = 20;
        iconImg.loading = 'lazy';

        item.appendChild(iconImg);
        iconsRow.appendChild(item);
      });
    }

    var link = document.createElement('a');
    link.className = 'work-card__link';
    link.href = 'projects/project.html?id=' + encodeURIComponent(project.id);
    link.appendChild(document.createTextNode('View project'));
    var arrow = document.createElement('span');
    arrow.className = 'work-card__link-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '&#8594;';
    link.appendChild(arrow);

    body.appendChild(topMeta);
    body.appendChild(title);
    body.appendChild(summary);
    if (stack.textContent) body.appendChild(stack);
    if (iconsRow) body.appendChild(iconsRow);
    body.appendChild(link);

    article.appendChild(media);
    article.appendChild(body);
    return article;
  }

  function setInteractivity(card, isActive) {
    if (isActive) {
      card.removeAttribute('aria-hidden');
      card.removeAttribute('inert');
    } else {
      card.setAttribute('aria-hidden', 'true');
      card.setAttribute('inert', '');
    }
    var focusables = card.querySelectorAll('a, button, input, [tabindex]');
    focusables.forEach(function (el) {
      if (isActive) {
        el.removeAttribute('tabindex');
      } else {
        el.setAttribute('tabindex', '-1');
      }
    });
  }

  function assignSlots(cards, activeIndex) {
    var total = cards.length;
    cards.forEach(function (card, idx) {
      var slot = 'hidden';
      if (idx === activeIndex) {
        slot = 'active';
      } else if (total > 1 && idx === (activeIndex + 1) % total) {
        slot = 'next';
      } else if (total > 2 && idx === (activeIndex - 1 + total) % total) {
        slot = 'prev';
      }
      SLOTS.forEach(function (s) {
        if (s !== slot) card.classList.remove('work-card--' + s);
      });
      card.classList.add('work-card--' + slot);
      setInteractivity(card, slot === 'active');
    });
  }

  function runTypewriter(section) {
    var target = section.querySelector('[data-work-typewriter]');
    if (!target || target.dataset.typed === 'true') return;

    var fullText = (target.dataset.text || target.textContent || '').trim();
    if (!fullText) return;
    target.dataset.text = fullText;
    target.dataset.typed = 'true';
    target.dataset.typewriterBuilt = 'true';
    target.setAttribute('data-bind-ignore', 'true');

    if (prefersReducedMotion()) {
      target.textContent = fullText;
      return;
    }

    var startTyping = function () {
      target.textContent = '';
      target.classList.add('is-typing');
      var i = 0;
      var tick = function () {
        i += 1;
        target.textContent = fullText.slice(0, i);
        if (i < fullText.length) {
          window.setTimeout(tick, TYPE_SPEED);
        } else {
          target.classList.remove('is-typing');
          target.classList.add('is-done');
        }
      };
      window.setTimeout(tick, 180);
    };

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              io.disconnect();
              startTyping();
            }
          });
        },
        { threshold: 0.35 }
      );
      io.observe(section);
    } else {
      startTyping();
    }
  }

  function initWorkGallery(projects) {
    var section = document.querySelector('.work-gallery');
    var deck = document.getElementById('featured-projects');
    if (!section || !deck) return;

    runTypewriter(section);

    var list = Array.isArray(projects) ? projects : [];
    var featured = list.filter(function (p) { return p && p.featured; });
    if (featured.length === 0) featured = list;

    var prevBtn = section.querySelector('[data-work-prev]');
    var nextBtn = section.querySelector('[data-work-next]');
    var counterEl = section.querySelector('[data-work-counter]');
    var totalEl = section.querySelector('[data-work-total]');
    var liveEl = section.querySelector('[data-work-live]');

    deck.innerHTML = '';

    if (featured.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'work-gallery__empty';
      empty.textContent = 'Featured projects coming soon.';
      deck.appendChild(empty);
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      return;
    }

    var total = featured.length;
    var cards = featured.map(function (project, idx) {
      var card = buildCard(project, idx, total);
      deck.appendChild(card);
      return card;
    });

    if (totalEl) totalEl.textContent = pad2(total);
    if (prevBtn) prevBtn.disabled = total < 2;
    if (nextBtn) nextBtn.disabled = total < 2;

    var active = 0;

    var goTo = function (nextIndex, announce) {
      if (total === 0) return;
      active = ((nextIndex % total) + total) % total;
      assignSlots(cards, active);
      if (counterEl) counterEl.textContent = pad2(active + 1);
      if (announce && liveEl) {
        var current = featured[active];
        liveEl.textContent =
          'Showing project ' +
          (active + 1) +
          ' of ' +
          total +
          ': ' +
          (current && current.title ? current.title : '');
      }
    };

    goTo(0, false);

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        goTo(active - 1, true);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        goTo(active + 1, true);
      });
    }

    cards.forEach(function (card, idx) {
      card.addEventListener('click', function (event) {
        if (idx !== active) {
          event.preventDefault();
          goTo(idx, true);
        }
      });
    });

    section.addEventListener('keydown', function (event) {
      if (total < 2) return;
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo(active + 1, true);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo(active - 1, true);
      } else if (event.key === 'Home') {
        event.preventDefault();
        goTo(0, true);
      } else if (event.key === 'End') {
        event.preventDefault();
        goTo(total - 1, true);
      }
    });

    var touchStartX = null;
    var touchStartY = null;
    deck.addEventListener(
      'touchstart',
      function (event) {
        if (event.touches.length !== 1) return;
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
      },
      { passive: true }
    );

    deck.addEventListener(
      'touchend',
      function (event) {
        if (touchStartX === null || event.changedTouches.length === 0) return;
        var dx = event.changedTouches[0].clientX - touchStartX;
        var dy = event.changedTouches[0].clientY - touchStartY;
        touchStartX = null;
        touchStartY = null;
        if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
          goTo(dx < 0 ? active + 1 : active - 1, true);
        }
      },
      { passive: true }
    );
  }

  window.initWorkGallery = initWorkGallery;
})();
