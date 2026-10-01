# Task: 02-rework-animation-observerjs-for-replay

## Feature: 04-replay-section-animations

## Dependencies

- **1. Add exit + replay styles to `animations.css`** (01-add-exit--replay-styles-to-animationscss)

## Plan Section

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
