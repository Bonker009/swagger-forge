let container = null;

export function initToast() {
  container = document.createElement('div');
  container.id = 'toast-container';
  container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
  document.body.appendChild(container);
}

export function showToast(msg, type = 'success') {
  if (!container) return;
  const colors = { success: '#22c55e', error: '#ef4444', info: '#6366f1', warning: '#f59e0b' };
  const toast = document.createElement('div');
  toast.style.cssText = `padding:10px 16px;border-radius:10px;font-size:13px;font-weight:500;color:white;background:${colors[type] || colors.info};box-shadow:0 4px 12px rgba(0,0,0,.15);animation:toastIn .25s ease;max-width:320px;`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity .3s';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
