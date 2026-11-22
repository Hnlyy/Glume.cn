export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

export function html(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      ...headers
    }
  });
}

export function fail(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

export async function readBody(request) {
  try {
    const data = await request.json();
    return data && typeof data === 'object' ? data : {};
  } catch (_) {
    return {};
  }
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isSafeUrl(value) {
  const url = String(value ?? '').trim();
  return /^https?:\/\//i.test(url) || url.startsWith('/');
}

export function isVideo(url) {
  return /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(String(url || ''));
}
