# Task: 03-opt-in-the-four-homepage-sections

## Feature: 04-replay-section-animations

## Dependencies

- **2. Rework `animation-observer.js` for replay** (02-rework-animation-observerjs-for-replay)

## Plan Section

### 3. Opt in the four homepage sections

**File:** `Project Files/index.html`

Add `data-animate-replay="true"` to exactly these four elements and no others:

| Line | Element |
| --- | --- |
| 47 | `section.featured-projects#projects` |
| 56 | `section.about-section#about` |
| 83 | `section.experience-section#experience` |
| 104 | `section.contact-preview#contact` |

Leave `.hero#hero` alone — it has no `data-animate` and uses its own on-load classes.

While in this file, correct the malformed markup on line 86:
`//The following experience section are still incomplete` is JavaScript comment syntax sitting in HTML
body content and renders as visible text on the page. Convert it to an HTML comment or delete it.

Do **not** add replay attributes to `about.html`, `contact.html`, or `projects.html`.
