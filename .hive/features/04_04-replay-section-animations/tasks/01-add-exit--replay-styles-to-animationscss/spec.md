# Task: 01-add-exit--replay-styles-to-animationscss

## Feature: 04-replay-section-animations

## Dependencies

_None_

## Plan Section

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
