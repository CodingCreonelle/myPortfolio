# Task: 04-repair-the-demo-stylesheet-references

## Feature: css-purpose-audit

## Dependencies

- **1. Establish the `variables.css` token layer** (01-establish-the-variablescss-token-layer)

## Plan Section

### 4. Repair the demo stylesheet references

Repoint all 6 demo stylesheet `href`s so they resolve to `Project Files/assets/css/`:

- `Project Files/demos/project1/index.html` lines 7–8: `assets/css/global.css` → `../../assets/css/global.css`; `assets/css/variables.css` → `../../assets/css/variables.css`.
- `Project Files/demos/project1/README.html` lines 7–8: `../assets/css/global.css` → `../../assets/css/global.css`; `../assets/css/variables.css` → `../../assets/css/variables.css`.
- `Project Files/demos/project2/index.html` lines 7–8: `../assets/css/global.css` → `../../assets/css/global.css`; `../assets/css/variables.css` → `../../assets/css/variables.css`.

Change nothing else in these files — do not add a `markdown.css` link (see RK6), do not alter inline styles or copy.

Files: `Project Files/demos/project1/index.html`, `Project Files/demos/project1/README.html`, `Project Files/demos/project2/index.html`.

Depends on: Task 1 (so that the corrected `variables.css` href resolves to a file that exists).

Acceptance: AC7; V5, V12.
