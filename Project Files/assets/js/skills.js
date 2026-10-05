/**
 * Skills matrix - turns the skill data into a compact grid of tiles.
 *
 * Like the timeline, this module owns structure only. The grid layout and the
 * hover/focus expansion are separate layers, so the section still reads as a
 * plain list of skills if neither of them applies.
 */

(function () {
  'use strict';

  const MOUNT_SELECTOR = '#skills-matrix';
  const CELL_SELECTOR = '.skill-cell';
  /*
   * The states that open a card. CSS owns them; this only reads them back, so
   * the hover part is read the way the stylesheet reads it, behind
   * `@media (hover: hover)`. A touch device leaves the cell it was tapped on
   * matching `:hover` for good, so counting it there kept marking a collapsed
   * card's neighbours as covered with nothing open to cover them, and they never
   * came back.
   */
  const HOVER_MEDIA = '(hover: hover)';
  const OPEN_SELECTOR = ':is(:focus-visible, [data-expanded="true"])';
  const OPEN_SELECTOR_HOVER = ':is(:hover, :focus-visible, [data-expanded="true"])';
  const LEVEL_MAX = 5;
  // Half the grid gap. A cell within this of the grid's edge has no room to open
  // outwards, so its card opens back across the grid instead.
  const EDGE_TOLERANCE = 8;

  let edgeFrame = 0;

  function createNode(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  function openSelector() {
    return window.matchMedia(HOVER_MEDIA).matches ? OPEN_SELECTOR_HOVER : OPEN_SELECTOR;
  }

  function skillTileMarkup(skill, index) {
    const level = Math.max(1, Math.min(LEVEL_MAX, Number(skill.level) || 1));

    return `
      <li class="skill-cell card-entrance" data-skill-index="${index}" tabindex="0"
          style="animation-delay: ${index * 100}ms; --level: ${level}">
        <div class="skill-tile">
          <img class="skill-tile__icon" src="assets/icons/skills/${skill.icon}.svg"
               alt="" width="64" height="64">
          <h3 class="skill-tile__name">${skill.name}</h3>
          <div class="skill-tile__detail">
            <div class="skill-tile__detail-inner">
              <p class="skill-tile__summary">${skill.summary}</p>
              <p class="skill-tile__description">${skill.description}</p>
              <p class="skill-tile__level">
                <span class="skill-tile__level-label">${skill.levelLabel}</span>
                <span class="skill-tile__meter" role="img"
                      aria-label="Proficiency: ${skill.levelLabel}, ${level} out of ${LEVEL_MAX}"></span>
              </p>
            </div>
          </div>
        </div>
      </li>
    `;
  }

  function toggleExpanded(tile) {
    if (tile.getAttribute('data-expanded') === 'true') {
      tile.removeAttribute('data-expanded');
    } else {
      tile.setAttribute('data-expanded', 'true');
    }
  }

  /*
   * Marks the cells along the grid's right and bottom edges, which CSS cannot
   * work out for itself: the track count comes from the container width, so the
   * last column in one layout is not the last column in the next.
   *
   * Measured from the laid-out boxes rather than recalculated, so a fractional
   * width cannot leave a cell unmarked at the very edge it sits on.
   */
  function markEdgeCells(mount) {
    const cells = Array.prototype.slice.call(mount.children);
    if (!cells.length) return;

    /*
     * Layout offsets rather than bounding boxes: the boxes carry the entrance
     * animation's translate, and the cells are staggered, so at render time the
     * first cell is measured mid-slide while the rest are not. Offsets are the
     * positions the grid actually assigned, whatever is animating on top of
     * them.
     */
    const gridTop = mount.offsetTop;
    const gridLeft = mount.offsetLeft;
    const gridRight = gridLeft + mount.offsetWidth;
    const gridBottom = gridTop + mount.offsetHeight;
    const columns = getComputedStyle(mount).gridTemplateColumns.split(' ').length;

    /*
     * Remembered here because the covered marking runs on pointer activity, where
     * reading the track count back would mean a forced layout on every event.
     */
    mount.dataset.columns = String(columns);

    /*
     * A single column has nowhere for a two-cell card to open into - either side
     * would put it off the page - so it opens inside its own square instead.
     *
     * Decided from the track count rather than a viewport width, because the
     * narrowest grids still fit two tracks: a width guess widely off would either
     * cap a card that had room or let one overflow.
     */
    mount.style.setProperty('--tile-open-size', columns > 1 ? '' : '100%');

    cells.forEach((cell) => {
      const cellTop = cell.offsetTop;
      const cellLeft = cell.offsetLeft;
      /*
       * A cell in the top row is never bottom-anchored, even when that row is
       * also the last one: with a grid only one row tall every cell sits on the
       * bottom edge, and anchoring them all would open the whole band of cards
       * upward over the heading above the grid. There it opens downward instead,
       * over the empty space below the grid.
       */
      const inTopRow = cellTop - gridTop <= EDGE_TOLERANCE;
      const edges = [
        gridRight - (cellLeft + cell.offsetWidth) <= EDGE_TOLERANCE ? 'right' : '',
        !inTopRow && gridBottom - (cellTop + cell.offsetHeight) <= EDGE_TOLERANCE ? 'bottom' : '',
      ].filter(Boolean);

      if (edges.length) {
        cell.setAttribute('data-edge', edges.join(' '));
      } else {
        cell.removeAttribute('data-edge');
      }
    });
  }

  /*
   * Marks the cells an open card grows across.
   *
   * A card covers the 2x2 block it opens into, and a pane is glass, so the tiles
   * under it would otherwise read through as smudges of their own icons and
   * labels. The stylesheet takes marked cells out of the picture instead.
   *
   * Worked out from the grid's track count rather than from measured boxes: the
   * card's geometry while it is opening is animation, not layout, so measuring it
   * would mark whatever it happens to cover this frame. The count is the one
   * markEdgeCells recorded, so this stays cheap enough to run on pointer events.
   *
   * A card opens back across the grid from an edge cell (see markEdgeCells), so
   * which block it covers depends on the same edge marks; a grid one column wide
   * has no room for a card to grow into at all.
   */
  function markCoveredCells(mount) {
    const cells = Array.prototype.slice.call(mount.children);
    if (!cells.length) return;

    const columns = Number(mount.dataset.columns) || 0;
    const covered = new Set();

    if (columns > 1) {
      mount.querySelectorAll(CELL_SELECTOR + openSelector()).forEach((cell) => {
        const index = cells.indexOf(cell);
        if (index < 0) return;

        const edge = cell.getAttribute('data-edge') || '';
        const column = index % columns;
        const row = Math.floor(index / columns);
        const firstColumn = edge.indexOf('right') === -1 ? column : column - 1;
        const firstRow = edge.indexOf('bottom') === -1 ? row : row - 1;

        for (let y = firstRow; y <= firstRow + 1; y += 1) {
          for (let x = firstColumn; x <= firstColumn + 1; x += 1) {
            const other = x >= 0 && x < columns ? cells[y * columns + x] : null;
            if (other && other !== cell) covered.add(other);
          }
        }
      });
    }

    cells.forEach((cell) => {
      // Only written when it changes: an attribute set to the value it already
      // has would still be a style invalidation on every pointer move.
      if (covered.has(cell) !== cell.hasAttribute('data-covered')) {
        if (covered.has(cell)) {
          cell.setAttribute('data-covered', 'true');
        } else {
          cell.removeAttribute('data-covered');
        }
      }
    });
  }

  /** Re-measure on resize, where the grid reflows to a different track count. */
  function scheduleEdgeUpdate() {
    if (edgeFrame) return;
    edgeFrame = requestAnimationFrame(() => {
      edgeFrame = 0;
      const mount = document.querySelector(MOUNT_SELECTOR);
      if (!mount) return;
      markEdgeCells(mount);
      markCoveredCells(mount);
    });
  }

  function bindEdgeTracking(mount) {
    // Idempotent, so a re-render cannot stack duplicate observers.
    if (mount.dataset.edgesBound === 'true') return;
    mount.dataset.edgesBound = 'true';

    /*
     * Observed on the grid rather than the window, because what matters is when
     * the grid itself reflows to a different track count. A window resize can also
     * be reported before the page has taken the new size, which measured the old
     * layout and left every mark one layout behind; layout has already happened by
     * the time an observer runs.
     */
    new ResizeObserver(scheduleEdgeUpdate).observe(mount);
  }

  /*
   * Hover, focus and the tap toggle all decide which card is open, and all of them
   * end in an event the grid can see. Run straight off the event rather than on
   * the next frame: the work is a few attribute writes, and deferring it would
   * leave the covered panes showing through the card until a frame the browser is
   * free to schedule whenever it likes.
   */
  function bindCoverageTracking(mount) {
    if (mount.dataset.coverageBound === 'true') return;
    mount.dataset.coverageBound = 'true';

    ['pointerover', 'pointerout', 'focusin', 'focusout', 'click'].forEach((type) => {
      mount.addEventListener(type, () => markCoveredCells(mount));
    });
  }

  /*
   * Pointer hover and keyboard focus already open a card through CSS. This is the
   * tap path for touch, where neither of those applies.
   */
  function bindTiles(mount) {
    mount.addEventListener('click', (event) => {
      const cell = event.target.closest(CELL_SELECTOR);
      if (cell && mount.contains(cell)) toggleExpanded(cell);
    });
  }

  function renderSkillMatrix(skills) {
    const mount = document.querySelector(MOUNT_SELECTOR);
    if (!mount || !Array.isArray(skills) || !skills.length) return;

    mount.innerHTML = '';

    skills.forEach((skill, index) => {
      mount.appendChild(createNode(skillTileMarkup(skill, index)));
    });

    // Trigger stagger animation for dynamically added tiles, matching the other
    // data-loader renderers.
    if (window.AnimationObserver && window.AnimationObserver.triggerStagger) {
      window.AnimationObserver.triggerStagger(mount, 'card-entrance', 100);
    }

    bindTiles(mount);
    bindEdgeTracking(mount);
    bindCoverageTracking(mount);
    markEdgeCells(mount);
    markCoveredCells(mount);
  }

  window.PortfolioSkills = {
    render: renderSkillMatrix,
  };
})();
