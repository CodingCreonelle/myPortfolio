const test = require('node:test');
const assert = require('node:assert/strict');
const {
  FALLBACK_EMAIL,
  MAILTO_BODY_LIMIT,
  extractRecipientAddress,
  validateContactFields,
  buildMailtoPayload,
  formatClipboardMessage,
} = require('../Project Files/assets/js/contact-form.js');

test('extractRecipientAddress parses valid mailto links and falls back safely', () => {
  assert.equal(
    extractRecipientAddress('mailto:charles@example.com?subject=Hi'),
    'charles@example.com'
  );
  assert.equal(extractRecipientAddress('https://github.com'), FALLBACK_EMAIL);
  assert.equal(extractRecipientAddress(''), FALLBACK_EMAIL);
});

test('validateContactFields enforces required name, valid email, and non-empty message', () => {
  assert.equal(
    validateContactFields({ name: '', email: 'a@b.com', message: 'Hi' }).valid,
    false
  );
  assert.equal(
    validateContactFields({ name: 'Ada', email: 'not-an-email', message: 'Hi' }).valid,
    false
  );
  assert.equal(
    validateContactFields({ name: 'Ada', email: 'ada@example.com', message: '   ' }).valid,
    false
  );
  assert.deepEqual(
    validateContactFields({ name: 'Ada', email: 'ada@example.com', message: 'Hello Charles!' }),
    { valid: true, error: '' }
  );
});

test('buildMailtoPayload constructs encoded mailto link with topic, subject, and sender signature', () => {
  const payload = buildMailtoPayload(
    {
      name: 'Ada Lovelace',
      email: 'ada@analytical.org',
      topic: 'Project Inquiry',
      subject: 'Frontend Architecture Review',
      message: 'Would love to collaborate on an upcoming web interface.',
    },
    'charlesdavidlopez741@gmail.com'
  );

  assert.equal(payload.to, 'charlesdavidlopez741@gmail.com');
  assert.equal(payload.subject, 'Frontend Architecture Review from Ada Lovelace');
  assert.match(payload.body, /Topic: Project Inquiry/);
  assert.match(payload.body, /— Ada Lovelace \(ada@analytical\.org\)/);
  assert.ok(payload.mailto.startsWith('mailto:charlesdavidlopez741@gmail.com?subject='));
});

test('buildMailtoPayload truncates overly long message bodies at MAILTO_BODY_LIMIT', () => {
  const longMessage = 'A'.repeat(MAILTO_BODY_LIMIT + 200);
  const payload = buildMailtoPayload({
    name: 'Grace',
    email: 'grace@navy.mil',
    message: longMessage,
  });

  assert.equal(payload.body.length, MAILTO_BODY_LIMIT + 1);
  assert.ok(payload.body.endsWith('…'));
});

test('formatClipboardMessage formats clean plain-text message for clipboard fallback', () => {
  const text = formatClipboardMessage(
    {
      name: 'Linus',
      email: 'linus@kernel.org',
      topic: 'Collaboration',
      subject: '',
      message: 'Let us build something fast.',
    },
    'charlesdavidlopez741@gmail.com'
  );

  assert.match(text, /^To: charlesdavidlopez741@gmail\.com\nSubject: \[Collaboration\] Portfolio contact from Linus/);
  assert.match(text, /Let us build something fast\./);
});
