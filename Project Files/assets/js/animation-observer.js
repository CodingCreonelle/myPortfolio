/**
 * Animation Observer - Handles scroll-triggered entry animations
 * Uses IntersectionObserver for performance
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    rootMargin: '0px 0px 100% 0px', // Trigger as soon as element enters viewport
    threshold: 0.02,
  };

  // Replay configuration - opt-in per element via [data-animate-replay].
  const REPLAY = {
    selector: '[data-animate-replay]',
    exitClass: 'is-exiting',
    resetClass: 'animate-reset',
    // Must match the 300ms exit duration of .is-exiting in animations.css.
    exitDuration: 300,
    // Safety buffer for the setTimeout fallback that completes an exit.
    exitBuffer: 100,
    // Reset the section once its visible ratio drops to this value or below.
    resetRatio: 0.02,
    // Multi-threshold list so a callback fires at the reset boundary.
    thresholds: [0, 0.02, 0.05, 0.1, 0.25, 0.5, 1],
  };

  // Animation attribute selectors
  const SELECTORS = {
    animate: '[data-animate]',
    stagger: '[data-animate-stagger]',
  };

  const AUTO_SECTION_SELECTOR = 'main > section, main > header, .contact-workspace > section, .doc-section, #project-detail .project-view__section';

  // Default animation classes
  const DEFAULT_ANIMATION = 'animate-entrance';
  const STAGGER_CHILD_SELECTOR = ':scope > *';

  // Descendants of a replay section that own an entry animation, so they must
  // be reset and replayed together with the section itself.
  const REPLAY_DESCENDANT_SELECTOR = [
    '[data-animate]',
    '[data-animate-stagger]',
    '[data-animate-stagger] > *',
    '.animate-on-scroll',
    '.card-entrance',
    '.animate-stagger > *',
    '.animate-stagger-reverse > *',
    '.list-animate > li',
    '.section-header-animate > *',
    '.hero-animate-title',
    '.hero-animate-subtitle',
    '.hero-animate-description',
    '.hero-animate-actions',
    '.hero-animate-visual',
    '.hero-animate-avatar',
  ].join(', ');

  // Per-section replay state (status: 'idle' | 'shown' | 'exiting').
  const replayState = new WeakMap();
  const replaySections = [];
  let replayFrame = 0;
  let replayListenersBound = false;

  // IntersectionObserver handles (module-scoped rather than leaked on window).
  let observer = null;
  let replayObserver = null;

  /**
   * Check if user prefers reduced motion
   */
  function prefersReducedMotion() {
    if (typeof window !== 'undefined' && window.PortfolioUtils && typeof window.PortfolioUtils.reduceMotion === 'function') {
      return window.PortfolioUtils.reduceMotion();
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Get animation configuration from element
   */
  function getAnimationConfig(element) {
    const dataset = element.dataset;
    return {
      animation: dataset.animate || DEFAULT_ANIMATION,
      delay: parseInt(dataset.animateDelay, 10) || 0,
      duration: dataset.animateDuration || null,
      easing: dataset.animateEasing || null,
      stagger: dataset.animateStagger === 'true',
      staggerDelay: parseInt(dataset.animateStaggerDelay, 10) || 100,
      once: dataset.animateOnce !== 'false',
    };
  }

  /**
   * Add the entry animation classes / inline configuration to an element.
   * Idempotent, so it is safe to call again on every replay.
   */
  function configureEntryAnimation(element, config) {
    // Add base animation class
    element.classList.add('animate-on-scroll');
    element.classList.add(config.animation);

    // Apply custom duration if specified
    if (config.duration) {
      element.style.animationDuration = config.duration;
    }

    // Apply custom easing if specified
    if (config.easing) {
      element.style.animationTimingFunction = config.easing;
    }

    // Apply delay
    if (config.delay > 0) {
      element.style.animationDelay = `${config.delay}ms`;
    }
  }

  /**
   * Apply animation classes to element
   */
  function applyAnimation(element, config) {
    configureEntryAnimation(element, config);

    // Mark as visible synchronously so elements never get stranded hidden
    element.classList.add('is-visible');
  }

  /**
   * Apply stagger animation to children
   */
  function applyStaggerAnimation(container, config) {
    const children = container.querySelectorAll(STAGGER_CHILD_SELECTOR);
    
    children.forEach((child, index) => {
      child.classList.add('animate-on-scroll');
      child.classList.add(config.animation || DEFAULT_ANIMATION);
      child.classList.add('is-visible');
      
      const delay = config.delay + (index * config.staggerDelay);
      child.style.animationDelay = `${delay}ms`;
      
      if (config.duration) {
        child.style.animationDuration = config.duration;
      }
      
      if (config.easing) {
        child.style.animationTimingFunction = config.easing;
      }
    });

    // Mark container as visible synchronously to trigger children animations
    container.classList.add('is-visible');
  }

  /**
   * Handle intersection observer entries
   */
  function handleIntersections(entries, observer) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        
        // Check for stagger container
        if (element.hasAttribute('data-animate-stagger')) {
          const config = getAnimationConfig(element);
          applyStaggerAnimation(element, config);
        } else {
          const config = getAnimationConfig(element);
          applyAnimation(element, config);
        }

        // Unobserve if once is true
        const config = getAnimationConfig(element);
        if (config.once) {
          observer.unobserve(element);
        }
      }
    });
  }

  /**
   * Visible fraction of an element relative to the viewport.
   * Uses min(element height, viewport height) as the denominator so a section
   * taller than the viewport still counts as fully visible when it fills the
   * screen (otherwise it could hide itself while fully on screen).
   */
  function visibleRatio(element) {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (viewportHeight <= 0) return 0;
    if (rect.height <= 0) {
      return (rect.top >= 0 && rect.top < viewportHeight) ? 1 : 0;
    }

    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    if (visibleHeight <= 0) return 0;

    const denominator = Math.min(rect.height, viewportHeight);
    return Math.max(0, Math.min(1, visibleHeight / denominator));
  }

  /**
   * The section itself plus every animated descendant that must be reset and
   * replayed together with it.
   */
  function replayTargets(section) {
    const targets = [section];
    section.querySelectorAll(REPLAY_DESCENDANT_SELECTOR).forEach(element => {
      if (!targets.includes(element)) targets.push(element);
    });
    return targets;
  }

  /**
   * Get (or create) the replay state for a section.
   */
  function getReplayState(section) {
    let state = replayState.get(section);
    if (!state) {
      state = { status: 'idle', generation: 0, timer: 0, onAnimationEnd: null };
      replayState.set(section, state);
    }
    return state;
  }

  /**
   * Cancel any pending exit completion for a section.
   */
  function cancelReplayPending(section, state) {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = 0;
    }
    if (state.onAnimationEnd) {
      section.removeEventListener('animationend', state.onAnimationEnd);
      state.onAnimationEnd = null;
    }
  }

  /**
   * Automatically opts every section across all pages into scroll entry/exit
   * unless explicitly marked with data-animate-once="true".
   */
  function enrollPageSections() {
    document.querySelectorAll(AUTO_SECTION_SELECTOR).forEach(section => {
      if (section.dataset.animateOnce === 'true') return;
      if (!section.hasAttribute('data-animate')) {
        section.setAttribute('data-animate', DEFAULT_ANIMATION);
      }
      if (!section.hasAttribute('data-animate-replay')) {
        section.setAttribute('data-animate-replay', 'true');
      }
    });
  }

  /**
   * Play the entrance animation for a replay section (and its descendants).
   */
  function enterReplaySection(section) {
    const state = getReplayState(section);
    state.generation += 1;
    cancelReplayPending(section, state);

    const config = getAnimationConfig(section);
    configureEntryAnimation(section, config);

    section.querySelectorAll(SELECTORS.animate).forEach(child => {
      configureEntryAnimation(child, getAnimationConfig(child));
    });

    const staggerContainers = [];
    if (section.hasAttribute('data-animate-stagger')) {
      staggerContainers.push(section);
    }
    section.querySelectorAll(SELECTORS.stagger).forEach(container => {
      staggerContainers.push(container);
    });
    staggerContainers.forEach(container => {
      const containerConfig = getAnimationConfig(container);
      container.querySelectorAll(STAGGER_CHILD_SELECTOR).forEach((child, index) => {
        child.classList.add('animate-on-scroll');
        child.classList.add(containerConfig.animation || DEFAULT_ANIMATION);
        if (!child.style.animationDelay) {
          child.style.animationDelay = `${containerConfig.delay + (index * containerConfig.staggerDelay)}ms`;
        }
      });
    });

    const targets = replayTargets(section);

    // A filled CSS animation (animation: ... forwards) cannot be restarted by
    // toggling is-visible alone. Suppress every animation (section + managed
    // descendants), commit that state with a forced reflow, then release it so
    // each animation starts again from the beginning.
    targets.forEach(element => {
      element.classList.remove(REPLAY.exitClass);
      element.classList.add(REPLAY.resetClass);
    });
    void section.offsetWidth;

    targets.forEach(element => element.classList.remove(REPLAY.resetClass));
    void section.offsetWidth;

    if (section.dataset.hasShownOnce === 'true' && window.Typewriter && typeof window.Typewriter.replayWithin === 'function') {
      window.Typewriter.replayWithin(section);
    }
    section.dataset.hasShownOnce = 'true';

    targets.forEach(element => element.classList.add('is-visible'));

    state.status = 'shown';
  }

  /**
   * Fade a replay section (and its descendants) out, then reset it so the next
   * entry replays from the beginning.
   */
  function exitReplaySection(section) {
    const state = getReplayState(section);
    const generation = ++state.generation;
    cancelReplayPending(section, state);

    const targets = replayTargets(section);
    targets.forEach(element => {
      element.classList.remove(REPLAY.resetClass);
      element.classList.add(REPLAY.exitClass);
    });
    state.status = 'exiting';

    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      cancelReplayPending(section, state);
      // A newer transition (e.g. the user scrolled back) superseded this exit.
      if (state.generation !== generation) return;

      targets.forEach(element => {
        element.classList.remove(REPLAY.exitClass);
        element.classList.remove('is-visible');
        element.classList.add(REPLAY.resetClass);
      });
      // Commit the reset state before any possible re-entry.
      void section.offsetWidth;
      state.status = 'idle';
    };

    const onAnimationEnd = (event) => {
      // Child exits bubble here too, but they share the same timing.
      if (event.animationName !== 'fade-out' && event.animationName !== 'section-exit') return;
      finish();
    };

    // Belt and braces: animationend plus a timeout, so a missed event can never
    // strand the section in the exiting (partial opacity) state.
    section.addEventListener('animationend', onAnimationEnd);
    state.onAnimationEnd = onAnimationEnd;
    state.timer = setTimeout(finish, REPLAY.exitDuration + REPLAY.exitBuffer);
  }

  /**
   * Decide whether a replay section should enter or exit.
   */
  function evaluateReplaySection(section) {
    if (prefersReducedMotion()) return;

    const state = getReplayState(section);
    if (visibleRatio(section) > REPLAY.resetRatio) {
      if (state.status !== 'shown') {
        enterReplaySection(section);
      }
    } else if (state.status === 'shown') {
      exitReplaySection(section);
    }
  }

  /**
   * Evaluate every replay section.
   */
  function evaluateReplaySections() {
    replaySections.forEach(evaluateReplaySection);
  }

  /**
   * IntersectionObserver callback for replay sections.
   */
  function handleReplayIntersections(entries) {
    entries.forEach(entry => evaluateReplaySection(entry.target));
  }

  /**
   * rAF-throttled scroll/resize handler. Threshold callbacks alone cannot cover
   * every point at which a tall section crosses the reset ratio, so the visible
   * ratio is also recomputed directly while scrolling.
   */
  function scheduleReplayEvaluation() {
    if (replayFrame) return;
    replayFrame = requestAnimationFrame(() => {
      replayFrame = 0;
      evaluateReplaySections();
    });
  }

  function registerObservedElements() {
    document.querySelectorAll(SELECTORS.animate).forEach(element => {
      if (element.matches(REPLAY.selector) && element.dataset.animateOnce !== 'true') {
        if (!replaySections.includes(element)) {
          replaySections.push(element);
          getReplayState(element);
          if (replayObserver) replayObserver.observe(element);
        }
      } else if (!element.closest(REPLAY.selector) && !element.classList.contains('is-visible')) {
        if (observer) observer.observe(element);
      }
    });

    // Observe stagger containers (replay sections manage their own children).
    document.querySelectorAll(SELECTORS.stagger).forEach(element => {
      if (!element.closest(REPLAY.selector) && !element.classList.contains('is-visible')) {
        if (observer) observer.observe(element);
      }
    });
  }

  /**
   * Initialize animation observer
   */
  function initAnimationObserver() {
    enrollPageSections();

    // Skip if reduced motion is preferred
    if (prefersReducedMotion()) {
      // Make all elements visible immediately
      document.querySelectorAll(SELECTORS.animate).forEach(el => {
        el.classList.add('force-visible');
      });
      document.querySelectorAll(SELECTORS.stagger).forEach(el => {
        el.classList.add('force-visible');
        el.querySelectorAll(STAGGER_CHILD_SELECTOR).forEach(child => {
          child.classList.add('force-visible');
        });
      });
      return;
    }

    // Create intersection observer
    observer = new IntersectionObserver(handleIntersections, {
      rootMargin: CONFIG.rootMargin,
      threshold: CONFIG.threshold,
    });

    // Replay sections need a multi-threshold observer so a callback fires at
    // the reset boundary (0.12) and not only on first entry.
    replayObserver = new IntersectionObserver(handleReplayIntersections, {
      rootMargin: CONFIG.rootMargin,
      threshold: REPLAY.thresholds,
    });

    registerObservedElements();

    // Threshold callbacks alone miss part of the tall-section reset boundary,
    // so also recompute ratios while scrolling/resizing (rAF-throttled).
    if (!replayListenersBound) {
      window.addEventListener('scroll', scheduleReplayEvaluation, { passive: true });
      window.addEventListener('resize', scheduleReplayEvaluation, { passive: true });
      replayListenersBound = true;
    }

    // Establish the initial state of each replay section.
    evaluateReplaySections();
  }

  /**
   * Trigger stagger animation for a container
   */
  function triggerStaggerAnimation(container, animationClass = DEFAULT_ANIMATION, staggerDelay = 100) {
    if (prefersReducedMotion()) {
      container.classList.add('force-visible');
      container.querySelectorAll(STAGGER_CHILD_SELECTOR).forEach(child => {
        child.classList.add('force-visible');
      });
      return;
    }

    // Clear any lingering exit/reset state so a dynamically re-rendered grid is
    // never left faded out or with its animations suppressed.
    container.classList.remove(REPLAY.exitClass, REPLAY.resetClass);
    container.classList.add('is-visible');

    const children = container.querySelectorAll(STAGGER_CHILD_SELECTOR);

    children.forEach((child, index) => {
      child.classList.remove(REPLAY.exitClass, REPLAY.resetClass);
      child.classList.add('animate-on-scroll');
      child.classList.add(animationClass);
      child.classList.add('is-visible');
      child.style.animationDelay = `${index * staggerDelay}ms`;
    });

    const replayHost = container.matches(REPLAY.selector) ? container : container.closest(REPLAY.selector);
    if (replayHost) {
      evaluateReplaySection(replayHost);
    }
  }

  /**
   * Refresh observer (useful after dynamic content loads)
   */
  function refreshObserver() {
    enrollPageSections();

    if (prefersReducedMotion()) {
      document.querySelectorAll(SELECTORS.animate).forEach(el => {
        el.classList.add('force-visible');
      });
      return;
    }

    registerObservedElements();

    // Keep replay sections observed and re-evaluate their current state.
    if (replayObserver) {
      replaySections.forEach(section => replayObserver.observe(section));
    }
    evaluateReplaySections();
    if (typeof refreshPinnedScenes === 'function') {
      refreshPinnedScenes();
    }
  }

  /* ==========================================================================
     SCROLL PROGRESS BAR, SECTION RAIL & PINNED VIEWS (Home & About Pages)
     ========================================================================== */
  const PIN_SCENE_MEDIA = '(hover: hover) and (pointer: fine) and (min-width: 960px) and (prefers-reduced-motion: no-preference)';
  const pinnedSections = [];
  let scrollProgressBarEl = null;
  let sectionRailEl = null;
  let sceneScrollFrame = 0;
  let sceneListenersBound = false;
  let sceneAriaTimer = 0;
  const supportsNativeScrollTimeline = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timeline', 'scroll()');
  const supportsScrollTargetGroup = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('scroll-target-group', 'auto');
  const supportsScrollStateQuery = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('container-type', 'scroll-state');

  function isPinnedSceneMode() {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(PIN_SCENE_MEDIA).matches;
  }

  function ensureScrollProgressBar() {
    if (scrollProgressBarEl || typeof document === 'undefined' || !document.body) return scrollProgressBarEl;
    let bar = document.getElementById('scroll-progress-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'scroll-progress-bar';
      bar.className = 'scroll-progress-bar';
      bar.setAttribute('aria-hidden', 'true');
      bar.innerHTML = '<span class="scroll-progress-bar__fill"></span>';
      document.body.prepend(bar);
    }
    scrollProgressBarEl = bar;
    return bar;
  }

  function buildSectionRail(sections) {
    if (typeof document === 'undefined' || !document.body || sections.length === 0) return null;
    if (sectionRailEl) sectionRailEl.remove();

    const nav = document.createElement('nav');
    nav.className = 'section-progress-rail';
    nav.setAttribute('aria-label', 'Page section progress');

    const itemsHtml = sections.map((section, idx) => {
      const id = section.id || `section-${idx + 1}`;
      if (!section.id) section.id = id;
      const label = section.getAttribute('data-section-label') || `Section ${idx + 1}`;
      return `
        <li class="section-progress-rail__item">
          <a class="section-progress-rail__link" href="#${id}" data-rail-target="${id}" aria-label="${label}" title="${label}" aria-current="${idx === 0 ? 'true' : 'false'}">
            <span class="section-progress-rail__orb" aria-hidden="true">
              <span class="section-progress-rail__orb-halo"></span>
              <span class="section-progress-rail__orb-core"></span>
            </span>
          </a>
        </li>`;
    }).join('');

    nav.innerHTML = `
      <div class="section-progress-rail__track" aria-hidden="true">
        <span class="section-progress-rail__track-fill"></span>
      </div>
      <ol class="section-progress-rail__list">${itemsHtml}</ol>`;

    nav.addEventListener('click', (event) => {
      const link = event.target.closest('.section-progress-rail__link');
      if (!link) return;
      const targetId = link.getAttribute('data-rail-target');
      const targetEl = targetId ? document.getElementById(targetId) : null;
      if (!targetEl) return;
      event.preventDefault();
      targetEl.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
      try {
        targetEl.focus({ preventScroll: true });
      } catch (_e) {}
    });

    document.body.appendChild(nav);
    sectionRailEl = nav;
    return nav;
  }

  function wrapPinnedSection(section) {
    if (section.dataset.pinnedInitialized === 'true') return;
    section.dataset.pinnedInitialized = 'true';
    section.classList.add('is-pinned-ready');

    if (!section.hasAttribute('tabindex')) {
      section.setAttribute('tabindex', '-1');
    }

    const existingTimelineRunway = section.querySelector('.timeline-runway');
    const existingTimelinePin = existingTimelineRunway && existingTimelineRunway.querySelector('.timeline-pin');
    if (existingTimelineRunway && existingTimelinePin) {
      return;
    }

    const runway = document.createElement('div');
    runway.className = 'pinned-section__runway';
    const pin = document.createElement('div');
    pin.className = 'pinned-section__pin';
    const stage = document.createElement('div');
    stage.className = 'pinned-section__stage';

    while (section.firstChild) {
      stage.appendChild(section.firstChild);
    }

    pin.appendChild(stage);
    runway.appendChild(pin);
    section.appendChild(runway);
  }

  const trainingsDeckState = new WeakMap();

  function getTrainingsState(section) {
    let state = trainingsDeckState.get(section);
    if (!state) {
      state = { activeIdx: 0, lastScrollIdx: -1, itemCount: 0, controlsEl: null };
      trainingsDeckState.set(section, state);
    }
    return state;
  }

  function setTrainingsActiveIndex(section, index) {
    const list = section.querySelector('#ab-trainings-list');
    if (!list) return;
    const items = Array.from(list.children);
    const total = items.length;
    if (total === 0) return;

    const clamped = Math.max(0, Math.min(total - 1, index));
    const state = getTrainingsState(section);
    state.activeIdx = clamped;

    items.forEach((item, i) => {
      const isActive = i === clamped;
      item.classList.toggle('is-train-active', isActive);
      item.setAttribute('aria-hidden', isPinnedSceneMode() && !isActive ? 'true' : 'false');
    });

    if (state.controlsEl) {
      const counter = state.controlsEl.querySelector('.ab-trainings__counter');
      if (counter) {
        counter.textContent = `${String(clamped + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
      }
      const prevBtn = state.controlsEl.querySelector('[data-train-dir="-1"]');
      const nextBtn = state.controlsEl.querySelector('[data-train-dir="1"]');
      if (prevBtn) prevBtn.disabled = clamped <= 0;
      if (nextBtn) nextBtn.disabled = clamped >= total - 1;
      state.controlsEl.querySelectorAll('.ab-trainings__dot').forEach((dot, i) => {
        const isCurrent = i === clamped;
        dot.classList.toggle('is-active', isCurrent);
        dot.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
      });
    }
  }

  function syncTrainingsDeck(section) {
    if (!section || section.id !== 'trainings') return;
    const list = section.querySelector('#ab-trainings-list');
    if (!list) return;

    const items = Array.from(list.children);
    const pinned = isPinnedSceneMode();
    const state = getTrainingsState(section);

    if (!pinned || items.length <= 1) {
      list.classList.remove('ab-trainings__list--paged');
      items.forEach((item) => {
        item.classList.remove('is-train-active');
        item.removeAttribute('aria-hidden');
      });
      if (state.controlsEl) {
        state.controlsEl.hidden = true;
      }
      return;
    }

    list.classList.add('ab-trainings__list--paged');

    if (!state.controlsEl || !section.contains(state.controlsEl) || state.itemCount !== items.length) {
      if (state.controlsEl) state.controlsEl.remove();

      const controls = document.createElement('div');
      controls.className = 'ab-trainings__controls';
      controls.setAttribute('aria-label', 'Training milestone navigation');
      const dotsHtml = items.map((_, i) => (
        `<button type="button" class="ab-trainings__dot" data-train-dot="${i}" role="tab" aria-label="Milestone ${i + 1}" aria-selected="false"></button>`
      )).join('');

      controls.innerHTML = `
        <button type="button" class="ab-trainings__ctrl-btn" data-train-dir="-1" aria-label="Previous milestone">&#8592;</button>
        <div class="ab-trainings__dots" role="tablist" aria-label="Select milestone">${dotsHtml}</div>
        <span class="ab-trainings__counter">01 / ${String(items.length).padStart(2, '0')}</span>
        <button type="button" class="ab-trainings__ctrl-btn" data-train-dir="1" aria-label="Next milestone">&#8594;</button>`;

      controls.addEventListener('click', (event) => {
        const dirBtn = event.target.closest('[data-train-dir]');
        if (dirBtn) {
          const dir = parseInt(dirBtn.getAttribute('data-train-dir'), 10) || 0;
          setTrainingsActiveIndex(section, state.activeIdx + dir);
          return;
        }
        const dotBtn = event.target.closest('[data-train-dot]');
        if (dotBtn) {
          const idx = parseInt(dotBtn.getAttribute('data-train-dot'), 10);
          if (!isNaN(idx)) setTrainingsActiveIndex(section, idx);
        }
      });

      list.insertAdjacentElement('afterend', controls);
      state.controlsEl = controls;
      state.itemCount = items.length;
    }

    state.controlsEl.hidden = false;
    setTrainingsActiveIndex(section, Math.min(state.activeIdx, items.length - 1));
  }

  function measureSectionTravel(section) {
    const id = section.id || '';
    if (id === 'projects') {
      const count = section.querySelectorAll('.work-card').length || 3;
      return Math.min(540, Math.max(260, count * 110));
    }
    if (id === 'skills') {
      const cardCount = section.querySelectorAll('.ab-skill-card').length || 3;
      return Math.min(420, Math.max(220, cardCount * 75));
    }
    if (id === 'trainings') {
      const stepCount = section.querySelectorAll('.ab-train').length || 3;
      return Math.min(540, Math.max(260, stepCount * 80));
    }
    if (id === 'about') {
      return 260;
    }
    return 180;
  }

  function sizePinnedRunways() {
    const pinned = isPinnedSceneMode();
    const vh = window.innerHeight || document.documentElement.clientHeight || 800;

    pinnedSections.forEach((section) => {
      if (section.querySelector('.timeline-runway')) return;
      const runway = section.querySelector('.pinned-section__runway');
      const pin = section.querySelector('.pinned-section__pin');
      if (!runway || !pin) return;

      if (section.id === 'trainings') {
        syncTrainingsDeck(section);
      }

      if (!pinned) {
        runway.style.height = '';
        pin.style.removeProperty('--pin-top');
        return;
      }

      runway.style.height = '';
      const pinHeight = pin.offsetHeight || 0;
      const travel = measureSectionTravel(section);
      const navClearance = 84;
      const bottomClearance = 36;
      const availableHeight = Math.max(320, vh - navClearance - bottomClearance);
      const centeredTop = Math.round(navClearance + (availableHeight - pinHeight) / 2);
      const stickyTop = Math.max(navClearance, centeredTop);
      pin.style.setProperty('--pin-top', `${stickyTop}px`);
      runway.style.height = `${pinHeight + travel}px`;
    });
  }

  function updateSectionInternalProgression(section, progress) {
    const id = section.id || '';

    if (id === 'projects' && window.WorkGallery && typeof window.WorkGallery.getCount === 'function') {
      const total = window.WorkGallery.getCount();
      if (total > 1 && progress > 0 && progress < 1) {
        const targetIdx = Math.min(total - 1, Math.floor(progress * total));
        if (window.WorkGallery.getActive() !== targetIdx) {
          window.WorkGallery.goTo(targetIdx, false);
        }
      }
      return;
    }

    if (id === 'skills') {
      const cards = section.querySelectorAll('.ab-skill-card');
      if (cards.length > 0) {
        const activeIdx = progress > 0 && progress < 1
          ? Math.min(cards.length - 1, Math.floor(progress * cards.length))
          : -1;
        cards.forEach((card, i) => card.classList.toggle('is-pin-focus', i === activeIdx));
      }
      return;
    }

    if (id === 'trainings') {
      const items = section.querySelectorAll('.ab-train');
      if (items.length > 1) {
        const state = getTrainingsState(section);
        const scrollIdx = progress >= 1
          ? items.length - 1
          : (progress <= 0 ? 0 : Math.min(items.length - 1, Math.floor(progress * items.length)));
        if (scrollIdx !== state.lastScrollIdx) {
          state.lastScrollIdx = scrollIdx;
          setTrainingsActiveIndex(section, scrollIdx);
        }
      }
      return;
    }

    if (id === 'about') {
      const goals = section.querySelectorAll('.ab-profile__goals li');
      if (goals.length > 0) {
        const activeIdx = progress > 0 && progress < 1
          ? Math.min(goals.length - 1, Math.floor(progress * goals.length))
          : -1;
        goals.forEach((goal, i) => goal.classList.toggle('is-pin-focus', i === activeIdx));
      }
    }
  }

  function syncRailAriaFromTargetCurrent() {
    if (!sectionRailEl || !supportsScrollTargetGroup) return;
    const current = sectionRailEl.querySelector('.section-progress-rail__link:target-current');
    sectionRailEl.querySelectorAll('.section-progress-rail__link').forEach((link) => {
      link.setAttribute('aria-current', link === current ? 'true' : 'false');
    });
  }

  function updatePinnedScenesOnScroll() {
    if (pinnedSections.length === 0) return;

    const docEl = document.documentElement;
    const vh = window.innerHeight || docEl.clientHeight || 1;
    const scrollable = Math.max(1, docEl.scrollHeight - vh);
    const rootProgress = Math.min(1, Math.max(0, window.scrollY / scrollable));

    if (scrollProgressBarEl && (!supportsNativeScrollTimeline || prefersReducedMotion())) {
      const topFill = scrollProgressBarEl.querySelector('.scroll-progress-bar__fill');
      if (topFill) topFill.style.transform = `scaleX(${rootProgress.toFixed(4)})`;
    }

    if (sectionRailEl) {
      const railFill = sectionRailEl.querySelector('.section-progress-rail__track-fill');
      if (railFill) railFill.style.transform = `scaleY(${rootProgress.toFixed(4)})`;
    }

    let bestActiveIndex = 0;
    let bestScore = -1;
    const pinnedActive = isPinnedSceneMode();

    pinnedSections.forEach((section, idx) => {
      const runway = section.querySelector('.pinned-section__runway') || section.querySelector('.timeline-runway');
      const pin = section.querySelector('.pinned-section__pin') || section.querySelector('.timeline-pin');
      const measureEl = runway || section;
      const rect = measureEl.getBoundingClientRect();

      let progress = 0;
      let isStuck = false;

      if (pinnedActive && runway && pin && runway.offsetHeight > pin.offsetHeight + 4) {
        const pinTopPx = parseFloat(getComputedStyle(pin).top) || 88;
        const travel = runway.offsetHeight - pin.offsetHeight;
        progress = travel > 0 ? Math.min(1, Math.max(0, (pinTopPx - rect.top) / travel)) : 0;
        isStuck = rect.top <= pinTopPx + 1 && rect.bottom >= pinTopPx + pin.offsetHeight - 1;
      } else {
        const totalSpan = rect.height + vh;
        progress = totalSpan > 0 ? Math.min(1, Math.max(0, (vh - rect.top) / totalSpan)) : 0;
      }

      section.style.setProperty('--section-progress', progress.toFixed(4));
      section.classList.toggle('is-pin-active', isStuck);
      if (pin && !supportsScrollStateQuery) {
        pin.classList.toggle('is-stuck', isStuck);
      }

      if (pinnedActive) {
        updateSectionInternalProgression(section, progress);
      }

      if (sectionRailEl) {
        const link = sectionRailEl.querySelector(`[data-rail-target="${section.id}"]`);
        if (link) link.style.setProperty('--orb-progress', progress.toFixed(4));
      }

      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(vh, rect.bottom);
      const visiblePx = Math.max(0, visibleBottom - visibleTop);
      if (visiblePx > bestScore) {
        bestScore = visiblePx;
        bestActiveIndex = idx;
      }
    });

    if (sectionRailEl && !supportsScrollTargetGroup) {
      const links = sectionRailEl.querySelectorAll('.section-progress-rail__link');
      links.forEach((link, idx) => {
        const active = idx === bestActiveIndex;
        link.classList.toggle('target-current', active);
        link.setAttribute('aria-current', active ? 'true' : 'false');
      });
    }
  }

  function schedulePinnedSceneUpdate() {
    if (sceneScrollFrame) return;
    sceneScrollFrame = requestAnimationFrame(() => {
      sceneScrollFrame = 0;
      updatePinnedScenesOnScroll();
    });
  }

  function bindPinnedSceneListeners() {
    if (sceneListenersBound || typeof window === 'undefined') return;
    sceneListenersBound = true;

    window.addEventListener('scroll', schedulePinnedSceneUpdate, { passive: true });
    window.addEventListener('resize', () => {
      sizePinnedRunways();
      schedulePinnedSceneUpdate();
    }, { passive: true });

    if (supportsScrollTargetGroup && typeof document !== 'undefined') {
      document.addEventListener('scrollend', () => {
        syncRailAriaFromTargetCurrent();
      });
    } else if (typeof document !== 'undefined') {
      window.addEventListener('scroll', () => {
        clearTimeout(sceneAriaTimer);
        sceneAriaTimer = setTimeout(updatePinnedScenesOnScroll, 90);
      }, { passive: true });
    }
  }

  function initPinnedScenes() {
    if (typeof document === 'undefined') return;
    const found = Array.from(document.querySelectorAll('[data-pinned-section]'));
    if (found.length === 0) return;

    pinnedSections.length = 0;
    found.forEach((sec) => pinnedSections.push(sec));

    ensureScrollProgressBar();
    pinnedSections.forEach((sec) => wrapPinnedSection(sec));
    buildSectionRail(pinnedSections);
    sizePinnedRunways();
    bindPinnedSceneListeners();
    updatePinnedScenesOnScroll();
    syncRailAriaFromTargetCurrent();
  }

  function refreshPinnedScenes() {
    if (pinnedSections.length === 0) {
      initPinnedScenes();
      return;
    }
    sizePinnedRunways();
    updatePinnedScenesOnScroll();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('portfolio:content-ready', function () {
      refreshObserver();
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initAnimationObserver();
      initPinnedScenes();
    });
  } else {
    initAnimationObserver();
    initPinnedScenes();
  }

  // Expose public API
  window.AnimationObserver = {
    init: initAnimationObserver,
    triggerStagger: triggerStaggerAnimation,
    refresh: refreshObserver,
    prefersReducedMotion: prefersReducedMotion,
  };

  window.PortfolioScrollScene = {
    init: initPinnedScenes,
    refresh: refreshPinnedScenes,
    getSectionProgress: function (id) {
      const target = id ? document.getElementById(id) : null;
      if (!target) return 0;
      return parseFloat(target.style.getPropertyValue('--section-progress')) || 0;
    },
  };

})();