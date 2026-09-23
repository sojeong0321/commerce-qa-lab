import { api, formatWon, escapeHtml } from './api.js';
import { initLayout, showError } from './layout.js';

const container = document.getElementById('order-complete');

function render(order) {
  const itemLines = order.items
    .map((item) => `<li>${escapeHtml(item.productName)} × ${item.quantity} · ${formatWon(item.lineTotal)}</li>`)
    .join('');
  const discountLine = order.couponCode
    ? `<div><dt>할인 (${escapeHtml(order.couponCode)})</dt><dd data-testid="complete-discount">-${formatWon(order.discountAmount)}</dd></div>`
    : '';

  container.innerHTML = `
    <p class="complete-lead">주문이 완료되었습니다.</p>
    <p class="order-number">주문번호 <b data-testid="order-number">#${order.id}</b></p>
    <ul class="order-items">${itemLines}</ul>
    <dl class="summary">
      <div><dt>상품 금액</dt><dd data-testid="complete-subtotal">${formatWon(order.subtotalAmount)}</dd></div>
      ${discountLine}
      <div class="total-row"><dt>결제 금액</dt><dd data-testid="complete-total">${formatWon(order.totalAmount)}</dd></div>
    </dl>
    <div class="complete-actions">
      <a class="button-link" href="/orders.html">주문 내역 보기</a>
      <a href="/">계속 쇼핑하기</a>
    </div>`;
}

const orderId = new URLSearchParams(window.location.search).get('orderId');

try {
  await initLayout();
  if (!orderId) throw new Error('주문번호가 없습니다. 주문 내역에서 확인해 주세요.');
  render(await api('GET', `/api/orders/${orderId}`));
} catch (error) {
  showError(error.message);
}
