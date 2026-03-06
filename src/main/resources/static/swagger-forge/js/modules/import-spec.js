import { showToast } from './toast.js';

export function initImportSpec() {
  const openBtn = document.getElementById('open-import');
  const closeBtn = document.getElementById('close-import');
  const modal = document.getElementById('import-modal');
  const doImportBtn = document.getElementById('do-import');
  const resetBtn = document.getElementById('reset-to-sample');
  const fileInput = document.getElementById('import-file');
  const dropZone = modal?.querySelector('.drop-zone');
  const fileDisplay = document.getElementById('file-name-display');

  openBtn?.addEventListener('click', () => openModal());
  closeBtn?.addEventListener('click', closeModal);
  modal?.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);
  doImportBtn?.addEventListener('click', doImport);
  resetBtn?.addEventListener('click', resetToSample);

  // Import tabs
  document.querySelectorAll('.import-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.importTab));
  });

  // Quick URL examples
  document.querySelectorAll('.quick-url').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById('import-url');
      if (input) input.value = btn.dataset.url;
    });
  });

  // File upload
  fileInput?.addEventListener('change', () => {
    if (fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  // Drag & drop
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-indigo-500', 'bg-indigo-50');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-indigo-500', 'bg-indigo-50');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });
  }

  // Format buttons
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.format-btn').forEach(b => {
        b.classList.remove('active-format', 'bg-indigo-600', 'text-white');
        b.classList.add('border', 'border-gray-200', 'text-gray-600');
      });
      btn.classList.add('active-format', 'bg-indigo-600', 'text-white');
      btn.classList.remove('border', 'border-gray-200', 'text-gray-600');
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal?.classList.contains('hidden')) closeModal();
  });
}

function openModal() {
  document.getElementById('import-modal').classList.remove('hidden');
  clearError();
  switchTab('url');
}

function closeModal() {
  document.getElementById('import-modal').classList.add('hidden');
}

function switchTab(tab) {
  document.querySelectorAll('.import-tab').forEach(t => {
    t.classList.toggle('active-import-tab', t.dataset.importTab === tab);
    t.classList.toggle('text-indigo-600', t.dataset.importTab === tab);
    t.classList.toggle('border-indigo-500', t.dataset.importTab === tab);
    t.classList.toggle('text-gray-500', t.dataset.importTab !== tab);
    t.classList.toggle('border-transparent', t.dataset.importTab !== tab);
  });
  document.querySelectorAll('.import-tab-pane').forEach(p => p.classList.add('hidden'));
  document.getElementById(`import-tab-${tab}`)?.classList.remove('hidden');
  clearError();
}

function handleFile(file) {
  const display = document.getElementById('file-name-display');
  if (display) {
    display.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    display.classList.remove('hidden');
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const paste = document.getElementById('import-paste');
    if (paste) {
      paste.value = e.target.result;
      switchTab('paste');
    }
  };
  reader.readAsText(file);
}

async function doImport() {
  const btn = document.getElementById('do-import');
  btn.disabled = true;
  btn.textContent = 'Importing...';
  clearError();

  // Which tab is active?
  const activeTab = document.querySelector('.import-tab.active-import-tab')?.dataset.importTab;

  try {
    if (activeTab === 'url') {
      await importFromUrl();
    } else if (activeTab === 'file' || activeTab === 'paste') {
      await importFromPaste();
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Import Spec';
  }
}

async function importFromUrl() {
  const url = document.getElementById('import-url')?.value?.trim();
  if (!url) { showError('Please enter a URL'); return; }

  try {
    const res = await fetch('/api/spec/url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch spec');
    showToast('Spec imported! Reloading...');
    setTimeout(() => window.location.reload(), 800);
  } catch (err) {
    showError(err.message);
  }
}

async function importFromPaste() {
  const content = document.getElementById('import-paste')?.value?.trim();
  if (!content) { showError('Please paste your spec content'); return; }

  const format = document.querySelector('.format-btn.active-format')?.dataset.format || 'auto';

  try {
    const res = await fetch('/api/spec/paste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, format })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to parse spec');
    showToast('Spec imported! Reloading...');
    setTimeout(() => window.location.reload(), 800);
  } catch (err) {
    showError(err.message);
  }
}

async function resetToSample() {
  try {
    await fetch('/api/spec/reset', { method: 'POST' });
    showToast('Reset to sample spec');
    setTimeout(() => window.location.reload(), 600);
  } catch {
    showToast('Failed to reset', 'error');
  }
}

function showError(msg) {
  const el = document.getElementById('import-error');
  const text = document.getElementById('import-error-text');
  if (el && text) {
    text.textContent = msg;
    el.classList.remove('hidden');
  }
}

function clearError() {
  document.getElementById('import-error')?.classList.add('hidden');
}
