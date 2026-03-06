const STORAGE_KEY = 'swaggerforge_envs';

// ---- Data helpers ----
function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { environments: [], activeId: null }; }
  catch { return { environments: [], activeId: null }; }
}

/** Persist to localStorage and to server storage */
function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  fetch('/api/environments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ environments: data.environments, activeId: data.activeId })
  }).catch(() => {});
}

/** Load environments from server storage into localStorage (used on init) */
async function loadFromServer() {
  try {
    const res = await fetch('/api/environments');
    if (!res.ok) return;
    const data = await res.json();
    if (data && Array.isArray(data.environments)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        environments: data.environments,
        activeId: data.activeId ?? null
      }));
    }
  } catch {
    // Offline or no server: keep localStorage as-is
  }
}

function uid() {
  return 'env_' + Math.random().toString(36).slice(2, 9);
}

// ---- Public API ----
export function getActiveEnv() {
  const data = load();
  return data.environments.find(e => e.id === data.activeId) || null;
}

export function getAllEnvs() {
  return load().environments;
}

export function getActiveId() {
  return load().activeId;
}

export function resolveVariables(text) {
  if (!text || typeof text !== 'string') return text;
  const env = getActiveEnv();
  if (!env) return text;
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const v = env.variables.find(v => v.key === key.trim() && v.enabled !== false);
    return v ? v.value : match;
  });
}

export function getEnvValue(key) {
  const env = getActiveEnv();
  if (!env) return null;
  const v = env.variables.find(v => v.key === key && v.enabled !== false);
  return v ? v.value : null;
}

export function hasVariables(text) {
  return /\{\{[^}]+\}\}/.test(text || '');
}

export function setEnvVariableByKey(envId, key, value) {
  if (!key || key.trim() === '') return;
  const data = load();
  const env = data.environments.find(e => e.id === envId);
  if (!env) return;
  const k = key.trim();
  const idx = env.variables.findIndex(v => v.key === k);
  if (idx >= 0) {
    env.variables[idx].value = String(value);
  } else {
    env.variables.push({ key: k, value: String(value), description: '', enabled: true, secret: true });
  }
  save(data);
}

// ---- CRUD ----
function createEnv(name, color = '#6366f1') {
  const data = load();
  const env = { id: uid(), name, color, variables: [] };
  data.environments.push(env);
  if (!data.activeId) data.activeId = env.id;
  save(data);
  return env;
}

function deleteEnv(id) {
  const data = load();
  data.environments = data.environments.filter(e => e.id !== id);
  if (data.activeId === id) data.activeId = data.environments[0]?.id || null;
  save(data);
}

function setActiveEnv(id) {
  const data = load();
  data.activeId = id;
  save(data);
}

function renameEnv(id, name) {
  const data = load();
  const env = data.environments.find(e => e.id === id);
  if (env) env.name = name;
  save(data);
}

function setEnvColor(id, color) {
  const data = load();
  const env = data.environments.find(e => e.id === id);
  if (env) env.color = color;
  save(data);
}

function addVariable(envId, variable) {
  const data = load();
  const env = data.environments.find(e => e.id === envId);
  if (env) env.variables.push({ key: '', value: '', description: '', enabled: true, secret: false, ...variable });
  save(data);
}

function updateVariable(envId, index, variable) {
  const data = load();
  const env = data.environments.find(e => e.id === envId);
  if (env && env.variables[index] !== undefined) {
    env.variables[index] = { ...env.variables[index], ...variable };
    save(data);
  }
}

function deleteVariable(envId, index) {
  const data = load();
  const env = data.environments.find(e => e.id === envId);
  if (env) env.variables.splice(index, 1);
  save(data);
}

function duplicateEnv(id) {
  const data = load();
  const src = data.environments.find(e => e.id === id);
  if (!src) return;
  const copy = { ...JSON.parse(JSON.stringify(src)), id: uid(), name: src.name + ' (copy)' };
  data.environments.push(copy);
  save(data);
  return copy;
}


// ---- UI ----
export async function initEnvironments() {
  await loadFromServer();
  renderNavEnvButton();

  const openBtn = document.getElementById('open-env');
  const modal = document.getElementById('env-modal');
  const closeBtn = document.getElementById('close-env');

  openBtn?.addEventListener('click', () => { openModal(); });
  closeBtn?.addEventListener('click', closeModal);
  modal?.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal?.classList.contains('hidden')) closeModal();
  });
}

function openModal() {
  document.getElementById('env-modal').classList.remove('hidden');
  renderModal();
}

function closeModal() {
  document.getElementById('env-modal').classList.add('hidden');
  renderNavEnvButton();
  // Notify try-modal to refresh if open
  document.dispatchEvent(new CustomEvent('env:changed'));
}

// Render the small env button in the navbar
export function renderNavEnvButton() {
  const btn = document.getElementById('open-env');
  if (!btn) return;
  const env = getActiveEnv();
  const dot = btn.querySelector('.env-dot');
  const label = btn.querySelector('.env-label');
  if (env) {
    if (dot) { dot.style.background = env.color; dot.classList.remove('hidden'); }
    if (label) label.textContent = env.name;
    btn.classList.add('border-purple-300', 'text-purple-700', 'bg-purple-50');
    btn.classList.remove('border-gray-200', 'text-gray-600', 'bg-white');
  } else {
    if (dot) dot.classList.add('hidden');
    if (label) label.textContent = 'No Env';
    btn.classList.remove('border-purple-300', 'text-purple-700', 'bg-purple-50');
    btn.classList.add('border-gray-200', 'text-gray-600', 'bg-white');
  }
}

// Render the full modal content dynamically
function renderModal() {
  const data = load();
  renderEnvList(data);
  const activeEnv = data.environments.find(e => e.id === data.activeId);
  if (activeEnv) renderVariables(activeEnv);
  else document.getElementById('env-vars-panel').innerHTML = renderEmptyVarsPanel();
}

function renderEnvList(data) {
  const list = document.getElementById('env-list');
  if (!list) return;

  list.innerHTML = data.environments.map(env => `
    <div class="env-list-item flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${env.id === data.activeId ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-100'}"
         data-env-id="${env.id}">
      <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${env.color}"></span>
      <span class="text-sm font-medium text-gray-700 flex-1 truncate">${escHtml(env.name)}</span>
      ${env.id === data.activeId ? '<svg class="w-3 h-3 text-indigo-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>' : ''}
    </div>
  `).join('') + `
    <button id="add-env-btn" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 transition-colors mt-1">
      <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
      New Environment
    </button>
  `;

  // Bind clicks — dispatch env:changed so token/URL resolve with new env immediately
  list.querySelectorAll('.env-list-item').forEach(item => {
    item.addEventListener('click', () => {
      setActiveEnv(item.dataset.envId);
      renderModal();
      document.dispatchEvent(new CustomEvent('env:changed'));
    });
  });

  list.querySelector('#add-env-btn')?.addEventListener('click', () => {
    const env = createEnv('New Environment');
    renderModal();
  });
}

function renderVariables(env) {
  const panel = document.getElementById('env-vars-panel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="flex items-center gap-3 mb-4">
      <input class="env-name-input flex-1 px-3 py-2 text-sm font-semibold border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
             type="text" value="${escHtml(env.name)}" data-env-id="${env.id}" placeholder="Environment name" />
      <input class="env-color-input w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0 overflow-hidden"
             type="color" value="${env.color}" data-env-id="${env.id}" title="Environment color" />
      <button class="env-duplicate-btn p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors" data-env-id="${env.id}" title="Duplicate">
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M7 9a2 2 0 012-2h6a2 2 0 012 2v6a2 2 0 01-2 2H9a2 2 0 01-2-2V9z"/><path d="M5 3a2 2 0 00-2 2v6a2 2 0 002 2V5h8a2 2 0 00-2-2H5z"/></svg>
      </button>
      <button class="env-delete-btn p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors" data-env-id="${env.id}" title="Delete environment">
        <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
      </button>
    </div>

    <div class="rounded-xl border border-gray-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="w-8 px-3 py-2"></th>
            <th class="text-left px-3 py-2 text-xs font-semibold text-gray-500">Key</th>
            <th class="text-left px-3 py-2 text-xs font-semibold text-gray-500">Value</th>
            <th class="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-40">Description</th>
            <th class="w-8 px-3 py-2"></th>
          </tr>
        </thead>
        <tbody id="vars-tbody">
          ${env.variables.map((v, i) => renderVarRow(env.id, v, i)).join('')}
        </tbody>
      </table>
      <div class="px-3 py-2 bg-gray-50 border-t border-gray-200">
        <button class="add-var-btn text-xs text-indigo-600 hover:text-indigo-800 transition-colors font-medium" data-env-id="${env.id}">
          + Add Variable
        </button>
      </div>
    </div>

    <div class="flex gap-2 mt-4">
      <button class="env-export-btn flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors" data-env-id="${env.id}">
        <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        Export JSON
      </button>
      <label class="flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
        <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
        Import JSON
        <input type="file" accept=".json" class="hidden env-import-file" data-env-id="${env.id}" />
      </label>
    </div>
  `;

  bindVarPanelEvents(env.id);
}

function renderVarRow(envId, v, i) {
  return `
    <tr class="border-t border-gray-100 var-row" data-index="${i}">
      <td class="px-3 py-2">
        <input type="checkbox" class="var-enabled rounded" ${v.enabled !== false ? 'checked' : ''} data-index="${i}" />
      </td>
      <td class="px-3 py-2">
        <input class="var-key w-full px-2 py-1 text-xs border border-gray-200 rounded font-mono focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-transparent"
               type="text" value="${escHtml(v.key)}" placeholder="VARIABLE_NAME" data-index="${i}" />
      </td>
      <td class="px-3 py-2">
        <div class="flex items-center gap-1">
          <input class="var-value flex-1 px-2 py-1 text-xs border border-gray-200 rounded font-mono focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-transparent"
                 type="${v.secret ? 'password' : 'text'}" value="${escHtml(v.value)}" placeholder="value" data-index="${i}" />
          <button class="var-secret-toggle text-gray-400 hover:text-gray-600 flex-shrink-0" data-index="${i}" title="Toggle secret">
            <svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>
          </button>
        </div>
      </td>
      <td class="px-3 py-2">
        <input class="var-desc w-full px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-transparent"
               type="text" value="${escHtml(v.description || '')}" placeholder="optional" data-index="${i}" />
      </td>
      <td class="px-3 py-2">
        <button class="var-delete text-gray-300 hover:text-red-500 transition-colors" data-index="${i}">
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </button>
      </td>
    </tr>
  `;
}

function bindVarPanelEvents(envId) {
  const panel = document.getElementById('env-vars-panel');
  if (!panel) return;

  // Name input
  panel.querySelector('.env-name-input')?.addEventListener('input', e => {
    renameEnv(envId, e.target.value);
  });

  // Color picker
  panel.querySelector('.env-color-input')?.addEventListener('input', e => {
    setEnvColor(envId, e.target.value);
    renderEnvList(load());
  });

  // Duplicate
  panel.querySelector('.env-duplicate-btn')?.addEventListener('click', () => {
    duplicateEnv(envId);
    renderModal();
  });

  // Delete env
  panel.querySelector('.env-delete-btn')?.addEventListener('click', () => {
    if (!confirm('Delete this environment?')) return;
    deleteEnv(envId);
    renderModal();
  });

  // Add variable
  panel.querySelector('.add-var-btn')?.addEventListener('click', () => {
    addVariable(envId, {});
    renderModal();
  });

  // Variable field changes (key, value, desc, enabled, secret)
  const tbody = panel.querySelector('#vars-tbody');
  if (tbody) {
    tbody.addEventListener('input', e => {
      const el = e.target;
      const idx = parseInt(el.dataset.index);
      if (isNaN(idx)) return;
      if (el.classList.contains('var-key')) updateVariable(envId, idx, { key: el.value });
      if (el.classList.contains('var-value')) updateVariable(envId, idx, { value: el.value });
      if (el.classList.contains('var-desc')) updateVariable(envId, idx, { description: el.value });
    });

    tbody.addEventListener('change', e => {
      const el = e.target;
      const idx = parseInt(el.dataset.index);
      if (isNaN(idx)) return;
      if (el.classList.contains('var-enabled')) updateVariable(envId, idx, { enabled: el.checked });
    });

    tbody.querySelectorAll('.var-secret-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index);
        const data = load();
        const env = data.environments.find(e => e.id === envId);
        if (env?.variables[idx]) {
          env.variables[idx].secret = !env.variables[idx].secret;
          save(data);
          renderModal();
        }
      });
    });

    tbody.querySelectorAll('.var-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteVariable(envId, parseInt(btn.dataset.index));
        renderModal();
      });
    });
  }

  // Export
  panel.querySelector('.env-export-btn')?.addEventListener('click', () => {
    const data = load();
    const env = data.environments.find(e => e.id === envId);
    if (!env) return;
    const blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${env.name.replace(/\s+/g, '-')}-env.json`;
    a.click();
  });

  // Import
  panel.querySelector('.env-import-file')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        const data = load();
        const env = data.environments.find(e => e.id === envId);
        if (env && Array.isArray(imported.variables)) {
          env.variables = [...env.variables, ...imported.variables];
          save(data);
          renderModal();
        }
      } catch { alert('Invalid JSON file'); }
    };
    reader.readAsText(file);
  });
}

function renderEmptyVarsPanel() {
  return `<div class="flex flex-col items-center justify-center h-48 text-gray-400">
    <svg class="w-8 h-8 mb-2" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/></svg>
    <p class="text-sm">Select or create an environment</p>
  </div>`;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
