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
  const LEVEL_MAX = 5;

  function createNode(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  function skillTileMarkup(skill, index) {
    const level = Math.max(1, Math.min(LEVEL_MAX, Number(skill.level) || 1));

    return `
      <li class="skill-tile card-entrance" data-skill-index="${index}" tabindex="0"
          style="animation-delay: ${index * 100}ms; --level: ${level}">
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
   * Pointer hover and keyboard focus already expand a tile through CSS. This is
   * the tap path for touch, where neither of those applies.
   */
  function bindTiles(mount) {
    mount.addEventListener('click', (event) => {
      const tile = event.target.closest('.skill-tile');
      if (tile && mount.contains(tile)) toggleExpanded(tile);
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
  }

  window.PortfolioSkills = {
    render: renderSkillMatrix,
  };
})();
