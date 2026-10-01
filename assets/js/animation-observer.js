/**
 * Animation Observer - Handles scroll-triggered entry animations
 * Uses IntersectionObserver for performance
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG = {
    rootMargin: '0px 0px -10% 0px', // Trigger when element is 10% into viewport
    threshold: 0.1,
    once: true, // Only animate once
  };

  // Animation attribute selectors
  const SELECTORS = {
    animate: '[data-animate]',
    stagger: '[data-animate-stagger]',
    staggerChildren: '[data-animate-stagger-children]',
  };

  // Default animation classes
  const DEFAULT_ANIMATION = 'animate-entrance';
  const STAGGER_CHILD_SELECTOR = '> *';

  /**
   * Check if user prefers reduced motion
   */
  function prefersReducedMotion() {
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
   * Apply animation classes to element
   */
  function applyAnimation(element, config) {
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

    // Mark as visible to trigger animation
    requestAnimationFrame(() => {
      element.classList.add('is-visible');
    });
  }

  /**
   * Apply stagger animation to children
   */
  function applyStaggerAnimation(container, config) {
    const children = container.querySelectorAll(STAGGER_CHILD_SELECTOR);
    
    children.forEach((child, index) => {
      child.classList.add('animate-on-scroll');
      child.classList.add(config.animation || DEFAULT_ANIMATION);
      
      const delay = config.delay + (index * config.staggerDelay);
      child.style.animationDelay = `${delay}ms`;
      
      if (config.duration) {
        child.style.animationDuration = config.duration;
      }
      
      if (config.easing) {
        child.style.animationTimingFunction = config.easing;
      }
    });

    // Mark container as visible to trigger children animations
    requestAnimationFrame(() => {
      container.classList.add('is-visible');
    });
  }

  /**
   * Handle intersection observer entries
   */
  function handleIntersections(entries, observer) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        
        // Check for stagger container
        if (element.hasAttribute('data-animate-stagger') || 
            element.hasAttribute('data-animate-stagger-children')) {
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
   * Initialize animation observer
   */
  function initAnimationObserver() {
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
    const observer = new IntersectionObserver(handleIntersections, {
      rootMargin: CONFIG.rootMargin,
      threshold: CONFIG.threshold,
    });

    // Observe all elements with data-animate attribute
    document.querySelectorAll(SELECTORS.animate).forEach(element => {
      observer.observe(element);
    });

    // Observe stagger containers
    document.querySelectorAll(SELECTORS.stagger).forEach(element => {
      observer.observe(element);
    });

    document.querySelectorAll(SELECTORS.staggerChildren).forEach(element => {
      observer.observe(element);
    });

    // Store observer for potential cleanup
    window._animationObserver = observer;
  }

  /**
   * Manually trigger animation for an element (useful for dynamically added content)
   */
  function triggerAnimation(element, animationClass = DEFAULT_ANIMATION) {
    if (prefersReducedMotion()) {
      element.classList.add('force-visible');
      return;
    }

    element.classList.add('animate-on-scroll');
    element.classList.add(animationClass);
    
    requestAnimationFrame(() => {
      element.classList.add('is-visible');
    });
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

    const children = container.querySelectorAll(STAGGER_CHILD_SELECTOR);
    
    children.forEach((child, index) => {
      child.classList.add('animate-on-scroll');
      child.classList.add(animationClass);
      child.style.animationDelay = `${index * staggerDelay}ms`;
    });

    requestAnimationFrame(() => {
      container.classList.add('is-visible');
    });
  }

  /**
   * Refresh observer (useful after dynamic content loads)
   */
  function refreshObserver() {
    if (window._animationObserver) {
      // Re-observe all elements
      document.querySelectorAll(SELECTORS.animate).forEach(element => {
        if (!element.classList.contains('is-visible')) {
          window._animationObserver.observe(element);
        }
      });

      document.querySelectorAll(SELECTORS.stagger).forEach(element => {
        if (!element.classList.contains('is-visible')) {
          window._animationObserver.observe(element);
        }
      });

      document.querySelectorAll(SELECTORS.staggerChildren).forEach(element => {
        if (!element.classList.contains('is-visible')) {
          window._animationObserver.observe(element);
        }
      });
    }
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
    trigger: triggerAnimation,
    triggerStagger: triggerStaggerAnimation,
    refresh: refreshObserver,
    prefersReducedMotion: prefersReducedMotion,
  };

})();