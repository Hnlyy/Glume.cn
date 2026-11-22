import { escapeHtml as e, isVideo } from './lib/http.js';

function layout(title, body, script = '') {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${e(title)} · Glume</title>
  <meta name="description" content="Glume 相册" />
  <link rel="stylesheet" href="/assets/style.css" />
</head>
<body>
${body}
${script ? `<script type="module" src="${script}"></script>` : ''}
</body>
</html>`;
}

function siteFooter() {
  return `<footer class="site-footer">
  <span>&copy; 2026 Glume.cn</span>
  <span class="footer-links">
    <a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">XXICP备XXXXXXXX号</a>
    <a href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=XXXXXXXXXXXXXX" target="_blank" rel="noopener noreferrer">XX公网安备 XXXXXXXXXXXX号</a>
  </span>
</footer>`;
}

function topbar(user, active = '') {
  return `<header class="topbar">
  <a class="brand" href="/">G<i>.</i><span>Glume</span></a>
  <nav>
    ${active === 'gallery' ? '<span class="nav-current">相册</span>' : '<a href="/f/">相册</a>'}
    ${active === 'admin' ? '<span class="nav-current">管理</span>' : '<a href="/admin/">管理</a>'}
    <span class="nav-user">${e(user)}</span>
    <button class="link-button" id="logout" type="button">退出</button>
  </nav>
</header>`;
}

export function loginPage() {
  return layout('登录', `<main class="auth-wrap">
  <div class="auth-card">
    <a class="brand brand-lg" href="/">G<i>.</i><span>Glume</span></a>
    <h1>欢迎回来</h1>
    <p class="muted">登录后查看相册与管理内容</p>
    <form id="login-form" class="form-stack">
      <label>账号<input name="user" type="text" autocomplete="username" required placeholder="管理员账号" /></label>
      <label>密码<input name="pass" type="password" autocomplete="current-password" required placeholder="管理员密码" /></label>
      <p class="form-error" id="login-error" hidden></p>
      <button class="btn btn-primary" type="submit">登录</button>
    </form>
  </div>
</main>
${siteFooter()}`, '/assets/login.js');
}

export function galleryPage(user) {
  return layout('相册', `${topbar(user, 'gallery')}
<main class="page">
  <div class="page-head">
    <div>
      <p class="eyebrow">COLLECTION</p>
      <h1>相册</h1>
    </div>
    <div class="filters">
      <select id="category" aria-label="分类"><option value="">全部分类</option></select>
      <input id="search" type="search" placeholder="搜索标题、链接" aria-label="搜索" />
    </div>
  </div>
  <div class="masonry" id="grid"></div>
  <div class="empty" id="empty" hidden>暂无内容</div>
  <div class="sentinel" id="sentinel">加载中…</div>
</main>
${siteFooter()}`, '/assets/gallery.js');
}

export function detailPage(item, key, isPreview) {
  const video = isVideo(item.url);
  const media = video
    ? `<video src="${e(item.url)}" controls playsinline preload="metadata"></video>`
    : `<img src="${e(item.url)}" alt="${e(item.nic)}" />`;
  const date = new Date(Number(item.ext) || Date.now()).toLocaleString('zh-CN', { hour12: false });

  return layout(String(item.nic || '详情'), `<header class="topbar">
  <a class="brand" href="/">G<i>.</i><span>Glume</span></a>
  <nav><a href="/f/">返回相册</a><a href="/">首页</a></nav>
</header>
<main class="detail">
  ${isPreview ? '<p class="preview-tip">后台预览 · 该内容仅管理员可见</p>' : ''}
  <div class="media-box">${media}</div>
  <div class="detail-meta">
    <p class="eyebrow">${e(item.gfs || '未分类')}</p>
    <h1>${e(item.nic)}</h1>
    <dl>
      <div><dt>编号</dt><dd class="mono">${e(key)}</dd></div>
      <div><dt>大小</dt><dd>${e(item.siz)} MB</dd></div>
      <div><dt>更新</dt><dd>${e(date)}</dd></div>
    </dl>
    <a class="btn btn-ghost" href="${e(item.url)}" target="_blank" rel="noopener noreferrer">打开原文件</a>
  </div>
</main>
${siteFooter()}`);
}

export function adminPage(user) {
  return layout('后台管理', `${topbar(user, 'admin')}
<main class="page">
  <div class="page-head">
    <div>
      <p class="eyebrow">MANAGE</p>
      <h1>后台管理</h1>
    </div>
    <button class="btn btn-primary" id="create" type="button">+ 新增</button>
  </div>
  <div class="toolbar">
    <input id="search" type="search" placeholder="搜索标题、链接" aria-label="搜索" />
    <select id="category" aria-label="分类"><option value="">全部分类</option></select>
    <select id="status" aria-label="状态">
      <option value="">全部状态</option>
      <option value="1">正常显示</option>
      <option value="0">仅后台可见</option>
      <option value="2">已软删除</option>
    </select>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>预览</th><th>标题</th><th>分类</th><th>状态</th><th>大小</th><th>更新时间</th><th>操作</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
  </div>
  <div class="empty" id="empty" hidden>暂无内容</div>
  <div class="sentinel" id="sentinel">加载中…</div>
</main>
${siteFooter()}

<div class="modal" id="modal" hidden>
  <div class="modal-backdrop" data-close></div>
  <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-head">
      <h2 id="modal-title">新增内容</h2>
      <button class="icon-button" data-close type="button" aria-label="关闭">&times;</button>
    </div>
    <form id="item-form" class="form-stack">
      <label>标题<input name="nic" type="text" maxlength="120" required placeholder="例如：海边的傍晚" /></label>
      <label>链接<input name="url" type="text" required placeholder="https://… 或 /assets/…" /></label>
      <div class="form-row">
        <label>分类<input name="gfs" type="text" maxlength="40" placeholder="未分类" /></label>
        <label>大小（MB）<input name="siz" type="number" min="0" step="0.01" value="0" /></label>
      </div>
      <label>状态
        <select name="xhr">
          <option value="1">1 · 正常显示</option>
          <option value="0">0 · 仅后台可见</option>
          <option value="2">2 · 软删除</option>
        </select>
      </label>
      <p class="form-error" id="form-error" hidden></p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close type="button">取消</button>
        <button class="btn btn-primary" type="submit">保存</button>
      </div>
    </form>
  </div>
</div>`, '/assets/admin.js');
}

export function notFoundPage() {
  return layout('未找到', `<main class="auth-wrap">
  <div class="auth-card">
    <h1>404</h1>
    <p class="muted">这里什么都没有。</p>
    <a class="btn btn-primary" href="/">返回首页</a>
  </div>
</main>
${siteFooter()}`);
}
