import { initToast } from './modules/toast.js';
import { initThemeEditor } from './modules/theme-editor.js';
import { initEndpoints } from './modules/endpoints.js';
import { initSidebar } from './modules/sidebar.js';
import { initSearch } from './modules/search.js';
import { initTryModal } from './modules/try-modal.js';
import { initImportSpec } from './modules/import-spec.js';
import { initAuth } from './modules/auth.js';
import { initEnvironments } from './modules/environments.js';
import { initJwtModal } from './modules/jwt.js';
import { shouldLoadSpecFromUrl, loadSpecFromUrlAndRender } from './modules/spec-loader.js';
import { renderFromSpec } from './modules/client-render.js';

function needsClientRender() {
  const spec = window.__SF?.spec;
  if (!spec || !spec.paths || Object.keys(spec.paths).length === 0) return false;
  const hasContent = document.querySelector('#endpoint-groups .tag-group-btn') || document.querySelector('#main-content .tag-section');
  return !hasContent;
}

async function bootstrap() {
  if (shouldLoadSpecFromUrl()) {
    const ok = await loadSpecFromUrlAndRender();
    if (ok) {
      initSidebar();
      initEndpoints();
      initSearch();
    }
  } else if (needsClientRender()) {
    renderFromSpec(window.__SF.spec);
    initSidebar();
    initEndpoints();
    initSearch();
  }

  initToast();
  initEnvironments();
  initAuth();
  initJwtModal();
  initThemeEditor();
  initEndpoints();
  initSidebar();
  initSearch();
  initTryModal();
  initImportSpec();
}

document.addEventListener('DOMContentLoaded', bootstrap);
