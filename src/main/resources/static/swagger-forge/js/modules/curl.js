import { getAuthHeaders, getAuthQueryParams } from './auth.js';

export function generateCurl({ method, url, headers = {}, body = null }) {
  const authHeaders = getAuthHeaders();
  const allHeaders = { ...authHeaders, ...headers };

  let cmd = `curl -X ${method.toUpperCase()} \\\n  '${url}'`;

  for (const [k, v] of Object.entries(allHeaders)) {
    cmd += ` \\\n  -H '${k}: ${v}'`;
  }

  if (body) {
    cmd += ` \\\n  -H 'Content-Type: application/json'`;
    cmd += ` \\\n  -d '${body.replace(/'/g, "\\'")}'`;
  }

  return cmd;
}

export function copyToClipboard(text, label = 'Copied!') {
  return navigator.clipboard.writeText(text).then(() => true).catch(() => {
    // Fallback for older browsers
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
    return true;
  });
}
