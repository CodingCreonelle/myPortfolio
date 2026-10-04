async function fetchJSON(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

function createCard(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
}

function renderFeaturedProjects(projects) {
  const container = document.querySelector('#featured-projects');
  if (!container || !Array.isArray(projects)) return;
  container.innerHTML = '';

  projects.forEach((project, index) => {
    const card = createCard(`
      <article class="project-card card-entrance" style="animation-delay: ${index * 100}ms;">
        <h3>${project.title}</h3>
        <p>${project.description}</p>
        <p class="project-tags">${project.tags?.join(' · ') || ''}</p>
        <a href="${project.url}" class="text-link">View details</a>
      </article>
    `);
    container.appendChild(card);
  });
  
  // Trigger stagger animation for dynamically added cards
  if (window.AnimationObserver && window.AnimationObserver.triggerStagger) {
    window.AnimationObserver.triggerStagger(container, 'card-entrance', 100);
  }
}

function renderProjectList(projects) {
  const container = document.querySelector('#project-list');
  if (!container || !Array.isArray(projects)) return;
  container.innerHTML = '';

  projects.forEach((project, index) => {
    const card = createCard(`
      <article class="project-item card-entrance" style="animation-delay: ${index * 100}ms;">
        <div class="project-meta">
          <p class="project-category">Project</p>
          <h2>${project.title}</h2>
        </div>
        <p class="project-description">${project.description}</p>
        <div class="project-footer">
          <span class="project-tags">${project.tags?.join(' · ') || ''}</span>
          <a href="${project.url}" class="text-link">View project</a>
        </div>
      </article>
    `);
    container.appendChild(card);
  });
  
  // Trigger stagger animation for dynamically added cards
  if (window.AnimationObserver && window.AnimationObserver.triggerStagger) {
    window.AnimationObserver.triggerStagger(container, 'card-entrance', 100);
  }
}

function renderSkills(skills) {
  const container = document.querySelector('#skills-grid');
  if (!container || !Array.isArray(skills)) return;
  container.innerHTML = '';

  skills.forEach((skill, index) => {
    const card = createCard(`
      <div class="skill-card card-entrance" style="animation-delay: ${index * 100}ms;">
        <h3>${skill}</h3>
        <p>Experience working with ${skill} across portfolio projects.</p>
      </div>
    `);
    container.appendChild(card);
  });
  
  // Trigger stagger animation for dynamically added cards
  if (window.AnimationObserver && window.AnimationObserver.triggerStagger) {
    window.AnimationObserver.triggerStagger(container, 'card-entrance', 100);
  }
}

function renderEducation(education) {
  const container = document.querySelector('#education-content');
  if (!container || !Array.isArray(education)) return;
  container.innerHTML = '';

  education.forEach((item, index) => {
    const card = createCard(`
      <div class="detail-card card-entrance" style="animation-delay: ${index * 100}ms;">
        <h3>${item.title}</h3>
        <p><strong>${item.institution}</strong> · ${item.dates}</p>
        <p>${item.details}</p>
      </div>
    `);
    container.appendChild(card);
  });
  
  // Trigger stagger animation for dynamically added cards
  if (window.AnimationObserver && window.AnimationObserver.triggerStagger) {
    window.AnimationObserver.triggerStagger(container, 'card-entrance', 100);
  }
}

function renderContactCards(socials) {
  const container = document.querySelector('#contact-cards');
  if (!container || !socials) return;
  container.innerHTML = '';

  const items = [
    { label: 'Email', value: socials.email, href: socials.email ? `mailto:${socials.email}` : null },
    { label: 'GitHub', value: socials.github, href: socials.github },
    { label: 'LinkedIn', value: socials.linkedin, href: socials.linkedin },
    { label: 'Discord', value: socials.discord, href: null },
  ];

  let validIndex = 0;
  items.forEach((item) => {
    if (!item.value) return;
    const linkMarkup = item.href
      ? `<p><a href="${item.href}" ${item.href.startsWith('http') ? 'target="_blank" rel="noreferrer"' : ''}>${item.value}</a></p>`
      : `<p>${item.value}</p>`;

    const card = createCard(`
      <div class="contact-card card-entrance" style="animation-delay: ${validIndex * 100}ms;">
        <h2>${item.label}</h2>
        ${linkMarkup}
      </div>
    `);

    container.appendChild(card);
    validIndex++;
  });
  
  // Trigger stagger animation for dynamically added cards
  if (window.AnimationObserver && window.AnimationObserver.triggerStagger) {
    window.AnimationObserver.triggerStagger(container, 'card-entrance', 100);
  }
}

async function loadDynamicData() {
  const [projects, experience, socials] = await Promise.all([
    fetchJSON('data/projects.json'),
    fetchJSON('data/experience.json'),
    fetchJSON('data/socials.json'),
  ]);

  if (projects) {
    renderFeaturedProjects(projects);
    renderProjectList(projects);
  }

  if (experience) {
    renderSkills(experience.skills);
    renderEducation(experience.education);

    if (window.PortfolioTimeline && window.PortfolioTimeline.render) {
      window.PortfolioTimeline.render(experience.timeline);
    }
  }

  if (socials) {
    renderContactCards(socials);
  }
}

document.addEventListener('DOMContentLoaded', loadDynamicData);
