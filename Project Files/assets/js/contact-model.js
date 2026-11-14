/*
 * contact-model.js — Pure Contact Domain Model
 *
 * Standalone pure domain model and business logic for the contact subsystem:
 * - Recipient address extraction and safe fallback resolution
 * - Required field validation (name, email regex, message)
 * - Mailto URL payload assembly with subject prefixing, signature, and truncation
 * - Multi-line plain-text clipboard message formatting
 * - Default inquiry topic configurations
 *
 * Pure functional design with ZERO DOM or browser globals (no window, document,
 * or navigator required). Fully executable in headless Node.js runtimes.
 * Exposes window.PortfolioContactModel in browsers and module.exports in CommonJS.
 */
(function (global) {
    'use strict';

    /**
     * Fallback destination email address when no recipient link is available.
     * @constant {string}
     */
    var FALLBACK_EMAIL = 'charlesdavidlopez741@gmail.com';

    /**
     * Maximum character limit for mailto body before truncation to prevent URI overflow.
     * @constant {number}
     */
    var MAILTO_BODY_LIMIT = 1800;

    /**
     * RFC 5322-compliant simplified email validation regular expression pattern.
     * Checks for non-whitespace and non-@ characters before and after '@', with dot-separated domain label.
     * @constant {RegExp}
     */
    var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    /**
     * @typedef {Object} TopicConfig
     * @property {string} subject - Default subject line for this topic.
     * @property {string} placeholder - Default message textarea placeholder.
     */

    /**
     * Default subject lines and message placeholders keyed by inquiry topic.
     * Deep-frozen to guarantee immutability.
     * @constant {Readonly<Record<string, Readonly<TopicConfig>>>}
     */
    var TOPIC_DEFAULTS = Object.freeze({
        'Project Inquiry': Object.freeze({
            subject: 'Project Inquiry — Web Development',
            placeholder: 'Tell me about your project scope, goals, and target timeline'
        }),
        'Role / Opportunity': Object.freeze({
            subject: 'Role Opportunity — Front-End Engineering',
            placeholder: 'Share details about the team, role responsibilities, and location'
        }),
        'Collaboration': Object.freeze({
            subject: 'Collaboration Idea — Open Source / Creative Web',
            placeholder: 'Tell me what you are building and how we might collaborate'
        }),
        'General Question': Object.freeze({
            subject: 'Hello from your portfolio',
            placeholder: 'Ask a question or share your thoughts'
        })
    });

    /**
     * Extracts and normalizes an email recipient address from a mailto: link or raw string.
     * Strips query parameters, parses mailto scheme case-insensitively, and trims whitespace.
     *
     * @param {string} [href] - The mailto: href string or email address to parse.
     * @param {string} [fallback] - Fallback address if href is invalid or missing (defaults to FALLBACK_EMAIL).
     * @returns {string} The normalized destination email address.
     */
    function extractRecipientAddress(href, fallback) {
        var defaultEmail = (fallback && typeof fallback === 'string') ? fallback : FALLBACK_EMAIL;
        if (!href || typeof href !== 'string') {
            return defaultEmail;
        }
        var trimmed = href.trim();
        if (trimmed.slice(0, 'mailto:'.length).toLowerCase() !== 'mailto:') {
            return defaultEmail;
        }
        var address = trimmed.slice('mailto:'.length).split('?')[0].trim();
        return address || defaultEmail;
    }

    /**
     * @typedef {Object} ContactFields
     * @property {string} [name] - Submitter full name.
     * @property {string} [email] - Submitter email address.
     * @property {string} [topic] - Selected message topic.
     * @property {string} [subject] - Custom subject line override.
     * @property {string} [message] - Message body content.
     */

    /**
     * @typedef {Object} ContactValidationResult
     * @property {boolean} valid - Whether all required fields meet validation rules.
     * @property {string} error - Human-readable error message, or empty string if valid.
     */

    /**
     * Validates contact form submission fields (name, email, message).
     * Strictly returns an object with exactly `valid` (boolean) and `error` (string) properties.
     *
     * @param {ContactFields} [fields] - Form field values.
     * @returns {ContactValidationResult} Validation result object.
     */
    function validateContactFields(fields) {
        var name = String((fields && fields.name) || '').trim();
        var email = String((fields && fields.email) || '').trim();
        var message = String((fields && fields.message) || '').trim();

        if (!name) {
            return { valid: false, error: 'Please enter your name before sending.' };
        }
        if (!email || !EMAIL_REGEX.test(email)) {
            return { valid: false, error: 'Please enter a valid email address.' };
        }
        if (!message) {
            return { valid: false, error: 'Please enter a message before sending.' };
        }
        return { valid: true, error: '' };
    }

    /**
     * @typedef {Object} MailtoPayloadOptions
     * @property {string} [recipient] - Target destination email address.
     * @property {string} [to] - Target destination email address alias.
     * @property {string} [name] - Submitter full name.
     * @property {string} [email] - Submitter contact email address.
     * @property {string} [topic] - Inquiry topic identifier.
     * @property {string} [subject] - Optional custom subject line.
     * @property {string} [message] - Message body text.
     */

    /**
     * @typedef {Object} MailtoPayload
     * @property {string} to - Destination email address (legacy contract).
     * @property {string} recipient - Destination email address alias.
     * @property {string} subject - Formatted subject line.
     * @property {string} body - Formatted message body including topic header, signature, and ellipsis if truncated.
     * @property {string} mailto - Fully constructed mailto: URI with encoded query parameters.
     * @property {string} url - Alias for mailto URI.
     * @property {boolean} isTruncated - Whether the message body exceeded MAILTO_BODY_LIMIT and was truncated.
     * @property {number} bodyLength - Character length of the final formatted body string.
     */

    /**
     * Builds an encoded mailto: URL payload with formatted subject, body with signature, and truncation.
     * Supports both two-argument format buildMailtoPayload(fields, recipient)
     * and unified single-object format buildMailtoPayload({ recipient, topic, subject, name, email, message }).
     *
     * @param {ContactFields|MailtoPayloadOptions} [fieldsOrPayload] - Field map or unified payload options.
     * @param {string} [optionalRecipient] - Target recipient if passed as separate second argument.
     * @returns {MailtoPayload} Assembled payload metadata.
     */
    function buildMailtoPayload(fieldsOrPayload, optionalRecipient) {
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

        var to = extractRecipientAddress(rawTarget, FALLBACK_EMAIL);

        var name = String(fields.name || '').trim();
        var email = String(fields.email || '').trim();
        var topic = String(fields.topic || '').trim();
        var customSubject = String(fields.subject || '').trim();
        var message = String(fields.message || '').trim();

        var baseSubject = customSubject || (topic ? '[' + topic + '] Portfolio contact' : 'Portfolio contact');
        var subject = name && customSubject.indexOf(name) === -1
            ? baseSubject + ' from ' + name
            : baseSubject;

        var topicHeader = topic ? 'Topic: ' + topic + '\n\n' : '';
        var rawBody = topicHeader + message + '\n\n— ' + (name || 'Visitor') + ' (' + (email || 'no email provided') + ')';

        var isTruncated = rawBody.length > MAILTO_BODY_LIMIT;
        var body = isTruncated
            ? rawBody.slice(0, MAILTO_BODY_LIMIT) + '…'
            : rawBody;

        var mailto = 'mailto:' + to +
            '?subject=' + encodeURIComponent(subject) +
            '&body=' + encodeURIComponent(body);

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
    }

    /**
     * Formats a clean plain-text summary suitable for copying to the system clipboard.
     *
     * @param {ContactFields|MailtoPayloadOptions} [fieldsOrPayload] - Field map or unified payload options.
     * @param {string} [optionalRecipient] - Destination email address if passed separately.
     * @returns {string} Plain-text clipboard representation with To, Subject, and Body headers.
     */
    function formatClipboardMessage(fieldsOrPayload, optionalRecipient) {
        var payload = buildMailtoPayload(fieldsOrPayload, optionalRecipient);
        return 'To: ' + payload.to + '\nSubject: ' + payload.subject + '\n\n' + payload.body;
    }

    /* ------------------------------------------------------------- Public API Export */
    /**
     * @typedef {Object} PortfolioContactModelAPI
     * @property {string} FALLBACK_EMAIL - Default destination email address.
     * @property {number} MAILTO_BODY_LIMIT - Maximum character limit for mailto body.
     * @property {Readonly<Record<string, Readonly<TopicConfig>>>} TOPIC_DEFAULTS - Topic defaults mapping.
     * @property {function(string=, string=): string} extractRecipientAddress - Normalizes recipient address.
     * @property {function(ContactFields=): ContactValidationResult} validateContactFields - Validates required fields.
     * @property {function((ContactFields|MailtoPayloadOptions)=, string=): MailtoPayload} buildMailtoPayload - Assembles mailto payload.
     * @property {function((ContactFields|MailtoPayloadOptions)=, string=): string} formatClipboardMessage - Formats clipboard message.
     */

    /** @type {PortfolioContactModelAPI} */
    var api = {
        FALLBACK_EMAIL: FALLBACK_EMAIL,
        MAILTO_BODY_LIMIT: MAILTO_BODY_LIMIT,
        TOPIC_DEFAULTS: TOPIC_DEFAULTS,
        extractRecipientAddress: extractRecipientAddress,
        validateContactFields: validateContactFields,
        buildMailtoPayload: buildMailtoPayload,
        formatClipboardMessage: formatClipboardMessage
    };

    // Attach to global scope in browser/worker environments
    global.PortfolioContactModel = api;

    // Export in CommonJS / Node.js test environments
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
