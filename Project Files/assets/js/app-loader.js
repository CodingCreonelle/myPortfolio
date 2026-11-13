/**
 * Site chrome loader.
 *
 * The backdrop, the header and the footer are the same on every page, so each one
 * lives once, as a component, and is filled in here. A page keeps a mount for each
 * and nothing else, which is what stops the three from drifting apart from page to
 * page the way hand-copied markup does.
 *
 * Depth does not matter: the components address everything from the site root, and
 * this script is always at assets/js/, so its own URL is enough to work that root
 * out. No page has to tell us where it sits.
 */

(function () {
  'use strict';

  const BACKGROUND_COMPONENT = 'components/background.html';
  const NAVBAR_COMPONENT = 'components/navbar.html';
  const FOOTER_COMPONENT = 'components/footer.html';

  const MOUNTS = {
    background: '#site-background',
    navbar: '#site-navbar',
    footer: '#site-footer',
  };

  const SCRIPT_URL = document.currentScript ? document.currentScript.src : '';
  const SITE_ROOT = SCRIPT_URL ? new URL('../../', SCRIPT_URL).href : '';

  // Anything already addressed from somewhere else - a scheme, a protocol-relative
  // path, a bare fragment or a root-relative path - is left alone.
  const ADDRESSED_ELSEWHERE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i;

  /**
   * Reads a component into a fragment, addressing its paths from the site root
   * rather than from the page that happens to be loading it.
   */
  function parseComponent(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();

    template.content.querySelectorAll('[href], [src], [action]').forEach((node) => {
      ['href', 'src', 'action'].forEach((attribute) => {
        const value = node.getAttribute(attribute);
        if (!value || ADDRESSED_ELSEWHERE.test(value)) return;
        node.setAttribute(attribute, SITE_ROOT + value.replace(/\\/g, '/'));
      });
    });

    return template.content;
  }

  function fetchComponent(path) {
    const fetchFn = (typeof window !== 'undefined' && typeof window.__nativeFetch === 'function')
      ? window.__nativeFetch
      : fetch;
    return fetchFn(SITE_ROOT + path)
      .then((response) => {
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        return response.text();
      })
      .then(parseComponent)
      .catch((error) => {
        console.error('Site chrome could not be loaded:', error);
        return null;
      });
  }

  /** Fills a mount, or falls back to the matching end of the body without one. */
  function fillMount(selector, fragment, fallback) {
    if (!fragment) return;

    const mount = document.querySelector(selector);
    if (mount) {
      mount.append(fragment);
      return;
    }

    if (fallback === 'start') {
      document.body.prepend(fragment);
    } else {
      document.body.append(fragment);
    }
  }

  /**
   * Builds and runs the full-screen interactive HTML5 Canvas backdrop inside
   * `.hero-bg`: liquid aurora fields, depth-layered geometric constellations,
   * scroll-reactive parallax/warp, and a cursor spotlight + luminous trail.
   */
  function initializeCanvasBackdrop(background) {
    if (!background || background.querySelector('.hero-bg__canvas')) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'hero-bg__canvas';
    canvas.dataset.bgCanvas = 'true';
    canvas.setAttribute('aria-hidden', 'true');
    background.append(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const PALETTES = {
      dark: {
        auroras: [
          'rgba(37, 99, 235, 0.20)',
          'rgba(56, 189, 248, 0.14)',
          'rgba(79, 70, 229, 0.16)',
        ],
        nodeFill: 'rgba(147, 197, 253, 0.72)',
        nodeStroke: 'rgba(96, 165, 250, 0.62)',
        accentStroke: 'rgba(56, 189, 248, 0.78)',
        lineRgb: '96, 165, 250',
        cursorLineRgb: '56, 189, 248',
        spotlightInner: 'rgba(37, 99, 235, 0.16)',
        spotlightMid: 'rgba(56, 189, 248, 0.06)',
        trailRgb: '125, 211, 252',
      },
      light: {
        auroras: [
          'rgba(37, 99, 235, 0.11)',
          'rgba(14, 165, 233, 0.09)',
          'rgba(99, 102, 241, 0.09)',
        ],
        nodeFill: 'rgba(37, 99, 235, 0.50)',
        nodeStroke: 'rgba(29, 78, 216, 0.45)',
        accentStroke: 'rgba(14, 165, 233, 0.58)',
        lineRgb: '37, 99, 235',
        cursorLineRgb: '14, 165, 233',
        spotlightInner: 'rgba(37, 99, 235, 0.10)',
        spotlightMid: 'rgba(14, 165, 233, 0.04)',
        trailRgb: '37, 99, 235',
      },
    };

    const SHAPES = ['orb', 'ring', 'diamond', 'cross', 'hex'];
    const motionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

    let isReducedMotion = Boolean(motionQuery && motionQuery.matches);
    let width = Math.max(1, window.innerWidth || 1280);
    let height = Math.max(1, window.innerHeight || 720);
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let rafId = 0;
    let lastTimestamp = 0;

    let particles = [];
    let auroras = [];
    const trail = [];

    const pointer = {
      x: width * 0.5,
      y: height * 0.4,
      tx: width * 0.5,
      ty: height * 0.4,
      alpha: 0,
      active: false,
      lastTrailX: -999,
      lastTrailY: -999,
    };

    const scrollState = {
      y: window.scrollY || 0,
      velocity: 0,
    };

    function currentTheme() {
      return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }

    function pseudoRandom(seed) {
      const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
      return x - Math.floor(x);
    }

    function seedScene() {
      const targetCount = Math.max(18, Math.min(56, Math.round((width * height) / 23000)));
      particles = Array.from({ length: targetCount }, (_, i) => {
        const rx = pseudoRandom(i + 1);
        const ry = pseudoRandom(i + 101);
        const rv = pseudoRandom(i + 201);
        const ra = pseudoRandom(i + 301);
        const depth = 0.35 + (i % 5) * 0.2;
        const speedBase = (0.14 + rv * 0.28) * depth;
        const heading = ra * Math.PI * 2;
        return {
          x: rx * width,
          y: ry * height,
          vx: Math.cos(heading) * speedBase,
          vy: Math.sin(heading) * speedBase,
          depth: depth,
          radius: 2.2 + pseudoRandom(i + 401) * 4.6,
          shape: SHAPES[i % SHAPES.length],
          angle: ra * Math.PI * 2,
          vAngle: ((i % 2 === 0 ? 1 : -1) * (0.002 + rv * 0.005)),
          accent: i % 4 === 0,
        };
      });

      const baseRadius = Math.max(width, height);
      auroras = [
        { cx: 0.22, cy: 0.26, radius: baseRadius * 0.36, speed: 0.00022, phase: 0.4, parallax: 0.06 },
        { cx: 0.78, cy: 0.38, radius: baseRadius * 0.42, speed: 0.00018, phase: 2.1, parallax: 0.09 },
        { cx: 0.48, cy: 0.78, radius: baseRadius * 0.46, speed: 0.00015, phase: 4.3, parallax: 0.05 },
      ];
    }

    function syncDiagnostics() {
      canvas.dataset.ready = 'true';
      canvas.dataset.theme = currentTheme();
      canvas.dataset.particles = String(particles.length);
      canvas.dataset.reducedMotion = String(isReducedMotion);
    }

    function resizeCanvas() {
      width = Math.max(1, window.innerWidth || 1280);
      height = Math.max(1, window.innerHeight || 720);
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      seedScene();
      syncDiagnostics();

      if (isReducedMotion) {
        renderFrame(0);
      }
    }

    function drawAuroras(palette, time) {
      for (let i = 0; i < auroras.length; i++) {
        const blob = auroras[i];
        const driftX = isReducedMotion ? 0 : Math.sin(time * blob.speed + blob.phase) * width * 0.08;
        const driftY = isReducedMotion ? 0 : Math.cos(time * blob.speed * 0.85 + blob.phase) * height * 0.07;
        const scrollShift = (scrollState.y * blob.parallax) % (height * 0.45);

        const x = blob.cx * width + driftX;
        const y = ((blob.cy * height + driftY - scrollShift) % (height + blob.radius) + (height + blob.radius)) % (height + blob.radius) - blob.radius * 0.35;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, blob.radius);
        gradient.addColorStop(0, palette.auroras[i]);
        gradient.addColorStop(0.55, palette.auroras[i].replace(/[\d.]+\)$/, '0.04)'));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
    }

    function drawSpotlight(palette) {
      if (isReducedMotion || pointer.alpha <= 0.01) return;

      const radius = Math.min(width, height) * 0.32;
      const gradient = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius);
      gradient.addColorStop(0, palette.spotlightInner);
      gradient.addColorStop(0.45, palette.spotlightMid);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.save();
      ctx.globalAlpha = pointer.alpha;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    function drawShape(p, py, palette, warpScale) {
      ctx.save();
      ctx.translate(p.x, py);
      if (warpScale > 1.02) {
        ctx.scale(1 / Math.sqrt(warpScale), warpScale);
      }
      ctx.rotate(p.angle);

      const strokeColor = p.accent ? palette.accentStroke : palette.nodeStroke;
      const r = p.radius;

      switch (p.shape) {
        case 'ring': {
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.25;
          ctx.stroke();
          break;
        }
        case 'diamond': {
          const d = r * 1.25;
          ctx.beginPath();
          ctx.moveTo(0, -d);
          ctx.lineTo(d, 0);
          ctx.lineTo(0, d);
          ctx.lineTo(-d, 0);
          ctx.closePath();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          break;
        }
        case 'cross': {
          const arm = r * 1.1;
          ctx.beginPath();
          ctx.moveTo(-arm, 0);
          ctx.lineTo(arm, 0);
          ctx.moveTo(0, -arm);
          ctx.lineTo(0, arm);
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.25;
          ctx.stroke();
          break;
        }
        case 'hex': {
          const hr = r * 1.25;
          ctx.beginPath();
          for (let s = 0; s < 6; s++) {
            const theta = (s * Math.PI) / 3;
            const hx = Math.cos(theta) * hr;
            const hy = Math.sin(theta) * hr;
            if (s === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.15;
          ctx.stroke();
          break;
        }
        default: {
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
          ctx.fillStyle = palette.nodeFill;
          ctx.fill();
          break;
        }
      }

      ctx.restore();
    }

    function drawConstellationAndParticles(palette, dtFactor) {
      const linkDist = width < 720 ? 105 : 145;
      const linkDistSq = linkDist * linkDist;
      const pointerTetherDist = 175;
      const pointerRepelDist = 140;
      const speedClamp = Math.min(Math.abs(scrollState.velocity), 45);
      const warpScale = isReducedMotion || speedClamp <= 1.5 ? 1 : 1 + speedClamp * 0.014;
      const scrollBoost = isReducedMotion ? 0 : scrollState.velocity * 0.06;

      const positions = new Array(particles.length);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!isReducedMotion) {
          p.x += p.vx * dtFactor;
          p.y += (p.vy - scrollBoost * p.depth) * dtFactor;
          p.angle += p.vAngle * dtFactor;

          if (p.x < -24) p.x = width + 24;
          else if (p.x > width + 24) p.x = -24;

          if (p.y < -24) p.y = height + 24;
          else if (p.y > height + 24) p.y = -24;
        }

        let py = ((p.y - scrollState.y * p.depth * 0.35) % height + height) % height;
        let px = p.x;

        if (!isReducedMotion && pointer.alpha > 0.05) {
          const dx = px - pointer.x;
          const dy = py - pointer.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > 1 && distSq < pointerRepelDist * pointerRepelDist) {
            const dist = Math.sqrt(distSq);
            const push = ((pointerRepelDist - dist) / pointerRepelDist) * 10 * pointer.alpha;
            px += (dx / dist) * push;
            py += (dy / dist) * push;
          }
        }

        positions[i] = { x: px, y: py };
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const a = positions[i];

        for (let j = i + 1; j < particles.length; j++) {
          const b = positions[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy;

          if (distSq < linkDistSq) {
            const alpha = (1 - Math.sqrt(distSq) / linkDist) * 0.24;
            ctx.strokeStyle = `rgba(${palette.lineRgb}, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        if (!isReducedMotion && pointer.alpha > 0.05) {
          const pdx = a.x - pointer.x;
          const pdy = a.y - pointer.y;
          const pDistSq = pdx * pdx + pdy * pdy;
          if (pDistSq < pointerTetherDist * pointerTetherDist) {
            const pAlpha = (1 - Math.sqrt(pDistSq) / pointerTetherDist) * 0.34 * pointer.alpha;
            ctx.strokeStyle = `rgba(${palette.cursorLineRgb}, ${pAlpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(pointer.x, pointer.y);
            ctx.lineTo(a.x, a.y);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const pos = positions[i];
        drawShape({ x: pos.x, radius: p.radius, shape: p.shape, angle: p.angle, accent: p.accent }, pos.y, palette, warpScale);
      }
    }

    function drawCursorTrail(palette, dtFactor) {
      if (isReducedMotion || trail.length === 0) return;

      for (let i = trail.length - 1; i >= 0; i--) {
        const node = trail[i];
        node.x += node.vx * dtFactor;
        node.y += node.vy * dtFactor;
        node.life -= 0.028 * dtFactor;
        if (node.life <= 0) {
          trail.splice(i, 1);
        }
      }

      if (trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const prev = trail[i - 1];
          const curr = trail[i];
          const segAlpha = Math.max(0, Math.min(prev.life, curr.life) * 0.42);
          ctx.strokeStyle = `rgba(${palette.trailRgb}, ${segAlpha.toFixed(3)})`;
          ctx.lineWidth = Math.max(0.75, curr.size * curr.life * 0.65);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(prev.x, prev.y);
          ctx.lineTo(curr.x, curr.y);
          ctx.stroke();
        }
      }

      for (let i = 0; i < trail.length; i++) {
        const node = trail[i];
        const dotAlpha = Math.max(0, node.life * 0.55);
        ctx.fillStyle = `rgba(${palette.trailRgb}, ${dotAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, Math.max(0.8, node.size * node.life), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function renderFrame(timestamp) {
      const deltaMs = lastTimestamp ? Math.min(48, Math.max(8, timestamp - lastTimestamp)) : 16.67;
      lastTimestamp = timestamp;
      const dtFactor = isReducedMotion ? 0 : deltaMs / 16.67;

      const palette = PALETTES[currentTheme()];

      pointer.x += (pointer.tx - pointer.x) * 0.16;
      pointer.y += (pointer.ty - pointer.y) * 0.16;
      pointer.alpha += ((pointer.active ? 1 : 0) - pointer.alpha) * 0.1;
      scrollState.velocity *= 0.9;
      if (Math.abs(scrollState.velocity) < 0.05) scrollState.velocity = 0;

      ctx.clearRect(0, 0, width, height);
      drawAuroras(palette, timestamp);
      drawSpotlight(palette);
      drawConstellationAndParticles(palette, dtFactor);
      drawCursorTrail(palette, dtFactor);
    }

    function loop(timestamp) {
      if (isReducedMotion || document.hidden) {
        rafId = 0;
        return;
      }
      renderFrame(timestamp);
      rafId = window.requestAnimationFrame(loop);
    }

    function startLoop() {
      if (isReducedMotion) {
        stopLoop();
        renderFrame(0);
        return;
      }
      if (!rafId && !document.hidden) {
        lastTimestamp = 0;
        rafId = window.requestAnimationFrame(loop);
      }
    }

    function stopLoop() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function spawnTrailNode(x, y, burst) {
      if (isReducedMotion) return;
      const angle = Math.random() * Math.PI * 2;
      const speed = burst ? 0.45 + Math.random() * 0.75 : 0.12 + Math.random() * 0.25;
      trail.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        size: burst ? 3.4 : 2.4,
      });
      while (trail.length > 28) {
        trail.shift();
      }
    }

    window.addEventListener('pointermove', (event) => {
      if (isReducedMotion) return;
      pointer.tx = event.clientX;
      pointer.ty = event.clientY;
      pointer.active = true;

      const dx = event.clientX - pointer.lastTrailX;
      const dy = event.clientY - pointer.lastTrailY;
      if (dx * dx + dy * dy >= 36) {
        pointer.lastTrailX = event.clientX;
        pointer.lastTrailY = event.clientY;
        spawnTrailNode(event.clientX, event.clientY, false);
      }
    }, { passive: true });

    window.addEventListener('pointerdown', (event) => {
      if (isReducedMotion) return;
      pointer.tx = event.clientX;
      pointer.ty = event.clientY;
      pointer.active = true;
      for (let i = 0; i < 4; i++) {
        spawnTrailNode(event.clientX, event.clientY, true);
      }
    }, { passive: true });

    window.addEventListener('pointerleave', () => {
      pointer.active = false;
    });

    window.addEventListener('blur', () => {
      pointer.active = false;
    });

    window.addEventListener('scroll', () => {
      const nextY = window.scrollY || 0;
      const delta = nextY - scrollState.y;
      scrollState.y = nextY;
      scrollState.velocity = Math.max(-45, Math.min(45, scrollState.velocity + delta * 0.45));
    }, { passive: true });

    window.addEventListener('resize', resizeCanvas, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    });

    if (motionQuery) {
      const onMotionChange = (event) => {
        isReducedMotion = Boolean(event.matches);
        if (isReducedMotion) {
          trail.length = 0;
          pointer.active = false;
        }
        syncDiagnostics();
        startLoop();
      };
      if (typeof motionQuery.addEventListener === 'function') {
        motionQuery.addEventListener('change', onMotionChange);
      } else if (typeof motionQuery.addListener === 'function') {
        motionQuery.addListener(onMotionChange);
      }
    }

    const themeObserver = new MutationObserver(() => {
      syncDiagnostics();
      if (isReducedMotion) {
        renderFrame(0);
      }
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    resizeCanvas();
    startLoop();
  }

  /**
   * Alternates the two takes of the backdrop. Each one plays to the end and hands
   * over, so the footage cuts on its own last frame rather than on a timer.
   */
  function initializeBackground(background) {
    if (!background) return;

    initializeCanvasBackdrop(background);

    const videos = Array.from(background.querySelectorAll('.hero-bg__video'));
    if (!videos.length) return;

    let active = 0;
    videos.forEach((video) => {
      video.playbackRate = 0.5;
    });

    function playNext() {
      const current = videos[active];
      const next = videos[(active + 1) % videos.length];

      next.currentTime = 0;
      current.classList.remove('is-active');
      next.classList.add('is-active');
      next.play().catch(() => {});
      active = (active + 1) % videos.length;
    }

    // Only the take that is on screen advances the playlist, so one that ended
    // while it was already fading out cannot cut off the take that replaced it.
    videos.forEach((video, index) => {
      video.addEventListener('ended', () => {
        if (index === active) playNext();
      });
    });

    videos[0].play().catch(() => {});
  }

  /*
   * Marks the active navigation link from the current page, and keeps it in step
   * with the section being read on the one page that has sections to read.
   */
  function initializeNavbarSectionHighlight() {
    const navLinks = document.querySelectorAll('.site-nav a');
    if (!navLinks.length) return;

    const normalizePathname = (pathname) => {
      if (!pathname) return '';
      return pathname.endsWith('/') ? `${pathname}index.html` : pathname;
    };

    /*
     * Only in-page anchors that resolve to THIS page may drive the section
     * highlight. On about.html the nav's "#hero" link points at index.html, so
     * without this guard the observer would light up "Home" on a page whose own
     * link is already the active one. Directory roots ending in "/" are normalized
     * to "/index.html" so root URL launches match properly.
     */
    const currentPath = normalizePathname(window.location.pathname);
    const pageHashLinks = Array.from(navLinks).filter((link) => {
      try {
        const url = new URL(link.href);
        return normalizePathname(url.pathname) === currentPath && url.hash.length > 1;
      } catch (error) {
        return false;
      }
    });

    const sections = pageHashLinks
      .map(link => document.getElementById(link.hash.slice(1)))
      .filter(Boolean);

    const setActiveLink = (link) => {
      navLinks.forEach(navLink => {
        const isActive = navLink === link;
        navLink.classList.toggle('active', isActive);
        if (isActive) {
          navLink.setAttribute('aria-current', 'page');
        } else {
          navLink.removeAttribute('aria-current');
        }
      });
    };

    const findLinkForSectionId = (id) => {
      return pageHashLinks.find(link => link.hash === `#${id}`);
    };

    /*
     * The links are addressed from the site root, so they are compared as the URLs
     * they resolve to rather than as the text in the attribute. Directory roots
     * are normalized to index.html so "/" matches "index.html".
     */
    const linkPath = (link) => {
      try {
        return normalizePathname(new URL(link.href).pathname);
      } catch (error) {
        return null;
      }
    };

    const currentHash = window.location.hash;
    let initialLink = null;
    if (currentHash) {
      initialLink = Array.from(navLinks).find((link) => {
        try {
          const url = new URL(link.href);
          return normalizePathname(url.pathname) === currentPath && url.hash === currentHash;
        } catch (error) {
          return false;
        }
      });
      if (initialLink) {
        setActiveLink(initialLink);
      }
    }

    if (!initialLink) {
      let pathLink = Array.from(navLinks).find(link => linkPath(link) === currentPath);
      if (!pathLink && /(?:\/projects\/|\/docs\/)/i.test(currentPath)) {
        pathLink = Array.from(navLinks).find((link) => {
          const path = linkPath(link);
          return path && path.endsWith('/projects.html');
        });
      }
      if (pathLink) {
        setActiveLink(pathLink);
      }
    }

    let pendingActiveSectionId = null;
    let clickLockTimer = null;

    const clearClickLock = () => {
      pendingActiveSectionId = null;
      if (clickLockTimer) {
        clearTimeout(clickLockTimer);
        clickLockTimer = null;
      }
    };

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        setActiveLink(link);

        const href = link.getAttribute('href') || '';
        const hashMatch = href.match(/#(hero|about|contact)$/);
        pendingActiveSectionId = hashMatch ? hashMatch[1] : null;

        if (clickLockTimer) {
          clearTimeout(clickLockTimer);
        }
        clickLockTimer = setTimeout(clearClickLock, 800);
      });
    });

    if (sections.length) {
      const observer = new IntersectionObserver((entries) => {
        const visible = entries
          .filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.35)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;
        const visibleSectionId = visible.target.id;
        if (pendingActiveSectionId && visibleSectionId !== pendingActiveSectionId) {
          return;
        }

        const link = findLinkForSectionId(visibleSectionId);
        if (link) {
          setActiveLink(link);
          if (pendingActiveSectionId === visibleSectionId) {
            clearClickLock();
          }
        }
      }, {
        threshold: [0.35, 0.45, 0.55]
      });

      sections.forEach(section => observer.observe(section));
    }
  }

  function initializeNavbarBrand() {
    const brand = document.querySelector('.brand');
    if (!brand) return;

    brand.addEventListener('mouseenter', () => {
      brand.classList.add('brand--active');
    });

    brand.addEventListener('mouseleave', () => {
      brand.classList.remove('brand--active');
    });
  }

  function initializeNavbarScrollState() {
    const header = document.querySelector('.site-header');
    if (!header || header.dataset.scrollBound === 'true') return;
    header.dataset.scrollBound = 'true';

    const update = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  async function loadSiteChrome() {
    const [background, navbar, footer] = await Promise.all([
      fetchComponent(BACKGROUND_COMPONENT),
      fetchComponent(NAVBAR_COMPONENT),
      fetchComponent(FOOTER_COMPONENT),
    ]);

    fillMount(MOUNTS.background, background, 'start');
    fillMount(MOUNTS.navbar, navbar, 'start');
    fillMount(MOUNTS.footer, footer, 'end');

    initializeBackground(document.querySelector('.hero-bg'));
    initializeNavbarBrand();
    initializeNavbarSectionHighlight();
    initializeNavbarScrollState();
  }

  document.addEventListener('DOMContentLoaded', loadSiteChrome);
})();
