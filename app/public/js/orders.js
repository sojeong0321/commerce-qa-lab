import { api, formatWon, escapeHtml } from './api.js';
import { initLayout, clearMessages, showStatus, showError } from './layout.js';

const list = document.getElementById('order-list');

const STATUS_LABEL = { PLACED: '주문 완료', CANCELED: '취소됨' };

let busy = false;

// 표시 시간대에 따라 글자가 달라지지 않도록 저장된 값(UTC)을 그대로 보여 준다.
// 시간대에 따라 바뀌는 문자열은 CI에서 테스트를 흔들리게 만든다.
function formatDate(iso) {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function renderOrder(order) {
  const headingId = `order-${order.id}-heading`;
  const itemLines = order.items
    .map((item) => `<li>${escapeHtml(item.productName)} × ${item.quantity} · ${formatWon(item.lineTotal)}</li>`)
    .join('');
  const discountLine = order.couponCode
    ? `<div><dt>할인 (${escapeHtml(order.couponCode)})</dt><dd data-testid="order-discount">-${formatWon(order.discountAmount)}</dd></div>`
    : '';

  return `
    <li>
      <article class="order-card" aria-labelledby="${headingId}">
        <div class="order-head">
          <h2 id="${headingId}">주문 #${order.id}</h2>
          <span class="badge ${order.status === 'PLACED' ? 'badge-ok' : 'badge-muted'}" data-testid="order-status">${STATUS_LABEL[order.status] ?? order.status}</span>
          <time class="order-date" datetime="${escapeHtml(order.createdAt)}">${formatDate(order.createdAt)}</time>
        </div>
        <ul class="order-items">${itemLines}</ul>
        <dl class="summary">
          <div><dt>상품 금액</dt><dd>${formatWon(order.subtotalAmount)}</dd></div>
          ${discountLine}
          <div class="total-row"><dt>결제 금액</dt><dd data-testid="order-total">${formatWon(order.totalAmount)}</dd></div>
        </dl>
        ${order.status === 'PLACED' ? `<button type="button" class="cancel-button" data-order-id="${escapeHtml(order.id)}">주문 취소</button>` : ''}
      </article>
    </li>`;
}

async function loadOrders() {
  const { orders } = await api('GET', '/api/orders');
  list.innerHTML =
    orders.length === 0
      ? '<li class="empty">주문 내역이 없습니다. <a href="/">상품 보러 가기</a></li>'
      : orders.map(renderOrder).join('');
}

list.addEventListener('click', async (event) => {
  if (!event.target.classList.contains('cancel-button')) return;
  if (busy) return; // 연타로 같은 주문을 두 번 취소 요청하지 않는다.
  busy = true;
  clearMessages();
  const orderId = Number(event.target.dataset.orderId);

  try {
    await api('POST', `/api/orders/${orderId}/cancel`);
    await loadOrders();
    showStatus(`주문 #${orderId}을(를) 취소했습니다. 재고와 쿠폰이 복구되었습니다.`);
  } catch (error) {
    try {
      await loadOrders(); // 화면을 서버의 실제 상태로 맞춘 뒤 이유를 보여 준다.
    } catch {
      // 목록 갱신까지 실패해도 아래에서 원래 실패 이유를 보여 준다.
    }
    showError(error.message);
  } finally {
    busy = false;
  }
});

try {
  await initLayout();
} catch (error) {
  showError(error.message);
}
try {
  await loadOrders();
} catch (error) {
  showError(error.message);
}
