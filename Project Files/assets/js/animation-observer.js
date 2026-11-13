/**
 * Animation Observer - Handles scroll-triggered entry animations
 * Uses IntersectionObserver for performance
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    rootMargin: '0px 0px -10% 0px', // Trigger as soon as element enters viewport
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
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('portfolio:content-ready', function () {
      refreshObserver();
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnimationObserver);
  } else {
    initAnimationObserver();
  }

  // Expose public API
  window.AnimationObserver = {
    init: initAnimationObserver,
    triggerStagger: triggerStaggerAnimation,
    refresh: refreshObserver,
    prefersReducedMotion: prefersReducedMotion,
  };

})();