import { showToast } from './toast.js';
import { copyToClipboard } from './curl.js';

let cssEditor = null;
let currentTheme = window.__SF?.activeTheme || 'default';
let cssVarOverrides = {};

export function initThemeEditor() {
  const panel = document.getElementById('theme-editor');
  const toggleBtn = document.getElementById('toggle-editor');
  const closeBtn = document.getElementById('close-editor');

  toggleBtn?.addEventListener('click', () => {
    const isOpen = panel.classList.toggle('open');
    panel.classList.toggle('translate-x-full', !isOpen);
    if (isOpen) setTimeout(() => cssEditor?.refresh(), 310);
  });

  closeBtn?.addEventListener('click', () => {
    panel.classList.remove('open');
    panel.classList.add('translate-x-full');
  });

  initTabs();
  initCodeEditor();
  initThemePresets();
  initCSSVars();
  initActions();
  loadSavedStyles();
  setActiveTheme(currentTheme, false);
}

function initTabs() {
  document.querySelectorAll('.editor-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.dataset.tab;
      document.querySelectorAll('.editor-tab').forEach(t => {
        t.classList.toggle('active-tab', t.dataset.tab === tabId);
        t.classList.toggle('text-indigo-600', t.dataset.tab === tabId);
        t.classList.toggle('border-indigo-500', t.dataset.tab === tabId);
        t.classList.toggle('text-gray-500', t.dataset.tab !== tabId);
        t.classList.toggle('border-transparent', t.dataset.tab !== tabId);
      });
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('hidden', p.id !== `tab-${tabId}`));
      if (tabId === 'css') setTimeout(() => cssEditor?.refresh(), 50);
    });
  });
}

function initCodeEditor() {
  const textarea = document.getElementById('css-editor');
  if (!textarea || typeof CodeMirror === 'undefined') return;

  cssEditor = CodeMirror.fromTextArea(textarea, {
    mode: 'css',
    theme: 'dracula',
    lineNumbers: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    lineWrapping: true,
    extraKeys: { 'Ctrl-Space': 'autocomplete' }
  });

  // Live preview
  let debounce;
  cssEditor.on('change', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => applyUserCSS(cssEditor.getValue()), 400);
  });

  // Tailwind snippets
  document.querySelectorAll('.tailwind-snippet').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!cssEditor) return;
      cssEditor.replaceRange(btn.dataset.class + ' ', cssEditor.getCursor());
      cssEditor.focus();
    });
  });
}

function initThemePresets() {
  document.querySelectorAll('.theme-preset-card').forEach(card => {
    card.addEventListener('click', () => setActiveTheme(card.dataset.theme));
  });
}

function initCSSVars() {
  document.querySelectorAll('.css-var-input').forEach(input => {
    input.addEventListener('input', () => {
      const v = input.dataset.var;
      cssVarOverrides[v] = input.value;
      syncColorPicker(v, input.value);
      document.documentElement.style.setProperty(v, input.value);
    });
  });

  document.querySelectorAll('.css-var-color').forEach(picker => {
    picker.addEventListener('input', () => {
      const v = picker.dataset.var;
      cssVarOverrides[v] = picker.value;
      syncTextInput(v, picker.value);
      document.documentElement.style.setProperty(v, picker.value);
    });
  });
}

function syncColorPicker(varName, value) {
  const picker = document.querySelector(`.css-var-color[data-var="${varName}"]`);
  if (picker && /^#[0-9a-f]{6}$/i.test(value)) picker.value = value;
}

function syncTextInput(varName, value) {
  const input = document.querySelector(`.css-var-input[data-var="${varName}"]`);
  if (input) input.value = value;
}

function initActions() {
  document.getElementById('apply-styles')?.addEventListener('click', applyAndSave);

  document.getElementById('reset-styles')?.addEventListener('click', async () => {
    if (!confirm('Reset all custom styles to defaults?')) return;
    await fetch('/api/styles/reset', { method: 'POST' });
    document.getElementById('user-custom-css').textContent = '';
    document.getElementById('theme-css').textContent = '';
    cssEditor?.setValue('');
    cssVarOverrides = {};
    document.querySelectorAll('.css-var-input').forEach(i => i.value = '');
    document.documentElement.removeAttribute('style');
    setActiveTheme('default', false);
    showToast('Styles reset');
  });

  document.getElementById('copy-css')?.addEventListener('click', () => {
    const css = buildFullCSS();
    copyToClipboard(css).then(() => showToast('CSS copied', 'info'));
  });

  document.getElementById('export-css')?.addEventListener('click', () => {
    const css = buildFullCSS();
    const blob = new Blob([css], { type: 'text/css' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'swaggerforge-theme.css';
    a.click();
    showToast('CSS downloaded');
  });
}

function setActiveTheme(themeName, save = true) {
  currentTheme = themeName;
  const themes = window.__SF?.themes || {};
  const theme = themes[themeName];

  // Apply theme CSS
  document.getElementById('theme-css').textContent = theme?.css || '';

  // Update preset cards
  document.querySelectorAll('.theme-preset-card').forEach(card => {
    const isActive = card.dataset.theme === themeName;
    card.classList.toggle('border-indigo-500', isActive);
    card.classList.toggle('border-gray-200', !isActive);
    card.querySelector('.theme-check')?.classList.toggle('hidden', !isActive);
  });

  if (save) {
    const css = cssEditor?.getValue() || '';
    saveTailwindConfig();
    fetch('/api/styles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeTheme: themeName, css })
    });
  }
}

function applyUserCSS(css) {
  const varCSS = buildVarCSS();
  document.getElementById('user-custom-css').textContent = varCSS + '\n' + css;
}

function buildVarCSS() {
  const entries = Object.entries(cssVarOverrides).filter(([, v]) => v);
  if (!entries.length) return '';
  return ':root{' + entries.map(([k, v]) => `${k}:${v}`).join(';') + '}';
}

function buildFullCSS() {
  return buildVarCSS() + '\n' + (cssEditor?.getValue() || '');
}

async function applyAndSave() {
  const css = cssEditor?.getValue() || '';
  const tailwindConfig = document.getElementById('tailwind-editor')?.value || '';

  applyUserCSS(css);
  saveTailwindConfig();

  try {
    await fetch('/api/styles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ css, tailwindConfig, activeTheme: currentTheme })
    });
    showToast('Theme applied & saved');
  } catch {
    showToast('Applied locally (server save failed)', 'warning');
  }
}

function saveTailwindConfig() {
  const config = document.getElementById('tailwind-editor')?.value?.trim();
  if (!config) return;
  try {
    if (window.tailwind) {
      // eslint-disable-next-line no-eval
      const match = config.match(/tailwind\.config\s*=\s*({[\s\S]*})/);
      if (match) window.tailwind.config = eval('(' + match[1] + ')');
    }
  } catch {}
}

async function loadSavedStyles() {
  try {
    const res = await fetch('/api/styles');
    const styles = await res.json();
    if (styles.css && cssEditor) cssEditor.setValue(styles.css);
    if (styles.css) applyUserCSS(styles.css);
    if (styles.tailwindConfig) {
      const el = document.getElementById('tailwind-editor');
      if (el) el.value = styles.tailwindConfig;
    }
    if (styles.activeTheme) setActiveTheme(styles.activeTheme, false);
  } catch {}
}
