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

  let threeLoadPromise = null;

  /**
   * Loads self-hosted Three.js once and shares the resolved THREE global.
   */
  function loadThreeGlobal(src) {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (threeLoadPromise) return threeLoadPromise;
    threeLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve(window.THREE);
      script.onerror = (err) => {
        threeLoadPromise = null;
        reject(err);
      };
      document.head.appendChild(script);
    });
    return threeLoadPromise;
  }

  /**
   * Loads self-hosted Three.js dynamically and renders a 3D WebGL particle cloud
   * + floating geometric polyhedra layer above the 2D canvas, responding to
   * scroll depth, pointer parallax, click bursts, and dark/light theme changes.
   */
  function initializeThreeBackdrop(background) {
    if (!background || background.querySelector('.hero-bg__webgl')) return;

    const webglCanvas = document.createElement('canvas');
    webglCanvas.className = 'hero-bg__webgl';
    webglCanvas.dataset.bgThree = 'true';
    webglCanvas.setAttribute('aria-hidden', 'true');
    background.append(webglCanvas);

    const scriptUrl = SITE_ROOT + 'assets/js/three.min.js';
    const motionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

    loadThreeGlobal(scriptUrl)
      .then((THREE) => {
        if (!THREE) return;
        webglCanvas.dataset.threeLoaded = 'true';

        let renderer = null;
        try {
          renderer = new THREE.WebGLRenderer({
            canvas: webglCanvas,
            alpha: true,
            antialias: true,
            powerPreference: 'low-power',
          });
        } catch (err) {
          webglCanvas.dataset.webgl = 'fallback';
          return;
        }

        if (!renderer || !renderer.getContext()) {
          webglCanvas.dataset.webgl = 'fallback';
          return;
        }

        webglCanvas.dataset.webgl = 'active';
        let width = Math.max(1, window.innerWidth || 1280);
        let height = Math.max(1, window.innerHeight || 720);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
        camera.position.z = 28;

        // 3D particle cloud
        const particleCount = 220;
        const positions = new Float32Array(particleCount * 3);
        const seed = (n) => {
          const x = Math.sin(n * 19.31 + 41.7) * 43758.5453;
          return x - Math.floor(x);
        };
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3] = (seed(i + 1) - 0.5) * 72;
          positions[i * 3 + 1] = (seed(i + 301) - 0.5) * 48;
          positions[i * 3 + 2] = seed(i + 601) * 28 - 18;
        }
        const pointsGeom = new THREE.BufferGeometry();
        pointsGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const pointsMat = new THREE.PointsMaterial({
          size: 0.22,
          transparent: true,
          opacity: 0.68,
          color: 0x60a5fa,
        });
        const points = new THREE.Points(pointsGeom, pointsMat);
        scene.add(points);

        // Wireframe polyhedra group
        const polyGroup = new THREE.Group();
        const wireMat = new THREE.MeshBasicMaterial({
          wireframe: true,
          transparent: true,
          opacity: 0.18,
          color: 0x38bdf8,
        });

        const specs = [
          { geom: new THREE.IcosahedronGeometry(2.2, 0), pos: [-14, 7, -4], speed: [0.0022, 0.0031] },
          { geom: new THREE.OctahedronGeometry(1.8, 0), pos: [15, -5, -6], speed: [-0.0028, 0.0024] },
          { geom: new THREE.TorusGeometry(1.6, 0.45, 8, 20), pos: [-11, -8, -3], speed: [0.003, -0.002] },
          { geom: new THREE.DodecahedronGeometry(1.9, 0), pos: [13, 8, -5], speed: [-0.0019, -0.0026] },
        ];
        const meshes = specs.map((spec) => {
          const mesh = new THREE.Mesh(spec.geom, wireMat);
          mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
          mesh.userData.rotSpeed = spec.speed;
          mesh.userData.basePos = [spec.pos[0], spec.pos[1], spec.pos[2]];
          polyGroup.add(mesh);
          return mesh;
        });
        scene.add(polyGroup);

        function applyThreeTheme() {
          const isLight = document.documentElement.getAttribute('data-theme') === 'light';
          pointsMat.color.setHex(isLight ? 0x2563eb : 0x60a5fa);
          pointsMat.opacity = isLight ? 0.42 : 0.68;
          wireMat.color.setHex(isLight ? 0x0284c7 : 0x38bdf8);
          wireMat.opacity = isLight ? 0.13 : 0.18;
          webglCanvas.dataset.theme = isLight ? 'light' : 'dark';
        }
        applyThreeTheme();

        let burstEnergy = 0;
        let transitionIntro = 0;
        let transitionTarget = 0;
        let targetPointerX = 0;
        let targetPointerY = 0;
        let reducedMotion = Boolean(motionQuery && motionQuery.matches);
        let rafId = 0;

        window.__spawnThreeBurst = function () {
          if (reducedMotion) return;
          burstEnergy = 1;
        };

        window.__transitionThreeBackdrop = function (progress) {
          if (reducedMotion) {
            transitionIntro = 0;
            transitionTarget = 0;
            return;
          }
          const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
          transitionTarget = 1 - clamped;
          if (transitionIntro === 0 && clamped < 0.25) {
            transitionIntro = 1;
          }
          burstEnergy = Math.max(burstEnergy, 0.72 * (1 - clamped));
        };

        window.addEventListener('pointermove', (event) => {
          if (reducedMotion) return;
          targetPointerX = ((event.clientX / Math.max(1, width)) - 0.5) * 2;
          targetPointerY = ((event.clientY / Math.max(1, height)) - 0.5) * 2;
        }, { passive: true });

        window.addEventListener('pointerdown', () => {
          if (typeof window.__spawnThreeBurst === 'function') {
            window.__spawnThreeBurst();
          }
        }, { passive: true });

        function renderThreeFrame() {
          const scrollNorm = (window.scrollY || 0) * 0.0035;
          const speedBoost = 1 + burstEnergy * 3.5;

          if (!reducedMotion) {
            const loaderClosing = Boolean(
              window.PortfolioLoader
              && typeof window.PortfolioLoader.getState === 'function'
              && window.PortfolioLoader.getState().closing
            );
            if (!loaderClosing && transitionTarget > 0) {
              transitionTarget = 0;
            }
            transitionIntro += (transitionTarget - transitionIntro) * 0.14;
            if (Math.abs(transitionIntro) < 0.002 && transitionTarget === 0) {
              transitionIntro = 0;
            }

            points.rotation.y += 0.0007 * speedBoost;
            points.rotation.x += 0.00025 * speedBoost;
            meshes.forEach((mesh) => {
              mesh.rotation.x += mesh.userData.rotSpeed[0] * speedBoost;
              mesh.rotation.y += mesh.userData.rotSpeed[1] * speedBoost;
              const base = mesh.userData.basePos;
              if (base) {
                const factor = 1 - transitionIntro;
                mesh.position.x = (base[0] * 0.18) * transitionIntro + base[0] * factor;
                mesh.position.y = (base[1] * 0.18) * transitionIntro + base[1] * factor;
                mesh.position.z = 4 * transitionIntro + base[2] * factor;
              }
            });
            camera.position.x += (targetPointerX * 2.2 - camera.position.x) * 0.04;
            camera.position.y += (-targetPointerY * 1.5 - scrollNorm * 0.4 - camera.position.y) * 0.05;
            camera.position.z = 28 + transitionIntro * 14;
            polyGroup.position.y = Math.sin(scrollNorm * 0.6) * 1.2 - scrollNorm * 0.5;
            burstEnergy *= 0.94;
            if (burstEnergy < 0.01) burstEnergy = 0;
            const isLight = document.documentElement.getAttribute('data-theme') === 'light';
            pointsMat.opacity = (isLight ? 0.42 : 0.68) + burstEnergy * 0.22;
            wireMat.opacity = (isLight ? 0.13 : 0.18) + burstEnergy * 0.14;
          }

          camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
        }

        function startThreeLoop() {
          if (reducedMotion) {
            if (rafId) {
              window.cancelAnimationFrame(rafId);
              rafId = 0;
            }
            renderThreeFrame();
            return;
          }
          if (!rafId && !document.hidden) {
            const tick = () => {
              if (reducedMotion || document.hidden) {
                rafId = 0;
                return;
              }
              renderThreeFrame();
              rafId = window.requestAnimationFrame(tick);
            };
            rafId = window.requestAnimationFrame(tick);
          }
        }

        window.addEventListener('resize', () => {
          width = Math.max(1, window.innerWidth || 1280);
          height = Math.max(1, window.innerHeight || 720);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.setSize(width, height, false);
          if (reducedMotion) renderThreeFrame();
        }, { passive: true });

        document.addEventListener('visibilitychange', () => {
          if (document.hidden && rafId) {
            window.cancelAnimationFrame(rafId);
            rafId = 0;
          } else if (!document.hidden) {
            startThreeLoop();
          }
        });

        const themeObserver = new MutationObserver(() => {
          applyThreeTheme();
          if (reducedMotion) renderThreeFrame();
        });
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-theme'],
        });

        if (motionQuery) {
          const onMotionChange = (e) => {
            reducedMotion = Boolean(e.matches);
            startThreeLoop();
          };
          if (typeof motionQuery.addEventListener === 'function') {
            motionQuery.addEventListener('change', onMotionChange);
          }
        }

        startThreeLoop();
      })
      .catch(() => {
        webglCanvas.dataset.threeLoaded = 'false';
      });
  }

  /**
   * Alternates the two takes of the backdrop. Each one plays to the end and hands
   * over, so the footage cuts on its own last frame rather than on a timer.
   */
  function initializeBackground(background) {
    if (!background) return;

    initializeCanvasBackdrop(background);
    initializeThreeBackdrop(background);

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

    const navContainer = document.querySelector('.site-nav');
    if (navContainer && navContainer.dataset.highlightBound === 'true') {
      return;
    }
    if (navContainer) {
      navContainer.dataset.highlightBound = 'true';
    }

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
    if (!brand || brand.dataset.brandBound === 'true') return;
    brand.dataset.brandBound = 'true';

    brand.addEventListener('mouseenter', () => {
      brand.classList.add('brand--active');
    });

    brand.addEventListener('mouseleave', () => {
      brand.classList.remove('brand--active');
    });
  }

  function initializeNavbarScrollState() {
    const header = document.querySelector('.site-header');
    if (!header) return;

    const update = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
    };

    update();
    if (header.dataset.scrollBound === 'true') return;
    header.dataset.scrollBound = 'true';
    window.addEventListener('scroll', update, { passive: true });
  }

  /**
   * Ensures navbar DOM state (brand hover, active link, scrolled pill state, and
   * theme toggle accessibility attributes) stays initialized once the loader exits.
   */
  function syncNavbarState() {
    initializeNavbarBrand();
    initializeNavbarSectionHighlight();
    initializeNavbarScrollState();

    const toggleBtn = document.querySelector('[data-theme-toggle]');
    if (toggleBtn) {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      toggleBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    }
  }

  /**
   * Spring-physics external motion controller (React-Spring / Framer-Motion style):
   * applies 3D perspective card tilt + radial glare and magnetic button pull.
   */
  function initializeExternalMotionEffects() {
    if (document.documentElement.dataset.externalMotionBound === 'true') return;
    document.documentElement.dataset.externalMotionBound = 'true';

    const CARD_SELECTOR = '.work-card--active, .project-card, .ab-skill-card, .ab-train__item, .contact-card, .ab-contact__card, .ab-trait__card, .project-view__metric';
    const MAGNETIC_SELECTOR = '.button, .ab-btn, .work-gallery__control, .theme-toggle, .project-filter-btn';

    const prefersReducedMotion = () => {
      if (window.PortfolioUtils && typeof window.PortfolioUtils.reduceMotion === 'function') {
        return window.PortfolioUtils.reduceMotion();
      }
      return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    };

    const cardStates = new WeakMap();
    const magneticStates = new WeakMap();
    const activeElements = new Set();
    let rafId = 0;

    function tagTargets() {
      document.querySelectorAll(CARD_SELECTOR).forEach((el) => {
        el.setAttribute('data-motion-card', 'true');
      });
      document.querySelectorAll(MAGNETIC_SELECTOR).forEach((el) => {
        el.setAttribute('data-motion-magnetic', 'true');
      });
    }

    function ensureSpringLoop() {
      if (rafId || prefersReducedMotion()) return;
      const tick = () => {
        rafId = 0;
        if (prefersReducedMotion()) {
          activeElements.clear();
          return;
        }

        const nextActive = [];
        activeElements.forEach((el) => {
          const cardState = cardStates.get(el);
          if (cardState) {
            cardState.vx = (cardState.vx + (cardState.tx - cardState.rx) * 0.16) * 0.76;
            cardState.vy = (cardState.vy + (cardState.ty - cardState.ry) * 0.16) * 0.76;
            cardState.rx += cardState.vx;
            cardState.ry += cardState.vy;

            el.style.setProperty('--motion-rx', `${cardState.rx.toFixed(2)}deg`);
            el.style.setProperty('--motion-ry', `${cardState.ry.toFixed(2)}deg`);

            const settled =
              Math.abs(cardState.tx - cardState.rx) < 0.02 &&
              Math.abs(cardState.ty - cardState.ry) < 0.02 &&
              Math.abs(cardState.vx) < 0.02 &&
              Math.abs(cardState.vy) < 0.02 &&
              !cardState.hovered;

            if (!settled) {
              nextActive.push(el);
            } else {
              el.style.setProperty('--motion-rx', '0deg');
              el.style.setProperty('--motion-ry', '0deg');
              el.style.setProperty('--glare-alpha', '0');
            }
          }

          const magState = magneticStates.get(el);
          if (magState) {
            magState.vx = (magState.vx + (magState.tx - magState.x) * 0.18) * 0.74;
            magState.vy = (magState.vy + (magState.ty - magState.y) * 0.18) * 0.74;
            magState.x += magState.vx;
            magState.y += magState.vy;

            el.style.setProperty('--magnetic-x', `${magState.x.toFixed(2)}px`);
            el.style.setProperty('--magnetic-y', `${magState.y.toFixed(2)}px`);

            const magSettled =
              Math.abs(magState.tx - magState.x) < 0.04 &&
              Math.abs(magState.ty - magState.y) < 0.04 &&
              Math.abs(magState.vx) < 0.04 &&
              Math.abs(magState.vy) < 0.04 &&
              !magState.hovered;

            if (!magSettled) {
              nextActive.push(el);
            } else {
              el.style.setProperty('--magnetic-x', '0px');
              el.style.setProperty('--magnetic-y', '0px');
            }
          }
        });

        activeElements.clear();
        nextActive.forEach((el) => activeElements.add(el));
        if (activeElements.size > 0 && !document.hidden) {
          rafId = window.requestAnimationFrame(tick);
        }
      };

      rafId = window.requestAnimationFrame(tick);
    }

    document.addEventListener('pointermove', (event) => {
      if (prefersReducedMotion()) return;
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;

      const card = target.closest(CARD_SELECTOR);
      if (card) {
        card.setAttribute('data-motion-card', 'true');
        const rect = card.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const nx = Math.max(-0.5, Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5));
          const ny = Math.max(-0.5, Math.min(0.5, (event.clientY - rect.top) / rect.height - 0.5));
          let state = cardStates.get(card);
          if (!state) {
            state = { rx: 0, ry: 0, vx: 0, vy: 0, tx: 0, ty: 0, hovered: true };
            cardStates.set(card, state);
          }
          state.hovered = true;
          state.tx = -ny * 7;
          state.ty = nx * 7;
          card.style.setProperty('--glare-x', `${((nx + 0.5) * 100).toFixed(1)}%`);
          card.style.setProperty('--glare-y', `${((ny + 0.5) * 100).toFixed(1)}%`);
          card.style.setProperty('--glare-alpha', '1');
          activeElements.add(card);
          ensureSpringLoop();
        }
      }

      const btn = target.closest(MAGNETIC_SELECTOR);
      if (btn && !btn.disabled) {
        btn.setAttribute('data-motion-magnetic', 'true');
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const nx = Math.max(-0.5, Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5));
          const ny = Math.max(-0.5, Math.min(0.5, (event.clientY - rect.top) / rect.height - 0.5));
          let state = magneticStates.get(btn);
          if (!state) {
            state = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, hovered: true };
            magneticStates.set(btn, state);
          }
          state.hovered = true;
          state.tx = nx * 9;
          state.ty = ny * 9;
          activeElements.add(btn);
          ensureSpringLoop();
        }
      }
    }, { passive: true });

    document.addEventListener('pointerout', (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== 'function') return;

      const card = target.closest(CARD_SELECTOR);
      if (card && (!event.relatedTarget || !card.contains(event.relatedTarget))) {
        const state = cardStates.get(card);
        if (state) {
          state.hovered = false;
          state.tx = 0;
          state.ty = 0;
          card.style.setProperty('--glare-alpha', '0');
          activeElements.add(card);
          ensureSpringLoop();
        }
      }

      const btn = target.closest(MAGNETIC_SELECTOR);
      if (btn && (!event.relatedTarget || !btn.contains(event.relatedTarget))) {
        const state = magneticStates.get(btn);
        if (state) {
          state.hovered = false;
          state.tx = 0;
          state.ty = 0;
          activeElements.add(btn);
          ensureSpringLoop();
        }
      }
    }, { passive: true });

    tagTargets();
    document.addEventListener('portfolio:content-ready', tagTargets);
  }

  let _canTransitionDisplay;

  /**
   * Runtime probe checking whether discrete display transitions keep computed display visible.
   */
  function canTransitionDisplay() {
    if (_canTransitionDisplay !== undefined) return _canTransitionDisplay;
    if (
      typeof window === 'undefined'
      || !window.CSS
      || typeof window.CSS.supports !== 'function'
      || !window.CSS.supports('transition-behavior', 'allow-discrete')
      || !document.body
      || typeof window.getComputedStyle !== 'function'
    ) {
      return (_canTransitionDisplay = false);
    }
    const probe = document.createElement('div');
    probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
    document.body.appendChild(probe);
    window.getComputedStyle(probe).display;
    probe.style.display = 'none';
    _canTransitionDisplay = window.getComputedStyle(probe).display === 'block';
    probe.remove();
    return _canTransitionDisplay;
  }

  const LOAD_DURATION_MS = 5000;
  const EXIT_TRANSITION_MS = 1150;
  const LOADER_STAGES = [
    { id: 'boot', shortLabel: 'BOOT', threshold: 0, max: 20, message: 'Initializing theme & design tokens…' },
    { id: 'shell', shortLabel: 'SHELL', threshold: 20, max: 45, message: 'Mounting navigation & layout components…' },
    { id: 'webgl', shortLabel: 'WEBGL', threshold: 45, max: 72, message: 'Compiling Three.js WebGL & aurora shaders…' },
    { id: 'data', shortLabel: 'DATA', threshold: 72, max: 92, message: 'Hydrating project archive & spring physics…' },
    { id: 'ready', shortLabel: 'READY', threshold: 92, max: 100, message: 'Finalizing viewport & launching portfolio…' },
  ];

  function getClockNow() {
    return typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
  }

  function timedLoaderCurve(t) {
    const x = Math.max(0, Math.min(1, t));
    if (x < 0.16) {
      return (x / 0.16) * 20;
    }
    if (x < 0.40) {
      const p = (x - 0.16) / 0.24;
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      return 20 + eased * 25;
    }
    if (x < 0.68) {
      const p = (x - 0.40) / 0.28;
      const ripple = Math.sin(p * Math.PI * 2) * 0.05;
      return 45 + Math.max(0, Math.min(1, p + ripple)) * 27;
    }
    if (x < 0.90) {
      const p = (x - 0.68) / 0.22;
      const eased = 1 - Math.pow(1 - p, 2);
      return 72 + eased * 20;
    }
    const p = (x - 0.90) / 0.10;
    return 92 + p * 7;
  }

  /**
   * Returns true only when the current page load is an explicit browser refresh/reload
   * (e.g. F5, Ctrl/Cmd+R, Reload button, or location.reload()), never for normal link
   * navigation, navbar/CTA page switches, or back/forward history traversal.
   */
  function isPageReload() {
    if (typeof window === 'undefined' || !window.performance) {
      return false;
    }

    try {
      if (typeof window.performance.getEntriesByType === 'function') {
        const entries = window.performance.getEntriesByType('navigation');
        if (entries && entries.length > 0 && entries[0] && typeof entries[0].type === 'string') {
          return entries[0].type === 'reload';
        }
      }
    } catch (_) {
      // Fall through to legacy navigation timing API
    }

    try {
      const legacyNav = window.performance.navigation;
      if (legacyNav && typeof legacyNav.type === 'number') {
        return legacyNav.type === 1;
      }
    } catch (_) {
      // Ignore restricted performance access
    }

    return false;
  }

  /**
   * Lightweight no-op loader API used when navigation is not a page refresh or
   * when document.body is not available yet.
   */
  function createPassthroughLoader() {
    return {
      setProgress() {},
      setMilestone() {},
      startTimedSequence() {},
      runHomepageSpringTrail() {},
      complete() {},
      show() {
        return initializeLoadingScreen({ force: true });
      },
      hide() {},
      getState() {
        return { current: 100, target: 100, velocity: 0, closing: false, hidden: true };
      },
      canTransitionDisplay,
    };
  }

  /**
   * Mounts and drives the Three.js + spring-physics motion graphics loading screen.
   */
  function initializeLoadingScreen(options = {}) {
    const body = document.body;
    const onlyOnReload = Boolean(options && options.onlyOnReload);
    const force = Boolean(options && options.force);
    const shouldMountLoader = Boolean(body) && (force || !onlyOnReload || isPageReload());

    if (!shouldMountLoader) {
      if (body) {
        delete body.dataset.loaderState;
        const staleLoader = document.getElementById('site-loader');
        if (staleLoader) {
          staleLoader.hidden = true;
          staleLoader.remove();
        }
      }
      const passthrough = createPassthroughLoader();
      if (typeof window !== 'undefined') {
        window.PortfolioLoader = passthrough;
      }
      return passthrough;
    }

    body.dataset.loaderState = 'loading';

    let loaderEl = document.getElementById('site-loader');
    if (!loaderEl) {
      loaderEl = document.createElement('div');
      loaderEl.id = 'site-loader';
      loaderEl.className = 'site-loader';
      const stepsHtml = LOADER_STAGES.map((stage, idx) => (
        `<div class="site-loader__step" data-loader-step="${idx}" data-step-state="${idx === 0 ? 'active' : 'pending'}">`
        + '<span class="site-loader__step-bar"></span>'
        + `<span class="site-loader__step-label">${stage.shortLabel}</span>`
        + '</div>'
      )).join('');
      loaderEl.innerHTML = [
        '<div class="site-loader__backdrop" aria-hidden="true"></div>',
        '<canvas class="site-loader__webgl" aria-hidden="true"></canvas>',
        '<div class="site-loader__portal-ring" aria-hidden="true"></div>',
        '<div class="site-loader__stage">',
        '  <div class="site-loader__header" aria-hidden="true">',
        '    <span class="site-loader__badge"><span class="site-loader__badge-dot"></span><span class="site-loader__badge-text">STAGE 01 // BOOT</span></span>',
        '    <span class="site-loader__timer">0.0s / 5.0s</span>',
        '  </div>',
        '  <div class="site-loader__core" aria-hidden="true">',
        '    <div class="site-loader__orbit site-loader__orbit--outer"></div>',
        '    <div class="site-loader__orbit site-loader__orbit--inner"></div>',
        '    <svg class="site-loader__ring-svg" viewBox="0 0 100 100">',
        '      <circle class="site-loader__ring-track" cx="50" cy="50" r="46"></circle>',
        '      <circle class="site-loader__ring-fill" cx="50" cy="50" r="46"></circle>',
        '    </svg>',
        '    <div class="site-loader__core-prism"></div>',
        '  </div>',
        '  <div class="site-loader__meta" aria-hidden="true">',
        '    <span class="site-loader__brand">Charles David</span>',
        '    <span class="site-loader__percent">0%</span>',
        '  </div>',
        '  <progress class="site-loader__progress" aria-label="Loading portfolio" max="100" value="0"></progress>',
        '  <div class="site-loader__phase" aria-hidden="true">Initializing theme &amp; design tokens…</div>',
        `  <div class="site-loader__steps" aria-hidden="true">${stepsHtml}</div>`,
        '  <div class="site-loader__status" role="status" aria-live="polite">Loading portfolio</div>',
        '</div>',
      ].join('');
      body.prepend(loaderEl);
    }

    const canvas = loaderEl.querySelector('.site-loader__webgl');
    const progressEl = loaderEl.querySelector('.site-loader__progress');
    const percentEl = loaderEl.querySelector('.site-loader__percent');
    const phaseEl = loaderEl.querySelector('.site-loader__phase');
    const timerEl = loaderEl.querySelector('.site-loader__timer');
    const badgeTextEl = loaderEl.querySelector('.site-loader__badge-text');
    const stepEls = Array.from(loaderEl.querySelectorAll('.site-loader__step'));
    const statusEl = loaderEl.querySelector('.site-loader__status');

    const motionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

    const state = {
      current: 0,
      target: 18,
      velocity: 0,
      stiffness: 170,
      damping: 22,
      closing: false,
      closingStartedAt: 0,
      fullyHidden: false,
      completed: false,
      rafId: 0,
      lastTime: 0,
      startedAt: getClockNow(),
      durationMs: LOAD_DURATION_MS,
      timedMode: false,
      milestoneCap: 100,
      threeCtx: null,
    };

    function getStageIndex(clamped) {
      let activeIdx = 0;
      for (let i = 0; i < LOADER_STAGES.length; i++) {
        if (clamped >= LOADER_STAGES[i].threshold) {
          activeIdx = i;
        }
      }
      return activeIdx;
    }

    function applyVisualProgress() {
      const clamped = Math.max(0, Math.min(100, state.current));
      const springScale = 1 + Math.min(0.08, Math.abs(state.velocity) * 0.0006);
      loaderEl.style.setProperty('--loader-progress', clamped.toFixed(2));
      loaderEl.style.setProperty('--loader-spring-scale', springScale.toFixed(4));
      if (progressEl) progressEl.value = Math.round(clamped);
      if (percentEl) percentEl.textContent = Math.round(clamped) + '%';

      const stageIdx = getStageIndex(clamped);
      const isReady = state.completed || clamped >= 99.5;
      if (phaseEl) {
        phaseEl.textContent = isReady
          ? 'Portfolio ready — launching experience'
          : LOADER_STAGES[stageIdx].message;
      }
      if (badgeTextEl) {
        badgeTextEl.textContent = isReady
          ? 'SYSTEM READY'
          : `STAGE 0${stageIdx + 1} // ${LOADER_STAGES[stageIdx].shortLabel}`;
      }
      if (timerEl) {
        const totalSec = state.durationMs / 1000;
        const elapsedSec = state.completed
          ? totalSec
          : state.timedMode
            ? Math.min(totalSec, Math.max(0, (getClockNow() - state.startedAt) / 1000))
            : (clamped / 100) * totalSec;
        timerEl.textContent = `${elapsedSec.toFixed(1)}s / ${totalSec.toFixed(1)}s`;
      }
      stepEls.forEach((stepEl, idx) => {
        const stage = LOADER_STAGES[idx];
        if (!stage) return;
        if (state.completed || clamped >= stage.max) {
          stepEl.dataset.stepState = 'done';
        } else if (idx === stageIdx) {
          stepEl.dataset.stepState = 'active';
        } else {
          stepEl.dataset.stepState = 'pending';
        }
      });
    }

    function disposeThreeLoader() {
      const ctx = state.threeCtx;
      if (!ctx) return;
      state.threeCtx = null;
      if (ctx.resizeHandler) {
        window.removeEventListener('resize', ctx.resizeHandler);
      }
      ctx.disposables.forEach((item) => {
        if (item && typeof item.dispose === 'function') item.dispose();
      });
      if (ctx.renderer && typeof ctx.renderer.dispose === 'function') {
        ctx.renderer.dispose();
      }
    }

    function renderThreeLoaderFrame(now) {
      const ctx = state.threeCtx;
      if (!ctx) return;
      const progressFactor = Math.max(0, Math.min(1, state.current / 100));
      const reduced = Boolean(motionQuery && motionQuery.matches);
      if (!reduced) {
        const t = now * 0.001;
        if (state.closing && state.closingStartedAt) {
          const exitProgress = Math.max(0, Math.min(1, (getClockNow() - state.closingStartedAt) / EXIT_TRANSITION_MS));
          const morph = 1 - Math.pow(1 - exitProgress, 3);

          const posAttr = ctx.particles && ctx.particles.geometry && ctx.particles.geometry.attributes
            ? ctx.particles.geometry.attributes.position
            : null;
          if (posAttr && ctx.orbitPositions && ctx.homePositions) {
            const arr = posAttr.array;
            const swirlAmount = Math.sin(morph * Math.PI) * 0.65;
            for (let i = 0; i < arr.length; i += 3) {
              const ox = ctx.orbitPositions[i];
              const oy = ctx.orbitPositions[i + 1];
              const oz = ctx.orbitPositions[i + 2];
              const hx = ctx.homePositions[i];
              const hy = ctx.homePositions[i + 1];
              const hz = ctx.homePositions[i + 2];
              const swirlX = -oy * swirlAmount * 0.18;
              const swirlY = ox * swirlAmount * 0.18;
              arr[i] = ox + (hx - ox) * morph + swirlX;
              arr[i + 1] = oy + (hy - oy) * morph + swirlY;
              arr[i + 2] = oz + (hz - oz) * morph;
            }
            posAttr.needsUpdate = true;
          }

          ctx.camera.position.z = 5.4 - morph * 4.1;
          ctx.camera.fov = 48 + morph * 16;
          if (typeof ctx.camera.updateProjectionMatrix === 'function') {
            ctx.camera.updateProjectionMatrix();
          }

          ctx.group.scale.set(1, 1, 1);
          const ringScaleOuter = 1 + morph * 2.8;
          const ringScaleInner = 1 + morph * 3.4;
          const coreScale = 1 + morph * 2.2;
          ctx.coreMesh.scale.set(coreScale, coreScale, coreScale);
          ctx.knotMesh.scale.set(coreScale, coreScale, coreScale);
          ctx.outerRing.scale.set(ringScaleOuter, ringScaleOuter, ringScaleOuter);
          ctx.innerRing.scale.set(ringScaleInner, ringScaleInner, ringScaleInner);

          ctx.coreMesh.rotation.x += 0.032;
          ctx.coreMesh.rotation.y += 0.05;
          ctx.knotMesh.rotation.x -= 0.04;
          ctx.outerRing.rotation.z += 0.036;
          ctx.innerRing.rotation.y -= 0.044;
          ctx.particles.rotation.y += 0.012 * (1 - morph * 0.6);

          const wireFade = Math.max(0, 1 - morph * 1.25);
          ctx.coreMesh.material.opacity = 0.75 * wireFade;
          ctx.knotMesh.material.opacity = 0.45 * wireFade;
          ctx.outerRing.material.opacity = 0.52 * wireFade;
          ctx.innerRing.material.opacity = 0.36 * wireFade;
          ctx.particles.material.opacity = 0.65 * Math.max(0, 1 - Math.max(0, morph - 0.55) / 0.45);

          if (typeof window.__transitionThreeBackdrop === 'function') {
            window.__transitionThreeBackdrop(morph);
          }
        } else {
          const velBoost = Math.min(0.04, Math.abs(state.velocity) * 0.00025);
          ctx.camera.position.z = 5.4;
          ctx.coreMesh.scale.set(1, 1, 1);
          ctx.knotMesh.scale.set(1, 1, 1);
          ctx.outerRing.scale.set(1, 1, 1);
          ctx.innerRing.scale.set(1, 1, 1);
          ctx.coreMesh.rotation.x = t * 0.65 + progressFactor * 1.4;
          ctx.coreMesh.rotation.y = t * 0.95 + progressFactor * 2.1;
          ctx.knotMesh.rotation.x = -t * 0.85;
          ctx.knotMesh.rotation.z = t * 0.55;
          ctx.outerRing.rotation.z = t * (0.45 + velBoost * 8);
          ctx.outerRing.rotation.x = 1.05 + Math.sin(t * 0.8) * 0.14;
          ctx.innerRing.rotation.y = -t * (0.68 + velBoost * 10);
          ctx.innerRing.rotation.x = 0.72 + Math.cos(t * 0.7) * 0.16;
          ctx.particles.rotation.y = t * 0.18 + progressFactor * 0.8;
          ctx.particles.rotation.x = Math.sin(t * 0.35) * 0.15;
          const pulse = 0.9 + progressFactor * 0.2 + velBoost * 2.4;
          ctx.group.scale.set(pulse, pulse, pulse);
        }
      }
      ctx.renderer.render(ctx.scene, ctx.camera);
    }

    function setupThreeLoader() {
      if (!canvas) return;
      loadThreeGlobal(SITE_ROOT + 'assets/js/three.min.js')
        .then((THREE) => {
          if (!THREE || loaderEl.hidden || state.closing || state.threeCtx) return;

          let renderer = null;
          try {
            renderer = new THREE.WebGLRenderer({
              canvas,
              alpha: true,
              antialias: true,
              powerPreference: 'high-performance',
            });
          } catch {
            return;
          }

          const width = window.innerWidth || 1280;
          const height = window.innerHeight || 720;
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
          renderer.setSize(width, height, false);

          const scene = new THREE.Scene();
          const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
          camera.position.z = 5.4;

          const isLight = document.documentElement.getAttribute('data-theme') === 'light';
          const primaryHex = isLight ? 0x2563eb : 0x5ca8ff;
          const secondaryHex = isLight ? 0xd97706 : 0xffc470;

          const group = new THREE.Group();
          scene.add(group);

          const coreGeom = new THREE.IcosahedronGeometry(1.15, 1);
          const coreMat = new THREE.MeshBasicMaterial({
            color: primaryHex,
            wireframe: true,
            transparent: true,
            opacity: 0.75,
          });
          const coreMesh = new THREE.Mesh(coreGeom, coreMat);
          group.add(coreMesh);

          const knotGeom = new THREE.TorusKnotGeometry(0.62, 0.14, 64, 12);
          const knotMat = new THREE.MeshBasicMaterial({
            color: secondaryHex,
            wireframe: true,
            transparent: true,
            opacity: 0.45,
          });
          const knotMesh = new THREE.Mesh(knotGeom, knotMat);
          group.add(knotMesh);

          const outerGeom = new THREE.TorusGeometry(1.85, 0.018, 12, 96);
          const outerMat = new THREE.MeshBasicMaterial({
            color: primaryHex,
            transparent: true,
            opacity: 0.52,
          });
          const outerRing = new THREE.Mesh(outerGeom, outerMat);
          outerRing.rotation.x = 1.05;
          group.add(outerRing);

          const innerGeom = new THREE.TorusGeometry(2.35, 0.012, 12, 96);
          const innerMat = new THREE.MeshBasicMaterial({
            color: secondaryHex,
            transparent: true,
            opacity: 0.36,
          });
          const innerRing = new THREE.Mesh(innerGeom, innerMat);
          innerRing.rotation.x = 0.72;
          group.add(innerRing);

          const particleCount = 180;
          const orbitPositions = new Float32Array(particleCount * 3);
          const homePositions = new Float32Array(particleCount * 3);
          const pseudo = (n) => {
            const v = Math.sin(n * 19.31 + 41.7) * 43758.5453;
            return v - Math.floor(v);
          };
          for (let i = 0; i < particleCount; i++) {
            const radius = 2.6 + (i % 15) * 0.24;
            const theta = i * 2.3999632;
            const phi = Math.acos(1 - (2 * (i + 0.5)) / particleCount);
            orbitPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            orbitPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            orbitPositions[i * 3 + 2] = radius * Math.cos(phi);

            homePositions[i * 3] = (pseudo(i + 1) - 0.5) * 26;
            homePositions[i * 3 + 1] = (pseudo(i + 301) - 0.5) * 16;
            homePositions[i * 3 + 2] = -2 - pseudo(i + 601) * 10;
          }
          const positions = new Float32Array(orbitPositions);
          const particleGeom = new THREE.BufferGeometry();
          particleGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          const particleMat = new THREE.PointsMaterial({
            color: primaryHex,
            size: 0.045,
            transparent: true,
            opacity: 0.65,
          });
          const particles = new THREE.Points(particleGeom, particleMat);
          group.add(particles);

          const resizeHandler = () => {
            if (!state.threeCtx) return;
            const w = window.innerWidth || 1280;
            const h = window.innerHeight || 720;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h, false);
          };
          window.addEventListener('resize', resizeHandler);

          state.threeCtx = {
            renderer,
            scene,
            camera,
            group,
            coreMesh,
            knotMesh,
            outerRing,
            innerRing,
            particles,
            orbitPositions,
            homePositions,
            resizeHandler,
            disposables: [
              coreGeom,
              coreMat,
              knotGeom,
              knotMat,
              outerGeom,
              outerMat,
              innerGeom,
              innerMat,
              particleGeom,
              particleMat,
            ],
          };

          renderThreeLoaderFrame(performance.now());
        })
        .catch(() => {
          // CSS/SVG orbital rings remain active when Three.js or WebGL is unavailable.
        });
    }

    function stepLoop(now) {
      if (state.fullyHidden) {
        state.rafId = 0;
        disposeThreeLoader();
        return;
      }

      const reduced = Boolean(motionQuery && motionQuery.matches);
      if (state.timedMode && !state.completed && !state.closing) {
        const elapsedMs = Math.max(0, getClockNow() - state.startedAt);
        const norm = Math.min(1, elapsedMs / Math.max(1, state.durationMs));
        const curved = timedLoaderCurve(norm);
        const allowed = Math.min(state.milestoneCap, curved);
        state.target = Math.max(state.target, allowed);
        if (norm >= 1 && state.milestoneCap >= 99) {
          hide();
        }
      }

      if (reduced) {
        state.current = state.target;
        state.velocity = 0;
      } else if (!state.closing) {
        const dt = state.lastTime ? Math.min(0.05, (now - state.lastTime) / 1000) : 1 / 60;
        const displacement = state.target - state.current;
        const accel = displacement * state.stiffness - state.velocity * state.damping;
        state.velocity += accel * dt;
        state.current += state.velocity * dt;
        if (Math.abs(displacement) < 0.08 && Math.abs(state.velocity) < 0.08) {
          state.current = state.target;
          state.velocity = 0;
        }
      }
      state.lastTime = now;

      applyVisualProgress();
      renderThreeLoaderFrame(now);

      if (!state.fullyHidden) {
        state.rafId = window.requestAnimationFrame(stepLoop);
      } else {
        state.rafId = 0;
      }
    }

    function startLoop() {
      if (!state.rafId && typeof window.requestAnimationFrame === 'function') {
        state.lastTime = 0;
        state.rafId = window.requestAnimationFrame(stepLoop);
      }
    }

    let trailRafId = 0;

    /**
     * Format inline spring transforms while keeping percentage centering intact on
     * fixed headers (`left: 50%; translateX(-50%)`).
     */
    function applySpringTransform(item, x, y, scale) {
      const tx = item.baseXPercent
        ? `calc(${item.baseXPercent}% + ${x.toFixed(2)}px)`
        : `${x.toFixed(2)}px`;
      item.el.style.transform = `translate3d(${tx}, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    }

    function runHomepageSpringTrail() {
      if (trailRafId && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(trailRafId);
        trailRafId = 0;
      }

      const specs = [
        { selector: '.site-header', baseXPercent: -50, fromX: 0, fromY: -36, fromScale: 0.96, delay: 40 },
        { selector: '.site-header .brand', fromX: -10, fromY: -12, fromScale: 0.96, delay: 110 },
        ...Array.from(document.querySelectorAll('.site-header .site-nav a')).map((el, idx) => ({
          el,
          fromX: 0,
          fromY: -12,
          fromScale: 0.94,
          delay: 150 + idx * 45,
        })),
        { selector: '.site-header .theme-toggle', fromX: 10, fromY: -12, fromScale: 0.9, delay: 280 },
      ];
      const hasHeroCopy = Boolean(document.querySelector('.hero-copy'));
      if (hasHeroCopy) {
        specs.push({ selector: '.hero-copy .eyebrow', fromX: -14, fromY: 28, fromScale: 0.96, delay: 110 });
        specs.push({ selector: '.hero-copy h1', fromX: -18, fromY: 34, fromScale: 0.94, delay: 180 });
        specs.push({ selector: '.hero-copy .hero-description', fromX: 0, fromY: 32, fromScale: 0.97, delay: 250 });
        specs.push({ selector: '.hero-copy .hero-actions', fromX: 0, fromY: 26, fromScale: 0.95, delay: 320 });
        specs.push({ selector: '.hero-avatar', fromX: 24, fromY: 30, fromScale: 0.86, delay: 200 });
      } else {
        specs.push({ selector: 'main > section:first-of-type', fromX: 0, fromY: 28, fromScale: 0.97, delay: 120 });
      }

      const seen = new Set();
      const items = [];
      specs.forEach((spec) => {
        const el = spec.el || document.querySelector(spec.selector);
        if (!el || seen.has(el)) return;
        seen.add(el);
        items.push({
          el,
          baseXPercent: spec.baseXPercent || 0,
          delay: spec.delay,
          x: spec.fromX,
          vx: 0,
          y: spec.fromY,
          vy: 0,
          scale: spec.fromScale,
          vs: 0,
          opacity: 0,
          vo: 0,
          settled: false,
        });
      });

      const reduced = Boolean(motionQuery && motionQuery.matches);
      if (reduced || typeof window.requestAnimationFrame !== 'function' || items.length === 0) {
        items.forEach((item) => {
          item.el.style.opacity = '';
          item.el.style.transform = '';
          item.el.style.willChange = '';
        });
        return;
      }

      items.forEach((item) => {
        item.el.style.willChange = 'transform, opacity';
        item.el.style.opacity = '0';
        applySpringTransform(item, item.x, item.y, item.scale);
      });

      const spatialStiffness = 175;
      const spatialDamping = 19;
      const opacityStiffness = 220;
      const opacityDamping = 32;
      const startedAt = getClockNow();
      let lastTick = 0;

      const stepTrail = (now) => {
        const clock = getClockNow();
        const elapsed = Math.max(0, clock - startedAt);
        const dt = lastTick ? Math.min(0.05, Math.max(0.001, (now - lastTick) / 1000)) : 1 / 60;
        lastTick = now;

        let anyActive = false;
        items.forEach((item) => {
          if (item.settled) return;
          anyActive = true;
          if (elapsed < item.delay) return;

          const ax = -item.x * spatialStiffness - item.vx * spatialDamping;
          item.vx += ax * dt;
          item.x += item.vx * dt;

          const ay = -item.y * spatialStiffness - item.vy * spatialDamping;
          item.vy += ay * dt;
          item.y += item.vy * dt;

          const as = (1 - item.scale) * spatialStiffness - item.vs * spatialDamping;
          item.vs += as * dt;
          item.scale += item.vs * dt;

          const ao = (1 - item.opacity) * opacityStiffness - item.vo * opacityDamping;
          item.vo += ao * dt;
          item.opacity = Math.max(0, Math.min(1, item.opacity + item.vo * dt));

          const done =
            Math.abs(item.x) < 0.15
            && Math.abs(item.y) < 0.15
            && Math.abs(1 - item.scale) < 0.002
            && Math.abs(1 - item.opacity) < 0.01
            && Math.abs(item.vx) < 0.4
            && Math.abs(item.vy) < 0.4;

          if (done) {
            item.settled = true;
            item.el.style.opacity = '';
            item.el.style.transform = '';
            item.el.style.willChange = '';
          } else {
            item.el.style.opacity = item.opacity.toFixed(3);
            applySpringTransform(item, item.x, item.y, item.scale);
          }
        });

        if (anyActive) {
          trailRafId = window.requestAnimationFrame(stepTrail);
        } else {
          trailRafId = 0;
        }
      };

      trailRafId = window.requestAnimationFrame(stepTrail);
    }

    function finishHide() {
      state.fullyHidden = true;
      if (state.rafId && typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(state.rafId);
        state.rafId = 0;
      }
      disposeThreeLoader();
      body.dataset.loaderState = 'ready';
      syncNavbarState();

      const focusTarget = document.getElementById('hero') || document.querySelector('main');
      if (
        focusTarget
        && typeof focusTarget.focus === 'function'
        && (!document.activeElement || document.activeElement === document.body || loaderEl.contains(document.activeElement))
      ) {
        focusTarget.focus({ preventScroll: true });
      }

      document.dispatchEvent(new CustomEvent('portfolio:loader-complete'));
    }

    function triggerHomepageEntrance() {
      syncNavbarState();
      runHomepageSpringTrail();
      body.dataset.loaderState = 'entering';
      if (typeof window.__spawnThreeBurst === 'function') {
        window.__spawnThreeBurst();
      }
      if (typeof window.__transitionThreeBackdrop === 'function') {
        window.__transitionThreeBackdrop(0);
      }
      const heroEl = document.getElementById('hero');
      if (heroEl && window.Typewriter && typeof window.Typewriter.replayWithin === 'function') {
        window.Typewriter.replayWithin(heroEl);
      }
      document.dispatchEvent(new CustomEvent('portfolio:loader-transition-start'));
    }

    function hide() {
      if (loaderEl.hidden || state.closing) return;
      state.completed = true;
      state.closing = true;
      state.closingStartedAt = getClockNow();
      state.target = 100;
      state.current = Math.max(state.current, 100);
      state.velocity = 0;
      applyVisualProgress();
      if (statusEl) statusEl.textContent = 'Portfolio loaded';

      triggerHomepageEntrance();

      loaderEl.setAttribute('data-closing', '');
      const reduced = Boolean(motionQuery && motionQuery.matches);
      const waitMs = reduced ? 150 : EXIT_TRANSITION_MS;

      setTimeout(() => {
        if (!state.closing) return;
        if (canTransitionDisplay()) {
          loaderEl.hidden = true;
          const anims = typeof loaderEl.getAnimations === 'function' ? loaderEl.getAnimations() : [];
          if (anims.length > 0) {
            Promise.race([
              Promise.allSettled(anims.map((anim) => anim.finished)),
              new Promise((resolve) => setTimeout(resolve, 400)),
            ]).then(() => {
              if (state.closing) {
                loaderEl.removeAttribute('data-closing');
                finishHide();
              }
            });
            return;
          }
        }
        loaderEl.hidden = true;
        loaderEl.removeAttribute('data-closing');
        finishHide();
      }, waitMs);
    }

    function show(initialProgress = 0) {
      state.closing = false;
      state.closingStartedAt = 0;
      state.fullyHidden = false;
      state.completed = false;
      state.timedMode = false;
      state.milestoneCap = 100;
      state.startedAt = getClockNow();
      state.current = Math.max(0, Math.min(100, Number(initialProgress) || 0));
      state.target = Math.max(state.current, 25);
      state.velocity = 0;
      body.dataset.loaderState = 'loading';
      if (statusEl) statusEl.textContent = 'Loading portfolio';
      loaderEl.removeAttribute('data-closing');
      loaderEl.hidden = false;
      if (state.threeCtx) {
        const posAttr = state.threeCtx.particles.geometry.attributes.position;
        if (posAttr && state.threeCtx.orbitPositions) {
          posAttr.array.set(state.threeCtx.orbitPositions);
          posAttr.needsUpdate = true;
        }
        state.threeCtx.camera.fov = 48;
        state.threeCtx.camera.position.z = 5.4;
        if (typeof state.threeCtx.camera.updateProjectionMatrix === 'function') {
          state.threeCtx.camera.updateProjectionMatrix();
        }
      }
      applyVisualProgress();
      setupThreeLoader();
      startLoop();
    }

    function setProgress(value) {
      const next = Math.max(0, Math.min(100, Number(value) || 0));
      state.target = Math.max(state.target, next);
      if (motionQuery && motionQuery.matches) {
        state.current = state.target;
        applyVisualProgress();
      }
    }

    function startTimedSequence(durationMs = LOAD_DURATION_MS) {
      state.timedMode = true;
      state.completed = false;
      state.closing = false;
      state.durationMs = Math.max(500, Number(durationMs) || LOAD_DURATION_MS);
      state.startedAt = getClockNow();
      state.milestoneCap = 30;
      state.current = 0;
      state.target = 6;
      state.velocity = 0;
      applyVisualProgress();
      startLoop();
    }

    function setMilestone(cap) {
      const nextCap = Math.max(0, Math.min(100, Number(cap) || 0));
      state.milestoneCap = Math.max(state.milestoneCap, nextCap);
    }

    function getState() {
      return {
        current: state.current,
        target: state.target,
        velocity: state.velocity,
        closing: state.closing,
        hidden: Boolean(loaderEl.hidden),
      };
    }

    applyVisualProgress();
    setupThreeLoader();
    startLoop();

    const api = {
      setProgress,
      setMilestone,
      startTimedSequence,
      runHomepageSpringTrail,
      complete: hide,
      show,
      hide,
      getState,
      canTransitionDisplay,
    };

    window.PortfolioLoader = api;
    return api;
  }

  async function loadSiteChrome() {
    const showLoader = isPageReload();
    const loader = initializeLoadingScreen({ onlyOnReload: true });
    const startTime = getClockNow();
    const reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const minDisplayMs = showLoader && !reducedMotion ? LOAD_DURATION_MS : 0;

    if (minDisplayMs > 0 && typeof loader.startTimedSequence === 'function') {
      loader.startTimedSequence(minDisplayMs);
    }

    try {
      const [background, navbar, footer] = await Promise.all([
        fetchComponent(BACKGROUND_COMPONENT),
        fetchComponent(NAVBAR_COMPONENT),
        fetchComponent(FOOTER_COMPONENT),
      ]);
      if (minDisplayMs > 0 && typeof loader.setMilestone === 'function') {
        loader.setMilestone(68);
      } else {
        loader.setProgress(65);
      }

      fillMount(MOUNTS.background, background, 'start');
      fillMount(MOUNTS.navbar, navbar, 'start');
      fillMount(MOUNTS.footer, footer, 'end');

      initializeBackground(document.querySelector('.hero-bg'));
      if (minDisplayMs > 0 && typeof loader.setMilestone === 'function') {
        loader.setMilestone(99);
      } else {
        loader.setProgress(90);
      }

      initializeNavbarBrand();
      initializeNavbarSectionHighlight();
      initializeNavbarScrollState();
      initializeExternalMotionEffects();
    } finally {
      if (showLoader) {
        const now = getClockNow();
        const remaining = Math.max(0, minDisplayMs - (now - startTime));
        if (remaining > 0) {
          setTimeout(() => loader.complete(), remaining);
        } else {
          loader.complete();
        }
      } else {
        syncNavbarState();
      }
    }
  }

  if (typeof document !== 'undefined') {
    if (document.body && isPageReload()) {
      document.body.dataset.loaderState = 'loading';
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', loadSiteChrome);
    } else {
      loadSiteChrome();
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pageshow', (event) => {
      if (!event.persisted) return;
      const staleLoader = document.getElementById('site-loader');
      if (staleLoader) {
        staleLoader.hidden = true;
        staleLoader.remove();
      }
      if (document.body && document.body.dataset.loaderState && document.body.dataset.loaderState !== 'ready') {
        delete document.body.dataset.loaderState;
      }
      syncNavbarState();
    });
  }
})();
