/*
 * contact-form.js — Contact Form DOM Controller
 *
 * This is a static site: there is no server to POST to, and `action="#"` made
 * the browser navigate to the same page with a POST, which a plain file host
 * answers with 405 Method Not Allowed. The form is now intercepted here.
 *
 * DOM Controller Responsibilities:
 * - Interactive topic button selection, aria states, and dynamic placeholders
 * - Live message character counter and threshold warning styling
 * - Visual validation feedback and screen-reader status announcements
 * - Action handling: form submit interception (mailto trigger) and clipboard copy
 *
 * Domain Logic Delegation:
 * - Pure data validation, recipient extraction, mailto encoding, and plain-text
 *   formatting are delegated to PortfolioContactModel (assets/js/contact-model.js).
 * - Full backward compatibility is preserved: all Contract 1 CommonJS named exports
 *   continue to be exported from this file.
 */
(function (global) {
    'use strict';

    var BOUND_FLAG = 'contactFormBound';
    var initialized = false;

    /**
     * Resolves the PortfolioContactModel from the ambient environment.
     * Checks browser global (window.PortfolioContactModel), globalThis, or CommonJS require.
     *
     * @returns {Object|null} The resolved contact model API, or null if unresolvable.
     */
    function resolveModel() {
        if (typeof window !== 'undefined' && window.PortfolioContactModel) {
            return window.PortfolioContactModel;
        }
        if (typeof globalThis !== 'undefined' && globalThis.PortfolioContactModel) {
            return globalThis.PortfolioContactModel;
        }
        if (typeof require === 'function') {
            try {
                return require('./contact-model.js');
            } catch (e) {
                // Defensive fallback for non-CommonJS or resolution mismatch
            }
        }
        return null;
    }

    /**
     * Defensive fallback constants in case contact-model.js fails to load.
     */
    var FALLBACK_CONSTANTS = {
        FALLBACK_EMAIL: 'charlesdavidlopez741@gmail.com',
        MAILTO_BODY_LIMIT: 1800,
        TOPIC_DEFAULTS: {
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
        }
    };

    /**
     * Retrieves the active contact model or creates a resilient inline fallback.
     *
     * @returns {Object} Active model API.
     */
    function getModel() {
        var resolved = resolveModel();
        if (resolved) {
            return resolved;
        }

        return {
            FALLBACK_EMAIL: FALLBACK_CONSTANTS.FALLBACK_EMAIL,
            MAILTO_BODY_LIMIT: FALLBACK_CONSTANTS.MAILTO_BODY_LIMIT,
            TOPIC_DEFAULTS: FALLBACK_CONSTANTS.TOPIC_DEFAULTS,
            extractRecipientAddress: function (href, fallback) {
                var defaultEmail = (fallback && typeof fallback === 'string') ? fallback : FALLBACK_CONSTANTS.FALLBACK_EMAIL;
                if (!href || typeof href !== 'string') return defaultEmail;
                var trimmed = href.trim();
                if (trimmed.slice(0, 'mailto:'.length).toLowerCase() !== 'mailto:') return defaultEmail;
                var address = trimmed.slice('mailto:'.length).split('?')[0].trim();
                return address || defaultEmail;
            },
            validateContactFields: function (fields) {
                var name = String((fields && fields.name) || '').trim();
                var email = String((fields && fields.email) || '').trim();
                var message = String((fields && fields.message) || '').trim();

                if (!name) return { valid: false, error: 'Please enter your name before sending.' };
                if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { valid: false, error: 'Please enter a valid email address.' };
                if (!message) return { valid: false, error: 'Please enter a message before sending.' };
                return { valid: true, error: '' };
            },
            buildMailtoPayload: function (fieldsOrPayload, optionalRecipient) {
                var fields = fieldsOrPayload || {};
                var explicitRecipient = (optionalRecipient && typeof optionalRecipient === 'string')
                    ? optionalRecipient
                    : (fields.recipient || fields.to || '');

                var rawTarget = '';
                if (explicitRecipient) {
                    var trimmedTarget = String(explicitRecipient).trim();
                    rawTarget = trimmedTarget.slice(0, 'mailto:'.length).toLowerCase() === 'mailto:'
                        ? trimmedTarget
                        : 'mailto:' + trimmedTarget;
                }

                var to = this.extractRecipientAddress(rawTarget, FALLBACK_CONSTANTS.FALLBACK_EMAIL);
                var name = String(fields.name || '').trim();
                var email = String(fields.email || '').trim();
                var topic = String(fields.topic || '').trim();
                var customSubject = String(fields.subject || '').trim();
                var message = String(fields.message || '').trim();

                var baseSubject = customSubject || (topic ? '[' + topic + '] Portfolio contact' : 'Portfolio contact');
                var subject = name && customSubject.indexOf(name) === -1 ? baseSubject + ' from ' + name : baseSubject;
                var topicHeader = topic ? 'Topic: ' + topic + '\n\n' : '';
                var body = topicHeader + message + '\n\n— ' + (name || 'Visitor') + ' (' + (email || 'no email provided') + ')';

                var isTruncated = body.length > FALLBACK_CONSTANTS.MAILTO_BODY_LIMIT;
                if (isTruncated) {
                    body = body.slice(0, FALLBACK_CONSTANTS.MAILTO_BODY_LIMIT) + '…';
                }

                var mailto = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
                return {
                    to: to,
                    recipient: to,
                    subject: subject,
                    body: body,
                    mailto: mailto,
                    url: mailto,
                    isTruncated: isTruncated,
                    bodyLength: body.length
                };
            },
            formatClipboardMessage: function (fields, recipient) {
                var p = this.buildMailtoPayload(fields, recipient);
                return 'To: ' + p.to + '\nSubject: ' + p.subject + '\n\n' + p.body;
            }
        };
    }

    var initialModel = getModel();
    var FALLBACK_EMAIL = initialModel.FALLBACK_EMAIL;
    var MAILTO_BODY_LIMIT = initialModel.MAILTO_BODY_LIMIT;
    var TOPIC_DEFAULTS = initialModel.TOPIC_DEFAULTS;

    /**
     * Delegates recipient address extraction to the active contact model.
     *
     * @param {string} [href] - Mailto URI or email string.
     * @param {string} [fallback] - Safe fallback email.
     * @returns {string} Normalized email address.
     */
    function extractRecipientAddress(href, fallback) {
        return getModel().extractRecipientAddress(href, fallback);
    }

    /**
     * Delegates contact field validation to the active contact model.
     *
     * @param {Object} [fields] - Form field values.
     * @returns {{ valid: boolean, error: string }} Validation result.
     */
    function validateContactFields(fields) {
        return getModel().validateContactFields(fields);
    }

    /**
     * Delegates mailto payload generation to the active contact model.
     *
     * @param {Object} [fields] - Field values.
     * @param {string} [recipient] - Target recipient address.
     * @returns {Object} Payload containing to, subject, body, and mailto URL.
     */
    function buildMailtoPayload(fields, recipient) {
        return getModel().buildMailtoPayload(fields, recipient);
    }

    /**
     * Delegates clipboard message formatting to the active contact model.
     *
     * @param {Object} [fields] - Field values.
     * @param {string} [recipient] - Target recipient address.
     * @returns {string} Plain-text clipboard representation.
     */
    function formatClipboardMessage(fields, recipient) {
        return getModel().formatClipboardMessage(fields, recipient);
    }

    /* ------------------------------------------------------------- DOM View Accessors */

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
        var utils = typeof window !== 'undefined' ? window.PortfolioUtils : (typeof globalThis !== 'undefined' ? globalThis.PortfolioUtils : null);
        if (utils && typeof utils.copyToClipboard === 'function') {
            return utils.copyToClipboard(text);
        }
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return false; });
        }
        return Promise.resolve(false);
    }

    /* ------------------------------------------------------------- Accessibility & Validation Sync */

    function linkError(el, shown) {
        if (!el || !el.dataset) return;
        var errorId = el.dataset.error;
        if (!errorId) return;
        var current = el.getAttribute('aria-describedby') || '';
        var ids = current.split(/\s+/).filter(function (id) {
            return id && id !== errorId;
        });
        if (shown) ids.push(errorId);
        if (ids.length) {
            el.setAttribute('aria-describedby', ids.join(' '));
        } else {
            el.removeAttribute('aria-describedby');
        }
    }

    function spokenText(node) {
        if (!node || typeof node.cloneNode !== 'function') return '';
        var copy = node.cloneNode(true);
        copy.querySelectorAll('[aria-hidden="true"]').forEach(function (n) {
            n.remove();
        });
        copy.querySelectorAll('[role="img"][aria-label]').forEach(function (n) {
            n.replaceWith(n.getAttribute('aria-label') + ': ');
        });
        return String(copy.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function bindFieldValidation(form) {
        if (!form || typeof document === 'undefined' || !document.body) return null;

        var announcer = document.querySelector('[data-contact-error-announcer]');
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.setAttribute('aria-live', 'polite');
            announcer.setAttribute('data-contact-error-announcer', 'true');
            announcer.className = 'visually-hidden';
            document.body.appendChild(announcer);
        }

        var announceTimer = null;
        var announcedField = null;
        var flagged = typeof WeakSet === 'function' ? new WeakSet() : null;
        var announced = typeof WeakSet === 'function' ? new WeakSet() : null;
        var dirtyState = typeof WeakMap === 'function' ? new WeakMap() : null;
        var supportsUserInvalid = false;

        try {
            supportsUserInvalid = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('selector(:user-invalid)');
        } catch (e) {
            supportsUserInvalid = false;
        }

        function announceError(el) {
            if (!el || !el.dataset || !el.dataset.error) return;
            var errorEl = document.getElementById(el.dataset.error);
            if (!errorEl) return;
            var labelNode = (el.labels && el.labels[0]) ? el.labels[0] : (el.id ? form.querySelector('label[for="' + el.id + '"]') : null);
            var labelPrefix = labelNode ? spokenText(labelNode) + ': ' : '';
            clearTimeout(announceTimer);
            announcer.textContent = '';
            announcedField = el;
            announceTimer = setTimeout(function () {
                announcer.textContent = labelPrefix + spokenText(errorEl);
            }, 500);
        }

        function syncAria(el, announce) {
            if (!el || !el.matches || !el.matches('input, select, textarea')) return;
            if (el.type === 'hidden') return;

            var isInvalid = false;
            if (supportsUserInvalid) {
                isInvalid = el.matches(':user-invalid');
            } else {
                var state = dirtyState ? dirtyState.get(el) : null;
                isInvalid = Boolean(state && state.hasBlurred && el.validity && !el.validity.valid);
            }

            if (isInvalid) {
                if (announce && announced && !announced.has(el)) {
                    announceError(el);
                    announced.add(el);
                }
                el.setAttribute('aria-invalid', 'true');
                linkError(el, true);
                if (flagged) flagged.add(el);
            } else if ((flagged && flagged.has(el)) || el.getAttribute('aria-invalid') !== 'true') {
                el.setAttribute('aria-invalid', 'false');
                linkError(el, false);
                if (flagged) flagged.delete(el);
                if (announced) announced.delete(el);
                if (announcedField === el) {
                    clearTimeout(announceTimer);
                    announcer.textContent = '';
                }
            }
        }

        form.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(function (el) {
            syncAria(el, false);
        });

        form.addEventListener('blur', function (event) {
            var target = event.target;
            if (!supportsUserInvalid && dirtyState && target && target.matches && target.matches('input, select, textarea')) {
                var st = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
                st.hasBlurred = true;
                dirtyState.set(target, st);
                if (st.hasInteracted && target.validity) {
                    var ok = target.validity.valid;
                    target.classList.toggle('user-invalid-fallback', !ok);
                    target.classList.toggle('user-valid-fallback', ok);
                }
            }
            syncAria(target, true);
        }, true);

        form.addEventListener('input', function (event) {
            var target = event.target;
            if (!supportsUserInvalid && dirtyState && target && target.matches && target.matches('input, select, textarea')) {
                var st = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
                st.hasInteracted = true;
                dirtyState.set(target, st);
                if (st.hasBlurred && target.validity) {
                    var ok = target.validity.valid;
                    target.classList.toggle('user-invalid-fallback', !ok);
                    target.classList.toggle('user-valid-fallback', ok);
                }
            }
            if (target && target.hasAttribute && target.hasAttribute('aria-invalid')) {
                syncAria(target, false);
            }
        });

        form.addEventListener('change', function (event) {
            syncAria(event.target, true);
        }, true);

        form.addEventListener('invalid', function (event) {
            var target = event.target;
            if (!supportsUserInvalid && dirtyState && target && target.validity) {
                dirtyState.set(target, { hasInteracted: true, hasBlurred: true });
                target.classList.toggle('user-invalid-fallback', !target.validity.valid);
                target.classList.toggle('user-valid-fallback', target.validity.valid);
            }
            if (announced) announced.add(target);
            syncAria(target, false);
        }, true);

        form.addEventListener('reset', function () {
            setTimeout(function () {
                form.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(function (el) {
                    if (dirtyState) dirtyState.delete(el);
                    el.classList.remove('user-invalid-fallback', 'user-valid-fallback');
                    syncAria(el, false);
                });
            }, 0);
        }, true);

        return {
            syncAll: function () {
                form.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(function (el) {
                    syncAria(el, false);
                });
            },
            focusFirstInvalid: function () {
                var first = form.querySelector(':is(:user-invalid, .user-invalid-fallback, [aria-invalid="true"])');
                if (!first) {
                    first = form.querySelector('input:invalid, textarea:invalid, select:invalid');
                }
                if (first && typeof first.focus === 'function') {
                    first.focus();
                }
            }
        };
    }

    function reportCopyButton(button, ok) {
        if (!button) return;
        var utils = (typeof window !== 'undefined' && window.PortfolioUtils) || (global && global.PortfolioUtils) || null;
        if (utils && typeof utils.reportCopyFeedback === 'function') {
            utils.reportCopyFeedback(button, ok, { captureLabel: true });
            return;
        }
        button.removeAttribute(ok ? 'data-failed' : 'data-copied');
        button.setAttribute(ok ? 'data-copied' : 'data-failed', '');
    }

    function syncRecipientPreview(form) {
        var preview = (form ? form.querySelector('[data-contact-recipient-preview]') : null) ||
            document.querySelector('[data-contact-recipient-preview]');
        if (preview) {
            preview.textContent = recipientEmail();
        }
    }

    /* ------------------------------------------------------------- Event Controllers */

    function bindTopics(form) {
        var group = form.querySelector('[data-contact-topics]') || document.querySelector('[data-contact-topics]');
        var topicInput = form.querySelector('[data-contact-topic-input]');
        var subjectInput = form.querySelector('[data-contact-subject]');
        var messageInput = form.querySelector('[data-contact-message]');
        var topicPreview = form.querySelector('[data-contact-active-topic]') || document.querySelector('[data-contact-active-topic]');
        if (!group) return;

        var currentDefaults = getModel().TOPIC_DEFAULTS || TOPIC_DEFAULTS;
        var buttons = Array.prototype.slice.call(group.querySelectorAll('[data-topic], [data-contact-topic]'));
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var topic = btn.getAttribute('data-topic') || btn.getAttribute('data-contact-topic') || '';
                buttons.forEach(function (other) {
                    other.setAttribute('aria-pressed', other === btn ? 'true' : 'false');
                });
                if (topicInput) {
                    topicInput.value = topic;
                }
                if (topicPreview && topic) {
                    topicPreview.textContent = topic;
                }
                var defaults = currentDefaults[topic];
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

        var limit = getModel().MAILTO_BODY_LIMIT || MAILTO_BODY_LIMIT;

        function updateCounter() {
            var len = String(messageInput.value || '').length;
            counter.textContent = len + ' / ' + limit;
            counter.classList.toggle('is-near-limit', len >= Math.floor(limit * 0.85));
        }

        messageInput.addEventListener('input', updateCounter);
        updateCounter();
    }

    function bindCopyMessageButton(form, status, validationSync) {
        var copyBtn = form.querySelector('[data-contact-copy-message]');
        if (!copyBtn) return;

        copyBtn.addEventListener('click', function () {
            if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
                if (typeof form.reportValidity === 'function') form.reportValidity();
                if (validationSync) {
                    validationSync.syncAll();
                    validationSync.focusFirstInvalid();
                }
            }

            var values = readFormValues(form);
            var validation = validateContactFields(values);
            if (!validation.valid) {
                setStatus(status, validation.error, true);
                return;
            }

            var to = recipientEmail();
            var formatted = formatClipboardMessage(values, to);
            copyToClipboard(formatted).then(function (ok) {
                var succeeded = ok !== false;
                reportCopyButton(copyBtn, succeeded);
                if (succeeded) {
                    setStatus(
                        status,
                        'Copied formatted message to your clipboard. You can paste it directly into an email to ' + to + '.',
                        false
                    );
                } else {
                    setStatus(status, 'Unable to copy to clipboard automatically. Please try again or email ' + to + ' directly.', true);
                }
            }).catch(function () {
                reportCopyButton(copyBtn, false);
                setStatus(status, 'Unable to copy to clipboard automatically. Please try again or email ' + to + ' directly.', true);
            });
        });
    }

    function onSubmit(form, status, validationSync, event) {
        event.preventDefault();

        if (typeof form.checkValidity === 'function' && !form.checkValidity()) {
            if (typeof form.reportValidity === 'function') form.reportValidity();
            if (validationSync) {
                validationSync.syncAll();
                validationSync.focusFirstInvalid();
            }
            return;
        }

        var values = readFormValues(form);
        var validation = validateContactFields(values);
        if (!validation.valid) {
            setStatus(status, validation.error, true);
            if (validationSync) validationSync.focusFirstInvalid();
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

    function hydrateFromQuery(form) {
        if (typeof window === 'undefined' || !window.location || typeof URLSearchParams !== 'function') return;
        var params = new URLSearchParams(window.location.search);
        if (!params.toString()) return;

        var topicParam = params.get('topic');
        if (topicParam) {
            var needle = topicParam.trim().toLowerCase();
            var buttons = document.querySelectorAll('[data-contact-topic], [data-topic]');
            for (var i = 0; i < buttons.length; i++) {
                var btn = buttons[i];
                var label = (btn.dataset.contactTopic || btn.dataset.topic || btn.textContent || '').trim().toLowerCase();
                if (label === needle || label.indexOf(needle) !== -1) {
                    btn.click();
                    break;
                }
            }
        }

        ['name', 'email', 'subject', 'message'].forEach(function (field) {
            var val = params.get(field);
            var input = form.elements && form.elements[field];
            if (val && input && !input.value) {
                input.value = val;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }

    function init() {
        if (initialized || typeof document === 'undefined') return;

        var form = findForm();
        if (!form) return;

        if (form.dataset && form.dataset[BOUND_FLAG] === 'true') return;
        if (form.dataset) form.dataset[BOUND_FLAG] = 'true';
        initialized = true;

        var status = findStatus();
        var validationSync = bindFieldValidation(form);

        bindTopics(form);
        bindCharacterCounter(form);
        bindCopyMessageButton(form, status, validationSync);
        syncRecipientPreview(form);
        hydrateFromQuery(form);

        document.addEventListener('portfolio:data-updated', function () {
            syncRecipientPreview(form);
        });

        form.addEventListener('submit', function (event) {
            onSubmit(form, status, validationSync, event);
        });
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }

    /* ------------------------------------------------------------- Contract 1 Re-Exports */

    var api = {
        FALLBACK_EMAIL: FALLBACK_EMAIL,
        MAILTO_BODY_LIMIT: MAILTO_BODY_LIMIT,
        TOPIC_DEFAULTS: TOPIC_DEFAULTS,
        extractRecipientAddress: extractRecipientAddress,
        validateContactFields: validateContactFields,
        buildMailtoPayload: buildMailtoPayload,
        formatClipboardMessage: formatClipboardMessage,
        init: init
    };

    global.PortfolioContactForm = api;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
