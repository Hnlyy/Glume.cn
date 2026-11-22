const grid = document.getElementById('grid');
const empty = document.getElementById('empty');
const sentinel = document.getElementById('sentinel');
const categorySelect = document.getElementById('category');
const searchInput = document.getElementById('search');

const state = { page: 0, loading: false, done: false, category: '', q: '' };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function isVideo(url) {
  return /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(String(url || ''));
}

function dateOf(item) {
  const value = new Date(Number(item.ext) || Date.now());
  return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString('zh-CN');
}

function cardHtml(item) {
  const video = isVideo(item.url);
  const media = video
    ? `<video src="${esc(item.url)}" preload="metadata" muted playsinline></video>`
    : `<img src="${esc(item.url)}" alt="${esc(item.nic)}" loading="lazy" />`;
  return `<a class="card" href="/p/${encodeURIComponent(item.key)}">
    <div class="card-media">${media}<span class="tag">${video ? '视频' : '图片'}</span></div>
    <div class="card-body">
      <h2>${esc(item.nic)}</h2>
      <div class="card-meta"><span>${esc(item.gfs || '未分类')}</span><span>${esc(dateOf(item))}</span></div>
    </div>
  </a>`;
}

async function load() {
  if (state.loading || state.done) return;
  state.loading = true;
  sentinel.textContent = '加载中…';

  const params = new URLSearchParams({
    page: String(state.page + 1),
    limit: '18',
    status: '1',
    category: state.category,
    q: state.q
  });

  try {
    const response = await fetch(`/api/list?${params}`);
    if (response.status === 401) {
      location.href = '/login';
      return;
    }
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || '加载失败');

    state.page = result.page;
    state.done = !result.hasMore;
    grid.insertAdjacentHTML('beforeend', result.items.map(cardHtml).join(''));
    empty.hidden = result.total > 0 || state.page > 1;

    for (const category of result.categories || []) {
      if ([...categorySelect.options].some((option) => option.value === category)) continue;
      categorySelect.insertAdjacentHTML('beforeend', `<option value="${esc(category)}">${esc(category)}</option>`);
    }
    sentinel.textContent = state.done ? '已经到底了' : '继续下滑加载';
  } catch (error) {
    sentinel.textContent = '加载失败，向下滚动重试';
  } finally {
    state.loading = false;
  }
}

function reset() {
  state.page = 0;
  state.done = false;
  state.loading = false;
  grid.innerHTML = '';
  load();
}

let timer;
searchInput.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    state.q = searchInput.value.trim();
    reset();
  }, 300);
});

categorySelect.addEventListener('change', () => {
  state.category = categorySelect.value;
  reset();
});

const observer = new IntersectionObserver((entries) => {
  if (entries.some((entry) => entry.isIntersecting)) load();
}, { rootMargin: '500px' });
observer.observe(sentinel);

document.getElementById('logout')?.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  location.href = '/login';
});

load();
