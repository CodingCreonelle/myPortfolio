/* =========================================================================
   About-page components.

   Renders the shared component set from the site's JSON: capability cards and
   icon row (used by index.html and about.html), training rows, archive rows,
   contact cards, and the profile stats + floating trait deck.

   The typewriter and the light/dark theme used to live here; they are now
   shared modules (typewriter.js, theme.js) so every page can use them.

   Follows the project's existing conventions: SITE_ROOT is resolved from this
   script's own URL (same trick as app-loader.js / data-loader.js) and
   window.AnimationObserver drives the staggered entrances.
   ========================================================================= */
(function () {
    'use strict';

    var SCRIPT_URL = document.currentScript ? document.currentScript.src : '';
    var SITE_ROOT = SCRIPT_URL ? new URL('../../', SCRIPT_URL).href : '';

    var TRAITS = ['Problem Solver', 'Digital Generalist', 'Detail-Oriented', 'Curious', 'Reliable'];

    /* ------------------------------------------------------------- helpers */
    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function reduceMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function fetchJSON(path) {
        return fetch(SITE_ROOT + path).then(function (res) {
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

    function icon(name) {
        var paths = {
            mail: '<path d="M3 6.5h18v11H3z"/><path d="M3 7l9 6 9-6"/>',
            github: '<path d="M9 19c-4 1.2-4-2.2-6-2.8m12 5.3v-3.6a3 3 0 0 0-.9-2.4c3-.3 5-1.9 5-6a4.7 4.7 0 0 0-1.3-3.2 4.4 4.4 0 0 0-.1-3.3s-1.4-.4-4.6 1.7a11 11 0 0 0-6 0C3.9 2.6 2.5 3 2.5 3a4.4 4.4 0 0 0-.1 3.3A4.7 4.7 0 0 0 1 9.5c0 4.1 2 5.7 5 6a3 3 0 0 0-.9 2.3V21"/>',
            linkedin: '<path d="M5 9v10M5 5.5v.01M10 19v-5.5a3 3 0 0 1 6 0V19"/><path d="M10 9v10"/>',
            discord: '<path d="M8.5 17.5S7 19 5.5 19.5c0 0-2.5-3.5-2.5-8a13 13 0 0 1 4-3l1 1.5a11 11 0 0 1 4 0L13 8.5a13 13 0 0 1 4 3c0 4.5-2.5 8-2.5 8-1.5-.5-3-2-3-2"/><path d="M9.5 13v.01M14.5 13v.01"/>',
            ext: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
        };
        return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (paths[name] || '') + '</svg>';
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

    function renderLanguages(languages) {
        var list = document.getElementById('ab-skill-icons');
        if (!list || !languages.length) { return; }

        list.innerHTML = languages.map(function (item) {
            var name = item.name || '';
            var title = name + (item.level ? ' \u2014 ' + item.level : '');
            return '<li class="ab-skill-icon" title="' + esc(title) + '">' +
                '<img src="' + iconPath(item) + '" alt="' + esc(name) + '" ' +
                'data-monogram="' + esc(monogram(name)) + '" loading="lazy"></li>';
        }).join('');

        addIconFallbacks(list);
    }

    function renderTools(tools) {
        var wrap = document.getElementById('ab-skill-cards');
        if (!wrap || !tools.length) { return; }

        wrap.innerHTML = tools.map(function (item, index) {
            return '' +
                '<article class="ab-skill-card">' +
                    '<div class="ab-skill-card__top">' +
                        '<span class="ab-skill-card__num">' + pad(index + 1) + '</span>' +
                        '<span class="ab-skill-card__label">' + esc(item.level || '') + '</span>' +
                    '</div>' +
                    '<span class="ab-skill-card__icon">' +
                        '<img src="' + iconPath(item) + '" alt="" ' +
                        'data-monogram="' + esc(monogram(item.name)) + '" loading="lazy">' +
                    '</span>' +
                    '<h3 class="ab-skill-card__name">' + esc(item.name) + '</h3>' +
                    '<p class="ab-skill-card__desc">' + esc(item.description || '') + '</p>' +
                    '<div class="ab-skill-card__foot">' +
                        (item.summary ? '<span class="ab-pill">' + esc(item.summary) + '</span>' : '') +
                        (item.level ? '<span class="ab-pill">' + esc(item.level) + '</span>' : '') +
                    '</div>' +
                '</article>';
        }).join('');

        addIconFallbacks(wrap);
    }

    /* ------------------------------------------------------------ trainings */
    function renderTrainings(items) {
        var list = document.getElementById('ab-trainings-list');
        if (!list || !items.length) { return; }

        list.innerHTML = items.map(function (item) {
            var tags = (item.tags || []).map(function (tag) {
                return '<span class="ab-tag">' + esc(tag) + '</span>';
            }).join('');

            return '' +
                '<li class="ab-train">' +
                    '<div class="ab-train__visual" aria-hidden="true">' +
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

    /* -------------------------------------------------------------- archive */
    function renderArchive(projects) {
        var list = document.getElementById('ab-archive-list');
        if (!list || !projects.length) { return; }

        list.innerHTML = projects.map(function (project, index) {
            var stack = (project.technologies || project.tags || []).join(' &middot; ');
            return '' +
                '<li class="ab-arch">' +
                    '<span class="ab-arch__num">' + pad(index + 1) + '</span>' +
                    '<div class="ab-arch__body">' +
                        '<h3 class="ab-arch__title">' + esc(project.title) + '</h3>' +
                        '<p class="ab-arch__desc">' + esc(project.summary) + '</p>' +
                        (stack ? '<p class="ab-arch__stack">' + stack + '</p>' : '') +
                    '</div>' +
                    '<span class="ab-arch__year">' + esc(project.status || '') + '</span>' +
                '</li>';
        }).join('');
    }

    /* ------------------------------------------------------------- contacts */
    function renderContacts(socials) {
        var list = document.getElementById('ab-contact-cards');
        if (!list || !socials) { return; }

        var entries = [
            { label: 'Email', value: socials.email, href: 'mailto:' + socials.email, icon: 'mail' },
            { label: 'GitHub', value: socials.github, href: socials.github, icon: 'github', external: true },
            { label: 'LinkedIn', value: socials.linkedin, href: socials.linkedin, icon: 'linkedin', external: true },
            { label: 'Discord', value: socials.discord, href: null, icon: 'discord' }
        ].filter(function (entry) { return entry.value; });

        list.innerHTML = entries.map(function (entry, index) {
            var shown = String(entry.value).replace(/^https?:\/\//, '').replace(/\/$/, '');
            var tag = entry.href ? 'a' : 'div';
            var attrs = entry.href ? ' href="' + esc(entry.href) + '"' : '';
            if (entry.external) { attrs += ' target="_blank" rel="noreferrer"'; }

            return '' +
                '<li class="ab-contact__item">' +
                    '<' + tag + ' class="ab-contact__card"' + attrs + '>' +
                        '<span class="ab-contact__icon" aria-hidden="true">' + icon(entry.icon) + '</span>' +
                        '<span class="ab-contact__text">' +
                            '<span class="ab-contact__label">' + esc(entry.label) + '</span>' +
                            '<span class="ab-contact__value">' + esc(shown) + '</span>' +
                        '</span>' +
                        '<span class="ab-contact__index" aria-hidden="true">' + pad(index + 1) + '</span>' +
                        (entry.external ? '<span class="ab-contact__ext" aria-hidden="true">' +
                            icon('ext') + '</span>' : '') +
                    '</' + tag + '>' +
                '</li>';
        }).join('');
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
        if (!deck || !value || reduceMotion()) { return; }

        /* The trait words live in data/pages.json; wait for it so an edit there
           wins over the built-in fallback list. */
        function rotate(traits) {
            if (!traits || !traits.length) { return; }

            value.textContent = traits[0];
            var index = 0;

            window.setInterval(function () {
                index = (index + 1) % traits.length;
                var card = deck.querySelector('.ab-trait__card');
                if (!card) { return; }
                card.classList.add('is-swapping');
                window.setTimeout(function () {
                    value.textContent = traits[index];
                    card.classList.remove('is-swapping');
                }, 260);
            }, 2200);
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
            archive:   !!document.getElementById('ab-archive-list'),
            contacts:  !!document.getElementById('ab-contact-cards'),
            profile:   !!document.getElementById('ab-profile-stats') ||
                       !!document.getElementById('ab-trait-deck')
        };

        var needsExperience = mounts.skills || mounts.trainings || mounts.profile;
        var needsProjects = mounts.archive || mounts.profile;
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
            if (mounts.archive) { renderArchive(projects); }
            if (mounts.contacts) { renderContacts(socials); }
            if (mounts.profile) { renderProfile(projects, languages, tools, timeline); }

            if (window.AnimationObserver && window.AnimationObserver.triggerStagger) {
                ['ab-skill-cards', 'ab-contact-cards', 'ab-trainings-list', 'ab-archive-list']
                    .forEach(function (id) {
                        var el = document.getElementById(id);
                        if (el) { window.AnimationObserver.triggerStagger(el, 'card-entrance', 90); }
                    });
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
