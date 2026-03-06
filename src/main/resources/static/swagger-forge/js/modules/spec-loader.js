/**
 * When __SF.specUrl is set, fetch the OpenAPI spec from that URL and render the UI.
 * Used when embedding SwaggerForge in Spring Boot (spec from /v3/api-docs).
 */

import { renderFromSpec } from './client-render.js';

export function shouldLoadSpecFromUrl() {
  const sf = window.__SF;
  if (!sf || !sf.specUrl) return false;
  const spec = sf.spec;
  if (!spec || !spec.paths) return true;
  return Object.keys(spec.paths).length === 0;
}

export async function loadSpecFromUrlAndRender() {
  const specUrl = window.__SF?.specUrl;
  if (!specUrl) return false;
  try {
    const res = await fetch(specUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const spec = await res.json();
    if (!spec || typeof spec !== 'object') throw new Error('Invalid spec');
    window.__SF.spec = spec;
    renderFromSpec(spec);
    return true;
  } catch (err) {
    console.error('[SwaggerForge] Failed to load spec from', specUrl, err);
    document.getElementById('main-content').innerHTML = `
      <div class="p-6 text-center text-gray-500">
        <p class="font-semibold text-red-600">Failed to load API spec</p>
        <p class="text-sm mt-2">${escapeHtml(String(err.message))}</p>
        <p class="text-xs mt-2">Check that <code class="bg-gray-100 px-1 rounded">${escapeHtml(specUrl)}</code> is available (e.g. springdoc-openapi).</p>
      </div>`;
    return false;
  }
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}
