# Task: 01-establish-the-variablescss-token-layer

## Feature: css-purpose-audit

## Dependencies

_None_

## Plan Section

### 1. Establish the `variables.css` token layer

Create `Project Files/assets/css/variables.css` containing the `:root { … }` block moved verbatim from `global.css` (including `color-scheme: light`). Then add `<link rel="stylesheet" href="assets/css/variables.css">` as the **first** stylesheet in the `<head>` of `Project Files/index.html`, `about.html`, `contact.html`, and `projects.html` — immediately before the existing `global.css` link. Only then remove the `:root` block from `global.css`.

Files: `Project Files/assets/css/variables.css` (new), `Project Files/assets/css/global.css`, `Project Files/index.html`, `Project Files/about.html`, `Project Files/contact.html`, `Project Files/projects.html`.

Acceptance: AC1, AC2; V1, V2, V6, V10, V13.
