/*
 * contact-form.js — C6 / M14
 *
 * This is a static site: there is no server to POST to, and `action="#"` made
 * the browser navigate to the same page with a POST, which a plain file host
 * answers with 405 Method Not Allowed. The form is now intercepted here.
 *
 * The fallback is a mailto: URL assembled from the form fields, so the form
 * does something real and useful without inventing a backend. The recipient is
 * read from the rendered contact cards (data/socials.json) when available, with
 * a literal fallback so the handler still works if that JSON fails to load.
 */
(function () {
    'use strict';

    var FALLBACK_EMAIL = 'charlesdavidlopez741@gmail.com';
    var MAILTO_BODY_LIMIT = 1800;
    var BOUND_FLAG = 'contactFormBound';

    // Guards the DOMContentLoaded path, where a second init() would otherwise
    // bind the listener twice. The data- attribute further down guards a second
    // copy of this script, which arrives with its own closures and so cannot see
    // this flag.
    var initialized = false;

    function findForm() {
        return document.querySelector('[data-contact-form]') ||
            document.querySelector('#contact-form');
    }

    function findStatus() {
        return document.querySelector('[data-contact-form-status]') ||
            document.querySelector('#contact-form-status');
    }

    function recipientEmail() {
        var mailLink = document.querySelector('#contact-cards a[href^="mailto:"]');
        var href = mailLink ? mailLink.getAttribute('href') : '';
        if (!href || href.slice(0, 'mailto:'.length).toLowerCase() !== 'mailto:') {
            return FALLBACK_EMAIL;
        }
        var address = href.slice('mailto:'.length).split('?')[0].trim();
        return address || FALLBACK_EMAIL;
    }

    function fieldValue(form, name) {
        var field = form.elements ? form.elements[name] : null;
        return field && typeof field.value === 'string' ? field.value.trim() : '';
    }

    function setStatus(node, message, isError) {
        if (!node) return;
        // The status paragraph ships hidden in the markup, so it is revealed
        // here rather than being left invisible when it finally has something
        // to say.
        node.hidden = false;
        node.removeAttribute('hidden');
        node.textContent = message;
        node.classList.toggle('is-error', Boolean(isError));
        node.classList.toggle('is-ok', Boolean(message) && !isError);
    }

    /*
     * The browser decides what is valid: checkValidity() covers the required
     * fields and the email syntax. An invalid form is handed back to the user
     * untouched, so this handler never reports an outcome it did not get.
     */
    function onSubmit(form, status, event) {
        // Never let the browser perform the POST that used to 405.
        event.preventDefault();

        if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
            if (typeof form.reportValidity === 'function') form.reportValidity();
            return;
        }

        var name = fieldValue(form, 'name');
        var email = fieldValue(form, 'email');
        var message = fieldValue(form, 'message');

        var to = recipientEmail();
        var subject = 'Portfolio contact from ' + (name || 'the contact form');
        var body = message + '\n\n— ' + name + ' (' + email + ')';
        if (body.length > MAILTO_BODY_LIMIT) {
            body = body.slice(0, MAILTO_BODY_LIMIT) + '…';
        }

        var mailto = 'mailto:' + to +
            '?subject=' + encodeURIComponent(subject) +
            '&body=' + encodeURIComponent(body);

        window.location.href = mailto;

        setStatus(
            status,
            'Opening your email app with the message ready to send. If nothing opens, email ' + to + ' directly.',
            false
        );
    }

    function init() {
        if (initialized) return;

        var form = findForm();
        // No form on this page: stay a no-op instead of throwing.
        if (!form) return;

        // Set before binding, so a second execution of this file (a duplicate
        // <script> tag, say) sees the flag and does not stack a second listener.
        if (form.dataset && form.dataset[BOUND_FLAG] === 'true') return;
        if (form.dataset) form.dataset[BOUND_FLAG] = 'true';
        initialized = true;

        var status = findStatus();

        form.addEventListener('submit', function (event) {
            onSubmit(form, status, event);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
