/**
 * Build sidebar and main content DOM from an OpenAPI spec object.
 * Used when the page is loaded with spec in __SF (e.g. from Spring Boot) but empty DOM,
 * or when spec is loaded from specUrl (embed mode).
 */
function esc(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function cardId(method, path) {
  return method + '-' + path.replace(/\//g, '-').replace(/[{}]/g, '');
}

function requiresAuth(spec, path, op) {
  const pathObj = spec?.paths?.[path];
  const sec = op?.security ?? pathObj?.security ?? spec?.security;
  return Array.isArray(sec) && sec.length > 0 && sec.some(s => s && typeof s === 'object' && Object.keys(s).length > 0);
}

function pathParamNames(path) {
  return [...path.matchAll(/\{([^}]+)\}/g)].map(m => m[1]);
}

export function renderFromSpec(spec) {
  if (!spec || !spec.paths) return;
  const tags = spec.tags || [];
  const paths = spec.paths;
  const servers = spec.servers || [];
  const info = spec.info || { title: 'API', version: '1.0' };

  // Navbar
  const titleEl = document.getElementById('spec-title');
  const versionEl = document.getElementById('spec-version');
  const serverSelect = document.getElementById('server-selector');
  if (titleEl) titleEl.textContent = info.title || 'API';
  if (versionEl) versionEl.textContent = 'v' + (info.version || '1.0');
  if (serverSelect) {
    serverSelect.innerHTML = servers.map(s => `<option value="${esc(s.url)}">${esc(s.url + (s.description ? ' — ' + s.description : ''))}</option>`).join('');
  }

  // Sidebar: spec info block (inside .sidebar-expanded)
  const specInfoBlock = document.querySelector('#endpoint-groups')?.closest('.sidebar-expanded')?.querySelector('.mb-3.p-3.rounded-xl');
  if (specInfoBlock) {
    const totalEndpoints = Object.values(paths).reduce((n, ms) => n + Object.keys(ms).length, 0);
    specInfoBlock.innerHTML = `
      <div class="flex items-start justify-between gap-2 mb-1">
        <p class="text-xs font-semibold text-indigo-700 truncate">${esc(info.title)}</p>
        <span class="px-1.5 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-600 font-mono flex-shrink-0">v${esc(info.version)}</span>
      </div>
      ${info.description ? `<p class="text-xs text-gray-500 truncate">${esc(info.description)}</p>` : ''}
      <div class="flex gap-1 mt-2 flex-wrap">
        <span class="px-1.5 py-0.5 text-xs rounded bg-white text-purple-600 border border-purple-100 font-mono">OAS ${esc(spec.openapi || spec.swagger || '3')}</span>
        <span class="px-1.5 py-0.5 text-xs rounded bg-white text-gray-500 border border-gray-200">${totalEndpoints} endpoints</span>
      </div>`;
  }

  // Sidebar: endpoint groups
  const groupsEl = document.getElementById('endpoint-groups');
  if (groupsEl) {
    let html = '';
    for (const tag of tags) {
      const tagCount = Object.entries(paths).reduce((n, [p, ms]) => n + Object.values(ms).filter(op => op.tags && op.tags.includes(tag.name)).length, 0);
      html += `
        <div class="mb-1">
          <button class="tag-group-btn w-full flex items-center justify-between px-2 py-2 text-sm font-semibold text-gray-700 rounded-lg transition-colors hover:bg-gray-100 border-0 bg-transparent cursor-pointer text-left" data-tag="${esc(tag.name)}">
            <div class="flex items-center gap-2 min-w-0">
              <span class="truncate">${esc(tag.name)}</span>
              <span class="px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 flex-shrink-0">${tagCount}</span>
            </div>
            <svg class="tag-chevron w-4 h-4 text-gray-400 transition-transform flex-shrink-0 rotated" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
          </button>
          <div class="tag-endpoints pl-1" data-tag="${esc(tag.name)}">`;
      for (const [path, methods] of Object.entries(paths)) {
        for (const [method, op] of Object.entries(methods)) {
          if (!op || typeof op !== 'object' || !op.tags || !op.tags.includes(tag.name)) continue;
          const pathObj = paths[path];
          const auth = requiresAuth(spec, path, op);
          const href = '#' + cardId(method, path);
          html += `<a class="sidebar-link endpoint-link flex items-center gap-2 pl-2 pr-1 mt-1 rounded-lg text-xs text-gray-600 cursor-pointer transition-colors py-1.5 hover:bg-gray-100" data-path="${esc(path)}" data-method="${esc(method)}" data-tag="${esc(tag.name)}" href="${esc(href)}">
            <span class="method-badge flex-shrink-0 method-${esc(method.toLowerCase())}">${esc(method.toUpperCase())}</span>
            <span class="truncate flex-1">${esc(path)}</span>
            ${auth ? '<svg class="w-3 h-3 text-amber-600 flex-shrink-0" title="Requires authentication" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>' : ''}
          </a>`;
        }
      }
      html += '</div></div>';
    }
    groupsEl.innerHTML = html;
  }

  // Main content: API info + tag sections + endpoint cards
  const mainEl = document.getElementById('main-content');
  if (!mainEl) return;

  let mainHtml = `
    <div class="api-card rounded-xl p-5 mb-6 border border-gray-200 bg-white">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">${esc(info.title)}</h1>
          ${info.description ? `<p class="text-gray-500 text-sm mb-3">${esc(info.description)}</p>` : ''}
          <div class="flex flex-wrap gap-2">
            <span class="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-mono">OpenAPI ${esc(spec.openapi || spec.swagger || '3')}</span>
            <span class="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-mono">v${esc(info.version)}</span>
          </div>
        </div>
        <div class="flex-shrink-0 text-right">
          <p class="text-xs text-gray-400 mb-1">Servers</p>
          ${servers.map(s => `<p class="text-xs font-mono text-indigo-600 truncate max-w-xs">${esc(s.url)}</p>`).join('')}
        </div>
      </div>
    </div>`;

  // Tag sections with endpoint cards
  for (const tag of tags) {
    const tagEndpoints = [];
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(methods)) {
        if (op && typeof op === 'object' && op.tags && op.tags.includes(tag.name)) tagEndpoints.push({ path, method, op });
      }
    }
    if (tagEndpoints.length === 0) continue;
    mainHtml += `<div class="tag-section mb-8" data-tag="${esc(tag.name)}">
      <div class="flex items-center gap-3 mb-3">
        <span class="h-6 rounded-full bg-indigo-500 inline-block w-1.5"></span>
        <h2 class="text-base font-bold text-gray-800">${esc(tag.name)}</h2>
        <span class="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">${tagEndpoints.length} endpoint${tagEndpoints.length !== 1 ? 's' : ''}</span>
      </div>`;
    for (const { path, method, op } of tagEndpoints) {
      mainHtml += renderEndpointCard(spec, op, method, path);
    }
    mainHtml += '</div>';
  }

  // Untagged
  const untagged = [];
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, op] of Object.entries(methods)) {
      if (!op || typeof op !== 'object') continue;
      const hasTag = op.tags && op.tags.length > 0 && tags.some(t => op.tags.includes(t.name));
      if (!hasTag) untagged.push({ path, method, op });
    }
  }
  if (untagged.length > 0) {
    mainHtml += `<div class="mb-8">
      <div class="flex items-center gap-3 mb-3">
        <span class="h-6 rounded-full bg-gray-400 inline-block w-1.5"></span>
        <h2 class="text-base font-bold text-gray-800">Other</h2>
      </div>`;
    for (const { path, method, op } of untagged) mainHtml += renderEndpointCard(spec, op, method, path);
    mainHtml += '</div>';
  }

  // Schemas section if present
  const schemas = spec.components?.schemas;
  if (schemas && Object.keys(schemas).length > 0) {
    mainHtml += `<div class="mb-8">
      <div class="flex items-center gap-3 mb-4">
        <span class="h-6 rounded-full bg-purple-500 inline-block w-1.5"></span>
        <h2 class="text-base font-bold text-gray-800">Schemas</h2>
        <span class="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">${Object.keys(schemas).length}</span>
      </div>
      <div class="grid gap-3">`;
    for (const [name, schema] of Object.entries(schemas)) {
      mainHtml += `<div class="api-card schema-card rounded-xl border border-gray-200 bg-white overflow-hidden" id="schema-${esc(name)}">
        <div class="schema-header flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-gray-50">
          <div class="flex items-center gap-2">
            <span class="font-mono font-semibold text-gray-800">${esc(name)}</span>
            ${schema.type ? `<span class="px-1.5 py-0.5 text-xs rounded bg-purple-50 text-purple-600 font-mono">${esc(schema.type)}</span>` : ''}
          </div>
          <svg class="schema-chevron w-5 h-5 text-gray-400 transition-transform" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </div>
        <div class="schema-body hidden border-t border-gray-100 p-4">
          <pre class="text-xs text-gray-600 font-mono overflow-auto max-h-48 border border-gray-200 rounded-lg p-3">${esc(JSON.stringify(schema, null, 2))}</pre>
        </div>
      </div>`;
    }
    mainHtml += '</div></div>';
  }

  mainEl.innerHTML = mainHtml;
}

function renderEndpointCard(spec, op, method, path) {
  const id = cardId(method, path);
  const pathParams = pathParamNames(path);
  const queryParams = (op.parameters || []).filter(p => p.in === 'query');
  const hasBody = ['post', 'put', 'patch'].includes(method.toLowerCase());
  const auth = requiresAuth(spec, path, op);
  const summary = op.summary ? `<span class="ml-3 text-sm text-gray-400">${esc(op.summary)}</span>` : '';
  const lockIcon = auth ? '<svg class="endpoint-lock w-4 h-4 ml-2 inline-block text-amber-600" title="Requires authentication" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>' : '';
  const deprecated = op.deprecated ? '<span class="ml-2 px-1.5 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700 font-semibold">DEPRECATED</span>' : '';
  const desc = op.description ? `<p class="text-sm text-gray-600 mb-4">${esc(op.description)}</p>` : '';

  const paramsCount = pathParams.length + queryParams.length;
  const tryInline = buildTryInline(method, path, pathParams, queryParams, hasBody);

  return `
  <div class="api-card endpoint-card rounded-xl border border-gray-200 bg-white mb-3 overflow-hidden" id="${esc(id)}" data-method="${esc(method)}">
    <div class="endpoint-header flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-gray-50" data-path="${esc(path)}" data-method="${esc(method)}">
      <span class="method-badge method-${esc(method.toLowerCase())}">${esc(method.toUpperCase())}</span>
      <div class="flex-1 min-w-0">
        <span class="font-mono text-sm text-gray-800">${esc(path)}</span>${summary}${lockIcon}${deprecated}
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <button class="curl-btn p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 border-0 bg-transparent cursor-pointer" data-path="${esc(path)}" data-method="${esc(method)}" title="Copy as cURL">
          <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
        </button>
        <svg class="endpoint-chevron w-5 h-5 text-gray-400 transition-transform" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      </div>
    </div>
    <div class="endpoint-body hidden">
      <div class="px-4 pt-4 pb-2">${desc}
        <div class="px-4 pb-4 flex items-center gap-2">
          <button class="try-it-btn flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 border-0 cursor-pointer transition-colors" data-path="${esc(path)}" data-method="${esc(method)}">
            <svg class="try-play-icon w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/></svg>
            <span class="try-btn-label">Execute</span>
          </button>
        </div>
      </div>
      ${tryInline}
    </div>
  </div>`;
}

function buildTryInline(method, path, pathParamNamesArr, queryParams, hasBody) {
  const paramsCount = pathParamNamesArr.length + queryParams.length;
  let pathParamsHtml = '';
  for (const name of pathParamNamesArr) {
    pathParamsHtml += `<div class="flex items-start gap-2"><div class="w-28 flex-shrink-0 pt-1"><span class="text-xs font-mono text-indigo-600">${esc(name)}</span></div><div class="flex-1"><input class="try-path-param w-full px-2 py-1 text-xs border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-indigo-300" type="text" data-param="${esc(name)}" placeholder="value"></div></div>`;
  }
  let queryRowsHtml = '';
  for (const param of queryParams) {
    queryRowsHtml += `<div class="flex items-center gap-2"><div class="w-28 flex-shrink-0"><span class="text-xs font-mono text-gray-600 truncate">${esc(param.name)}</span></div><input class="try-query-param flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-indigo-300" type="text" data-param="${esc(param.name)}"></div>`;
  }
  const bodyPane = hasBody ? `
    <div class="try-pane hidden" data-pane="body">
      <div class="flex items-center justify-between mb-2">
        <select class="try-content-type text-xs border border-gray-200 rounded font-mono px-2 py-1 focus:outline-none"><option value="application/json">application/json</option><option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option><option value="text/plain">text/plain</option></select>
        <div class="flex gap-1"><button class="try-format-body text-xs text-gray-500 px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 border-0 cursor-pointer">Format</button><button class="try-clear-body text-xs text-gray-500 px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 border-0 cursor-pointer">Clear</button></div>
      </div>
      <textarea class="try-body-input w-full px-3 py-2 text-xs border border-gray-200 rounded-lg font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" style="height:140px" placeholder="{}">{}</textarea>
    </div>` : '';

  return `
  <div class="try-inline hidden border-t border-indigo-200" data-path="${esc(path)}" data-method="${esc(method)}">
    <div class="flex items-center gap-2 px-4 py-3 bg-indigo-50 border-b border-indigo-100">
      <span class="method-badge flex-shrink-0 method-${esc(method.toLowerCase())}">${esc(method.toUpperCase())}</span>
      <input class="try-url-input flex-1 px-3 py-2 text-sm border border-indigo-200 rounded-lg font-mono bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300" type="text" spellcheck="false">
      <button class="try-send-btn flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white flex-shrink-0 hover:bg-indigo-700 border-0 cursor-pointer transition-colors"><svg class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg><span>Send</span></button>
    </div>
    <div class="try-url-resolved hidden px-4 py-1 bg-indigo-50 border-b border-indigo-100"><span class="text-xs text-purple-600">→ Resolved:</span><span class="try-url-resolved-text font-mono ml-1"></span></div>
    <div class="flex border-b border-gray-200 bg-white px-4">
      <button class="try-tab-btn py-2 px-3 text-xs font-medium border-b-2 border-indigo-500 text-indigo-600" data-tab="params">Params${paramsCount ? ` <span class="ml-1 px-1 text-xs rounded-full bg-indigo-100 text-indigo-600">${paramsCount}</span>` : ''}</button>
      <button class="try-tab-btn py-2 px-3 text-xs font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="headers">Headers</button>
      ${hasBody ? '<button class="try-tab-btn py-2 px-3 text-xs font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700" data-tab="body">Body</button>' : ''}
    </div>
    <div class="try-panes px-4 py-3 bg-white">
      <div class="try-pane" data-pane="params">
        ${pathParamNamesArr.length ? '<p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Path Parameters</p><div class="space-y-2 mb-4">' + pathParamsHtml + '</div>' : ''}
        ${queryParams.length ? '<p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Query Parameters</p>' : ''}
        <div class="try-query-rows space-y-2 mb-3">${queryRowsHtml}</div>
        <div class="flex items-center justify-between mt-2"><button class="add-query-btn text-xs text-indigo-600 font-medium hover:text-indigo-800 border-0 bg-transparent cursor-pointer">+ Add query param</button>${!paramsCount ? '<p class="text-xs text-gray-400">No parameters defined — add custom query params above.</p>' : ''}</div>
      </div>
      <div class="try-pane hidden" data-pane="headers">
        <div class="flex items-center justify-between mb-2"><p class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Custom Headers</p><button class="add-header-btn text-xs text-indigo-600 font-medium hover:text-indigo-800 border-0 bg-transparent cursor-pointer">+ Add Header</button></div>
        <div class="try-header-rows space-y-2"></div>
        <div class="try-auth-preview mt-3 pt-3 border-t border-gray-100"></div>
      </div>
      ${bodyPane}
    </div>
    <div class="flex items-center gap-2 px-4 py-2 bg-white border-t border-gray-100">
      <span class="try-loading hidden text-xs text-gray-400">Sending...</span>
      <button class="try-copy-curl text-xs text-gray-500 px-2 py-1 rounded border border-gray-200 hover:bg-gray-100 border-0 cursor-pointer">Copy cURL</button>
      <div class="flex-1"></div>
      <p class="text-xs text-gray-400">Tip: use <code class="mx-1 font-mono text-purple-600">{{var}}</code> from your environment</p>
    </div>
    <div class="try-response response-panel hidden">
      <div class="response-toolbar">
        <div class="response-toolbar-left"><span class="response-toolbar-label">Response</span><span class="try-status-badge response-status"></span><span class="response-meta"><span class="try-resp-time response-time"></span><span class="try-resp-size response-size"></span></span></div>
        <div class="response-toolbar-right">
          <div class="response-tabs">
            <button class="try-res-tab response-tab response-tab-active" data-res="pretty">Pretty</button>
            <button class="try-res-tab response-tab" data-res="raw">Raw</button>
            <button class="try-res-tab response-tab" data-res="headers">Headers</button>
            <button class="try-res-tab response-tab" data-res="curl">cURL</button>
          </div>
          <button class="try-copy-response response-copy-btn" title="Copy to clipboard">Copy</button>
        </div>
      </div>
      <div class="response-body-wrap">
        <div class="response-json try-res-pretty font-mono"></div>
        <pre class="try-res-raw response-raw hidden"></pre>
        <pre class="try-res-headers response-headers hidden"></pre>
        <pre class="try-res-curl response-curl hidden"></pre>
      </div>
    </div>
  </div>`;
}
