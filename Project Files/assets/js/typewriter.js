/* =========================================================================
   Typewriter headings.

   Types out the text of every [data-typewriter] element as it scrolls into
   view. The heading text may come from data/pages.json, so this waits for
   window.SiteContent before starting, and init() is re-runnable and idempotent
   (an element already being typed is left alone).

   Reduced-motion users get the finished heading with no typing.
   ========================================================================= */
(function () {
    'use strict';

    var SELECTOR = '[data-typewriter]';
    var TEXT_ATTR = 'data-typewriter-text';
    var ACTIVE_ATTR = 'data-typewriter-active';
    var SPEED = 55; // ms per character

    function reduceMotion() {
        if (typeof window !== 'undefined' && window.PortfolioUtils && typeof window.PortfolioUtils.reduceMotion === 'function') {
            return window.PortfolioUtils.reduceMotion();
        }
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function type(el) {
        var full = el.getAttribute(TEXT_ATTR) || el.textContent.trim();
        if (!full) { return; }
        el.textContent = '';

        var i = 0;
        (function step() {
            el.textContent = full.slice(0, ++i);
            if (i < full.length) { window.setTimeout(step, SPEED); }
        })();
    }

    var observer = null;

    /* One observer for every heading: the callback keys off entry.target, so a
       single instance can watch them all. */
    function sharedObserver() {
        if (observer) { return observer; }

        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) { return; }
                observer.unobserve(entry.target);
                type(entry.target);
            });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

        return observer;
    }

    function init() {
        var targets = document.querySelectorAll(SELECTOR);
        if (!targets.length || reduceMotion()) { return; }

        // Without IntersectionObserver the constructor would throw, so the text is
        // left in place rather than erased and never typed back.
        var canObserve = 'IntersectionObserver' in window;

        Array.prototype.forEach.call(targets, function (el) {
            if (el.getAttribute(ACTIVE_ATTR) === 'true') { return; }

            var full = el.textContent.trim();
            if (!full) { return; }

            el.setAttribute(ACTIVE_ATTR, 'true');
            el.setAttribute(TEXT_ATTR, full);

            if (!canObserve) { return; }

            el.textContent = '';
            sharedObserver().observe(el);
        });
    }

    window.Typewriter = { init: init };

    /* Decoupled event listener: responds whenever dynamic page content is rendered. */
    if (typeof document !== 'undefined') {
        document.addEventListener('portfolio:content-ready', function () {
            init();
        });
    }

    /* Wait for the JSON copy so we type the final text, not the markup fallback. */
    if (window.SiteContent && window.SiteContent.ready) {
        window.SiteContent.ready.then(init, init);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
