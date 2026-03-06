import { openEndpointById } from './endpoints.js';

const COLLAPSED_KEY = 'swaggerforge_sidebar_collapsed';
const MOBILE_BREAKPOINT = 768;

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;
}

export function initSidebar() {
  initCollapse();
  initTagGroups();
  initSidebarLinks();
  initSchemaToggle();
  initMethodFilter();
}

// ---- Collapse / Expand (desktop) / Overlay open (mobile) ----
function initCollapse() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('collapse-sidebar');
  const navToggle = document.getElementById('sidebar-toggle');
  const backdrop = document.querySelector('.sidebar-mobile-backdrop');

  const collapsed = localStorage.getItem(COLLAPSED_KEY) === 'true';
  if (collapsed && !isMobile()) applySidebarState(true, false);

  function closeMobileSidebar() {
    document.body.classList.remove('sidebar-open-mobile');
  }

  navToggle?.addEventListener('click', () => {
    if (isMobile()) {
      document.body.classList.toggle('sidebar-open-mobile');
    } else {
      const isCollapsed = sidebar.dataset.collapsed === 'true';
      applySidebarState(!isCollapsed);
    }
  });

  toggleBtn?.addEventListener('click', () => {
    if (isMobile()) {
      closeMobileSidebar();
    } else {
      const isCollapsed = sidebar.dataset.collapsed === 'true';
      applySidebarState(!isCollapsed);
    }
  });

  backdrop?.addEventListener('click', closeMobileSidebar);

  window.addEventListener('resize', () => {
    if (!isMobile()) closeMobileSidebar();
  });
}

function applySidebarState(collapsed, animate = true) {
  const sidebar = document.getElementById('sidebar');
  const expandedEls = sidebar.querySelectorAll('.sidebar-expanded');
  const collapsedEls = sidebar.querySelectorAll('.sidebar-collapsed');
  const icon = document.getElementById('collapse-icon');

  sidebar.dataset.collapsed = collapsed ? 'true' : 'false';
  localStorage.setItem(COLLAPSED_KEY, collapsed);

  if (collapsed) {
    sidebar.style.width = '48px';
    sidebar.style.minWidth = '48px';
    expandedEls.forEach(el => el.classList.add('hidden'));
    collapsedEls.forEach(el => el.classList.remove('hidden'));
    if (icon) icon.style.transform = 'rotate(180deg)';
  } else {
    sidebar.style.width = '260px';
    sidebar.style.minWidth = '260px';
    expandedEls.forEach(el => el.classList.remove('hidden'));
    collapsedEls.forEach(el => el.classList.add('hidden'));
    if (icon) icon.style.transform = '';
  }
}

// ---- Tag groups ----
function initTagGroups() {
  document.querySelectorAll('.tag-group-btn').forEach(btn => {
    const tag = btn.dataset.tag;
    const group = document.querySelector(`.tag-endpoints[data-tag="${tag}"]`);
    const chevron = btn.querySelector('.tag-chevron');

    // Start expanded
    if (group) group.classList.remove('hidden');

    btn.addEventListener('click', () => {
      if (!group) return;
      const hidden = group.classList.toggle('hidden');
      chevron?.classList.toggle('rotated', !hidden);
    });
  });

  // Collapsed icon buttons scroll to tag
  document.querySelectorAll('.collapsed-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = document.querySelector(`.tag-section[data-tag="${btn.dataset.tag}"]`);
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Expand sidebar when clicking collapsed tag
      applySidebarState(false);
    });
  });
}

// ---- Sidebar endpoint links ----
function initSidebarLinks() {
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      if (isMobile()) document.body.classList.remove('sidebar-open-mobile');
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      openEndpointById(link.dataset.method, link.dataset.path);
    });
  });
}

// ---- Schema toggle ----
function initSchemaToggle() {
  const toggleBtn = document.getElementById('toggle-schemas');
  const list = document.getElementById('schemas-list');
  const chevron = document.getElementById('schemas-chevron');

  if (toggleBtn && list) {
    list.classList.remove('hidden');
    toggleBtn.addEventListener('click', () => {
      const hidden = list.classList.toggle('hidden');
      chevron?.classList.toggle('rotated', !hidden);
    });
  }
}

// ---- Method filter ----
function initMethodFilter() {
  document.querySelectorAll('.method-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.method-filter').forEach(b => b.classList.remove('active-filter'));
      btn.classList.add('active-filter');
      filterByMethod(btn.dataset.filter);
    });
  });
}

function filterByMethod(filter) {
  const all = filter === 'all';

  document.querySelectorAll('.sidebar-link').forEach(link => {
    const match = all || link.dataset.method?.toUpperCase() === filter;
    link.style.display = match ? '' : 'none';
  });

  document.querySelectorAll('.endpoint-card').forEach(card => {
    const match = all || card.dataset.method?.toUpperCase() === filter;
    card.style.display = match ? '' : 'none';
  });

  document.querySelectorAll('.tag-section').forEach(section => {
    const hasVisible = [...section.querySelectorAll('.endpoint-card')].some(c => c.style.display !== 'none');
    section.style.display = hasVisible ? '' : 'none';
  });

  document.querySelectorAll('.tag-endpoints').forEach(group => {
    const tag = group.dataset.tag;
    const hasVisible = [...group.querySelectorAll('.sidebar-link')].some(l => l.style.display !== 'none');
    const btn = document.querySelector(`.tag-group-btn[data-tag="${tag}"]`);
    if (btn) btn.style.display = hasVisible || all ? '' : 'none';
    group.style.display = hasVisible || all ? '' : 'none';
  });
}
