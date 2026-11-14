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
 * @property {(value: number|string) => string} pad2 - Left-pads a number or short string to 2 digits.
 * @property {(value: any, fallback?: string) => string} slugify - Converts text to a URL-safe slug.
 * @property {Record<string, { id: string, file: string, label: string }>} SKILL_ICONS - Canonical skill icon metadata map.
 * @property {(name: string) => ({ id: string, file: string, label: string } | null)} resolveSkillIcon - Looks up skill icon metadata.
 * @property {(html: string) => Element|null} createFromTemplate - Builds an element from an HTML string via a template element.
 * @property {(button: Element, ok: boolean, options?: { copiedClass?: string, captureLabel?: boolean, fallbackLabel?: string }) => void} reportCopyFeedback - Announces clipboard copy result on a trigger button.
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
    const ADMIN_STORAGE_PREFIX = 'portfolio-admin-data:';
    const ADMIN_DATASETS = ['pages', 'projects', 'experience', 'socials'];

    const SKILL_ICON_ENTRIES = {
        html: { id: 'html', file: 'html.svg', label: 'HTML5' },
        css: { id: 'css', file: 'css.svg', label: 'CSS3' },
        javascript: { id: 'javascript', file: 'javascript.svg', label: 'JavaScript' },
        git: { id: 'git', file: 'git.svg', label: 'Git' },
        github: { id: 'github', file: 'github.svg', label: 'GitHub' },
        vscode: { id: 'vscode', file: 'vscode.svg', label: 'VS Code' },
    };

    const SKILL_ICONS = Object.freeze({
        html: SKILL_ICON_ENTRIES.html,
        html5: SKILL_ICON_ENTRIES.html,
        css: SKILL_ICON_ENTRIES.css,
        css3: SKILL_ICON_ENTRIES.css,
        javascript: SKILL_ICON_ENTRIES.javascript,
        js: SKILL_ICON_ENTRIES.javascript,
        git: SKILL_ICON_ENTRIES.git,
        github: SKILL_ICON_ENTRIES.github,
        vscode: SKILL_ICON_ENTRIES.vscode,
        'vs code': SKILL_ICON_ENTRIES.vscode,
    });

    const copyFeedbackTimers = typeof WeakMap === 'function' ? new WeakMap() : null;
    let lastCopyFeedbackMessage = '';

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

    /* ------------------------------------------------------------- Admin Overrides & Request Caching */
    /**
     * Extracts the portfolio dataset name ('pages', 'projects', 'experience', 'socials')
     * from a JSON endpoint URL or path.
     * @param {string} url - Endpoint URL.
     * @returns {string|null} Lowercase dataset name or null.
     */
    function extractDatasetName(url) {
        const clean = String(url || '').split('#')[0];
        const match = /(?:^|\/)data\/(pages|projects|experience|socials)\.json(?:\?.*)?$/i.exec(clean);
        return match ? match[1].toLowerCase() : null;
    }

    function cloneJsonValue(value) {
        if (value === null || value === undefined) return value;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (err) {
            return value;
        }
    }

    /**
     * Reads an admin-customized JSON override from localStorage if present.
     * @param {string} dataset - Dataset name ('pages'|'projects'|'experience'|'socials').
     * @returns {any|null} Parsed override object/array, or null if none stored.
     */
    function getAdminOverride(dataset) {
        const name = String(dataset || '').toLowerCase();
        if (ADMIN_DATASETS.indexOf(name) === -1) return null;
        const storage = global.localStorage;
        if (!storage || typeof storage.getItem !== 'function') return null;
        try {
            const raw = storage.getItem(ADMIN_STORAGE_PREFIX + name);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err) {
            return null;
        }
    }

    /**
     * Clears the in-memory JSON request cache so subsequent fetches read fresh data.
     */
    function clearRequestCache() {
        const cache = requestCache();
        if (cache && typeof cache.clear === 'function') {
            cache.clear();
        }
    }

    function dispatchDataUpdated(dataset) {
        if (typeof document !== 'undefined' && typeof CustomEvent === 'function') {
            try {
                document.dispatchEvent(new CustomEvent('portfolio:data-updated', {
                    detail: { dataset: dataset, source: 'admin' }
                }));
            } catch (err) {
                /* Ignore in headless environments without CustomEvent */
            }
        }
    }

    /**
     * Saves an admin-customized dataset into localStorage, clears the request cache,
     * and dispatches 'portfolio:data-updated' so live page views re-hydrate immediately.
     * @param {string} dataset - Dataset name ('pages'|'projects'|'experience'|'socials').
     * @param {any} value - JSON-serializable dataset payload.
     * @param {{ silent?: boolean }} [options] - Optional settings.
     * @returns {any} Deep clone of stored value.
     */
    function setAdminOverride(dataset, value, options) {
        const name = String(dataset || '').toLowerCase();
        if (ADMIN_DATASETS.indexOf(name) === -1) {
            throw new Error('Unknown portfolio dataset: ' + dataset);
        }
        const storage = global.localStorage;
        if (storage && typeof storage.setItem === 'function') {
            storage.setItem(ADMIN_STORAGE_PREFIX + name, JSON.stringify(value));
        }
        clearRequestCache();
        if (!options || !options.silent) {
            dispatchDataUpdated(name);
        }
        return cloneJsonValue(value);
    }

    /**
     * Removes one or all admin dataset overrides from localStorage, clears the cache,
     * and dispatches 'portfolio:data-updated'.
     * @param {string} [dataset='all'] - Dataset name or 'all'.
     * @param {{ silent?: boolean }} [options] - Optional settings.
     */
    function clearAdminOverride(dataset, options) {
        const target = !dataset || dataset === 'all' ? 'all' : String(dataset).toLowerCase();
        const names = target === 'all' ? ADMIN_DATASETS : [target];
        const storage = global.localStorage;
        if (storage && typeof storage.removeItem === 'function') {
            names.forEach((name) => {
                if (ADMIN_DATASETS.indexOf(name) !== -1) {
                    storage.removeItem(ADMIN_STORAGE_PREFIX + name);
                }
            });
        }
        clearRequestCache();
        if (!options || !options.silent) {
            dispatchDataUpdated(target);
        }
    }

    /**
     * Retrieves or initializes the shared Promise request cache Map on the global namespace.
     * @returns {Map<string, Promise<any>>} The request cache Map instance.
     */
    function requestCache() {
        const namespace = global.PortfolioUtils || (global.PortfolioUtils = {});
        return namespace[CACHE_KEY] || (namespace[CACHE_KEY] = new Map());
    }

    /**
     * Fetches and parses a JSON endpoint with in-memory Promise caching and admin override support.
     * Concurrent requests for the same URL join the existing in-flight request.
     * Network or HTTP errors resolve to null and remain cached to prevent error cascades.
     *
     * @param {string} url - Target URL or path to fetch.
     * @param {{ bypassAdminOverride?: boolean }} [options] - Optional fetch flags.
     * @returns {Promise<any>} Resolves to parsed JSON object/array, or null on error.
     */
    function fetchJSON(url, options) {
        const key = String(url);
        const bypass = Boolean(options && options.bypassAdminOverride);

        if (!bypass) {
            const dataset = extractDatasetName(key);
            if (dataset) {
                const override = getAdminOverride(dataset);
                if (override !== null) {
                    return Promise.resolve(cloneJsonValue(override));
                }
            }
        }

        const cache = requestCache();
        if (!bypass && cache.has(key)) return cache.get(key);

        const fetchFn = typeof global.__nativeFetch === 'function' ? global.__nativeFetch : fetch;
        const request = fetchFn(key)
            .then((response) => {
                if (!response.ok) throw new Error(`Failed to fetch ${key}: ${response.status}`);
                return response.json();
            })
            .catch((error) => {
                console.error(error);
                return null;
            });

        if (!bypass) {
            cache.set(key, request);
        }
        return request;
    }

    /* ------------------------------------------------------------- Shared Formatting & DOM Helpers */
    /**
     * Left-pads a number or short string to at least 2 characters with '0'.
     * @param {number|string} value
     * @returns {string}
     */
    function pad2(value) {
        return String(value == null ? 0 : value).padStart(2, '0');
    }

    /**
     * Converts a string into a lowercase URL-safe hyphenated slug.
     * @param {any} value
     * @param {string} [fallback='item']
     * @returns {string}
     */
    function slugify(value, fallback) {
        const slug = String(value == null ? '' : value)
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        if (slug) return slug;
        return fallback === undefined || fallback === null || fallback === '' ? 'item' : String(fallback);
    }

    /**
     * Looks up canonical skill icon metadata by skill/technology name.
     * @param {any} name
     * @returns {{ id: string, file: string, label: string }|null}
     */
    function resolveSkillIcon(name) {
        const key = String(name == null ? '' : name).trim().toLowerCase();
        return SKILL_ICONS[key] || null;
    }

    /**
     * Parses an HTML string via an inert <template> element and returns its first child element.
     * @param {string} html
     * @returns {Element|null}
     */
    function createFromTemplate(html) {
        if (typeof document === 'undefined') return null;
        const template = document.createElement('template');
        template.innerHTML = String(html == null ? '' : html).trim();
        return template.content.firstElementChild;
    }

    /**
     * Updates a copy button's temporary visual & screen-reader live-region feedback.
     * @param {Element} button
     * @param {boolean} ok
     * @param {{ copiedClass?: string, captureLabel?: boolean, fallbackLabel?: string }} [options]
     */
    function reportCopyFeedback(button, ok, options) {
        if (!button) return;
        const opts = options && typeof options === 'object' ? options : {};
        const copiedClass = opts.copiedClass || '';
        const tip = button.nextElementSibling;
        const labelNode = button.querySelector('[data-copy-text]');
        const cachedDefault = (button.dataset && button.dataset.copyDefault)
            || (typeof button.getAttribute === 'function' ? button.getAttribute('data-copy-default') : '')
            || (opts.captureLabel && labelNode ? labelNode.textContent : '')
            || '';

        if (opts.captureLabel && button.dataset && !button.dataset.copyDefault && cachedDefault) {
            button.dataset.copyDefault = cachedDefault;
        }
        const defaultLabel = cachedDefault || opts.fallbackLabel || '';

        if (copyFeedbackTimers && copyFeedbackTimers.has(button)) {
            clearTimeout(copyFeedbackTimers.get(button));
        }

        button.removeAttribute('data-copied');
        button.removeAttribute('data-failed');
        if (copiedClass && button.classList) {
            button.classList.remove(copiedClass);
        }

        let message = ok ? 'Copied' : 'Copy failed';
        if (message === lastCopyFeedbackMessage) message += '\u00A0';
        lastCopyFeedbackMessage = message;

        if (tip) tip.textContent = '';
        void button.offsetWidth;

        if (ok) {
            button.setAttribute('data-copied', '');
            if (copiedClass && button.classList) {
                button.classList.add(copiedClass);
            }
            if (labelNode) labelNode.textContent = 'Copied';
        } else {
            button.setAttribute('data-failed', '');
        }

        if (tip) {
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(() => {
                    tip.textContent = message;
                });
            } else {
                tip.textContent = message;
            }
        }

        const timerId = setTimeout(() => {
            button.removeAttribute('data-copied');
            button.removeAttribute('data-failed');
            if (copiedClass && button.classList) {
                button.classList.remove(copiedClass);
            }
            if (labelNode && defaultLabel) {
                labelNode.textContent = defaultLabel;
            }
            if (tip) tip.textContent = '';
        }, 2000);

        if (copyFeedbackTimers) {
            copyFeedbackTimers.set(button, timerId);
        }
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
        getAdminOverride: getAdminOverride,
        setAdminOverride: setAdminOverride,
        clearAdminOverride: clearAdminOverride,
        clearRequestCache: clearRequestCache,
        pad2: pad2,
        slugify: slugify,
        SKILL_ICONS: SKILL_ICONS,
        resolveSkillIcon: resolveSkillIcon,
        createFromTemplate: createFromTemplate,
        reportCopyFeedback: reportCopyFeedback,
    };

    // Publish to global namespace by merging, preserving existing namespace properties (e.g. requestCache)
    global.PortfolioUtils = Object.assign(global.PortfolioUtils || {}, api);

    // Export for CommonJS test environments (Node.js)
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
