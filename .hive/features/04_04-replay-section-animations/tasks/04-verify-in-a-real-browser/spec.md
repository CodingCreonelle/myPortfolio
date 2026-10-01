# Task: 04-verify-in-a-real-browser

## Feature: 04-replay-section-animations

## Dependencies

- **3. Opt in the four homepage sections** (03-opt-in-the-four-homepage-sections)

## Plan Section

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
