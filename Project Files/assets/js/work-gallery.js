/**
 * Featured work gallery.
 *
 * Shows one project at a time and steps through them with the previous / next
 * controls, wrapping around at either end. The heading types itself out the
 * first time the section is on screen.
 *
 * Cards are left visible in the markup and only collapsed into a viewer once
 * this script runs, so the section still reads as a list of projects without it.
 */
(function () {
  'use strict';

  const SELECTORS = {
    root: '.work-gallery',
    card: '.work-card',
    title: '.work-card__title',
    heading: '[data-work-typewriter]',
    stage: '.work-gallery__stage',
    controls: '.work-gallery__controls',
    previous: '[data-work-prev]',
    next: '[data-work-next]',
    counter: '[data-work-counter]',
    total: '[data-work-total]',
    live: '[data-work-live]',
  };

  const CLASSES = {
    typed: 'is-typed',
    active: 'is-active',
    enhanced: 'is-enhanced',
  };

  const TYPE_SPEED = 52;
  const TYPE_START_DELAY = 220;

  const state = {
    root: null,
    cards: [],
    characters: [],
    caret: null,
    heading: null,
    counter: null,
    live: null,
    index: -1,
    typed: false,
  };

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Split the heading into per-character spans so the text can be revealed one
   * letter at a time without moving anything around it.
   */
  function buildTypewriter() {
    const heading = state.root.querySelector(SELECTORS.heading);
    if (!heading || heading.dataset.typewriterBuilt === 'true') return;

    const text = heading.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;

    heading.dataset.typewriterBuilt = 'true';
    heading.textContent = '';

    const caret = document.createElement('span');
    caret.className = 'work-gallery__caret';
    caret.setAttribute('aria-hidden', 'true');

    const characters = [];
    for (const character of text) {
      const span = document.createElement('span');
      span.className = 'work-gallery__char';
      span.textContent = character;
      characters.push(span);
      heading.appendChild(span);
    }
    heading.appendChild(caret);

    state.characters = characters;
    state.caret = caret;
    state.heading = heading;
  }

  function revealCharacter(index) {
    if (index >= state.characters.length) return;

    state.characters[index].classList.add(CLASSES.typed);
    // The caret rides along with the text rather than sitting at the end.
    state.heading.insertBefore(state.caret, state.characters[index + 1] || null);
    window.setTimeout(() => revealCharacter(index + 1), TYPE_SPEED);
  }

  function startTyping() {
    if (state.typed || !state.characters.length) return;
    state.typed = true;

    if (reducedMotion()) {
      state.characters.forEach((character) => character.classList.add(CLASSES.typed));
      return;
    }

    state.heading.insertBefore(state.caret, state.characters[0] || null);
    window.setTimeout(() => revealCharacter(0), TYPE_START_DELAY);
  }

  /**
   * Announce the project that just came into view, so the change is not silent
   * for anyone who cannot see the deck turn over.
   */
  function announce(index) {
    if (!state.live) return;
    const title = state.cards[index].querySelector(SELECTORS.title);
    const name = title ? title.textContent.trim() : 'Project';
    state.live.textContent = `${name} (${index + 1} of ${state.cards.length})`;
  }

  function show(index, options) {
    const count = state.cards.length;
    const target = ((index % count) + count) % count;
    if (target === state.index) return;

    state.index = target;
    state.cards.forEach((card, position) => {
      card.classList.toggle(CLASSES.active, position === target);
    });
    if (state.counter) state.counter.textContent = pad(target + 1);
    if (!options || options.announce !== false) announce(target);
  }

  function step(offset) {
    show(state.index + offset);
  }

  function onKeydown(event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    step(event.key === 'ArrowLeft' ? -1 : 1);
  }

  function init() {
    const root = document.querySelector(SELECTORS.root);
    if (!root) return;

    state.root = root;
    state.cards = Array.from(root.querySelectorAll(SELECTORS.card));
    state.counter = root.querySelector(SELECTORS.counter);
    state.live = root.querySelector(SELECTORS.live);

    if (!state.cards.length) return;

    const total = root.querySelector(SELECTORS.total);
    if (total) total.textContent = pad(state.cards.length);

    const previous = root.querySelector(SELECTORS.previous);
    const next = root.querySelector(SELECTORS.next);

    // Single project: nothing to step through, so the controls add nothing.
    if (state.cards.length > 1) {
      root.classList.add(CLASSES.enhanced);
      if (previous) previous.addEventListener('click', () => step(-1));
      if (next) next.addEventListener('click', () => step(1));

      const controls = root.querySelector(SELECTORS.controls);
      if (controls) controls.addEventListener('keydown', onKeydown);
    }

    buildTypewriter();
    show(0, { announce: false });

    const stage = root.querySelector(SELECTORS.stage);
    if (stage && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            startTyping();
            observer.disconnect();
          }
        });
      }, { threshold: 0.35 });
      observer.observe(stage);
    } else {
      startTyping();
    }
  }

  window.PortfolioWorkGallery = { init: init };
})();
