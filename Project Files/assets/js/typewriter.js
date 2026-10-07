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

    function init() {
        var targets = document.querySelectorAll(SELECTOR);
        if (!targets.length || reduceMotion()) { return; }

        Array.prototype.forEach.call(targets, function (el) {
            if (el.getAttribute(ACTIVE_ATTR) === 'true') { return; }

            var full = el.textContent.trim();
            if (!full) { return; }

            el.setAttribute(ACTIVE_ATTR, 'true');
            el.setAttribute(TEXT_ATTR, full);
            el.textContent = '';

            var observer = new IntersectionObserver(function (entries, obs) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) { return; }
                    obs.unobserve(el);
                    type(el);
                });
            }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

            observer.observe(el);
        });
    }

    window.Typewriter = { init: init };

    /* Wait for the JSON copy so we type the final text, not the markup fallback. */
    if (window.SiteContent && window.SiteContent.ready) {
        window.SiteContent.ready.then(init, init);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
