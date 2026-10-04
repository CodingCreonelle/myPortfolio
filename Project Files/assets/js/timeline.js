/**
 * Experience Timeline - turns the timeline data into semantic markup.
 *
 * This module is intentionally responsible only for structure. Styling and
 * interaction are layered on separately so the section stays readable even
 * before (or without) any of them.
 */

(function () {
  'use strict';

  const MOUNT_SELECTOR = '#experience-timeline';
  const TRACK_SELECTOR = '.timeline-track';
  const DETAIL_SELECTOR = '.timeline-entry__detail';
  const RUNWAY_SELECTOR = '.timeline-runway';
  const PIN_SELECTOR = '.timeline-pin';

  // Must stay in step with the pinned-mode media query in timeline.css, since one
  // decides the layout and the other decides whether to drive it.
  const PIN_MEDIA = '(hover: hover) and (pointer: fine) and (min-width: 960px) and (prefers-reduced-motion: no-preference)';
  const ACTIVE_CLASS = 'is-active';
  const MEASURING_CLASS = 'is-measuring';
  const TIMELINE_DATE_PATTERN = /^(\d{4})-(\d{2})$/;

  let activeFrame = 0;
  let resizeFrame = 0;
  let pinnedFrame = 0;
  let pinOffset = 0;

  function createNode(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  function timelineEntryMarkup(entry, index) {
    return `
      <li class="timeline-entry" data-timeline-index="${index}">
        <div class="timeline-entry__orb" aria-hidden="true"></div>
        <div class="timeline-entry__body">
          <div class="timeline-entry__detail">
            <div class="timeline-entry__stem" aria-hidden="true"></div>
            <div class="timeline-entry__text">
              <p class="timeline-entry__year">${entryYear(entry)}</p>
              <h3 class="timeline-entry__title">${entry.title}</h3>
              <p class="timeline-entry__subtitle">${entry.subtitle}</p>
              <p class="timeline-entry__description">${entry.description}</p>
              <p class="timeline-entry__tags">${entry.tags?.join(' · ') || ''}</p>
            </div>
          </div>
        </div>
      </li>
    `;
  }

  /** Month index for an entry, or null when it has no usable date. */
  function entryMonth(entry) {
    const match = TIMELINE_DATE_PATTERN.exec(entry.date || '');
    return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
  }

  /** Displayed year, taken from the date so the label and the climb cannot drift. */
  function entryYear(entry) {
    const match = TIMELINE_DATE_PATTERN.exec(entry.date || '');
    return match ? match[1] : entry.year;
  }

  /**
   * Turns the gaps between entries into a mountain profile. Each entry's --rise
   * is how high it sits, 0 being the lowest point and 1 the highest.
   *
   * The climb alternates direction, so the trail rises and falls like a ridge
   * instead of only ascending, and the size of each step is the real gap between
   * the two entries. The whole profile is normalised into 0-1, which is what
   * lets it fit a fixed lane however many entries get added.
   */
  function applyRise(timeline, track) {
    const months = timeline.map(entryMonth);

    // Cumulative height, alternating up and down. An entry without a usable date
    // holds its position rather than inventing a step.
    const heights = [0];
    for (let index = 1; index < months.length; index += 1) {
      const previous = months[index - 1];
      const current = months[index];
      const gap = previous === null || current === null ? 0 : Math.abs(current - previous);
      heights.push(heights[index - 1] + (index % 2 === 1 ? gap : -gap));
    }

    const lowest = Math.min.apply(null, heights);
    const span = Math.max.apply(null, heights) - lowest;

    Array.prototype.forEach.call(track.children, (element, index) => {
      const rise = span > 0 ? (heights[index] - lowest) / span : 0;
      element.style.setProperty('--rise', rise.toFixed(4));
    });
  }

  /**
   * Resolves custom properties to pixels.
   *
   * getComputedStyle hands back a custom property's raw token, so a value such as
   * clamp(120px, 17vh, 200px) cannot be parsed directly - it has to go through the
   * layout engine first. A zero-size probe does that without affecting anything.
   */
  function resolveLengths(element, properties) {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;';
    element.appendChild(probe);

    const sizes = {};
    Object.keys(properties).forEach((key) => {
      probe.style.width = `var(${properties[key]})`;
      sizes[key] = parseFloat(getComputedStyle(probe).width);
    });

    probe.remove();
    return sizes;
  }

  /**
   * Gives every entry the diagonal leading to the next orb. The horizontal run is
   * fixed by the layout and the rise comes from --rise, so each segment only has
   * to be stretched and rotated to land exactly on the next orb.
   */
  function applySlopes(track) {
    const entries = Array.prototype.slice.call(track.children);
    if (entries.length < 2) return;

    const sizes = resolveLengths(track, {
      entryWidth: '--entry-width',
      trackGap: '--track-gap',
      lane: '--timeline-lane',
      orbSize: '--orb-size-active',
    });

    const run = sizes.entryWidth + sizes.trackGap;
    // The climb spans the lane minus one orb, matching --orb-centre.
    const climbSpan = sizes.lane - sizes.orbSize;

    if (!Number.isFinite(run) || !Number.isFinite(climbSpan)) return;

    entries.forEach((element, index) => {
      const next = entries[index + 1];
      if (!next) return;

      const from = parseFloat(element.style.getPropertyValue('--rise')) || 0;
      const to = parseFloat(next.style.getPropertyValue('--rise')) || 0;

      // Screen y grows downward, so climbing to a later entry is a negative
      // delta. That makes the rotation carry the segment up to the next orb.
      const climb = -(to - from) * climbSpan;

      element.style.setProperty('--slope-length', `${Math.hypot(run, climb).toFixed(2)}px`);
      element.style.setProperty('--slope-angle', `${(Math.atan2(climb, run) * 180 / Math.PI).toFixed(3)}deg`);
    });
  }

  function pinnedMode() {
    return window.matchMedia(PIN_MEDIA).matches;
  }

  /**
   * How far the page has to scroll for the track to cross its whole width.
   *
   * Measured from the track rather than fixed in CSS: the travel the track needs
   * barely changes with the window, so scaling the scroll distance to it is what
   * holds the timeline to a steady pace per pixel of scroll. Returns 0 when there
   * is nothing to travel or the ratio is unusable, which leaves the runway at its
   * natural height and hands the track back its own scrolling.
   */
  function pinDistance(runway) {
    const track = document.querySelector(TRACK_SELECTOR);
    if (!track) return 0;

    const ratio = parseFloat(
      getComputedStyle(runway).getPropertyValue('--timeline-pin-travel')
    );
    if (!Number.isFinite(ratio) || ratio <= 0) return 0;

    return (track.scrollWidth - track.clientWidth) * ratio;
  }

  /**
   * Gives the runway exactly the height pinned scrolling needs: the pinned
   * element's own height plus the distance the timeline should travel through.
   * Outside pinned mode it collapses, so the page is only as tall as the section.
   */
  function sizeRunway() {
    const runway = document.querySelector(RUNWAY_SELECTOR);
    const pin = document.querySelector(PIN_SELECTOR);
    if (!runway || !pin) return;

    if (!pinnedMode()) {
      runway.style.height = '';
      return;
    }

    const distance = pinDistance(runway);
    if (!(distance > 0)) return;

    const sizes = resolveLengths(runway, { offset: '--timeline-pin-offset' });

    // Cached for the scroll handler, which must not touch the DOM layout itself.
    pinOffset = Number.isFinite(sizes.offset) ? sizes.offset : 0;
    runway.style.height = `${pin.offsetHeight + distance}px`;
  }

  /**
   * Maps how far the runway has been scrolled onto the track's own horizontal
   * offset. Driving scrollLeft rather than a transform means the existing
   * centre-detection keeps working untouched: the same code that reacts to a drag
   * also reacts to page scroll.
   */
  function updatePinnedScroll() {
    const runway = document.querySelector(RUNWAY_SELECTOR);
    const pin = document.querySelector(PIN_SELECTOR);
    const track = document.querySelector(TRACK_SELECTOR);
    if (!runway || !pin || !track) return;

    const travel = runway.offsetHeight - pin.offsetHeight;
    if (travel <= 0) return;

    // The pinned element starts at its sticky offset, not at 0, so that offset has
    // to come out of the distance already travelled.
    const scrolled = pinOffset - runway.getBoundingClientRect().top;
    const progress = Math.min(1, Math.max(0, scrolled / travel));

    track.scrollLeft = progress * (track.scrollWidth - track.clientWidth);
  }

  function schedulePinnedUpdate() {
    if (pinnedFrame) return;
    pinnedFrame = requestAnimationFrame(() => {
      pinnedFrame = 0;
      updatePinnedScroll();
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * The controls mirror the scroll position rather than owning it: the active
   * entry is still whichever is nearest the centre, whether that came from a
   * drag, a key press or the page scrolling.
   */
  function controlsMarkup(timeline) {
    const dots = timeline.map((entry, index) => `
          <button type="button" class="timeline-dot" data-timeline-goto="${index}"
                  aria-label="${entryYear(entry)}: ${entry.title}"></button>`).join('');

    return `
      <div class="timeline-controls">
        <button type="button" class="timeline-control" data-timeline-step="-1" aria-label="Previous entry">
          <span aria-hidden="true">&#8249;</span>
        </button>
        <div class="timeline-dots">${dots}
        </div>
        <button type="button" class="timeline-control" data-timeline-step="1" aria-label="Next entry">
          <span aria-hidden="true">&#8250;</span>
        </button>
      </div>
      <p class="timeline-status" role="status"></p>
    `;
  }

  function activeIndexOf(track) {
    return Array.prototype.findIndex.call(
      track.children,
      (entry) => entry.classList.contains(ACTIVE_CLASS)
    );
  }

  function goToEntry(index) {
    const runway = document.querySelector(RUNWAY_SELECTOR);
    const pin = document.querySelector(PIN_SELECTOR);
    const track = document.querySelector(TRACK_SELECTOR);
    if (!track) return;

    const entries = Array.prototype.slice.call(track.children);
    const clamped = Math.max(0, Math.min(entries.length - 1, index));
    const entry = entries[clamped];
    if (!entry) return;

    const behavior = prefersReducedMotion() ? 'auto' : 'smooth';

    // While the page is driving the timeline, moving the track alone would be
    // undone by the very next scroll, so the page is moved instead.
    if (pinnedMode() && runway && pin) {
      const travel = runway.offsetHeight - pin.offsetHeight;
      const lastIndex = entries.length - 1;
      const ratio = lastIndex > 0 ? clamped / lastIndex : 0;
      const runwayTop = runway.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: runwayTop - pinOffset + travel * ratio, behavior });
      return;
    }

    track.scrollTo({
      left: entry.offsetLeft + entry.offsetWidth / 2 - track.clientWidth / 2,
      behavior,
    });
  }

  function syncControls(track, activeIndex) {
    const mount = document.querySelector(MOUNT_SELECTOR);
    if (!mount || activeIndex < 0) return;

    mount.querySelectorAll('[data-timeline-goto]').forEach((dot) => {
      const isActive = Number(dot.dataset.timelineGoto) === activeIndex;
      dot.classList.toggle(ACTIVE_CLASS, isActive);
      if (isActive) {
        dot.setAttribute('aria-current', 'true');
      } else {
        dot.removeAttribute('aria-current');
      }
    });

    const count = track.children.length;
    mount.querySelectorAll('[data-timeline-step]').forEach((button) => {
      const direction = Number(button.dataset.timelineStep);
      button.disabled = direction < 0 ? activeIndex <= 0 : activeIndex >= count - 1;
    });

    const status = mount.querySelector('.timeline-status');
    const title = track.children[activeIndex]?.querySelector('.timeline-entry__title');
    if (status && title) {
      status.textContent = `Entry ${activeIndex + 1} of ${count}: ${title.textContent}`;
    }
  }

  function bindControls(track) {
    const mount = document.querySelector(MOUNT_SELECTOR);
    // Idempotent, so a re-render cannot stack duplicate listeners.
    if (!mount || mount.dataset.controlsBound === 'true') return;
    mount.dataset.controlsBound = 'true';

    mount.addEventListener('click', (event) => {
      const step = event.target.closest('[data-timeline-step]');
      if (step) {
        goToEntry(activeIndexOf(track) + Number(step.dataset.timelineStep));
        return;
      }

      const dot = event.target.closest('[data-timeline-goto]');
      if (dot) goToEntry(Number(dot.dataset.timelineGoto));
    });
  }

  /**
   * The entry closest to the centre of the track is the active one. Distance is
   * measured between centres rather than edges so it stays correct no matter
   * how much of the track is on screen.
   */
  function markActiveEntry(track) {
    const entries = Array.prototype.slice.call(track.children);
    if (!entries.length) return;

    const trackRect = track.getBoundingClientRect();
    const trackCenter = trackRect.left + trackRect.width / 2;

    let nearest = null;
    let nearestDistance = Infinity;

    entries.forEach((entry) => {
      const rect = entry.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - trackCenter);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = entry;
      }
    });

    let activeIndex = -1;
    entries.forEach((entry, index) => {
      const isActive = entry === nearest;
      entry.classList.toggle(ACTIVE_CLASS, isActive);
      if (isActive) activeIndex = index;
    });

    syncControls(track, activeIndex);
  }

  function scheduleActiveUpdate() {
    if (activeFrame) return;
    activeFrame = requestAnimationFrame(() => {
      activeFrame = 0;
      const track = document.querySelector(TRACK_SELECTOR);
      if (track) markActiveEntry(track);
    });
  }

  /**
   * Reserves a block for the details sized to the tallest one, so changing which
   * orb is active cannot shift the page below the timeline. Measured rather than
   * hard-coded, so longer or shorter copy in the JSON stays correct.
   */
  function reserveDetailHeight(track) {
    track.classList.add(MEASURING_CLASS);

    let tallest = 0;
    Array.prototype.forEach.call(track.children, (entry) => {
      const detail = entry.querySelector(DETAIL_SELECTOR);
      if (detail) tallest = Math.max(tallest, detail.getBoundingClientRect().height);
    });

    track.classList.remove(MEASURING_CLASS);

    if (tallest > 0) {
      track.style.setProperty('--timeline-detail-height', `${Math.ceil(tallest)}px`);
    }
  }

  /** Re-measure and re-evaluate on resize, where the copy re-wraps. */
  function scheduleResizeUpdate() {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const track = document.querySelector(TRACK_SELECTOR);
      if (!track) return;
      applySlopes(track);
      reserveDetailHeight(track);
      markActiveEntry(track);
      sizeRunway();
      updatePinnedScroll();
    });
  }

  function bindActiveTracking(track) {
    // Idempotent, so a re-render cannot stack duplicate listeners.
    if (track.dataset.activeBound === 'true') return;
    track.dataset.activeBound = 'true';

    track.addEventListener('scroll', scheduleActiveUpdate, { passive: true });
    window.addEventListener('scroll', schedulePinnedUpdate, { passive: true });
    window.addEventListener('resize', scheduleResizeUpdate);
    scheduleActiveUpdate();
  }

  function renderTimeline(timeline) {
    const mount = document.querySelector(MOUNT_SELECTOR);
    if (!mount || !Array.isArray(timeline) || !timeline.length) return;

    mount.innerHTML = '';

    // An ordered list, because the timeline is chronological and the order is
    // part of the meaning rather than a presentation detail.
    const list = document.createElement('ol');
    list.className = 'timeline-track';

    timeline.forEach((entry, index) => {
      list.appendChild(createNode(timelineEntryMarkup(entry, index)));
    });

    mount.appendChild(list);

    // The climb and the trail depend only on the data and the layout, so they are
    // settled before the details are measured.
    applyRise(timeline, list);
    applySlopes(list);

    // Reserve the details block before anything else so the first paint is
    // already stable.
    reserveDetailHeight(list);

    // The track is the scroll affordance, so it has to be reachable and
    // scrollable by keyboard alone.
    list.tabIndex = 0;
    list.setAttribute('aria-label', 'Experience timeline');

    mount.insertAdjacentHTML('beforeend', controlsMarkup(timeline));
    bindControls(list);

    bindActiveTracking(list);

    // The runway depends on the rendered height, so it is sized last.
    sizeRunway();
  }

  window.PortfolioTimeline = {
    render: renderTimeline,
  };
})();
