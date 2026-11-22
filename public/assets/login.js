const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;
  const data = new FormData(form);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = '登录中…';

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user: data.get('user'), pass: data.get('pass') })
    });
    const result = await response.json().catch(() => ({}));
    if (response.ok) {
      location.href = '/f/';
      return;
    }
    errorBox.textContent = result.error || '登录失败';
    errorBox.hidden = false;
  } catch (_) {
    errorBox.textContent = '网络异常，请重试';
    errorBox.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = '登录';
  }
});
