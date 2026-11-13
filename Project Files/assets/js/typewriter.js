/* =========================================================================
   Unified Cyber-Decode Typewriter Headings.

   Drives both [data-typewriter] and [data-work-typewriter] elements across all
   pages with adaptive typing cadence, cipher-glyph scramble tail, glowing
   caret states, and replay support when sections re-enter the viewport.

   Reduced-motion users immediately receive the full heading without animation.
   ========================================================================= */
(function () {
    'use strict';

    var SELECTOR = '[data-typewriter], [data-work-typewriter]';
    var TEXT_ATTR = 'data-typewriter-text';
    var ACTIVE_ATTR = 'data-typewriter-active';
    var GLYPHS = '01/_<>[]*+•';

    function reduceMotion() {
        if (typeof window !== 'undefined' && window.PortfolioUtils && typeof window.PortfolioUtils.reduceMotion === 'function') {
            return window.PortfolioUtils.reduceMotion();
        }
        return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function cancelActiveTyping(el) {
        if (el && el._twTimer) {
            window.clearTimeout(el._twTimer);
            el._twTimer = 0;
            var full = resolveFullText(el);
            if (full) {
                el.textContent = full;
            }
        }
    }

    function resolveFullText(el) {
        if (!el) { return ''; }
        var bindPath = el.getAttribute('data-bind');
        if (bindPath && window.SiteContent && typeof window.SiteContent.get === 'function') {
            var boundValue = window.SiteContent.get(bindPath);
            if (typeof boundValue === 'string' && boundValue.trim()) {
                return boundValue.trim();
            }
        }
        var stored = el.getAttribute(TEXT_ATTR) || (el.dataset ? el.dataset.text : '');
        if (stored) { return stored.trim(); }
        return (el.textContent || '').trim();
    }

    function renderDecodeFrame(el, prefix, scrambleTail, pendingSuffix) {
        el.textContent = '';
        if (prefix) {
            el.appendChild(document.createTextNode(prefix));
        }
        if (scrambleTail) {
            var span = document.createElement('span');
            span.className = 'tw-scramble';
            span.setAttribute('aria-hidden', 'true');
            span.textContent = scrambleTail;
            el.appendChild(span);
        }
        var caret = document.createElement('span');
        caret.className = 'tw-caret';
        caret.setAttribute('aria-hidden', 'true');
        el.appendChild(caret);
        if (pendingSuffix) {
            var pendingSpan = document.createElement('span');
            pendingSpan.className = 'tw-pending';
            pendingSpan.textContent = pendingSuffix;
            el.appendChild(pendingSpan);
        }
    }

    function typeElement(el, forceReplay) {
        if (!el) { return; }
        var full = resolveFullText(el);
        if (!full) { return; }

        el.setAttribute(TEXT_ATTR, full);
        el.setAttribute(ACTIVE_ATTR, 'true');
        if (el.dataset) {
            el.dataset.text = full;
            el.dataset.typed = 'true';
            el.dataset.typewriterBuilt = 'true';
        }
        el.setAttribute('data-bind-ignore', 'true');

        if (!forceReplay && (el.classList.contains('is-typing') || el.classList.contains('is-done'))) {
            el.textContent = full;
            return;
        }

        cancelActiveTyping(el);

        if (reduceMotion()) {
            el.textContent = full;
            el.classList.remove('is-typing');
            el.classList.add('is-done');
            return;
        }

        el.classList.remove('is-done');
        el.classList.add('is-typing');

        var stepChars = full.length > 28 ? 2 : 1;
        var tickMs = Math.max(24, Math.min(48, Math.round(900 / Math.max(12, Math.ceil(full.length / stepChars)))));
        var i = 0;

        renderDecodeFrame(el, '', '', full);

        function step() {
            i = Math.min(full.length, i + stepChars);
            if (i < full.length) {
                var nextChar = full.charAt(i);
                var glitch = nextChar === ' ' ? '' : GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
                var remainingStart = glitch ? Math.min(full.length, i + 1) : i;
                renderDecodeFrame(el, full.slice(0, i), glitch, full.slice(remainingStart));
                el._twTimer = window.setTimeout(step, tickMs);
            } else {
                el._twTimer = 0;
                el.textContent = full;
                el.classList.remove('is-typing');
                el.classList.add('is-done');
            }
        }

        el._twTimer = window.setTimeout(step, 40);
    }

    var observer = null;

    function sharedObserver() {
        if (observer) { return observer; }

        observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) { return; }
                observer.unobserve(entry.target);
                typeElement(entry.target, false);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });

        return observer;
    }

    function replayWithin(root) {
        if (!root || typeof root.querySelectorAll !== 'function') { return; }
        var targets = root.querySelectorAll(SELECTOR);
        Array.prototype.forEach.call(targets, function (el) {
            typeElement(el, true);
        });
    }

    function init() {
        var targets = document.querySelectorAll(SELECTOR);
        if (!targets.length) { return; }

        var isReduced = reduceMotion();
        var canObserve = 'IntersectionObserver' in window;

        Array.prototype.forEach.call(targets, function (el) {
            var full = resolveFullText(el);
            if (!full) { return; }

            if (isReduced) {
                el.setAttribute(TEXT_ATTR, full);
                el.setAttribute(ACTIVE_ATTR, 'true');
                el.textContent = full;
                el.classList.remove('is-typing');
                el.classList.add('is-done');
                return;
            }

            if (el.getAttribute(ACTIVE_ATTR) === 'true') { return; }

            el.setAttribute(ACTIVE_ATTR, 'true');
            el.setAttribute(TEXT_ATTR, full);
            if (el.dataset) { el.dataset.text = full; }

            if (!canObserve) {
                typeElement(el, false);
                return;
            }

            el.textContent = full;
            sharedObserver().observe(el);
        });
    }

    window.Typewriter = {
        init: init,
        typeElement: typeElement,
        replayWithin: replayWithin,
    };

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
