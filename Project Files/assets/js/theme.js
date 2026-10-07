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

    function stored() {
        try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
    }

    function current() {
        return stored() === LIGHT ? LIGHT : DARK;
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

    function toggle() {
        var next = current() === LIGHT ? DARK : LIGHT;
        try { window.localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
        apply(next);
    }

    document.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || typeof target.closest !== 'function') { return; }
        if (!target.closest('[data-theme-toggle]')) { return; }
        toggle();
    });

    // Apply the saved palette as early as possible.
    apply(current());

    // Re-apply when the navbar arrives so aria-pressed is right from the start.
    // Attribute writes do not trigger a childList observer, so this is safe.
    var observer = new MutationObserver(function () { apply(current()); });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(function () { observer.disconnect(); }, 5000);
})();
