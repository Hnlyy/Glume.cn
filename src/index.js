import { json, html, fail, readBody } from './lib/http.js';
import { credentials, makeSession, clearSession, isAuthed } from './lib/auth.js';
import { listItems, getItem, createItem, updateItem, softDeleteItem } from './lib/store.js';
import * as pages from './pages.js';

export default {
  async fetch(request, context, runtimeEnv) {
    const env = runtimeEnv && Object.keys(runtimeEnv).length > 0
      ? runtimeEnv
      : (context && typeof context === 'object' ? context : {});
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return fail(error && error.message ? error.message : '服务器错误', 500);
    }
  }
};

function redirect(location, status = 302) {
  return new Response(null, { status, headers: { location } });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path.startsWith('/api/')) return handleApi(request, env, url, path, method);

  if (path === '/login' || path === '/login/' || path === '/admin/login') {
    if (await isAuthed(request, env)) return redirect('/f/');
    return html(pages.loginPage());
  }

  if (path === '/f' || path === '/f/') {
    if (!(await isAuthed(request, env))) return redirect('/login');
    return html(pages.galleryPage(credentials(env).user));
  }

  if (path === '/admin' || path === '/admin/') {
    if (!(await isAuthed(request, env))) return redirect('/login');
    return html(pages.adminPage(credentials(env).user));
  }

  if (path.startsWith('/p/')) {
    const key = path.slice(3).replace(/\/$/, '');
    if (!/^[a-z0-9]{9}$/.test(key)) return html(pages.notFoundPage(), 404);
    const item = await getItem(env, key);
    if (!item) return html(pages.notFoundPage(), 404);

    const preview = url.searchParams.get('preview') === '1';
    const normal = Number(item.xhr) === 1;
    if (!normal && !(preview && await isAuthed(request, env))) {
      return html(pages.notFoundPage(), 404);
    }
    return html(pages.detailPage(item, key, preview && !normal));
  }

  return html(pages.notFoundPage(), 404);
}

async function requireAuth(request, env) {
  if (!(await isAuthed(request, env))) return fail('请先登录', 401);
  return null;
}

async function handleApi(request, env, url, path, method) {
  if (path === '/api/login' && method === 'POST') {
    const body = await readBody(request);
    const account = credentials(env);
    if (!account.user || !account.pass) {
      return fail('请先在环境变量中配置 ADMIN_USER 与 ADMIN_PASSWORD', 500);
    }
    if (String(body.user || '') !== account.user || String(body.pass || '') !== account.pass) {
      return fail('账号或密码错误', 401);
    }
    return json({ ok: true, user: account.user }, 200, {
      'set-cookie': await makeSession(account.user, env, request)
    });
  }

  if (path === '/api/logout' && method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': clearSession(request) });
  }

  if (path === '/api/me') {
    const authed = await isAuthed(request, env);
    return json({ ok: authed, user: authed ? credentials(env).user : null });
  }

  const denied = await requireAuth(request, env);
  if (denied) return denied;

  if (path === '/api/list' && method === 'GET') {
    const rawStatus = url.searchParams.has('status') ? url.searchParams.get('status') : '1';
    const options = {
      q: url.searchParams.get('q') || '',
      category: url.searchParams.get('category') || ''
    };
    if (rawStatus !== '') options.status = Number(rawStatus);

    const all = await listItems(env, {});
    const matched = await listItems(env, options);
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const limit = Math.min(60, Math.max(1, Number(url.searchParams.get('limit')) || 18));
    const start = (page - 1) * limit;

    return json({
      ok: true,
      items: matched.slice(start, start + limit),
      page,
      limit,
      total: matched.length,
      hasMore: start + limit < matched.length,
      categories: [...new Set(all.map((item) => item.gfs).filter(Boolean))].sort()
    });
  }

  if (path === '/api/item' && method === 'POST') {
    try {
      const item = await createItem(env, await readBody(request));
      return json({ ok: true, item }, 201);
    } catch (error) {
      return fail(error.message || '新增失败', 400);
    }
  }

  if (path === '/api/item') {
    const key = url.searchParams.get('key') || '';
    try {
      if (method === 'GET') {
        const item = await getItem(env, key);
        return item ? json({ ok: true, item }) : fail('内容不存在', 404);
      }
      if (method === 'PUT') {
        const item = await updateItem(env, key, await readBody(request));
        return item ? json({ ok: true, item }) : fail('内容不存在', 404);
      }
      if (method === 'DELETE') {
        const item = await softDeleteItem(env, key);
        return item ? json({ ok: true, item }) : fail('内容不存在', 404);
      }
    } catch (error) {
      return fail(error.message || '操作失败', 400);
    }
  }

  return fail('接口不存在', 404);
}
