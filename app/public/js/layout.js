// 모든 페이지 공통: 사용자 선택, 장바구니 개수, 안내/에러 메시지.
import { api, getUserId, setUserId, escapeHtml } from './api.js';

export async function initLayout() {
  const select = document.getElementById('user-select');
  const { users } = await api('GET', '/api/users');
  const current = getUserId();

  select.innerHTML = users
    .map((u) => `<option value="${u.id}"${String(u.id) === current ? ' selected' : ''}>${escapeHtml(u.name)}</option>`)
    .join('');

  select.addEventListener('change', () => {
    setUserId(select.value);
    window.location.reload();
  });

  await refreshCartCount();
}

export async function refreshCartCount() {
  const cart = await api('GET', '/api/cart');
  document.getElementById('cart-count').textContent = String(cart.totalQuantity);
}

export function showStatus(text) {
  const status = document.getElementById('status-message');
  const error = document.getElementById('error-message');
  error.hidden = true;
  error.textContent = '';
  status.textContent = text;
  status.hidden = false;
}

export function showError(text) {
  const status = document.getElementById('status-message');
  const error = document.getElementById('error-message');
  status.hidden = true;
  status.textContent = '';
  error.textContent = text;
  error.hidden = false;
}
