import { envGet } from './env.js';

const COOKIE_NAME = 'glume_sess';
const MAX_AGE = 60 * 60 * 24 * 7;
const encoder = new TextEncoder();

function toBase64Url(text) {
  let binary = '';
  for (const byte of encoder.encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sign(data, secret) {
  if (globalThis.crypto && globalThis.crypto.subtle) {
    try {
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const buffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
      let binary = '';
      for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (_) {}
  }
  const bytes = encoder.encode(secret + '|' + data);
  let h1 = 2166136261;
  let h2 = 5381;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 16777619);
    h2 = (Math.imul(h2, 33) + bytes[i]) >>> 0;
  }
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

export function credentials(env) {
  return {
    user: envGet(env, 'ADMIN_USER', 'admin'),
    pass: envGet(env, 'ADMIN_PASSWORD', ''),
    secret: envGet(env, 'SESSION_SECRET', '') || envGet(env, 'ADMIN_PASSWORD', 'glume-local-secret')
  };
}

function cookieFlags(request) {
  const secure = String(request && request.url || '').startsWith('https:') ? ' Secure;' : '';
  return `Path=/; HttpOnly;${secure} SameSite=Lax`;
}

export async function makeSession(user, env, request) {
  const payload = toBase64Url(JSON.stringify({ u: user, exp: Date.now() + MAX_AGE * 1000 }));
  const signature = await sign(payload, credentials(env).secret);
  return `${COOKIE_NAME}=${payload}.${signature}; ${cookieFlags(request)}; Max-Age=${MAX_AGE}`;
}

export function clearSession(request) {
  return `${COOKIE_NAME}=; ${cookieFlags(request)}; Max-Age=0`;
}

export async function isAuthed(request, env) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)glume_sess=([^;]+)/);
  if (!match) return false;
  const parts = decodeURIComponent(match[1]).split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  const expected = await sign(parts[0], credentials(env).secret);
  if (parts[1].length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= parts[1].charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return false;

  try {
    const data = JSON.parse(fromBase64Url(parts[0]));
    return data.u === credentials(env).user && typeof data.exp === 'number' && data.exp > Date.now();
  } catch (_) {
    return false;
  }
}
