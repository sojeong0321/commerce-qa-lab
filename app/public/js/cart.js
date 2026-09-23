import { api, formatWon, escapeHtml } from './api.js';
import { initLayout, refreshCartCount, showStatus, showError } from './layout.js';

const container = document.getElementById('cart-content');

function renderRow(item) {
  const qtyId = `cart-qty-${item.productId}`;
  return `
    <tr data-product-id="${item.productId}">
      <th scope="row">${escapeHtml(item.name)}</th>
      <td class="num">${formatWon(item.price)}</td>
      <td>
        <form class="qty-form" novalidate>
          <label class="visually-hidden" for="${qtyId}">${escapeHtml(item.name)} 수량</label>
          <input id="${qtyId}" name="quantity" type="number" min="1" step="1" value="${item.quantity}" inputmode="numeric">
          <button type="submit">변경</button>
        </form>
      </td>
      <td class="num" data-testid="line-total">${formatWon(item.lineTotal)}</td>
      <td><button type="button" class="remove-button">삭제</button></td>
    </tr>`;
}

function renderCart(cart) {
  if (cart.items.length === 0) {
    container.innerHTML = '<p class="empty">장바구니가 비어 있습니다. <a href="/">상품 보러 가기</a></p>';
    return;
  }

  container.innerHTML = `
    <div class="table-scroll">
      <table class="cart-table">
        <thead>
          <tr><th scope="col">상품</th><th scope="col">가격</th><th scope="col">수량</th><th scope="col">금액</th><th scope="col"><span class="visually-hidden">삭제</span></th></tr>
        </thead>
        <tbody>${cart.items.map(renderRow).join('')}</tbody>
      </table>
    </div>
    <dl class="summary">
      <div><dt>상품 금액</dt><dd data-testid="cart-subtotal">${formatWon(cart.subtotal)}</dd></div>
    </dl>`;
}

async function loadCart() {
  renderCart(await api('GET', '/api/cart'));
}

function productIdOf(element) {
  return Number(element.closest('tr').dataset.productId);
}

container.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const productId = productIdOf(form);
  const quantity = Number(form.elements.quantity.value);
  const name = form.closest('tr').querySelector('th').textContent;

  try {
    renderCart(await api('PATCH', `/api/cart/items/${productId}`, { quantity }));
    showStatus(`${name} 수량을 ${quantity}개로 변경했습니다.`);
    await refreshCartCount();
  } catch (error) {
    showError(error.message);
    await loadCart(); // 실패하면 입력칸을 서버의 실제 수량으로 되돌린다.
  }
});

container.addEventListener('click', async (event) => {
  if (!event.target.classList.contains('remove-button')) return;
  const productId = productIdOf(event.target);
  const name = event.target.closest('tr').querySelector('th').textContent;

  try {
    await api('DELETE', `/api/cart/items/${productId}`);
    await loadCart();
    showStatus(`${name}을(를) 장바구니에서 삭제했습니다.`);
    await refreshCartCount();
  } catch (error) {
    showError(error.message);
  }
});

try {
  await initLayout();
  await loadCart();
} catch (error) {
  showError(error.message);
}
