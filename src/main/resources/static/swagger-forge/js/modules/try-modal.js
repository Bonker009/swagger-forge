import { getAuthHeaders, getAuthQueryParams, getAuthConfig } from './auth.js';
import { generateCurl, copyToClipboard } from './curl.js';
import { showToast } from './toast.js';
import { resolveVariables, getActiveEnv, hasVariables } from './environments.js';

// ---- Init (event delegation for all inline try sections) ----
export function initTryModal() {
  document.addEventListener('click', e => {
    // Tab switch
    const tabBtn = e.target.closest('.try-tab-btn');
    if (tabBtn) {
      const c = tabBtn.closest('.try-inline');
      if (c) switchTab(c, tabBtn.dataset.tab);
      return;
    }

    // Response tab switch
    const resTab = e.target.closest('.try-res-tab');
    if (resTab) {
      const c = resTab.closest('.try-inline');
      if (c) switchResTab(c, resTab.dataset.res);
      return;
    }

    // Send
    const sendBtn = e.target.closest('.try-send-btn');
    if (sendBtn) {
      const c = sendBtn.closest('.try-inline');
      if (c) sendRequest(c);
      return;
    }

    // Add query row
    const addQueryBtn = e.target.closest('.add-query-btn');
    if (addQueryBtn) {
      const c = addQueryBtn.closest('.try-inline');
      if (c) addQueryRow(c);
      return;
    }

    // Add header row
    const addHeaderBtn = e.target.closest('.add-header-btn');
    if (addHeaderBtn) {
      const c = addHeaderBtn.closest('.try-inline');
      if (c) addHeaderRow(c);
      return;
    }

    // Copy cURL
    const copyCurlBtn = e.target.closest('.try-copy-curl');
    if (copyCurlBtn) {
      const c = copyCurlBtn.closest('.try-inline');
      if (c) copyToClipboard(buildCurl(c)).then(() => showToast('cURL copied', 'info'));
      return;
    }

    // Copy response
    const copyRespBtn = e.target.closest('.try-copy-response');
    if (copyRespBtn) {
      const c = copyRespBtn.closest('.try-inline');
      const panel = c?.querySelector('.try-response');
      const activeTab = c?.querySelector('.try-res-tab.response-tab-active')?.dataset?.res;
      let text = '';
      if (activeTab === 'pretty' && panel?.dataset?.responsePretty) text = panel.dataset.responsePretty;
      else if (activeTab === 'raw') text = c?.querySelector('.try-res-raw')?.textContent ?? '';
      else if (activeTab === 'headers') text = c?.querySelector('.try-res-headers')?.textContent ?? '';
      else if (activeTab === 'curl') text = c?.querySelector('.try-res-curl')?.textContent ?? '';
      else text = panel?.dataset?.responsePretty ?? c?.querySelector('.try-res-pretty')?.textContent ?? '';
      copyToClipboard(text).then(() => showToast('Response copied', 'info'));
      return;
    }

    // Format body
    const formatBtn = e.target.closest('.try-format-body');
    if (formatBtn) {
      const c = formatBtn.closest('.try-inline');
      if (c) formatBody(c);
      return;
    }

    // Clear body
    const clearBtn = e.target.closest('.try-clear-body');
    if (clearBtn) {
      const bodyInput = clearBtn.closest('.try-inline')?.querySelector('.try-body-input');
      if (bodyInput) bodyInput.value = '';
      return;
    }

    // Enum quick-pick
    const enumBtn = e.target.closest('.enum-pick');
    if (enumBtn) {
      const c = enumBtn.closest('.try-inline');
      const input = enumBtn.closest('.flex-1')?.querySelector('.try-path-param');
      if (input) { input.value = enumBtn.dataset.value; if (c) updateUrl(c); }
      return;
    }

    // Remove dynamic row
    const removeBtn = e.target.closest('.remove-row-btn');
    if (removeBtn) {
      const c = removeBtn.closest('.try-inline');
      removeBtn.closest('.dynamic-row')?.remove();
      if (c) updateUrl(c);
    }
  });

  // Live URL resolve + param→URL sync
  document.addEventListener('input', e => {
    const c = e.target.closest('.try-inline');
    if (!c) return;

    if (e.target.matches('.try-url-input')) {
      refreshResolvedUrl(c);
    } else if (e.target.matches('.try-path-param, .try-query-param') ||
               e.target.closest('.dynamic-row')) {
      updateUrl(c);
    }
  });

  // Refresh auth preview on auth change
  document.addEventListener('auth:changed', () => {
    document.querySelectorAll('.try-inline:not(.hidden)').forEach(renderAuthPreview);
  });

  // Refresh resolved URL and auth preview on env change (token comes from current env)
  document.addEventListener('env:changed', () => {
    document.querySelectorAll('.try-inline:not(.hidden)').forEach(c => {
      refreshResolvedUrl(c);
      renderAuthPreview(c);
    });
  });
}

// Called by endpoints.js when opening a try-inline section
export function initInlineTry(container) {
  const path = container.dataset.path;
  const method = container.dataset.method.toLowerCase();

  // Set URL
  const server = document.getElementById('server-selector')?.value || '';
  const urlInput = container.querySelector('.try-url-input');
  if (urlInput) urlInput.value = server + path;

  refreshResolvedUrl(container);
  renderAuthPreview(container);

  // Pre-fill body from schema (so we show example body instead of {})
  const bodyInput = container.querySelector('.try-body-input');
  if (bodyInput) {
    const op = window.__SF?.spec?.paths?.[path]?.[method];
    const rawSchema = op?.requestBody?.content?.['application/json']?.schema;
    const spec = window.__SF?.spec;
    const bodyEmpty = !bodyInput.value || bodyInput.value.trim() === '' || bodyInput.value.trim() === '{}';
    if (rawSchema && bodyEmpty && spec) {
      const schema = resolveSchemaRef(rawSchema, spec);
      bodyInput.value = JSON.stringify(buildExample(schema, 0, spec), null, 2);
    } else if (bodyEmpty) {
      bodyInput.value = '{}';
    }
  }

  // Activate params tab
  switchTab(container, 'params');
}

// ---- Tab helpers ----
function switchTab(container, tabName) {
  container.querySelectorAll('.try-tab-btn').forEach(btn => {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle('border-indigo-500', active);
    btn.classList.toggle('text-indigo-600', active);
    btn.classList.toggle('border-transparent', !active);
    btn.classList.toggle('text-gray-500', !active);
  });
  container.querySelectorAll('.try-pane').forEach(pane => {
    pane.classList.toggle('hidden', pane.dataset.pane !== tabName);
  });
}

function switchResTab(container, tabName) {
  container.querySelectorAll('.try-res-tab').forEach(btn => {
    const active = btn.dataset.res === tabName;
    btn.classList.toggle('response-tab-active', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('text-gray-400', !active);
  });
  const prettyEl = container.querySelector('.try-res-pretty');
  const rawEl = container.querySelector('.try-res-raw');
  const headersEl = container.querySelector('.try-res-headers');
  const curlEl = container.querySelector('.try-res-curl');
  [prettyEl, rawEl, headersEl, curlEl].forEach((el, i) => {
    if (el) el.classList.toggle('hidden', ['pretty', 'raw', 'headers', 'curl'][i] !== tabName);
  });
}

// ---- URL helpers ----
function refreshResolvedUrl(container) {
  const url = container.querySelector('.try-url-input')?.value || '';
  const resolvedEl = container.querySelector('.try-url-resolved');
  const resolvedText = container.querySelector('.try-url-resolved-text');
  if (!resolvedEl) return;
  if (hasVariables(url)) {
    resolvedEl.classList.remove('hidden');
    if (resolvedText) resolvedText.textContent = resolveVariables(url);
  } else {
    resolvedEl.classList.add('hidden');
  }
}

function updateUrl(container) {
  const server = document.getElementById('server-selector')?.value || '';
  let path = container.dataset.path;

  // Path params
  container.querySelectorAll('.try-path-param').forEach(input => {
    const name = input.dataset.param;
    const val = resolveVariables(input.value) || `{${name}}`;
    path = path.replace(`{${name}}`, encodeURIComponent(val));
  });

  // Spec query params
  const queryParts = [];
  container.querySelectorAll('.try-query-param').forEach(input => {
    const name = input.dataset.param;
    const val = resolveVariables(input.value);
    if (name && val) queryParts.push(`${encodeURIComponent(name)}=${encodeURIComponent(val)}`);
  });

  // Dynamic query rows
  container.querySelectorAll('.dynamic-row[data-row-type="query"]').forEach(row => {
    const inputs = row.querySelectorAll('input');
    if (inputs.length >= 2 && inputs[0].value) {
      queryParts.push(`${encodeURIComponent(inputs[0].value)}=${encodeURIComponent(resolveVariables(inputs[1].value))}`);
    }
  });

  // Auth query params
  Object.entries(getAuthQueryParams()).forEach(([k, v]) =>
    queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  );

  const urlInput = container.querySelector('.try-url-input');
  if (urlInput) urlInput.value = server + path + (queryParts.length ? '?' + queryParts.join('&') : '');
  refreshResolvedUrl(container);
}

// ---- Auth preview ----
function renderAuthPreview(container) {
  const el = container.querySelector('.try-auth-preview');
  if (!el) return;
  const authCfg = getAuthConfig();
  const authHeaders = getAuthHeaders();
  const entries = Object.entries(authHeaders);
  const labels = { bearer: 'Bearer Token', apikey: 'API Key', basic: 'Basic Auth' };

  if (!authCfg.type || authCfg.type === 'none' || entries.length === 0) {
    el.innerHTML = `<p class="text-xs text-gray-400 italic">No auth — <button class="text-indigo-500 hover:underline" onclick="document.getElementById('open-auth').click()">configure</button></p>`;
    return;
  }
  el.innerHTML = `
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-green-600">${labels[authCfg.type] || authCfg.type}</span>
      ${entries.map(([k, v]) => `<span class="text-xs font-mono text-gray-500">${escHtml(k)}: ${escHtml(v.slice(0, 32))}${v.length > 32 ? '…' : ''}</span>`).join('')}
    </div>`;
}

// ---- Header/query row builders ----
function addQueryRow(container) {
  const rows = container.querySelector('.try-query-rows');
  if (!rows) return;
  const row = document.createElement('div');
  row.className = 'dynamic-row flex items-center gap-2';
  row.dataset.rowType = 'query';
  row.innerHTML = `
    <input class="w-28 px-2 py-1 text-xs border border-gray-200 rounded-lg font-mono" type="text" placeholder="key">
    <input class="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg font-mono" type="text" placeholder="value">
    <button class="remove-row-btn text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">&times;</button>`;
  rows.appendChild(row);
}

function addHeaderRow(container) {
  const rows = container.querySelector('.try-header-rows');
  if (!rows) return;
  const row = document.createElement('div');
  row.className = 'dynamic-row flex items-center gap-2';
  row.dataset.rowType = 'header';
  row.innerHTML = `
    <input class="w-32 px-2 py-1 text-xs border border-gray-200 rounded-lg font-mono" type="text" placeholder="Header-Name">
    <input class="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg font-mono" type="text" placeholder="value">
    <button class="remove-row-btn text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">&times;</button>`;
  rows.appendChild(row);
}

// ---- Collect headers ----
function collectHeaders(container) {
  const headers = {};
  container.querySelectorAll('.dynamic-row[data-row-type="header"]').forEach(row => {
    const inputs = row.querySelectorAll('input');
    const k = inputs[0]?.value?.trim();
    const v = inputs[1]?.value?.trim();
    if (k && v) headers[k] = resolveVariables(v);
  });
  return headers;
}

// ---- cURL ----
function buildCurl(container) {
  const url = resolveVariables(container.querySelector('.try-url-input')?.value || '');
  const method = container.dataset.method;
  const customHeaders = collectHeaders(container);
  const bodyPane = container.querySelector('[data-pane="body"]');
  const hasBody = bodyPane && !bodyPane.classList.contains('hidden');
  const body = hasBody ? container.querySelector('.try-body-input')?.value || null : null;
  return generateCurl({ method, url, headers: customHeaders, body });
}

// ---- Format body ----
function formatBody(container) {
  const bodyInput = container.querySelector('.try-body-input');
  if (!bodyInput) return;
  try {
    bodyInput.value = JSON.stringify(JSON.parse(bodyInput.value), null, 2);
  } catch {
    showToast('Invalid JSON', 'error');
  }
}

// ---- Send request ----
async function sendRequest(container) {
  const sendBtn = container.querySelector('.try-send-btn');
  const loadingEl = container.querySelector('.try-loading');
  const responseEl = container.querySelector('.try-response');

  sendBtn.disabled = true;
  loadingEl?.classList.remove('hidden');

  const rawUrl = container.querySelector('.try-url-input')?.value || '';
  const url = resolveVariables(rawUrl);
  const method = container.dataset.method.toUpperCase();
  const authHeaders = getAuthHeaders();
  const customHeaders = collectHeaders(container);
  const contentType = container.querySelector('.try-content-type')?.value || 'application/json';
  const bodyPane = container.querySelector('[data-pane="body"]');
  const hasBody = bodyPane && !bodyPane.classList.contains('hidden') &&
    ['POST', 'PUT', 'PATCH'].includes(method);
  const rawBody = hasBody ? container.querySelector('.try-body-input')?.value || null : null;
  const bodyText = rawBody ? resolveVariables(rawBody) : null;

  const reqHeaders = { ...authHeaders, ...customHeaders };
  if (bodyText) reqHeaders['Content-Type'] = contentType;

  const startTime = Date.now();

  try {
    const proxyRes = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, method, headers: reqHeaders, body: bodyText || undefined }),
      signal: AbortSignal.timeout(35000)
    });

    const proxyData = await proxyRes.json();

    if (!proxyRes.ok && proxyData.error) {
      throw new Error(proxyData.error);
    }

    const elapsed = Date.now() - startTime;
    const text = proxyData.body || '';
    const status = proxyData.status;
    const statusText = proxyData.statusText;
    const ok = status >= 200 && status < 300;
    const redirect = status >= 300 && status < 400;
    const statusClass = ok ? 'text-green-400' : redirect ? 'text-yellow-400' : 'text-red-400';

    let pretty = text;
    try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch {}

    const headersText = Object.entries(proxyData.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');

    responseEl?.classList.remove('hidden');

    const statusBadge = container.querySelector('.try-status-badge');
    if (statusBadge) {
      statusBadge.textContent = `${status} ${statusText}`;
      statusBadge.className = `try-status-badge response-status font-mono text-sm font-bold ${statusClass}`;
    }

    const timeEl = container.querySelector('.try-resp-time');
    const sizeEl = container.querySelector('.try-resp-size');
    if (timeEl) timeEl.textContent = `${elapsed}ms`;
    if (sizeEl) sizeEl.textContent = `${(new TextEncoder().encode(text).length / 1024).toFixed(1)}kb`;

    const prettyEl = container.querySelector('.try-res-pretty');
    const rawEl = container.querySelector('.try-res-raw');
    const headersEl = container.querySelector('.try-res-headers');
    const curlEl = container.querySelector('.try-res-curl');
    if (prettyEl) {
      try {
        const parsed = JSON.parse(text);
        prettyEl.innerHTML = renderJsonHighlight(parsed);
        bindResponseCopyButtons(container);
      } catch {
        prettyEl.textContent = pretty;
      }
    }
    if (rawEl) rawEl.textContent = text;
    if (headersEl) headersEl.textContent = headersText;
    if (curlEl) curlEl.textContent = buildCurl(container);

    const responsePanel = container.querySelector('.try-response');
    if (responsePanel) responsePanel.dataset.responsePretty = pretty;

    switchResTab(container, 'pretty');
    responseEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    responseEl?.classList.remove('hidden');
    const statusBadge = container.querySelector('.try-status-badge');
    if (statusBadge) {
      statusBadge.textContent = 'Error';
      statusBadge.className = 'try-status-badge response-status font-mono text-sm font-bold text-red-400';
    }
    const prettyEl = container.querySelector('.try-res-pretty');
    if (prettyEl) {
      prettyEl.textContent = '';
      prettyEl.innerHTML = '';
      prettyEl.textContent = `${err.name}: ${err.message}`;
    }
  } finally {
    sendBtn.disabled = false;
    loadingEl?.classList.add('hidden');
  }
}

// ---- JSON syntax highlighting for response ----
const MAX_STRING_LEN = 80;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderJsonHighlight(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const pad2 = '  '.repeat(indent + 1);
  if (value === null) return `<span class="res-null">null</span>`;
  if (value === true) return `<span class="res-bool">true</span>`;
  if (value === false) return `<span class="res-bool">false</span>`;
  if (typeof value === 'number') return `<span class="res-num">${escapeHtml(String(value))}</span>`;
  if (typeof value === 'string') {
    const escaped = escapeHtml(JSON.stringify(value));
    if (value.length <= MAX_STRING_LEN) return `<span class="res-str">${escaped}</span>`;
    const fullEscaped = escapeAttr(value);
    const truncated = escapeHtml(value.slice(0, MAX_STRING_LEN));
    return `<span class="res-long-wrap"><span class="res-str">"</span><span class="res-long-str res-str" title="${value.length} chars">${truncated}…</span><span class="res-str">"</span><button type="button" class="res-copy-val" data-value="${fullEscaped}">Copy</button></span>`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '<span class="res-punc">[]</span>';
    const parts = value.map((v, i) => `${pad2}${renderJsonHighlight(v, indent + 1)}`).join(',\n');
    return `<span class="res-punc">[</span>\n${parts}\n${pad}<span class="res-punc">]</span>`;
  }
  const entries = Object.entries(value);
  if (entries.length === 0) return '<span class="res-punc">{}</span>';
  const lines = entries.map(([k, v]) => {
    const key = escapeHtml(JSON.stringify(k));
    const val = renderJsonHighlight(v, indent + 1);
    return `${pad2}<span class="res-key">${key}</span><span class="res-punc">: </span>${val}`;
  });
  return `<span class="res-punc">{</span>\n${lines.join(',\n')}\n${pad}<span class="res-punc">}</span>`;
}

function bindResponseCopyButtons(container) {
  container.querySelectorAll('.res-copy-val').forEach(btn => {
    btn.replaceWith(btn.cloneNode(true));
  });
  container.querySelectorAll('.res-copy-val').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const value = btn.getAttribute('data-value');
      if (value != null) copyToClipboard(value).then(() => showToast('Value copied', 'info'));
    });
  });
}

// ---- Schema ref resolution (for request body example) ----
function resolveSchemaRef(schema, spec, depth = 0) {
  if (!schema || !spec || depth > 5) return schema;
  if (schema.$ref && typeof schema.$ref === 'string') {
    const match = schema.$ref.match(/^#\/components\/schemas\/(.+)$/);
    if (match) {
      const name = match[1];
      const resolved = spec.components?.schemas?.[name];
      if (resolved) return resolveSchemaRef(resolved, spec, depth + 1);
    }
    return schema;
  }
  return schema;
}

// ---- Schema example builder ----
function buildExample(schema, depth = 0, spec = null) {
  if (!schema || depth > 4) return {};
  if (schema.example !== undefined) return schema.example;
  if (schema.$ref && spec) {
    const resolved = resolveSchemaRef(schema, spec, 0);
    if (resolved !== schema) return buildExample(resolved, depth, spec);
  }
  if (schema.$ref) return {};
  if (schema.type === 'object' && schema.properties) {
    const obj = {};
    for (const [k, v] of Object.entries(schema.properties)) obj[k] = buildExample(v, depth + 1, spec);
    return obj;
  }
  if (schema.type === 'array') return [buildExample(schema.items || {}, depth + 1, spec)];
  if (schema.type === 'string') {
    if (schema.enum?.length) return schema.enum[0];
    if (schema.format === 'email') return 'user@example.com';
    if (schema.format === 'date-time') return new Date().toISOString();
    if (schema.format === 'uuid') return '00000000-0000-0000-0000-000000000000';
    if (schema.format === 'password') return '••••••••';
    return schema.default ?? 'string';
  }
  if (schema.type === 'integer' || schema.type === 'number') return schema.default ?? schema.minimum ?? 0;
  if (schema.type === 'boolean') return true;
  return {};
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
