# Task: 01-fix-the-invalid-stagger-child-selector

## Feature: fix-stagger-selector

## Dependencies

_None_

## Plan Section

### 1. Fix the invalid stagger child selector

In `Project Files/assets/js/animation-observer.js`, change line 25 from
`const STAGGER_CHILD_SELECTOR = '> *';` to `const STAGGER_CHILD_SELECTOR = ':scope > *';`.
Change nothing else — no call-site edits, no CSS edits, no other file. Then run verification V1–V8 and report the observed evidence for each.

Acceptance: AC1–AC6; V1–V8.
