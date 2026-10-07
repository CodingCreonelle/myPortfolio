/* =========================================================================
   Page content.

   All page copy lives in data/pages.json, keyed by page. This module fetches
   it and fills the markup, so adding or changing content is a JSON edit rather
   than an HTML edit.

   It is deliberately progressive: each element keeps its original text in the
   HTML, and the JSON only overwrites it once it has loaded. If the fetch fails
   the page still reads correctly.

   Directives
     data-bind="path"            sets textContent
     data-bind-src|alt|href|class|title="path"   sets that attribute
     data-list="path"            repeats; children built from an optional
                                 <template id="..."> named by
                                 data-list-template, otherwise by data-list-tag
                                 (default <li>) and data-list-field
                                 (default "text")

   Paths are relative to the page's own object, e.g. on about.html
   data-bind="profile.name" resolves to pages.about.profile.name. Inside a
   data-list template they are relative to the current item.

   window.SiteContent = { ready, get(path), page } is exposed so other modules
   (typewriter.js, about-page.js) can wait for the content and read from it.
   ========================================================================= */
(function () {
    'use strict';

    var SCRIPT_URL = document.currentScript ? document.currentScript.src : '';
    var SITE_ROOT = SCRIPT_URL ? new URL('../../', SCRIPT_URL).href : '';

    /* index.html is the homepage; anything unmapped (project detail, docs)
       simply gets no bindings. */
    var PAGE_KEYS = {
        'index': 'home',
        'about': 'about',
        'contact': 'contact',
        'projects': 'projects'
    };

    function pageFile() {
        var file = window.location.pathname.split('/').pop() || 'index.html';
        return file.replace(/\.html?$/i, '') || 'index';
    }

    var pageKey = PAGE_KEYS[pageFile()] || null;
    var data = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* Resolution base for the current binding context. */
    function baseScope(scope) {
        if (scope !== undefined) { return scope; }
        return pageKey ? data[pageKey] : undefined;
    }

    function resolve(path, scope) {
        if (!path) { return undefined; }
        var node = baseScope(scope);
        var parts = String(path).split('.');
        for (var i = 0; i < parts.length; i++) {
            if (node === null || node === undefined) { return undefined; }
            node = node[parts[i]];
        }
        return node;
    }

    function get(path) {
        if (!data || !path) { return undefined; }
        /* Absolute paths reach across page objects; otherwise stay on this page. */
        if (path.charAt(0) === '/') {
            return resolve(path.slice(1), data);
        }
        return resolve(path, pageKey ? data[pageKey] : data);
    }

    function applyBindings(el, scope) {
        /* work-gallery.js rebuilds this heading into per-character spans for its
           typing animation; overwriting it afterwards would destroy that. */
        if (el.hasAttribute('data-work-typewriter') && el.dataset.typewriterBuilt === 'true') {
            return;
        }

        var text = el.getAttribute('data-bind');
        if (text) {
            var value = resolve(text, scope);
            if (value !== undefined && value !== null) { el.textContent = value; }
        }

        ['src', 'alt', 'href', 'class', 'title', 'placeholder'].forEach(function (attr) {
            var path = el.getAttribute('data-bind-' + attr);
            if (!path) { return; }
            var resolved = resolve(path, scope);
            if (resolved === undefined || resolved === null) { return; }
            if (attr === 'class') { el.className = resolved; }
            else { el.setAttribute(attr, resolved); }
        });
    }

    function renderList(container, scope) {
        var items = resolve(container.getAttribute('data-list'), scope);
        if (!Array.isArray(items)) { return; }

        var tag = container.getAttribute('data-list-tag') || 'li';
        var field = container.getAttribute('data-list-field') || 'text';
        var templateId = container.getAttribute('data-list-template');
        var template = templateId ? document.getElementById(templateId) : null;

        container.innerHTML = items.map(function (item) {
            if (template) {
                var host = document.createElement('div');
                host.appendChild(template.content.cloneNode(true));
                bindWithin(host, item);
                return host.innerHTML;
            }
            if (item !== null && typeof item === 'object') {
                return '<' + tag + '>' + escapeHtml(item[field]) + '</' + tag + '>';
            }
            return '<' + tag + '>' + escapeHtml(item) + '</' + tag + '>';
        }).join('');
    }

    function bindWithin(root, scope) {
        var nodes = [root].concat(Array.prototype.slice.call(root.querySelectorAll('*')));

        /* Lists first: they inject the children the bindings then fill. */
        nodes.forEach(function (el) {
            if (el.hasAttribute && el.hasAttribute('data-list')) { renderList(el, scope); }
        });
        nodes.forEach(function (el) {
            if (el.hasAttribute) { applyBindings(el, scope); }
        });
    }

    function afterContent() {
        /* Typed headings and scroll entrances may have been injected after their
           modules initialised, so let both re-scan. */
        if (window.Typewriter && window.Typewriter.init) { window.Typewriter.init(); }
        if (window.AnimationObserver && window.AnimationObserver.refresh) {
            window.AnimationObserver.refresh();
        }
    }

    var ready = Promise.resolve();

    if (pageKey) {
        ready = fetch(SITE_ROOT + 'data/pages.json')
            .then(function (response) {
                if (!response.ok) { throw new Error('Failed to load data/pages.json'); }
                return response.json();
            })
            .then(function (json) {
                data = json;
                bindWithin(document, undefined);
                afterContent();
                return json;
            })
            .catch(function (error) {
                /* The markup already holds the copy, so this is not fatal. */
                console.error('Page content could not be loaded:', error);
                return null;
            });
    }

    window.SiteContent = { ready: ready, get: get, page: pageKey };
})();
