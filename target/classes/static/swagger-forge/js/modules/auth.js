import { showToast } from './toast.js';
import { resolveVariables, getActiveId, setEnvVariableByKey } from './environments.js';

const STORAGE_KEY = 'swaggerforge_auth';

export function initAuth() {
  const openBtn = document.getElementById('open-auth');
  const closeBtn = document.getElementById('close-auth');
  const saveBtn = document.getElementById('save-auth');
  const clearBtn = document.getElementById('clear-auth');
  const modal = document.getElementById('auth-modal');

  openBtn?.addEventListener('click', () => openModal());
  closeBtn?.addEventListener('click', () => closeModal());
  modal?.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);

  // Auth type radio change
  document.querySelectorAll('input[name="auth-type"]').forEach(radio => {
    radio.addEventListener('change', () => showAuthFields(radio.value));
  });

  // Toggle password visibility
  document.querySelectorAll('.toggle-secret').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  saveBtn?.addEventListener('click', saveAuth);
  clearBtn?.addEventListener('click', clearAuth);

  // Get token from login (Postman-style: run login, save token to current env)
  document.getElementById('get-token-btn')?.addEventListener('click', getTokenFromLogin);

  // When env switches, auto run get-token for the new env if config is set
  document.addEventListener('env:changed', () => tryAutoGetTokenForCurrentEnv());

  // Load saved auth on start
  loadSavedAuth();
}

function openModal() {
  document.getElementById('auth-modal').classList.remove('hidden');
  loadSavedAuth();
}

function closeModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function showAuthFields(type) {
  document.querySelectorAll('.auth-fields').forEach(el => el.classList.add('hidden'));
  const fields = document.getElementById(`auth-fields-${type}`);
  if (fields) fields.classList.remove('hidden');

  // Update radio
  const radio = document.querySelector(`input[name="auth-type"][value="${type}"]`);
  if (radio) radio.checked = true;

  // Update option card styling
  document.querySelectorAll('.auth-type-option').forEach(opt => {
    opt.classList.toggle('border-indigo-500', opt.dataset.authType === type);
    opt.classList.toggle('border-gray-200', opt.dataset.authType !== type);
  });
}

function saveAuth() {
  const type = document.querySelector('input[name="auth-type"]:checked')?.value || 'none';
  const auth = { type };

  if (type === 'bearer') {
    auth.token = document.getElementById('auth-bearer-token')?.value || '';
    auth.getTokenConfig = {
      url: document.getElementById('get-token-url')?.value?.trim() || '',
      body: document.getElementById('get-token-body')?.value?.trim() || '',
      responsePath: document.getElementById('get-token-path')?.value?.trim() || 'data.accessToken',
      varName: document.getElementById('get-token-var')?.value?.trim() || 'accessToken'
    };
  } else if (type === 'apikey') {
    auth.keyName = document.getElementById('auth-apikey-name')?.value || 'X-API-Key';
    auth.keyValue = document.getElementById('auth-apikey-value')?.value || '';
    auth.keyIn = document.querySelector('input[name="apikey-in"]:checked')?.value || 'header';
  } else if (type === 'basic') {
    auth.username = document.getElementById('auth-basic-user')?.value || '';
    auth.password = document.getElementById('auth-basic-pass')?.value || '';
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  updateAuthIndicator(type !== 'none');
  closeModal();
  showToast('Auth settings saved');
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
  showAuthFields('none');
  updateAuthIndicator(false);
  showToast('Auth cleared', 'info');
}

function loadSavedAuth() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!saved.type) return;

    showAuthFields(saved.type);

    if (saved.type === 'bearer' && saved.token) {
      const el = document.getElementById('auth-bearer-token');
      if (el) el.value = saved.token;
      const cfg = saved.getTokenConfig;
      if (cfg) {
        const urlEl = document.getElementById('get-token-url');
        const bodyEl = document.getElementById('get-token-body');
        const pathEl = document.getElementById('get-token-path');
        const varEl = document.getElementById('get-token-var');
        if (urlEl && cfg.url !== undefined) urlEl.value = cfg.url;
        if (bodyEl && cfg.body !== undefined) bodyEl.value = cfg.body;
        if (pathEl && cfg.responsePath !== undefined) pathEl.value = cfg.responsePath;
        if (varEl && cfg.varName !== undefined) varEl.value = cfg.varName;
      }
    } else if (saved.type === 'apikey') {
      const nameEl = document.getElementById('auth-apikey-name');
      const valEl = document.getElementById('auth-apikey-value');
      if (nameEl) nameEl.value = saved.keyName || 'X-API-Key';
      if (valEl) valEl.value = saved.keyValue || '';
      const radioIn = document.querySelector(`input[name="apikey-in"][value="${saved.keyIn || 'header'}"]`);
      if (radioIn) radioIn.checked = true;
    } else if (saved.type === 'basic') {
      const userEl = document.getElementById('auth-basic-user');
      const passEl = document.getElementById('auth-basic-pass');
      if (userEl) userEl.value = saved.username || '';
      if (passEl) passEl.value = saved.password || '';
    }

    updateAuthIndicator(saved.type !== 'none');
  } catch {}
}

function updateAuthIndicator(active) {
  const iconLock = document.getElementById('auth-icon-lock');
  const iconUnlock = document.getElementById('auth-icon-unlock');
  const btn = document.getElementById('open-auth');
  if (!btn) return;
  if (active) {
    btn.classList.add('border-green-400', 'text-green-600', 'bg-green-50');
    btn.classList.remove('border-gray-200', 'text-gray-600', 'bg-white');
    if (iconLock) iconLock.classList.add('hidden');
    if (iconUnlock) iconUnlock.classList.remove('hidden');
  } else {
    btn.classList.remove('border-green-400', 'text-green-600', 'bg-green-50');
    btn.classList.add('border-gray-200', 'text-gray-600', 'bg-white');
    if (iconLock) iconLock.classList.remove('hidden');
    if (iconUnlock) iconUnlock.classList.add('hidden');
  }
}

export function getAuthHeaders() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!saved.type || saved.type === 'none') return {};

    if (saved.type === 'bearer' && saved.token) {
      const token = resolveVariables(saved.token);
      if (token) return { Authorization: `Bearer ${token}` };
    }
    if (saved.type === 'apikey' && saved.keyValue && saved.keyIn === 'header') {
      const value = resolveVariables(saved.keyValue);
      if (value) return { [saved.keyName || 'X-API-Key']: value };
    }
    if (saved.type === 'basic' && saved.username) {
      const user = resolveVariables(saved.username);
      const pass = resolveVariables(saved.password || '');
      if (user) {
        const encoded = btoa(`${user}:${pass}`);
        return { Authorization: `Basic ${encoded}` };
      }
    }
  } catch {}
  return {};
}

export function getAuthQueryParams() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved.type === 'apikey' && saved.keyValue && saved.keyIn === 'query') {
      const value = resolveVariables(saved.keyValue);
      if (value) return { [saved.keyName || 'api_key']: value };
    }
  } catch {}
  return {};
}

export function getAuthConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch { return {}; }
}

// ---- Get token from login (Postman-style) ----
function getValueByPath(obj, path) {
  if (!path || typeof path !== 'string') return undefined;
  const parts = path.trim().split('.').filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

/** Run login request and save token to env. Used by manual "Get token" and by auto-get on env switch. */
async function fetchTokenAndSaveToEnv(loginUrl, bodyRaw, responsePath, varName, envId) {
  let requestBody = '{}';
  if (bodyRaw && bodyRaw.trim()) {
    try {
      const resolved = resolveVariables(bodyRaw);
      requestBody = JSON.stringify(JSON.parse(resolved));
    } catch {
      return { success: false, error: 'Request body must be valid JSON' };
    }
  }

  const res = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: loginUrl,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody
    }),
    signal: AbortSignal.timeout(15000)
  });

  const data = await res.json();
  if (!res.ok) return { success: false, error: data.error || `HTTP ${res.status}` };

  let json;
  try {
    json = JSON.parse(data.body || '');
  } catch {
    return { success: false, error: 'Login response is not JSON' };
  }

  const token = getValueByPath(json, responsePath);
  if (token == null || token === '') {
    return { success: false, error: `No value at path "${responsePath}"` };
  }

  const tokenStr = typeof token === 'string' ? token : String(token);
  setEnvVariableByKey(envId, varName, tokenStr);
  return { success: true, varName };
}

/** When user switches env: if Bearer + get-token URL is configured, auto run get-token for the new env. */
async function tryAutoGetTokenForCurrentEnv() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved.type !== 'bearer' || !saved.getTokenConfig || !saved.getTokenConfig.url) return;

    const envId = getActiveId();
    if (!envId) return;

    const cfg = saved.getTokenConfig;
    const loginUrl = resolveVariables(cfg.url);
    if (!loginUrl) return;

    const result = await fetchTokenAndSaveToEnv(
      loginUrl,
      cfg.body || '',
      cfg.responsePath || 'data.accessToken',
      cfg.varName || 'accessToken',
      envId
    );

    if (result.success) {
      document.dispatchEvent(new CustomEvent('auth:changed'));
      showToast(`Token refreshed for current environment`);
    } else {
      showToast(result.error || 'Token refresh failed', 'error');
    }
  } catch (err) {
    showToast(err.message || 'Token refresh failed', 'error');
  }
}

async function getTokenFromLogin() {
  const urlInput = document.getElementById('get-token-url');
  const bodyInput = document.getElementById('get-token-body');
  const pathInput = document.getElementById('get-token-path');
  const varInput = document.getElementById('get-token-var');
  const btn = document.getElementById('get-token-btn');

  const loginUrl = resolveVariables(urlInput?.value?.trim() || '');
  const bodyRaw = bodyInput?.value?.trim() || '';
  const responsePath = pathInput?.value?.trim() || 'data.accessToken';
  const varName = varInput?.value?.trim() || 'accessToken';

  if (!loginUrl) {
    showToast('Enter a login URL', 'error');
    return;
  }

  const envId = getActiveId();
  if (!envId) {
    showToast('Select an environment first', 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Requesting…';

  try {
    const result = await fetchTokenAndSaveToEnv(loginUrl, bodyRaw, responsePath, varName, envId);

    if (result.success) {
      const bearerInput = document.getElementById('auth-bearer-token');
      if (bearerInput) bearerInput.value = `{{${result.varName}}}`;
      saveAuth();
      document.dispatchEvent(new CustomEvent('env:changed'));
      showToast(`Token saved to ${result.varName} in current environment`);
    } else {
      showToast(result.error || 'Get token failed', 'error');
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg><span>Get token and save to current environment</span>';
  }
}
