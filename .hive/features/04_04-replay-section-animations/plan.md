# 04 — Replay Section Animations on Re-entry

## Overview / Design Summary

Today every `[data-animate]` section animates **exactly once** and can never replay. The goal is a
fade-out on scroll-away plus a full replay of the entry animation each time one of the four homepage
sections comes back into view.

### User-confirmed decisions (checkpoint, 2026-10-01)

| Decision | Choice |
| --- | --- |
| Scope | Homepage only: Projects, About, Experience, Contact |
| Exit style | Fade out in place (opacity only, no transform) |
| Reset timing | Reset once visible ratio ≤ 0.15 |

### Scope control

Replay is **opt-in** via a new `data-animate-replay="true"` attribute. Only the four homepage sections
receive it. `about.html`, `contact.html`, `projects.html` and every other `[data-animate]` consumer keep
today's animate-once behaviour untouched. The hero is explicitly excluded (it uses the separate
`.hero-animate-*` on-load classes and has no `data-animate`).

### Verified facts about the current system

These were confirmed by reading the files, and they dictate the implementation approach:

1. `animation-observer.js` line 15 sets `once: true` and line 125 calls `observer.unobserve(element)`.
   Re-entry is therefore impossible today — this must change.
2. `applyAnimation()` permanently adds `.animate-on-scroll` **and** the animation class
   (`.animate-entrance`) to the element. `.animate-entrance` resolves to
   `animation: slide-up 500ms ease-out forwards`.
   **Consequence:** removing `is-visible` alone does *not* reset anything — a filled CSS animation keeps
   overriding declarative `opacity`. The animation class must be removed **and** a reflow forced.
3. Three overlapping stagger mechanisms exist and all must be reset together:
   - `.animate-stagger > *` (animations.css line 217) — always-on, no `is-visible` gate
   - `[data-animate-stagger].is-visible > *` (line 347) — scroll-gated
   - `.card-entrance` (line 256) — its own always-on animation
4. `.about-grid.animate-stagger` in `index.html` line 62 has **no** `data-animate-stagger` attribute,
   so its cards currently animate on page load rather than on scroll. `.list-animate > li` in the
   Experience section has the same characteristic.
5. `data-loader.js` calls `AnimationObserver.triggerStagger()` after injecting cards into
   `#featured-projects`, `#project-list`, `#skills-grid`, `#education-content`, `#contact-cards`.
   The public API of `window.AnimationObserver` must not change or these break.
6. A `fade-out` keyframe **already exists** (animations.css lines 22–25) — reuse it, do not add a second one.
7. `!important` is already used in this file (`.force-visible`, line 373), so using it for the exit state
   is consistent with existing style and is required to beat the inline `animation-delay` that
   `applyAnimation()` writes for `data-animate-delay`.

### Technical approach — class state machine + forced reflow

```
(no class)  --enter-->  .is-visible  --exit-->  .is-exiting  --after fade-->  (no class)
    hidden                  shown                   fading                      hidden
```

Entry re-adds the animation class after a forced reflow; exit strips it after the fade completes.
This is the canonical technique for replaying a filled CSS animation.

Two elements of the reset are non-obvious and must not be skipped:

- Removing the animation class from **descendants** too (`.card-entrance`, `.animate-on-scroll`), not
  just the section. Otherwise inner cards stay stuck at their filled end state.
- Reading `offsetWidth` (or equivalent) between removal and re-add. Without the reflow the browser
  coalesces the change and the animation never restarts.

### Visible-ratio helper (handles sections taller than the viewport)

`intersectionRatio` alone is unsafe: a section taller than the viewport has a maximum ratio below 1,
and could fall under the 0.15 reset threshold while fully on screen, causing it to hide itself.
Compute the ratio from the bounding rect against the viewport instead, using the *smaller* of the
element height and the viewport height as the denominator.

### Trigger point

The existing `rootMargin: '0px 0px -10% 0px'` and `threshold: 0.1` produce exactly one callback when a
section first crosses 10% visible, which is not enough to observe the 0.15 exit boundary. The observer
for replay targets needs `threshold: [0, 0.15, 0.5, 1]` (or an equivalent multi-threshold list) so a
callback fires at the reset boundary. Non-replay elements keep using the existing single-threshold
behaviour so nothing else changes.

---

## Tasks

### 1. Add exit + replay styles to `animations.css`

**File:** `Project Files/assets/css/animations.css` (append only — do not modify existing rules)

Add an exit state that fades out in place using the existing `fade-out` keyframe:

- A rule for the replay section itself: `[data-animate-replay].is-exiting` applies
  `animation: fade-out 300ms ease-out forwards !important`, `animation-delay: 0ms !important` and
  `pointer-events: none`.
- A rule for managed descendants inside it: `[data-animate-replay] .is-exiting` applies the same
  `fade-out ... !important` and `animation-delay: 0ms !important`, **without** `pointer-events`.
- The `!important` on `animation-delay` is required: `applyAnimation()` writes an inline
  `animation-delay` for `data-animate-delay`, and only an important author declaration beats an inline
  style.

Also guard the replay machinery under the existing `prefers-reduced-motion` block so the reduced-motion
path never fades or hides anything.

**Do not** add a duplicate `@keyframes fade-out` — it already exists at line 22.

### 2. Rework `animation-observer.js` for replay

**File:** `Project Files/assets/js/animation-observer.js`

Add config constants for the attribute name, exit duration, and reset ratio. The exit duration constant
must match the 300ms used in task 1 — note this coupling in a comment.

Implement:

- `visibleRatio(element)` — viewport-relative visible fraction, using `min(rect.height, viewportHeight)`
  as the denominator so tall sections behave correctly.
- `replayTargets(root)` — returns the section plus every animated descendant, covering
  `.animate-on-scroll`, `.card-entrance`, `.animate-stagger > *`, `.animate-stagger-reverse > *`,
  `.list-animate > li`, and `.section-header-animate > *`.
- Exit path: add `.is-exiting` to the target set, then after the fade completes remove `.is-exiting`,
  remove `.is-visible`, remove the animation class and `.animate-on-scroll`, and force a reflow.
  Drive completion from `animationend` with a `setTimeout(EXIT_DURATION + buffer)` fallback so a
  missed event cannot strand a section in the exiting state.
- Entry path: re-add the animation class and `.animate-on-scroll`, force a reflow, then add
  `.is-visible` on the next frame so the animation actually restarts.

Change the un-observe behaviour so replay targets are **never** unobserved, while every other
`[data-animate]` element keeps today's `once: true` behaviour. `data-animate-once="true"` should remain a
valid per-element override.

Preserve the existing reduced-motion branch exactly: add `force-visible` and return, never replay.

The public API surface on `window.AnimationObserver` (`init`, `trigger`, `triggerStagger`, `refresh`,
`prefersReducedMotion`) must stay identical — `data-loader.js` depends on `triggerStagger`.
`triggerStagger()` must also clear any lingering `.is-exiting` so a dynamically re-rendered grid is
never left faded out.

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

### 4. Verify in a real browser

Serve the site and confirm the behaviour end to end (see Verification Requirements). Report the exact
commands run and what was observed. A claim of "works" without observed evidence is not acceptable.

---

## Acceptance Criteria

1. Scrolling one of the four homepage sections out of view fades it out in place — opacity only, no
   translate/scale movement.
2. Scrolling it back into view replays the entry animation from the start (the section slides up and
   fades in again), not just a static reveal.
3. Inner content replays too: the About cards, the Experience list items and the Projects grid all
   stagger in again rather than sitting at their final state.
4. A section taller than the viewport does **not** hide itself while fully on screen.
5. No section is ever left stuck invisible, faded out, or at partial opacity if you scroll quickly past it.
6. `about.html`, `contact.html`, `projects.html` and the hero behave exactly as before.
7. With `prefers-reduced-motion: reduce` enabled, nothing hides, fades, or replays.
8. `data-loader.js`'s `triggerStagger()` still correctly reveals dynamically injected cards on all pages.
9. No console errors on any page.

## Verification Requirements

1. Serve the `Project Files` directory over HTTP (a `file://` load breaks `fetch()` in `data-loader.js`
   and will produce false failures).
2. Load `Project Files/index.html`, open DevTools console, confirm zero errors.
3. Scroll down through Projects → About → Experience → Contact, then scroll back up and confirm each
   section replays. Watch specifically for a section that never reappears.
4. Test rapid scrolling (fling to the bottom, fling back to the top) to confirm no section is stranded
   at partial opacity. This is the highest-risk failure mode.
5. Emulate `prefers-reduced-motion: reduce` in DevTools rendering settings and confirm all four sections
   are visible immediately and never fade.
6. Load `about.html`, `contact.html` and `projects.html` and confirm behaviour is unchanged and that the
   dynamically injected grids still appear.
7. Report the changed files and the observed results as evidence.

## Rejected Alternatives

- **Pure CSS with `animation-direction: alternate` / scroll-driven animations** — `animation-timeline:
  view()` is not supported in enough current browsers and gives no control over the 0.15 reset point.
- **Toggling only `is-visible` without removing the animation class** — does not work; verified that the
  filled `.animate-entrance` animation keeps overriding declarative opacity.
- **`transition`-based exit instead of the `fade-out` keyframe** — would require releasing the filled
  entry animation first and would leave two competing animation systems to reason about.
- **Enabling replay globally for all `[data-animate]` elements** — rejected at the user checkpoint;
  blast radius includes other pages and risks visible flicker on tall sections.

## Remaining Risks

- The exit duration is duplicated between CSS (300ms) and JS (fallback timer). Mitigated with a comment
  in both files; a drift here causes a visible snap rather than a hard failure.
- Rapid scrolling is the main failure mode. The `animationend` + timeout belt-and-braces in task 2 is
  the mitigation — verify it explicitly.
- The pre-existing always-on `.animate-stagger > *` and `.list-animate > li` rules mean the About and
  Experience children animate on page load today. After this change they will also replay. This is a
  behaviour change on the homepage only, and is intended — but it should be confirmed as desirable
  rather than assumed.
