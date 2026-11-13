/* =========================================================================
   Theme.

   Swaps the palette by setting [data-theme] on <html>; the palette itself and
   the toggle's sun/moon icon both live in CSS (variables.css, navbar.css), so
   this file only needs to remember the choice and toggle it.

   The click is handled by delegation on the document rather than by binding to
   the button. app-loader.js injects the navbar asynchronously, so a bound
   listener would depend on winning a race against that injection; delegation
   works whenever the button turns up.
   ========================================================================= */
(function () {
    'use strict';

    var KEY = 'portfolio-theme';
    var DARK = 'dark';
    var LIGHT = 'light';
    var fallbackTimer = 0;

    function stored() {
        try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
    }

    /* Falls back to the OS preference when nothing valid is stored. Without
       this, a first-time visitor on a light-set OS would still get the dark
       palette, because the only other signal we have is localStorage. */
    function preferred() {
        return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? LIGHT : DARK;
    }

    function current() {
        var value = stored();
        if (value === LIGHT || value === DARK) { return value; }

        var resolved = preferred();
        // Present but unusable (typo, stale key): replace it with what we resolved.
        if (value !== null) {
            try { window.localStorage.setItem(KEY, resolved); } catch (e) { /* ignore */ }
        }
        return resolved;
    }

    function prefersReducedMotion() {
        if (window.PortfolioUtils && typeof window.PortfolioUtils.reduceMotion === 'function') {
            return window.PortfolioUtils.reduceMotion();
        }
        return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    /* Keeps the palette and the toggle's accessible state in step. Only
       attributes are written here, never innerHTML — the icon is CSS-driven —
       so the MutationObserver below cannot feed back into itself. */
    function apply(theme) {
        document.documentElement.setAttribute('data-theme', theme);

        var pressed = theme === LIGHT ? 'true' : 'false';
        var label = theme === LIGHT ? 'Switch to dark theme' : 'Switch to light theme';

        Array.prototype.forEach.call(
            document.querySelectorAll('[data-theme-toggle]'),
            function (button) {
                button.setAttribute('aria-pressed', pressed);
                button.setAttribute('aria-label', label);
            }
        );
    }

    function setRevealOrigin(button, event) {
        var root = document.documentElement;
        var vw = Math.max(1, window.innerWidth || 1280);
        var vh = Math.max(1, window.innerHeight || 720);
        var x = vw * 0.5;
        var y = vh * 0.5;

        if (button && typeof button.getBoundingClientRect === 'function') {
            var rect = button.getBoundingClientRect();
            if (rect.width > 0 || rect.height > 0) {
                x = rect.left + rect.width * 0.5;
                y = rect.top + rect.height * 0.5;
            }
        } else if (event && typeof event.clientX === 'number' && typeof event.clientY === 'number') {
            x = event.clientX;
            y = event.clientY;
        }

        var maxRadius = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));
        root.style.setProperty('--theme-x', Math.round(x) + 'px');
        root.style.setProperty('--theme-y', Math.round(y) + 'px');
        root.style.setProperty('--theme-r', Math.ceil(maxRadius) + 'px');
    }

    function clearTransitionState() {
        if (fallbackTimer) {
            window.clearTimeout(fallbackTimer);
            fallbackTimer = 0;
        }
        document.documentElement.removeAttribute('data-theme-transition');
    }

    function toggle(button, event) {
        var next = current() === LIGHT ? DARK : LIGHT;
        try { window.localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }

        if (prefersReducedMotion()) {
            clearTransitionState();
            apply(next);
            return;
        }

        setRevealOrigin(button, event);

        if (typeof document.startViewTransition === 'function') {
            clearTransitionState();
            document.documentElement.setAttribute('data-theme-transition', 'view');
            try {
                var transition = document.startViewTransition(function () {
                    apply(next);
                });
                if (transition && transition.finished && typeof transition.finished.then === 'function') {
                    transition.finished.then(clearTransitionState, clearTransitionState);
                } else {
                    clearTransitionState();
                }
                return;
            } catch (e) {
                clearTransitionState();
            }
        }

        clearTransitionState();
        document.documentElement.setAttribute('data-theme-transition', 'css');
        apply(next);
        fallbackTimer = window.setTimeout(clearTransitionState, 420);
    }

    document.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || typeof target.closest !== 'function') { return; }
        var button = target.closest('[data-theme-toggle]');
        if (!button) { return; }
        toggle(button, event);
    });

    // Apply the saved palette as early as possible.
    apply(current());

    // Re-apply when the navbar arrives so aria-pressed is right from the start,
    // then stop observing as soon as the toggle has been decorated.
    // Attribute writes do not trigger a childList observer, so this is safe.
    var observer = new MutationObserver(function () {
        apply(current());
        if (document.querySelector('[data-theme-toggle]')) {
            observer.disconnect();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Fallback only, for the case where the navbar never arrives.
    window.setTimeout(function () { observer.disconnect(); }, 5000);
})();
