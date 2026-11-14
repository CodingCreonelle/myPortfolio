/* =========================================================================
   About-page components.

   Renders the shared component set from the site's JSON: capability cards and
   icon row (used by index.html and about.html), training rows,
   contact cards, and the profile stats + floating trait deck.

   The typewriter and the light/dark theme used to live here; they are now
   shared modules (typewriter.js, theme.js) so every page can use them.

   Follows the project's existing conventions: SITE_ROOT is resolved from this
   script's own URL (same trick as app-loader.js / data-loader.js) and
   window.AnimationObserver drives the staggered entrances.
   ========================================================================= */
(function () {
    'use strict';

    var SITE_ROOT = (window.PortfolioUtils && typeof window.PortfolioUtils.getSiteRoot === 'function')
        ? window.PortfolioUtils.getSiteRoot()
        : (function () {
            var s = document.currentScript || document.querySelector('script[src*="about-page.js"]');
            return s && s.src ? new URL('../../', s.src).href : '';
        })();

    var TRAITS = ['Problem Solver', 'Digital Generalist', 'Detail-Oriented', 'Curious', 'Reliable'];
    var TRAIT_META = {
        'problem solver': {
            kicker: 'Approach',
            accent: '#5ca8ff',
            summary: 'Breaks complex bottlenecks into clean, maintainable systems.'
        },
        'digital generalist': {
            kicker: 'Versatility',
            accent: '#38bdf8',
            summary: 'Connects UI craft, front-end code, and practical product workflows.'
        },
        'detail-oriented': {
            kicker: 'Precision',
            accent: '#a78bfa',
            summary: 'Refines spacing, edge cases, and interactive states until they click.'
        },
        'curious': {
            kicker: 'Mindset',
            accent: '#ffc470',
            summary: 'Continuously explores modern web standards and sharper patterns.'
        },
        'reliable': {
            kicker: 'Delivery',
            accent: '#34d399',
            summary: 'Follows through with readable structure, accessibility, and steady output.'
        }
    };
    var TRAIT_ACCENTS = ['#5ca8ff', '#38bdf8', '#a78bfa', '#ffc470', '#34d399'];

    /* ------------------------------------------------------------- helpers */
    function esc(value) {
        if (window.PortfolioUtils && typeof window.PortfolioUtils.escapeHtml === 'function') {
            return window.PortfolioUtils.escapeHtml(value);
        }
        var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return map[c]; });
    }

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function reduceMotion() {
        if (window.PortfolioUtils && typeof window.PortfolioUtils.reduceMotion === 'function') {
            return window.PortfolioUtils.reduceMotion();
        }
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function fetchJSON(path) {
        var fullUrl = SITE_ROOT + path;
        if (window.PortfolioUtils && typeof window.PortfolioUtils.fetchJSON === 'function') {
            return window.PortfolioUtils.fetchJSON(fullUrl);
        }
        return fetch(fullUrl).then(function (res) {
            if (!res.ok) { throw new Error('Failed to load ' + path); }
            return res.json();
        }).catch(function (err) {
            console.error('About components could not load ' + path + ':', err);
            return null;
        });
    }

    function prettyDate(value) {
        if (!value) { return ''; }
        var parts = String(value).split('-');
        var months = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
        var month = parseInt(parts[1], 10);
        return (month >= 1 && month <= 12) ? months[month - 1] + ' ' + parts[0] : String(value);
    }

    var CONTACT_ICON_FILES = {
        email: 'email.svg',
        mail: 'email.svg',
        github: 'github.svg',
        linkedin: 'linkedin.svg',
        discord: 'discord.svg'
    };

    function icon(name) {
        var paths = {
            ext: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
            copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
            check: '<path d="M20 6 9 17l-5-5"/>'
        };
        return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[name] || '') + '</svg>';
    }

    function resolveContactIconSrc(iconValue) {
        var raw = String(iconValue || '').trim();
        if (!raw) { return ''; }
        if (/^(?:https?:\/\/|data:|\/)/i.test(raw)) { return raw; }
        if (raw.indexOf('/') !== -1) { return SITE_ROOT + raw.replace(/^\/+/, ''); }
        if (/\.(?:svg|png|webp|jpe?g)$/i.test(raw)) {
            return SITE_ROOT + 'assets/icons/contacts/' + raw;
        }
        var file = CONTACT_ICON_FILES[raw.toLowerCase()];
        return file ? (SITE_ROOT + 'assets/icons/contacts/' + file) : '';
    }

    function contactIcon(iconValue, fallbackKey) {
        var src = resolveContactIconSrc(iconValue) || resolveContactIconSrc(fallbackKey);
        if (!src) { return icon('ext'); }
        var isEmail = /(?:^|\/)email\.svg(?:$|\?)/i.test(src) || fallbackKey === 'email' || fallbackKey === 'mail';
        var keyAttr = isEmail ? 'email' : String(fallbackKey || 'custom');
        return '<img class="ab-contact__svg" src="' + esc(src) + '" data-contact-icon="' + esc(keyAttr) + '" alt="" width="22" height="22" loading="lazy" decoding="async">';
    }

    /* -------------------------------------------------------- capabilities */
    /*
     * "What I Can Do" is deliberately two groups: the small icon row lists the
     * languages, and the larger cards describe the tools. Both come from
     * experience.json (languages[] / tools[]) and scale to any number of
     * entries — the icon row wraps and the card grid re-flows on its own.
     */

    function iconPath(item) {
        return SITE_ROOT + 'assets/icons/skills/' + esc(item.icon || '') + '.svg';
    }

    function monogram(name) {
        var words = String(name || '').split(/[^A-Za-z0-9]+/).filter(Boolean);
        if (!words.length) { return '?'; }
        if (words.length === 1) { return words[0].slice(0, 2).toUpperCase(); }
        return words.slice(0, 3).map(function (word) {
            return word.charAt(0);
        }).join('').toUpperCase();
    }

    /*
     * An entry may name an icon that has not been added to
     * assets/icons/skills/ yet. Rather than show a broken image, fall back to a
     * monogram tile so new languages and tools can be added as data alone.
     */
    function addIconFallbacks(root) {
        Array.prototype.forEach.call(root.querySelectorAll('img'), function (img) {
            img.addEventListener('error', function () {
                if (!img.parentNode) { return; }
                var badge = document.createElement('span');
                badge.className = 'ab-skill-mono';
                badge.textContent = img.getAttribute('data-monogram') || '?';
                img.parentNode.replaceChild(badge, img);
            });
        });
    }

    function levelScore(level) {
        var norm = String(level || '').toLowerCase().trim();
        if (norm.indexOf('confident') !== -1 || norm.indexOf('advanced') !== -1 || norm.indexOf('expert') !== -1) {
            return 3;
        }
        if (norm.indexOf('intermediate') !== -1 || norm.indexOf('proficient') !== -1) {
            return 2;
        }
        return norm ? 1 : 0;
    }

    function meterBars(score) {
        var html = '';
        for (var i = 1; i <= 3; i++) {
            html += '<span class="ab-skill-meter__bar' + (i <= score ? ' is-filled' : '') + '"></span>';
        }
        return html;
    }

    function renderLanguages(languages) {
        var list = document.getElementById('ab-skill-icons');
        if (!list) { return; }
        if (!languages || !languages.length) {
            list.innerHTML = '';
            return;
        }

        list.innerHTML = languages.map(function (item) {
            var name = item.name || '';
            var level = item.level || '';
            var score = levelScore(level);
            return '<li class="ab-skill-icon">' +
                '<span class="ab-skill-icon__media" aria-hidden="true">' +
                    '<img src="' + iconPath(item) + '" alt="" width="22" height="22" ' +
                    'data-monogram="' + esc(monogram(name)) + '" loading="lazy">' +
                '</span>' +
                '<span class="ab-skill-icon__body">' +
                    '<span class="ab-skill-icon__label">' + esc(name) + '</span>' +
                    (level ? '<span class="ab-skill-icon__level">' + esc(level) + '</span>' : '') +
                '</span>' +
                (score > 0 ? '<span class="ab-skill-meter" aria-hidden="true">' + meterBars(score) + '</span>' : '') +
            '</li>';
        }).join('');

        addIconFallbacks(list);
    }

    function renderTools(tools) {
        var wrap = document.getElementById('ab-skill-cards');
        if (!wrap) { return; }
        if (!tools || !tools.length) {
            wrap.innerHTML = '';
            return;
        }

        wrap.innerHTML = tools.map(function (item, index) {
            var name = item.name || '';
            var level = item.level || '';
            var summary = item.summary || '';
            var desc = item.description || '';
            var score = levelScore(level);
            return '' +
                '<article class="ab-skill-card">' +
                    '<header class="ab-skill-card__top">' +
                        '<span class="ab-skill-card__icon" aria-hidden="true">' +
                            '<img src="' + iconPath(item) + '" alt="" width="24" height="24" ' +
                            'data-monogram="' + esc(monogram(name)) + '" loading="lazy">' +
                        '</span>' +
                        '<div class="ab-skill-card__badges">' +
                            '<span class="ab-skill-card__num">' + pad(index + 1) + '</span>' +
                            (level
                                ? '<span class="ab-skill-card__level"><span class="ab-skill-card__dot" aria-hidden="true"></span>' + esc(level) + '</span>'
                                : '') +
                        '</div>' +
                    '</header>' +
                    '<h3 class="ab-skill-card__name">' + esc(name) + '</h3>' +
                    '<p class="ab-skill-card__desc">' + esc(desc) + '</p>' +
                    '<footer class="ab-skill-card__foot">' +
                        (summary ? '<span class="ab-pill">' + esc(summary) + '</span>' : '') +
                        (score > 0 ? '<span class="ab-skill-meter" aria-hidden="true">' + meterBars(score) + '</span>' : '') +
                    '</footer>' +
                '</article>';
        }).join('');

        addIconFallbacks(wrap);
    }

    /* ------------------------------------------------------------ trainings */
    function renderTrainings(items) {
        var list = document.getElementById('ab-trainings-list');
        if (!list) { return; }
        if (!items || !items.length) {
            list.innerHTML = '';
            return;
        }

        list.innerHTML = items.map(function (item, index) {
            var tags = (item.tags || []).map(function (tag) {
                return '<span class="ab-tag">' + esc(tag) + '</span>';
            }).join('');
            var step = (window.PortfolioUtils && typeof window.PortfolioUtils.pad2 === 'function')
                ? window.PortfolioUtils.pad2(index + 1)
                : String(index + 1).padStart(2, '0');

            return '' +
                '<li class="ab-train">' +
                    '<div class="ab-train__visual" aria-hidden="true">' +
                        '<span class="ab-train__step">' + esc(step) + '</span>' +
                        '<span class="ab-train__year">' + esc(item.year) + '</span>' +
                    '</div>' +
                    '<div class="ab-train__body">' +
                        '<div class="ab-train__head">' +
                            '<h3 class="ab-train__title">' + esc(item.title) + '</h3>' +
                            '<span class="ab-train__date">' + esc(prettyDate(item.date)) + '</span>' +
                        '</div>' +
                        '<p class="ab-train__meta">' + esc(item.subtitle) + '</p>' +
                        '<p class="ab-train__desc">' + esc(item.description) + '</p>' +
                        '<div class="ab-train__tags">' + tags + '</div>' +
                    '</div>' +
                '</li>';
        }).join('');
    }

    /* ------------------------------------------------------------- contacts */
    var contactAccents = {
        email: '#5ca8ff',
        github: '#a78bfa',
        linkedin: '#38bdf8',
        discord: '#818cf8'
    };

    function bindContactCopy(list) {
        if (!list || list.dataset.copyBound) { return; }
        list.dataset.copyBound = '1';

        list.addEventListener('click', function (e) {
            var btn = e.target.closest('.ab-contact__copy');
            if (!btn || !list.contains(btn)) { return; }
            e.preventDefault();
            e.stopPropagation();

            var value = btn.getAttribute('data-copy-value') || '';
            var wrap = btn.closest('.ab-contact__copy-wrap');
            var tip = wrap ? wrap.querySelector('.ab-contact__tip') : null;
            var glyph = btn.querySelector('.ab-contact__copy-glyph');
            if (!value) { return; }

            var copyPromise = (window.PortfolioUtils && typeof window.PortfolioUtils.copyToClipboard === 'function')
                ? window.PortfolioUtils.copyToClipboard(value)
                : (navigator.clipboard && navigator.clipboard.writeText
                    ? navigator.clipboard.writeText(value).then(function () { return true; }).catch(function () { return false; })
                    : Promise.resolve(false));

            Promise.resolve(copyPromise).then(function (ok) {
                var text = ok ? 'Copied' : 'Copy failed';
                btn.removeAttribute('data-copied');
                btn.removeAttribute('data-failed');
                btn.setAttribute(ok ? 'data-copied' : 'data-failed', '1');
                if (glyph) {
                    glyph.innerHTML = icon(ok ? 'check' : 'copy');
                }
                if (tip) {
                    tip.textContent = tip.textContent === text ? text + '\u00A0' : text;
                }
                clearTimeout(btn._copyResetTimer);
                btn._copyResetTimer = setTimeout(function () {
                    btn.removeAttribute('data-copied');
                    btn.removeAttribute('data-failed');
                    if (glyph) {
                        glyph.innerHTML = icon('copy');
                    }
                    if (tip) {
                        tip.textContent = '';
                    }
                }, 2000);
            });
        });
    }

    function normalizeSocialEntry(key, rawEntry, defaults) {
        var isObj = rawEntry && typeof rawEntry === 'object';
        var rawVal = isObj
            ? String(rawEntry.value || rawEntry.url || rawEntry.href || '').trim()
            : String(rawEntry || '').trim();
        if (!rawVal) { return null; }

        var isHttp = /^https?:\/\//i.test(rawVal);
        var isMailto = /^mailto:/i.test(rawVal);
        var cleanVal = isMailto ? rawVal.replace(/^mailto:/i, '') : rawVal;
        var defaultHref = (defaults && defaults.isEmail)
            ? ('mailto:' + cleanVal)
            : ((isHttp || isMailto) ? rawVal : null);
        var href = (isObj && rawEntry.href) ? String(rawEntry.href).trim() : defaultHref;
        var defaultAction = (defaults && defaults.action) || (isHttp ? 'link' : 'copy');
        var action = (isObj && rawEntry.action) ? String(rawEntry.action).trim().toLowerCase() : defaultAction;
        var isCopy = action === 'copy';
        var isLink = action === 'link';

        return {
            key: String(key || '').toLowerCase(),
            label: (isObj && rawEntry.label) ? String(rawEntry.label).trim() : ((defaults && defaults.label) || key),
            value: cleanVal,
            href: href,
            icon: (isObj && rawEntry.icon) ? String(rawEntry.icon).trim() : ((defaults && defaults.icon) || key),
            external: Boolean(href) && (isLink || (!isCopy && isHttp)),
            copyable: isCopy || (!isLink && !href)
        };
    }

    function renderContacts(socials) {
        var list = document.getElementById('ab-contact-cards');
        if (!list || !socials) { return; }

        var coreDefaults = {
            email: { label: 'Email', icon: 'email', action: 'copy', isEmail: true },
            github: { label: 'GitHub', icon: 'github', action: 'link' },
            linkedin: { label: 'LinkedIn', icon: 'linkedin', action: 'link' },
            discord: { label: 'Discord', icon: 'discord', action: 'copy' }
        };
        var coreKeys = ['email', 'github', 'linkedin', 'discord'];
        var entries = [];

        coreKeys.forEach(function (key) {
            var item = normalizeSocialEntry(key, socials[key], coreDefaults[key]);
            if (item) { entries.push(item); }
        });

        Object.keys(socials).forEach(function (key) {
            if (coreKeys.indexOf(key) !== -1) { return; }
            var item = normalizeSocialEntry(key, socials[key], null);
            if (item) { entries.push(item); }
        });

        list.innerHTML = entries.map(function (entry, index) {
            var shown = String(entry.value).replace(/^https?:\/\//, '').replace(/\/$/, '');
            var accent = contactAccents[entry.key] || '#34d399';
            var copyOnly = !entry.href && entry.copyable;
            var cardClass = 'ab-contact__card' + (copyOnly ? ' ab-contact__card--copy-only' : '');

            var valueNode;
            if (entry.href) {
                var linkAttrs = ' href="' + esc(entry.href) + '"';
                if (entry.external) { linkAttrs += ' target="_blank" rel="noreferrer"'; }
                valueNode = '<a class="ab-contact__link"' + linkAttrs + '>' + esc(shown) + '</a>';
            } else {
                valueNode = '<span class="ab-contact__value">' + esc(shown) + '</span>';
            }

            var trailing = '';
            if (entry.copyable) {
                var copyBtnClass = 'ab-contact__copy' + (copyOnly ? ' ab-contact__copy--full' : '');
                trailing = '' +
                    '<span class="ab-contact__copy-wrap">' +
                        '<button type="button" class="' + copyBtnClass + '" data-copy-value="' + esc(shown) + '" aria-label="Copy ' + esc(entry.label) + ' ' + esc(shown) + '">' +
                            '<span class="ab-contact__copy-glyph" aria-hidden="true">' + icon('copy') + '</span>' +
                        '</button>' +
                        '<span class="ab-contact__tip" role="status"></span>' +
                    '</span>';
            } else if (entry.external || entry.href) {
                trailing = '<span class="ab-contact__ext" aria-hidden="true">' + icon('ext') + '</span>';
            }

            return '' +
                '<li class="ab-contact__item">' +
                    '<article class="' + cardClass + '" style="--contact-accent:' + accent + '">' +
                        '<span class="ab-contact__icon" aria-hidden="true">' + contactIcon(entry.icon, entry.key) + '</span>' +
                        '<span class="ab-contact__text">' +
                            '<span class="ab-contact__meta">' +
                                '<span class="ab-contact__label">' + esc(entry.label) + '</span>' +
                                '<span class="ab-contact__index" aria-hidden="true">' + pad(index + 1) + '</span>' +
                            '</span>' +
                            valueNode +
                        '</span>' +
                        '<span class="ab-contact__actions">' + trailing + '</span>' +
                    '</article>' +
                '</li>';
        }).join('');

        bindContactCopy(list);
    }

    /* -------------------------------------------------------------- profile */
    function renderProfile(projects, languages, tools, timeline) {
        var stats = document.getElementById('ab-profile-stats');
        if (stats) {
            var years = (timeline || []).map(function (item) { return parseInt(item.year, 10); })
                .filter(function (year) { return !isNaN(year); });
            var since = years.length ? Math.min.apply(null, years) : null;

            var cells = [
                { label: 'Projects', value: projects.length },
                { label: 'Languages', value: languages.length },
                { label: 'Tools', value: tools.length },
                { label: 'Since', value: since || '—' }
            ];

            stats.innerHTML = cells.map(function (cell) {
                return '<li class="ab-stat">' +
                    '<span class="ab-stat__label">' + esc(cell.label) + '</span>' +
                    '<span class="ab-stat__value">' + esc(cell.value) + '</span>' +
                '</li>';
            }).join('');
        }

        var deck = document.getElementById('ab-trait-deck');
        var value = document.getElementById('ab-trait-value');
        var kickerEl = document.getElementById('ab-trait-kicker');
        var summaryEl = document.getElementById('ab-trait-summary');
        var countEl = document.getElementById('ab-trait-count');
        var barsEl = document.getElementById('ab-trait-bars');
        var triggerEl = document.getElementById('ab-trait-trigger');
        var traitWrap = deck ? deck.closest('.ab-trait') : null;
        if (!deck || !value) { return; }

        function normalizeTrait(item, index) {
            var labelText = '';
            var customSummary = '';
            var customKicker = '';
            if (typeof item === 'string') {
                labelText = item.trim();
            } else if (item && typeof item === 'object') {
                labelText = String(item.title || item.text || item.label || '').trim();
                customSummary = String(item.summary || (item.title && item.text ? item.text : '') || '').trim();
                customKicker = String(item.kicker || item.tag || '').trim();
            }
            var fallback = TRAIT_META[labelText.toLowerCase()] || {};
            return {
                title: labelText || TRAITS[index % TRAITS.length],
                kicker: customKicker || fallback.kicker || ('Trait ' + pad(index + 1)),
                accent: fallback.accent || TRAIT_ACCENTS[index % TRAIT_ACCENTS.length],
                summary: customSummary || fallback.summary || 'Core working principle behind every project build.'
            };
        }

        /* The trait words live in data/pages.json; wait for it so an edit there
           wins over the built-in fallback list. */
        function rotate(rawTraits) {
            var traits = (Array.isArray(rawTraits) && rawTraits.length ? rawTraits : TRAITS)
                .map(normalizeTrait);
            if (!traits.length) { return; }

            if (deck._traitTimer) {
                window.clearInterval(deck._traitTimer);
                deck._traitTimer = null;
            }
            if (deck._swapTimer) {
                window.clearTimeout(deck._swapTimer);
                deck._swapTimer = null;
            }
            if (deck._cycleTimer) {
                window.clearTimeout(deck._cycleTimer);
                deck._cycleTimer = null;
            }

            deck._traitList = traits;
            deck._traitIndex = 0;

            function renderBars(activeIdx) {
                if (!barsEl) { return; }
                barsEl.innerHTML = traits.map(function (_item, idx) {
                    return '<span class="ab-trait__bar' + (idx === activeIdx ? ' is-active' : '') + '"></span>';
                }).join('');
            }

            function applyTraitState(idx) {
                var item = traits[idx];
                if (!item) { return; }
                value.textContent = item.title;
                if (kickerEl) { kickerEl.textContent = item.kicker; }
                if (summaryEl) { summaryEl.textContent = item.summary; }
                if (countEl) { countEl.textContent = pad(idx + 1) + ' / ' + pad(traits.length); }
                if (traitWrap) { traitWrap.style.setProperty('--trait-accent', item.accent); }
                if (triggerEl) {
                    triggerEl.setAttribute(
                        'aria-label',
                        'Next personal trait (' + item.title + ', ' + (idx + 1) + ' of ' + traits.length + ')'
                    );
                }
                renderBars(idx);
            }

            function stepTo(nextIdx) {
                var list = deck._traitList || traits;
                if (!list.length) { return; }
                var normalizedIdx = ((nextIdx % list.length) + list.length) % list.length;
                deck._traitIndex = normalizedIdx;

                var main = deck.querySelector('.ab-trait__main');
                if (reduceMotion() || !main) {
                    applyTraitState(normalizedIdx);
                    return;
                }

                if (deck._swapTimer) { window.clearTimeout(deck._swapTimer); }
                if (deck._cycleTimer) { window.clearTimeout(deck._cycleTimer); }

                main.classList.add('is-swapping');
                deck.classList.add('is-cycling');

                deck._swapTimer = window.setTimeout(function () {
                    applyTraitState(normalizedIdx);
                    main.classList.remove('is-swapping');
                }, 170);

                deck._cycleTimer = window.setTimeout(function () {
                    deck.classList.remove('is-cycling');
                }, 260);
            }

            function startAutoAdvance() {
                if (deck._traitTimer) {
                    window.clearInterval(deck._traitTimer);
                    deck._traitTimer = null;
                }
                if (reduceMotion() || deck._traitPaused || traits.length < 2) { return; }
                deck._traitTimer = window.setInterval(function () {
                    stepTo(deck._traitIndex + 1);
                }, 3400);
            }

            function stepBy(delta) {
                stepTo(deck._traitIndex + delta);
                startAutoAdvance();
            }

            deck._stepBy = stepBy;
            deck._startAutoAdvance = startAutoAdvance;
            applyTraitState(0);
            startAutoAdvance();

            if (!deck.dataset.traitBound) {
                deck.dataset.traitBound = 'true';

                deck.addEventListener('click', function (event) {
                    var dirBtn = event.target.closest('[data-trait-dir]');
                    if (dirBtn) {
                        var dir = dirBtn.getAttribute('data-trait-dir') === 'prev' ? -1 : 1;
                        if (typeof deck._stepBy === 'function') { deck._stepBy(dir); }
                        return;
                    }
                    if (event.target.closest('.ab-trait__trigger') || event.target.closest('.ab-trait__card')) {
                        if (typeof deck._stepBy === 'function') { deck._stepBy(1); }
                    }
                });

                deck.addEventListener('keydown', function (event) {
                    if (event.key === 'ArrowLeft') {
                        event.preventDefault();
                        if (typeof deck._stepBy === 'function') { deck._stepBy(-1); }
                    } else if (event.key === 'ArrowRight') {
                        event.preventDefault();
                        if (typeof deck._stepBy === 'function') { deck._stepBy(1); }
                    }
                });

                deck.addEventListener('mouseenter', function () {
                    deck._traitPaused = true;
                    if (deck._traitTimer) {
                        window.clearInterval(deck._traitTimer);
                        deck._traitTimer = null;
                    }
                });

                deck.addEventListener('mouseleave', function () {
                    deck._traitPaused = false;
                    if (typeof deck._startAutoAdvance === 'function') { deck._startAutoAdvance(); }
                });

                deck.addEventListener('focusin', function () {
                    deck._traitPaused = true;
                    if (deck._traitTimer) {
                        window.clearInterval(deck._traitTimer);
                        deck._traitTimer = null;
                    }
                });

                deck.addEventListener('focusout', function (event) {
                    if (event.relatedTarget && deck.contains(event.relatedTarget)) { return; }
                    deck._traitPaused = false;
                    if (typeof deck._startAutoAdvance === 'function') { deck._startAutoAdvance(); }
                });
            }
        }

        if (window.SiteContent && window.SiteContent.ready) {
            window.SiteContent.ready.then(function () {
                rotate(window.SiteContent.get('about.profile.traits') || TRAITS);
            }, function () { rotate(TRAITS); });
        } else {
            rotate(TRAITS);
        }
    }

    /* ------------------------------------------------------------ bootstrap */
    function init() {
        var mounts = {
            skills:    !!document.getElementById('ab-skill-cards'),
            trainings: !!document.getElementById('ab-trainings-list'),
            contacts:  !!document.getElementById('ab-contact-cards'),
            profile:   !!document.getElementById('ab-profile-stats') ||
                       !!document.getElementById('ab-trait-deck')
        };

        var needsExperience = mounts.skills || mounts.trainings || mounts.profile;
        var needsProjects = mounts.profile;
        var needsSocials = mounts.contacts;

        // Pages that use none of these components skip the fetches entirely.
        if (!needsExperience && !needsProjects && !needsSocials) { return; }

        Promise.all([
            needsProjects ? fetchJSON('data/projects.json') : Promise.resolve([]),
            needsExperience ? fetchJSON('data/experience.json') : Promise.resolve({}),
            needsSocials ? fetchJSON('data/socials.json') : Promise.resolve({})
        ]).then(function (results) {
            var projects = results[0] || [];
            var experience = results[1] || {};
            var socials = results[2] || {};
            var languages = experience.languages || [];
            var tools = experience.tools || [];
            var timeline = experience.timeline || [];

            if (mounts.skills) {
                renderLanguages(languages);
                renderTools(tools);
            }
            if (mounts.trainings) { renderTrainings(timeline); }
            if (mounts.contacts) { renderContacts(socials); }
            if (mounts.profile) { renderProfile(projects, languages, tools, timeline); }

            if (window.AnimationObserver && window.AnimationObserver.triggerStagger) {
                ['ab-skill-cards', 'ab-contact-cards', 'ab-trainings-list']
                    .forEach(function (id) {
                        var el = document.getElementById(id);
                        if (el) { window.AnimationObserver.triggerStagger(el, 'card-entrance', 90); }
                    });
            }
            if (window.AnimationObserver && typeof window.AnimationObserver.refresh === 'function') {
                window.AnimationObserver.refresh();
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    document.addEventListener('portfolio:data-updated', init);
})();
