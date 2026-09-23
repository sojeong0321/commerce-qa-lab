// 모든 페이지 공통: 사용자 선택, 장바구니 개수, 안내/에러 메시지.
import { api, getUserId, setUserId, escapeHtml } from './api.js';

// 응답이 엇갈려 도착해도 화면이 옛 값으로 남지 않도록, 가장 최근 요청의 결과만 반영한다.
let cartCountToken = 0;

export async function initLayout() {
  const select = document.getElementById('user-select');
  const { users } = await api('GET', '/api/users');
  const stored = getUserId();
  const current = users.some((u) => String(u.id) === stored) ? stored : String(users[0].id);
  if (current !== stored) setUserId(current); // 저장된 사용자가 사라졌으면 화면과 요청을 일치시킨다.

  select.innerHTML = users
    .map(
      (u) =>
        `<option value="${escapeHtml(u.id)}"${String(u.id) === current ? ' selected' : ''}>${escapeHtml(u.name)}</option>`
    )
    .join('');

  select.addEventListener('change', () => {
    setUserId(select.value);
    window.location.reload();
  });

  await refreshCartCount();
}

export async function refreshCartCount() {
  const token = ++cartCountToken;
  const cart = await api('GET', '/api/cart');
  if (token !== cartCountToken) return; // 더 최신 요청이 있으면 이 결과는 버린다.
  document.getElementById('cart-count').textContent = String(cart.totalQuantity);
}

function elements() {
  return {
    status: document.getElementById('status-message'),
    error: document.getElementById('error-message'),
  };
}

// 동작을 시작할 때 이전 메시지를 지운다. 그래야 "직전 메시지가 남아 있어 통과하는" 착시가 없다.
export function clearMessages() {
  const { status, error } = elements();
  for (const el of [status, error]) {
    el.textContent = '';
    el.hidden = true;
  }
}

export function showStatus(text) {
  const { status, error } = elements();
  error.textContent = '';
  error.hidden = true;
  status.textContent = text;
  status.hidden = false;
}

export function showError(text) {
  const { status, error } = elements();
  status.textContent = '';
  status.hidden = true;
  error.textContent = text;
  error.hidden = false;
}
