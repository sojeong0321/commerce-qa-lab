import { api, formatWon, escapeHtml } from './api.js';
import { initLayout, refreshCartCount, showStatus, showError } from './layout.js';

const list = document.getElementById('product-list');

function badgeFor(product) {
  if (product.status !== 'ACTIVE') return '<span class="badge badge-muted">판매 중지</span>';
  if (product.soldOut) return '<span class="badge badge-danger">품절</span>';
  return '';
}

function renderProduct(product) {
  const nameId = `product-${product.id}-name`;
  const qtyId = `qty-${product.id}`;
  const buyForm = product.purchasable
    ? `<form class="add-form" data-product-id="${product.id}" novalidate>
         <label for="${qtyId}">수량</label>
         <input id="${qtyId}" name="quantity" type="number" min="1" step="1" value="1" inputmode="numeric">
         <button type="submit">장바구니 담기</button>
       </form>`
    : '<button type="button" disabled>구매 불가</button>';

  return `
    <li>
      <article class="product-card" aria-labelledby="${nameId}">
        <h2 id="${nameId}">${escapeHtml(product.name)}</h2>
        ${badgeFor(product)}
        <p class="price" data-testid="product-price">${formatWon(product.price)}</p>
        <p class="stock" data-testid="product-stock">재고 ${product.stock}개</p>
        ${buyForm}
      </article>
    </li>`;
}

async function loadProducts() {
  const { products } = await api('GET', '/api/products');
  list.innerHTML = products.map(renderProduct).join('');
}

// 수량 검증은 서버가 최종 판단한다. 화면은 입력값을 그대로 보내고 서버 메시지를 보여 준다.
list.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  const productId = Number(form.dataset.productId);
  const quantity = Number(form.elements.quantity.value);
  const name = form.closest('article').querySelector('h2').textContent;

  try {
    await api('POST', '/api/cart/items', { productId, quantity });
    showStatus(`${name} ${quantity}개를 장바구니에 담았습니다.`);
    await refreshCartCount();
  } catch (error) {
    showError(error.message);
  }
});

try {
  await initLayout();
  await loadProducts();
} catch (error) {
  showError(error.message);
}
