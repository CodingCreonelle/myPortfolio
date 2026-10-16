/* =========================================================================
   Shared helpers.

   Three kinds of duplication end here: the prefers-reduced-motion check, the
   JSON fetch, and the HTML escaping every renderer needs before it interpolates
   data into a template string.

   escapeHtml and safeUrl are deliberately pure and dependency-free. They are the
   only thing standing between JSON and innerHTML, so they must not depend on the
   DOM, on load order, or on each other.

   window.PortfolioUtils is published by merging rather than assigning. This
   file's <script> tag is added per page by the HTML, so a page can load it after
   a consumer has already fallen back to a local copy; merging keeps both sides
   working and, because the request cache lives on the namespace, keeps one
   request per URL no matter which copy answers.
   ========================================================================= */
(function (global) {
    'use strict';

    const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    /*
     * Every interpolated value goes through here. null and undefined render as
     * empty text rather than the words "null"/"undefined", which is what the
     * renderers already expect of a missing optional field.
     */
    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ESCAPES[character]);
    }

    const SAFE_SCHEME = /^(?:https?|mailto)$/i;
    const ANY_SCHEME = /^([a-z][a-z0-9+.-]*):/i;
    /* Tab, newline and the other C0 controls are stripped by the URL parser
       before it reads a scheme, so "java\tscript:" has to be refused outright
       rather than trusted to fail the scheme test. */
    const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

    /*
     * A URL out of the data is accepted only when it is a fragment, a
     * site-relative path, a protocol-relative address, http(s) or mailto.
     * Everything else - javascript:, data:, vbscript: and every other scheme -
     * becomes '#'. Callers put the result in href/src, so this is the one check
     * that keeps an authored URL from being a program.
     */
    function safeUrl(value) {
        const url = String(value == null ? '' : value).trim();
        if (!url || CONTROL_CHARACTERS.test(url)) return '#';

        const scheme = ANY_SCHEME.exec(url);
        if (scheme && !SAFE_SCHEME.test(scheme[1])) return '#';

        return url;
    }

    const ALLOWED_TAGS = ('p br h2 h3 h4 ul ol li code pre strong em b i a span ' +
        'blockquote hr table thead tbody tr th td').split(' ');

    /* Dropped with their contents: a child of these is code or a nested document,
       not prose, so unwrapping one would leak its text into the page. */
    const DROPPED_TAGS = ('script style iframe object embed form svg math base link ' +
        'meta noscript template audio video canvas').split(' ');

    const ALLOWED_ATTRIBUTES = { a: ['href', 'title'], code: ['class'], pre: ['class'] };

    function unwrap(element) {
        const parent = element.parentNode;
        if (!parent) return;
        while (element.firstChild) parent.insertBefore(element.firstChild, element);
        parent.removeChild(element);
    }

    function stripAttributes(element, tag) {
        const allowed = ALLOWED_ATTRIBUTES[tag] || [];

        Array.from(element.attributes).forEach((attribute) => {
            const name = attribute.name.toLowerCase();
            const isAddress = name === 'href' || name === 'src';

            if (allowed.indexOf(name) === -1 || (isAddress && safeUrl(attribute.value) === '#')) {
                element.removeAttribute(attribute.name);
            }
        });
    }

    /*
     * The prose fields in data/projects.json are authored HTML and are inserted
     * as markup, on purpose. That makes the data trusted by convention, which is
     * the assumption worth removing: an allowlist here means a hand-edited (or
     * later, remote) JSON file cannot introduce a script, an event handler or a
     * javascript: URL. Anything not on the list keeps its text and loses its tag.
     *
     * A <template> is the parser because it is inert - nothing inside it loads,
     * runs or renders while it is being cleaned.
     */
    function sanitizeHtml(html) {
        if (typeof document === 'undefined') {
            throw new Error('PortfolioUtils.sanitizeHtml needs a DOM to parse HTML in.');
        }

        const template = document.createElement('template');
        template.innerHTML = String(html == null ? '' : html);

        /* Snapshot first: the walk rewrites the tree underneath it. */
        Array.from(template.content.querySelectorAll('*')).forEach((element) => {
            const tag = element.tagName.toLowerCase();

            if (DROPPED_TAGS.indexOf(tag) !== -1) {
                element.remove();
                return;
            }
            if (ALLOWED_TAGS.indexOf(tag) === -1) {
                unwrap(element);
                return;
            }
            stripAttributes(element, tag);
        });

        return template.innerHTML;
    }

    /* One check instead of the five copies this replaced. */
    function reduceMotion() {
        return typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    const CACHE_KEY = 'requestCache';

    function requestCache() {
        const namespace = global.PortfolioUtils || (global.PortfolioUtils = {});
        return namespace[CACHE_KEY] || (namespace[CACHE_KEY] = new Map());
    }

    /*
     * One request per URL per page load. The cache holds the promise rather than
     * the parsed body, so two callers asking in the same tick - data-loader.js
     * and about-page.js share two of their three files on the homepage - join the
     * request already in flight instead of starting another.
     *
     * A failure stays cached as a resolved null: the contract is one request per
     * URL, and every caller renders absent data as an empty section.
     */
    function fetchJSON(url) {
        const key = String(url);
        const cache = requestCache();
        if (cache.has(key)) return cache.get(key);

        const request = fetch(key)
            .then((response) => {
                if (!response.ok) throw new Error(`Failed to fetch ${key}: ${response.status}`);
                return response.json();
            })
            .catch((error) => {
                console.error(error);
                return null;
            });

        cache.set(key, request);
        return request;
    }

    const api = {
        escapeHtml: escapeHtml,
        safeUrl: safeUrl,
        sanitizeHtml: sanitizeHtml,
        reduceMotion: reduceMotion,
        fetchJSON: fetchJSON,
    };

    global.PortfolioUtils = Object.assign({}, global.PortfolioUtils, api);

    /* Node has no window, so the harness that counts requests and exercises the
       escaping can require this file directly. */
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
