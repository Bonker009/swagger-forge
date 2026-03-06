import { showToast } from './toast.js';
import { generateCurl, copyToClipboard } from './curl.js';
import { initInlineTry } from './try-modal.js';

export function initEndpoints() {
  // Expand/collapse endpoint cards
  document.querySelectorAll('.endpoint-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('.curl-btn')) return;
      toggleEndpoint(header);
    });
  });

  // Copy cURL buttons on cards
  document.querySelectorAll('.curl-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const { path, method } = btn.dataset;
      const server = document.getElementById('server-selector')?.value || '';
      const curl = generateCurl({ method, url: server + path });
      copyToClipboard(curl).then(() => showToast('cURL copied to clipboard', 'info'));
    });
  });

  // Try it out — toggle inline section
  document.querySelectorAll('.try-it-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const card = btn.closest('.endpoint-card');
      const inlineSection = card?.querySelector('.try-inline');
      const label = btn.querySelector('.try-btn-label');
      if (!inlineSection) return;

      const isOpen = !inlineSection.classList.contains('hidden');
      if (isOpen) {
        inlineSection.classList.add('hidden');
        if (label) label.textContent = 'Execute';
        btn.style.background = '';
      } else {
        inlineSection.classList.remove('hidden');
        if (label) label.textContent = 'Close';
        btn.style.background = '#6b7280';
        initInlineTry(inlineSection);
        inlineSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });

  // Schema card expand/collapse
  document.querySelectorAll('.schema-header').forEach(header => {
    header.addEventListener('click', () => {
      const card = header.closest('.schema-card');
      const body = card.querySelector('.schema-body');
      const chevron = header.querySelector('.schema-chevron');
      body.classList.toggle('hidden');
      chevron.classList.toggle('rotated');
    });
  });
}

export function toggleEndpoint(header) {
  const card = header.closest('.endpoint-card');
  const body = card.querySelector('.endpoint-body');
  const chevron = header.querySelector('.endpoint-chevron');
  const isOpen = !body.classList.contains('hidden');
  body.classList.toggle('hidden', isOpen);
  chevron.classList.toggle('rotated', !isOpen);
}

export function openEndpointById(method, path) {
  const id = method + '-' + path.replace(/\//g, '-').replace(/[{}]/g, '');
  const card = document.getElementById(id);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const body = card.querySelector('.endpoint-body');
  const chevron = card.querySelector('.endpoint-chevron');
  if (body && body.classList.contains('hidden')) {
    body.classList.remove('hidden');
    if (chevron) chevron.classList.add('rotated');
  }
}
