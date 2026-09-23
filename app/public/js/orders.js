import { api, formatWon, escapeHtml } from './api.js';
import { initLayout, showStatus, showError } from './layout.js';

const list = document.getElementById('order-list');

const STATUS_LABEL = { PLACED: '주문 완료', CANCELED: '취소됨' };

function formatDate(iso) {
  return new Date(iso).toLocaleString('ko-KR');
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
          <span class="badge ${order.status === 'PLACED' ? 'badge-ok' : 'badge-muted'}" data-testid="order-status">${STATUS_LABEL[order.status]}</span>
          <span class="order-date">${formatDate(order.createdAt)}</span>
        </div>
        <ul class="order-items">${itemLines}</ul>
        <dl class="summary">
          <div><dt>상품 금액</dt><dd>${formatWon(order.subtotalAmount)}</dd></div>
          ${discountLine}
          <div class="total-row"><dt>결제 금액</dt><dd data-testid="order-total">${formatWon(order.totalAmount)}</dd></div>
        </dl>
        ${order.status === 'PLACED' ? `<button type="button" class="cancel-button" data-order-id="${order.id}">주문 취소</button>` : ''}
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
  const orderId = Number(event.target.dataset.orderId);

  try {
    await api('POST', `/api/orders/${orderId}/cancel`);
    await loadOrders();
    showStatus(`주문 #${orderId}을(를) 취소했습니다. 재고와 쿠폰이 복구되었습니다.`);
  } catch (error) {
    showError(error.message);
    await loadOrders();
  }
});

try {
  await initLayout();
  await loadOrders();
} catch (error) {
  showError(error.message);
}
