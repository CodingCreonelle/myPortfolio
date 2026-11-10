/* =========================================================================
   Shared helpers & Core Kernel Architecture (PortfolioUtils).

   Centralized utility kernel for the Charles David Portfolio:
   - HTML escaping (escapeHtml) & DOM-template sanitization (sanitizeHtml)
   - Protocol/scheme validation (safeUrl)
   - Accessibility & animation preference (reduceMotion)
   - Cross-browser async clipboard copy with legacy fallback (copyToClipboard)
   - Cached Promise-based JSON fetching (fetchJSON)
   - Canonical site root resolution (getSiteRoot)

   Published via dual UMD/CommonJS interface for browser and Node.js testing.
   ========================================================================= */

/**
 * @typedef {Object} PortfolioUtilsAPI
 * @property {(value: any) => string} escapeHtml - Escapes HTML special characters (&, <, >, ", ').
 * @property {(value: any) => string} safeUrl - Sanitizes URL, preventing dangerous schemes (javascript:, data:, etc.).
 * @property {(html: string) => string} sanitizeHtml - Sanitizes authored HTML using an inert template DOM element.
 * @property {() => boolean} reduceMotion - Detects if the user prefers reduced motion.
 * @property {(text: string) => Promise<boolean>} copyToClipboard - Copies text via modern Clipboard API with textarea fallback.
 * @property {(url: string) => Promise<any>} fetchJSON - Fetches and caches JSON, deduplicating concurrent in-flight requests.
 * @property {(customUrl?: string) => string} getSiteRoot - Resolves the canonical site root URL from script location.
 */

(function (global) {
    'use strict';

    /* ------------------------------------------------------------- Constants */
    const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    const SAFE_SCHEME = /^(?:https?|mailto)$/i;
    const ANY_SCHEME = /^([a-z][a-z0-9+.-]*):/i;
    /* Tab, newline and the other C0 controls are stripped by the URL parser
       before it reads a scheme, so "java\tscript:" has to be refused outright
       rather than trusted to fail the scheme test. */
    const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

    const ALLOWED_TAGS = ('p br h2 h3 h4 ul ol li code pre strong em b i a span ' +
        'blockquote hr table thead tbody tr th td').split(' ');

    /* Dropped with their contents: a child of these is code or a nested document,
       not prose, so unwrapping one would leak its text into the page. */
    const DROPPED_TAGS = ('script style iframe object embed form svg math base link ' +
        'meta noscript template audio video canvas').split(' ');

    const ALLOWED_ATTRIBUTES = { a: ['href', 'title'], code: ['class'], pre: ['class'] };

    const CACHE_KEY = 'requestCache';

    /* ------------------------------------------------------------- Script URL & Site Root */
    /**
     * Resolves the absolute URL of utils.js as loaded in the current document.
     * @returns {string} Absolute script URL or empty string if not in DOM.
     */
    function findScriptUrl() {
        if (typeof document === 'undefined') return '';
        if (document.currentScript && document.currentScript.src) {
            return document.currentScript.src;
        }
        const script = document.querySelector('script[src*="utils.js"]') ||
                       document.querySelector('script[src*="assets/js/"]');
        return script && script.src ? script.src : '';
    }

    // Cache the detected script URL at initial script evaluation time
    const initialScriptUrl = findScriptUrl();

    /**
     * Computes the canonical site root path matching new URL('../../', scriptUrl).href.
     * Because utils.js resides at assets/js/utils.js, navigating two directory segments up
     * reaches the application root directory across root paths, subpaths, and file:// URLs.
     *
     * @param {string} [customUrl] - Optional script URL override for explicit resolution.
     * @returns {string} Canonical site root URL ending in a slash, or empty string if unresolvable.
     */
    function getSiteRoot(customUrl) {
        const target = customUrl || initialScriptUrl || findScriptUrl();
        if (!target) return '';
        try {
            return new URL('../../', target).href;
        } catch {
            return '';
        }
    }

    /* ------------------------------------------------------------- HTML Escaping & Sanitization */
    /**
     * Escapes HTML special characters in any value before template interpolation.
     * Null and undefined values are rendered as empty strings.
     *
     * @param {any} value - Value to interpolate.
     * @returns {string} Escaped HTML string safe for innerHTML insertion.
     */
    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ESCAPES[character]);
    }

    /**
     * Validates and sanitizes an authored URL. Only safe schemes (http, https, mailto),
     * site-relative paths, protocol-relative addresses, and fragments are permitted.
     * Unsafe URLs (javascript:, data:, vbscript:, etc.) or strings with control characters
     * resolve to '#'.
     *
     * @param {any} value - Authored URL value.
     * @returns {string} Safe URL string or '#'.
     */
    function safeUrl(value) {
        const url = String(value == null ? '' : value).trim();
        if (!url || CONTROL_CHARACTERS.test(url)) return '#';

        const scheme = ANY_SCHEME.exec(url);
        if (scheme && !SAFE_SCHEME.test(scheme[1])) return '#';

        return url;
    }

    /**
     * Unwraps a DOM element by promoting its children to its parent and removing the element.
     * @param {Element} element - DOM element to unwrap.
     */
    function unwrap(element) {
        const parent = element.parentNode;
        if (!parent) return;
        while (element.firstChild) parent.insertBefore(element.firstChild, element);
        parent.removeChild(element);
    }

    /**
     * Strips disallowed attributes and validates href/src values via safeUrl.
     * @param {Element} element - DOM element to inspect.
     * @param {string} tag - Lowercase tag name.
     */
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

    /**
     * Sanitizes authored HTML using an inert <template> element parser.
     * Strips dangerous tags (script, iframe, style, etc.), unwraps unlisted tags,
     * removes disallowed attributes, and validates address attributes.
     *
     * @param {string} html - Raw authored HTML markup.
     * @returns {string} Sanitized HTML string safe for DOM insertion.
     * @throws {Error} If called in an environment without DOM document support.
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

    /* ------------------------------------------------------------- Motion Preferences */
    /**
     * Checks if the user has requested reduced motion via prefers-reduced-motion media query.
     *
     * @returns {boolean} True if reduced motion is requested, false otherwise.
     */
    function reduceMotion() {
        return typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /* ------------------------------------------------------------- Clipboard Copy */
    /**
     * Synchronous DOM fallback for clipboard copying using a temporary hidden textarea
     * and document.execCommand('copy').
     *
     * @param {string} text - Text to copy.
     * @returns {boolean} True if copy succeeded, false otherwise.
     */
    function fallbackCopy(text) {
        if (typeof document === 'undefined' || !document.body) return false;
        let area = null;
        try {
            area = document.createElement('textarea');
            area.value = String(text == null ? '' : text);
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.left = '-9999px';
            area.style.top = '0';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.focus();
            area.select();
            if (typeof area.setSelectionRange === 'function') {
                area.setSelectionRange(0, area.value.length);
            }
            const successful = document.execCommand('copy');
            return successful !== false;
        } catch (err) {
            return false;
        } finally {
            if (area) {
                if (area.parentNode) {
                    area.parentNode.removeChild(area);
                } else if (document.body && typeof document.body.removeChild === 'function') {
                    document.body.removeChild(area);
                }
            }
        }
    }

    /**
     * Copies text to clipboard using the modern asynchronous Clipboard API (navigator.clipboard.writeText),
     * automatically falling back to document.execCommand('copy') on older browsers or non-HTTPS origins.
     * Never rejects; resolves to true on success and false on failure.
     *
     * @param {string} text - Text string to copy.
     * @returns {Promise<boolean>} Resolves to true if copying succeeded, false otherwise.
     */
    function copyToClipboard(text) {
        const textToCopy = String(text == null ? '' : text);
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(textToCopy)
                .then(() => true)
                .catch(() => fallbackCopy(textToCopy));
        }
        return Promise.resolve(fallbackCopy(textToCopy));
    }

    /* ------------------------------------------------------------- Fetch & Request Caching */
    /**
     * Retrieves or initializes the shared Promise request cache Map on the global namespace.
     * @returns {Map<string, Promise<any>>} The request cache Map instance.
     */
    function requestCache() {
        const namespace = global.PortfolioUtils || (global.PortfolioUtils = {});
        return namespace[CACHE_KEY] || (namespace[CACHE_KEY] = new Map());
    }

    /**
     * Fetches and parses a JSON endpoint with in-memory Promise caching.
     * Concurrent requests for the same URL join the existing in-flight request.
     * Network or HTTP errors resolve to null and remain cached to prevent error cascades.
     *
     * @param {string} url - Target URL or path to fetch.
     * @returns {Promise<any>} Resolves to parsed JSON object/array, or null on error.
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

    /* ------------------------------------------------------------- Public API Export */
    /** @type {PortfolioUtilsAPI} */
    const api = {
        escapeHtml: escapeHtml,
        safeUrl: safeUrl,
        sanitizeHtml: sanitizeHtml,
        reduceMotion: reduceMotion,
        copyToClipboard: copyToClipboard,
        fetchJSON: fetchJSON,
        getSiteRoot: getSiteRoot,
    };

    // Publish to global namespace by merging, preserving existing namespace properties (e.g. requestCache)
    global.PortfolioUtils = Object.assign(global.PortfolioUtils || {}, api);

    // Export for CommonJS test environments (Node.js)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
