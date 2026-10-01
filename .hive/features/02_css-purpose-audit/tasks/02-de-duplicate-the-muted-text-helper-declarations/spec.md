# Task: 02-de-duplicate-the-muted-text-helper-declarations

## Feature: css-purpose-audit

## Dependencies

- **1. Establish the `variables.css` token layer** (01-establish-the-variablescss-token-layer)

## Plan Section

### 2. De-duplicate the muted-text helper declarations

In `Project Files/assets/css/global.css`, reduce the muted-helper group to `.about-copy p, .skill-card p, .contact-card p { color: var(--muted); }` — removing `.hero-description` (owner: `homepage.css`) and `.project-description` (owner: `projects.css`). In `Project Files/assets/css/homepage.css`, delete the duplicate `.project-description, .about-copy p, .skill-card p, .contact-card p` block entirely, keeping the `.hero-description` rule untouched.

Do **not** touch the footer/header shared-layout section of `global.css`.

Files: `Project Files/assets/css/global.css`, `Project Files/assets/css/homepage.css`.

Acceptance: AC3, AC4; V3, V6, V7, V8.
