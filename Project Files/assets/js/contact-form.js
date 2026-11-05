/*
 * contact-form.js — C6 / M14
 *
 * This is a static site: there is no server to POST to, and `action="#"` made
 * the browser navigate to the same page with a POST, which a plain file host
 * answers with 405 Method Not Allowed. The form is now intercepted here.
 *
 * Includes interactive topic selection, live character counter, required field
 * validation, mailto: assembly, and a one-click clipboard copy fallback so
 * visitors without a local mail client can still copy their formatted message.
 */
(function (global) {
    'use strict';

    var FALLBACK_EMAIL = 'charlesdavidlopez741@gmail.com';
    var MAILTO_BODY_LIMIT = 1800;
    var BOUND_FLAG = 'contactFormBound';

    var TOPIC_DEFAULTS = {
        'Project Inquiry': {
            subject: 'Project Inquiry — Web Development',
            placeholder: 'Tell me about your project scope, goals, and target timeline'
        },
        'Role / Opportunity': {
            subject: 'Role Opportunity — Front-End Engineering',
            placeholder: 'Share details about the team, role responsibilities, and location'
        },
        'Collaboration': {
            subject: 'Collaboration Idea — Open Source / Creative Web',
            placeholder: 'Tell me what you are building and how we might collaborate'
        },
        'General Question': {
            subject: 'Hello from your portfolio',
            placeholder: 'Ask a question or share your thoughts'
        }
    };

    var initialized = false;

    function extractRecipientAddress(href, fallback) {
        var defaultEmail = fallback || FALLBACK_EMAIL;
        if (!href || typeof href !== 'string') return defaultEmail;
        if (href.slice(0, 'mailto:'.length).toLowerCase() !== 'mailto:') {
            return defaultEmail;
        }
        var address = href.slice('mailto:'.length).split('?')[0].trim();
        return address || defaultEmail;
    }

    function validateContactFields(fields) {
        var name = String((fields && fields.name) || '').trim();
        var email = String((fields && fields.email) || '').trim();
        var message = String((fields && fields.message) || '').trim();

        if (!name) {
            return { valid: false, error: 'Please enter your name before sending.' };
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return { valid: false, error: 'Please enter a valid email address.' };
        }
        if (!message) {
            return { valid: false, error: 'Please enter a message before sending.' };
        }
        return { valid: true, error: '' };
    }

    function buildMailtoPayload(fields, recipient) {
        var to = extractRecipientAddress('mailto:' + (recipient || FALLBACK_EMAIL), FALLBACK_EMAIL);
        var name = String((fields && fields.name) || '').trim();
        var email = String((fields && fields.email) || '').trim();
        var topic = String((fields && fields.topic) || '').trim();
        var customSubject = String((fields && fields.subject) || '').trim();
        var message = String((fields && fields.message) || '').trim();

        var baseSubject = customSubject || (topic ? '[' + topic + '] Portfolio contact' : 'Portfolio contact');
        var subject = name && customSubject.indexOf(name) === -1
            ? baseSubject + ' from ' + name
            : baseSubject;

        var topicHeader = topic ? 'Topic: ' + topic + '\n\n' : '';
        var body = topicHeader + message + '\n\n— ' + (name || 'Visitor') + ' (' + (email || 'no email provided') + ')';
        if (body.length > MAILTO_BODY_LIMIT) {
            body = body.slice(0, MAILTO_BODY_LIMIT) + '…';
        }

        var mailto = 'mailto:' + to +
            '?subject=' + encodeURIComponent(subject) +
            '&body=' + encodeURIComponent(body);

        return {
            to: to,
            subject: subject,
            body: body,
            mailto: mailto
        };
    }

    function formatClipboardMessage(fields, recipient) {
        var payload = buildMailtoPayload(fields, recipient);
        return 'To: ' + payload.to + '\nSubject: ' + payload.subject + '\n\n' + payload.body;
    }

    function findForm() {
        if (typeof document === 'undefined') return null;
        return document.querySelector('[data-contact-form]') ||
            document.querySelector('#contact-form');
    }

    function findStatus() {
        if (typeof document === 'undefined') return null;
        return document.querySelector('[data-contact-form-status]') ||
            document.querySelector('#contact-form-status');
    }

    function recipientEmail() {
        if (typeof document === 'undefined') return FALLBACK_EMAIL;
        var mailLink = document.querySelector('#contact-cards a[href^="mailto:"]') ||
            document.querySelector('#ab-contact-cards a[href^="mailto:"]');
        var href = mailLink ? mailLink.getAttribute('href') : '';
        return extractRecipientAddress(href, FALLBACK_EMAIL);
    }

    function fieldValue(form, name) {
        var field = form && form.elements ? form.elements[name] : null;
        return field && typeof field.value === 'string' ? field.value.trim() : '';
    }

    function readFormValues(form) {
        return {
            name: fieldValue(form, 'name'),
            email: fieldValue(form, 'email'),
            topic: fieldValue(form, 'topic'),
            subject: fieldValue(form, 'subject'),
            message: fieldValue(form, 'message')
        };
    }

    function setStatus(node, message, isError) {
        if (!node) return;
        node.hidden = false;
        node.removeAttribute('hidden');
        node.textContent = message;
        node.classList.toggle('is-error', Boolean(isError));
        node.classList.toggle('is-ok', Boolean(message) && !isError);
    }

    function copyToClipboard(text) {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () {
                return fallbackCopy(text);
            });
        }
        return Promise.resolve(fallbackCopy(text));
    }

    function fallbackCopy(text) {
        if (typeof document === 'undefined') return false;
        try {
            var area = document.createElement('textarea');
            area.value = String(text || '');
            area.setAttribute('readonly', '');
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            document.execCommand('copy');
            document.body.removeChild(area);
            return true;
        } catch (err) {
            return false;
        }
    }

    function bindTopics(form) {
        var group = document.querySelector('[data-contact-topics]');
        var topicInput = form.querySelector('[data-contact-topic-input]');
        var subjectInput = form.querySelector('[data-contact-subject]');
        var messageInput = form.querySelector('[data-contact-message]');
        if (!group) return;

        var buttons = Array.prototype.slice.call(group.querySelectorAll('[data-topic]'));
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var topic = btn.getAttribute('data-topic') || '';
                buttons.forEach(function (other) {
                    other.setAttribute('aria-pressed', other === btn ? 'true' : 'false');
                });
                if (topicInput) {
                    topicInput.value = topic;
                }
                var defaults = TOPIC_DEFAULTS[topic];
                if (defaults) {
                    if (subjectInput && (!subjectInput.value || subjectInput.dataset.autoFilled !== 'false')) {
                        subjectInput.placeholder = defaults.subject;
                    }
                    if (messageInput) {
                        messageInput.placeholder = defaults.placeholder;
                    }
                }
            });
        });

        if (subjectInput) {
            subjectInput.addEventListener('input', function () {
                subjectInput.dataset.autoFilled = subjectInput.value.trim() ? 'false' : 'true';
            });
        }
    }

    function bindCharacterCounter(form) {
        var messageInput = form.querySelector('[data-contact-message]') || form.elements.message;
        var counter = form.querySelector('[data-contact-counter]');
        if (!messageInput || !counter) return;

        function updateCounter() {
            var len = String(messageInput.value || '').length;
            counter.textContent = len + ' / ' + MAILTO_BODY_LIMIT;
            counter.classList.toggle('is-near-limit', len >= Math.floor(MAILTO_BODY_LIMIT * 0.85));
        }

        messageInput.addEventListener('input', updateCounter);
        updateCounter();
    }

    function bindCopyMessageButton(form, status) {
        var copyBtn = form.querySelector('[data-contact-copy-message]');
        if (!copyBtn) return;

        copyBtn.addEventListener('click', function () {
            var values = readFormValues(form);
            var validation = validateContactFields(values);
            if (!validation.valid) {
                if (typeof form.reportValidity === 'function') form.reportValidity();
                setStatus(status, validation.error, true);
                return;
            }

            var to = recipientEmail();
            var formatted = formatClipboardMessage(values, to);
            copyToClipboard(formatted).then(function () {
                setStatus(
                    status,
                    'Copied formatted message to your clipboard. You can paste it directly into an email to ' + to + '.',
                    false
                );
            });
        });
    }

    function onSubmit(form, status, event) {
        event.preventDefault();

        if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
            if (typeof form.reportValidity === 'function') form.reportValidity();
            return;
        }

        var values = readFormValues(form);
        var validation = validateContactFields(values);
        if (!validation.valid) {
            setStatus(status, validation.error, true);
            return;
        }

        var to = recipientEmail();
        var payload = buildMailtoPayload(values, to);

        window.location.href = payload.mailto;

        setStatus(
            status,
            'Opening your email app with the message ready to send to ' + payload.to + '. If nothing opens, click "Copy formatted message" above or email ' + payload.to + ' directly.',
            false
        );
    }

    function init() {
        if (initialized || typeof document === 'undefined') return;

        var form = findForm();
        if (!form) return;

        if (form.dataset && form.dataset[BOUND_FLAG] === 'true') return;
        if (form.dataset) form.dataset[BOUND_FLAG] = 'true';
        initialized = true;

        var status = findStatus();

        bindTopics(form);
        bindCharacterCounter(form);
        bindCopyMessageButton(form, status);

        form.addEventListener('submit', function (event) {
            onSubmit(form, status, event);
        });
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    var api = {
        FALLBACK_EMAIL: FALLBACK_EMAIL,
        MAILTO_BODY_LIMIT: MAILTO_BODY_LIMIT,
        extractRecipientAddress: extractRecipientAddress,
        validateContactFields: validateContactFields,
        buildMailtoPayload: buildMailtoPayload,
        formatClipboardMessage: formatClipboardMessage
    };

    global.PortfolioContactForm = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
