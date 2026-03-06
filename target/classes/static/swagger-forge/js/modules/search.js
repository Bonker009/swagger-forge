export function initSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doSearch(input.value.trim().toLowerCase()), 150);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      doSearch('');
      input.blur();
    }
  });
}

function doSearch(query) {
  const links = document.querySelectorAll('.sidebar-link');
  const cards = document.querySelectorAll('.endpoint-card');

  if (!query) {
    // Reset all
    links.forEach(l => { l.style.display = ''; l.innerHTML = l.dataset.originalHtml || l.innerHTML; });
    cards.forEach(c => c.style.display = '');
    document.querySelectorAll('.tag-section, .tag-endpoints, .tag-group-btn').forEach(el => el.style.display = '');
    return;
  }

  // Filter sidebar links
  links.forEach(link => {
    const path = (link.dataset.path || '').toLowerCase();
    const method = (link.dataset.method || '').toLowerCase();
    const tag = (link.dataset.tag || '').toLowerCase();
    const op = window.__SF?.spec?.paths?.[link.dataset.path]?.[link.dataset.method];
    const summary = (op?.summary || '').toLowerCase();

    const match = path.includes(query) || method.includes(query) || tag.includes(query) || summary.includes(query);
    link.style.display = match ? '' : 'none';
  });

  // Filter main content endpoint cards
  cards.forEach(card => {
    const method = (card.dataset.method || '').toLowerCase();
    const id = card.id || '';
    const headerEl = card.querySelector('.endpoint-header');
    const pathText = headerEl?.querySelector('.font-mono')?.textContent?.toLowerCase() || '';
    const summaryText = headerEl?.querySelector('.text-gray-400')?.textContent?.toLowerCase() || '';

    const match = method.includes(query) || pathText.includes(query) || summaryText.includes(query);
    card.style.display = match ? '' : 'none';
  });

  // Show/hide tag sections and sidebar groups
  document.querySelectorAll('.tag-section').forEach(section => {
    const hasVisible = [...section.querySelectorAll('.endpoint-card')].some(c => c.style.display !== 'none');
    section.style.display = hasVisible ? '' : 'none';
  });

  document.querySelectorAll('.tag-endpoints').forEach(group => {
    const tag = group.dataset.tag;
    const hasVisible = [...group.querySelectorAll('.sidebar-link')].some(l => l.style.display !== 'none');
    group.style.display = hasVisible ? '' : 'none';
    const btn = document.querySelector(`.tag-group-btn[data-tag="${tag}"]`);
    if (btn) btn.style.display = hasVisible ? '' : 'none';
    // Keep expanded when searching
    if (hasVisible) group.classList.remove('hidden');
  });
}
