# Task: 03-remove-true-duplicates-from-projectscss

## Feature: css-purpose-audit

## Dependencies

- **2. De-duplicate the muted-text helper declarations** (02-de-duplicate-the-muted-text-helper-declarations)

## Plan Section

### 3. Remove true duplicates from `projects.css`

Delete the `.text-link { color: var(--primary); font-weight: 600; }` block from `Project Files/assets/css/projects.css` — `global.css` is its sole owner and loads first on `projects.html`. Leave `.project-description { color: var(--muted); margin: 20px 0; }` intact as the single owner for that selector. Touch no other file.

Files: `Project Files/assets/css/projects.css`.

Acceptance: AC3, AC5; V4, V9.
