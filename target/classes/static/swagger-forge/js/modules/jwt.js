/**
 * JWT decode/encode (jwt.io style). No external lib: base64url + Web Crypto for HS256.
 */
import { showToast } from './toast.js';

/** Escape for HTML so we can safely use innerHTML */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Return HTML with spans for JSON syntax highlighting (keys, strings, numbers, literals).
 * String values are only matched when the opening " is in value position (after : , [ {)
 * so we never match the " in our own class="jwt-json-key" attribute.
 */
function highlightJson(jsonStr) {
  let s = escapeHtml(jsonStr);
  // Keys: "key" followed by optional whitespace and :
  s = s.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g, '<span class="jwt-json-key">"$1"</span>:');
  // String values: quoted string only when the opening " is after : or , or [ or { (value position)
  s = s.replace(/(?<=[:,\[\]{}\s])"([^"\\]*(?:\\.[^"\\]*)*)"(?!\s*:)/g, '<span class="jwt-json-string">"$1"</span>');
  // Literals
  s = s.replace(/\b(true|false|null)\b/g, '<span class="jwt-json-literal">$1</span>');
  // Numbers
  s = s.replace(/(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, '<span class="jwt-json-number">$1</span>');
  return s;
}

function base64urlDecode(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  try {
    return atob(padded);
  } catch {
    return null;
  }
}

function base64urlEncode(input) {
  let binary;
  if (typeof input === 'string') {
    binary = new TextEncoder().encode(input);
  } else {
    binary = input;
  }
  const bytes = binary instanceof Uint8Array ? binary : new Uint8Array(binary);
  let binaryStr = '';
  for (let i = 0; i < bytes.length; i++) binaryStr += String.fromCharCode(bytes[i]);
  const base64 = btoa(binaryStr);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a JWT without verifying signature. Returns { header, payload } or throws.
 */
export function decodeJWT(token) {
  const t = (token || '').trim();
  if (!t) throw new Error('Empty token');
  const parts = t.split('.');
  if (parts.length < 2) throw new Error('Invalid JWT format (expected header.payload[.signature])');
  const headerStr = base64urlDecode(parts[0]);
  const payloadStr = base64urlDecode(parts[1]);
  if (!headerStr || !payloadStr) throw new Error('Invalid base64 in header or payload');
  let header, payload;
  try {
    header = JSON.parse(headerStr);
  } catch {
    throw new Error('Invalid JSON in header');
  }
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    throw new Error('Invalid JSON in payload');
  }
  return { header, payload };
}

/**
 * Encode header + payload to JWT. If secret is provided and alg is HS256, sign with HMAC-SHA256.
 */
export async function encodeJWT(headerObj, payloadObj, secret) {
  const headerJson = typeof headerObj === 'string' ? headerObj : JSON.stringify(headerObj);
  const payloadJson = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
  const headerB64 = base64urlEncode(headerJson);
  const payloadB64 = base64urlEncode(payloadJson);
  const unsigned = `${headerB64}.${payloadB64}`;

  const alg = (typeof headerObj === 'object' && headerObj?.alg) || 'HS256';
  if (alg === 'none' || !secret) {
    return `${unsigned}.`;
  }
  if (alg !== 'HS256') {
    throw new Error('Only HS256 is supported for signing');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(unsigned)
  );
  const sigB64 = base64urlEncode(sig);
  return `${unsigned}.${sigB64}`;
}

export function initJwtModal() {
  const modal = document.getElementById('jwt-modal');
  const openBtn = document.getElementById('open-jwt');
  const closeBtn = document.getElementById('close-jwt');
  const backdrop = modal?.querySelector('.modal-backdrop');

  const decodeInput = document.getElementById('jwt-decode-input');
  const decodeBtn = document.getElementById('jwt-decode-btn');
  const decodeCopy = document.getElementById('jwt-decode-copy');
  const decodeError = document.getElementById('jwt-decode-error');
  const decodeHeader = document.getElementById('jwt-decode-header');
  const decodePayload = document.getElementById('jwt-decode-payload');

  const encodeHeader = document.getElementById('jwt-encode-header');
  const encodePayload = document.getElementById('jwt-encode-payload');
  const encodeSecret = document.getElementById('jwt-encode-secret');
  const encodeBtn = document.getElementById('jwt-encode-btn');
  const encodeOutput = document.getElementById('jwt-encode-output');
  const encodeCopy = document.getElementById('jwt-encode-copy');

  const tabs = document.querySelectorAll('.jwt-tab');
  const decodePane = document.getElementById('jwt-decode-pane');
  const encodePane = document.getElementById('jwt-encode-pane');

  function openModal() {
    modal?.classList.remove('hidden');
  }
  function closeModal() {
    modal?.classList.add('hidden');
  }

  openBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);

  tabs?.forEach((tab) => {
    tab.addEventListener('click', () => {
      const which = tab.dataset.jwtTab;
      tabs.forEach((t) => {
        t.classList.remove('jwt-tab-active', 'border-amber-500', 'text-amber-700', 'bg-white', '-mb-px');
        t.classList.add('border-transparent', 'text-gray-500');
      });
      tab.classList.add('jwt-tab-active', 'border-amber-500', 'text-amber-700', 'bg-white', '-mb-px');
      tab.classList.remove('border-transparent', 'text-gray-500');
      if (which === 'decode') {
        decodePane?.classList.remove('hidden');
        encodePane?.classList.add('hidden');
      } else {
        decodePane?.classList.add('hidden');
        encodePane?.classList.remove('hidden');
      }
    });
  });

  decodeBtn?.addEventListener('click', () => {
    decodeError?.classList.add('hidden');
    const token = decodeInput?.value?.trim();
    if (!token) {
      decodeError.textContent = 'Paste a JWT first';
      decodeError?.classList.remove('hidden');
      return;
    }
    try {
      const { header, payload } = decodeJWT(token);
      const headerStr = JSON.stringify(header, null, 2);
      const payloadStr = JSON.stringify(payload, null, 2);
      decodeHeader.innerHTML = highlightJson(headerStr);
      decodePayload.innerHTML = highlightJson(payloadStr);
    } catch (e) {
      decodeError.textContent = e.message || 'Decode failed';
      decodeError?.classList.remove('hidden');
      decodeHeader.innerHTML = '—';
      decodePayload.innerHTML = '—';
    }
  });

  decodeCopy?.addEventListener('click', () => {
    const h = decodeHeader?.textContent?.trim() ?? '';
    const p = decodePayload?.textContent?.trim() ?? '';
    if (h === '—' && p === '—') return;
    const text = `Header:\n${h}\n\nPayload:\n${p}`;
    navigator.clipboard?.writeText(text).then(() => showToast('Copied decoded JSON', 'info'));
  });

  encodeBtn?.addEventListener('click', async () => {
    let headerJson = encodeHeader?.value?.trim() || '{}';
    let payloadJson = encodePayload?.value?.trim() || '{}';
    const secret = encodeSecret?.value?.trim() || '';
    try {
      const header = JSON.parse(headerJson);
      const payload = JSON.parse(payloadJson);
      const token = await encodeJWT(header, payload, secret);
      if (encodeOutput) encodeOutput.value = token;
    } catch (e) {
      if (encodeOutput) encodeOutput.value = '';
      showToast(e.message || 'Encode failed', 'error');
    }
  });

  encodeCopy?.addEventListener('click', () => {
    const v = encodeOutput?.value?.trim();
    if (!v) return;
    navigator.clipboard?.writeText(v).then(() => showToast('JWT copied', 'info'));
  });
}
