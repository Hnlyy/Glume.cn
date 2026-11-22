import { envGet } from './env.js';
import { isSafeUrl } from './http.js';

const INDEX_KEY = '__index__';
const KEY_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const STATUS_VALUES = [0, 1, 2];

function kvFor(env) {
  return new EdgeKV({ namespace: envGet(env, 'KV_NAMESPACE', 'gallery') });
}

function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function normalize(data, partial = false) {
  const input = data && typeof data === 'object' ? data : {};
  const out = {};

  if (!partial || 'nic' in input) {
    const nic = text(input.nic, 120);
    if (!nic) throw new Error('标题不能为空');
    out.nic = nic;
  }

  if (!partial || 'url' in input) {
    const url = text(input.url, 2000);
    if (!url) throw new Error('链接不能为空');
    if (!isSafeUrl(url)) throw new Error('链接必须是 http(s) 地址或以 / 开头');
    out.url = url;
  }

  if (!partial || 'xhr' in input) {
    const xhr = input.xhr === undefined || input.xhr === '' ? 1 : Number(input.xhr);
    if (!STATUS_VALUES.includes(xhr)) throw new Error('状态只能是 0、1 或 2');
    out.xhr = xhr;
  }

  if (!partial || 'gfs' in input) {
    out.gfs = text(input.gfs, 40) || '未分类';
  }

  if (!partial || 'siz' in input) {
    const siz = input.siz === undefined || input.siz === '' ? 0 : Number(input.siz);
    if (!Number.isFinite(siz) || siz < 0) throw new Error('大小必须是非负数字（MB）');
    out.siz = Math.round(siz * 100) / 100;
  }

  return out;
}

async function readIndex(kv) {
  const raw = await kv.get(INDEX_KEY, { type: 'text' });
  if (!raw) return { v: 1, items: [] };
  try {
    const parsed = JSON.parse(raw);
    return parsed && Array.isArray(parsed.items) ? parsed : { v: 1, items: [] };
  } catch (_) {
    return { v: 1, items: [] };
  }
}

function writeIndex(kv, index) {
  return kv.put(INDEX_KEY, JSON.stringify({ v: 1, items: index.items }));
}

function randomKey() {
  const bytes = new Uint8Array(9);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let key = '';
  for (const byte of bytes) key += KEY_CHARS[byte % KEY_CHARS.length];
  return key;
}

async function uniqueKey(kv) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const key = randomKey();
    const exists = await kv.get(key, { type: 'text' });
    if (exists === undefined || exists === null) return key;
  }
  throw new Error('无法生成唯一键，请稍后重试');
}

export async function listItems(env, options = {}) {
  const kv = kvFor(env);
  const index = await readIndex(kv);
  let items = index.items.slice();

  if (options.status !== undefined && options.status !== null && options.status !== '') {
    const status = Number(options.status);
    items = items.filter((item) => Number(item.xhr) === status);
  }
  if (options.category) {
    const category = String(options.category).trim();
    items = items.filter((item) => String(item.gfs) === category);
  }
  if (options.q) {
    const query = String(options.q).trim().toLowerCase();
    items = items.filter((item) =>
      [item.nic, item.gfs, item.url].some((value) => String(value || '').toLowerCase().includes(query))
    );
  }

  return items.sort((a, b) => Number(b.ext || 0) - Number(a.ext || 0));
}

export async function getItem(env, key) {
  if (!/^[a-z0-9]{9}$/.test(String(key || ''))) return null;
  const kv = kvFor(env);
  const raw = await kv.get(key, { type: 'text' });
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {}
  }
  const index = await readIndex(kv);
  return index.items.find((item) => item.key === key) || null;
}

export async function createItem(env, data) {
  const kv = kvFor(env);
  const values = normalize(data, false);
  const key = await uniqueKey(kv);
  const item = { ...values, ext: Date.now() };

  await kv.put(key, JSON.stringify(item));
  const index = await readIndex(kv);
  index.items.push({ key, ...item });
  await writeIndex(kv, index);
  return { key, ...item };
}

export async function updateItem(env, key, data) {
  if (!/^[a-z0-9]{9}$/.test(String(key || ''))) throw new Error('无效的键');
  const kv = kvFor(env);
  const current = await getItem(env, key);
  if (!current) return null;

  const values = normalize(data, true);
  const item = { ...current, ...values, ext: Date.now() };
  await kv.put(key, JSON.stringify(item));

  const index = await readIndex(kv);
  const position = index.items.findIndex((entry) => entry.key === key);
  const entry = { key, ...item };
  if (position >= 0) index.items[position] = entry;
  else index.items.push(entry);
  await writeIndex(kv, index);
  return entry;
}

export function softDeleteItem(env, key) {
  return updateItem(env, key, { xhr: 2 });
}
