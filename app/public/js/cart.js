import { api, formatWon, escapeHtml } from './api.js';
import { initLayout, refreshCartCount, showStatus, showError } from './layout.js';

const container = document.getElementById('cart-content');
const couponSection = document.getElementById('coupon-section');
const couponForm = document.getElementById('coupon-form');
const couponInput = document.getElementById('coupon-code');
const couponList = document.getElementById('coupon-list');

// 적용 중인 쿠폰 코드. 금액은 항상 서버가 다시 계산한다. (BR-O4)
let appliedCouponCode = null;

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

function renderCart(checkout) {
  couponSection.hidden = checkout.items.length === 0;

  if (checkout.items.length === 0) {
    container.innerHTML = '<p class="empty">장바구니가 비어 있습니다. <a href="/">상품 보러 가기</a></p>';
    return;
  }

  const couponRow = checkout.coupon
    ? `<div class="applied-coupon">
         <dt>할인 금액 <span class="badge badge-ok">${escapeHtml(checkout.coupon.code)}</span></dt>
         <dd data-testid="cart-discount">-${formatWon(checkout.discount)}</dd>
       </div>`
    : `<div><dt>할인 금액</dt><dd data-testid="cart-discount">${formatWon(0)}</dd></div>`;

  container.innerHTML = `
    <div class="table-scroll">
      <table class="cart-table">
        <thead>
          <tr><th scope="col">상품</th><th scope="col">가격</th><th scope="col">수량</th><th scope="col">금액</th><th scope="col"><span class="visually-hidden">삭제</span></th></tr>
        </thead>
        <tbody>${checkout.items.map(renderRow).join('')}</tbody>
      </table>
    </div>
    <dl class="summary">
      <div><dt>상품 금액</dt><dd data-testid="cart-subtotal">${formatWon(checkout.subtotal)}</dd></div>
      ${couponRow}
      <div class="total-row"><dt>결제 예정 금액</dt><dd data-testid="cart-total">${formatWon(checkout.total)}</dd></div>
    </dl>
    <button type="button" id="order-button" class="order-button">주문하기</button>`;
}

function renderCoupons(coupons) {
  couponList.innerHTML = coupons
    .map(
      (c) => `<li>
        <b>${escapeHtml(c.code)}</b>
        <span>${formatWon(c.discountAmount)} 할인 · ${formatWon(c.minOrderAmount)} 이상</span>
        <span class="badge ${c.status === 'AVAILABLE' ? 'badge-ok' : 'badge-muted'}">${c.status === 'AVAILABLE' ? '사용 가능' : '사용 완료'}</span>
      </li>`
    )
    .join('');
}

// 장바구니와 쿠폰 적용 결과를 서버에서 다시 받아 화면을 그린다.
async function loadCart() {
  const checkout = await api('POST', '/api/checkout/preview', { couponCode: appliedCouponCode ?? undefined });
  renderCart(checkout);
  return checkout;
}

// 수량이 바뀌어 최소 주문금액에 미달하면 쿠폰을 자동으로 뗀다.
// 안내 문구는 여기서 바로 띄우지 않고 돌려준다. 호출한 쪽의 성공 메시지가 덮어쓰지 않도록.
async function reloadCheckout() {
  try {
    return { checkout: await loadCart(), notice: null };
  } catch (error) {
    if (appliedCouponCode && error.code === 'COUPON_MIN_AMOUNT_NOT_MET') {
      appliedCouponCode = null;
      return { checkout: await loadCart(), notice: `${error.message} 쿠폰 적용을 해제했습니다.` };
    }
    throw error;
  }
}

async function refreshCoupons() {
  const { coupons } = await api('GET', '/api/coupons');
  renderCoupons(coupons);
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
    await api('PATCH', `/api/cart/items/${productId}`, { quantity });
    const { notice } = await reloadCheckout();
    if (notice) showError(notice);
    else showStatus(`${name} 수량을 ${quantity}개로 변경했습니다.`);
    await refreshCartCount();
  } catch (error) {
    showError(error.message);
    await reloadCheckout(); // 실패하면 입력칸을 서버의 실제 수량으로 되돌린다.
  }
});

// 주문 생성. 금액과 재고, 쿠폰 사용 여부는 모두 서버가 다시 확인한다.
container.addEventListener('click', async (event) => {
  if (event.target.id !== 'order-button') return;
  event.target.disabled = true;

  try {
    const order = await api('POST', '/api/orders', { couponCode: appliedCouponCode ?? undefined });
    window.location.href = `/order-complete.html?orderId=${order.id}`;
  } catch (error) {
    showError(error.message);
    appliedCouponCode = error.code === 'COUPON_ALREADY_USED' ? null : appliedCouponCode;
    await reloadCheckout(); // 서버의 최신 상태(재고·금액)로 화면을 맞춘다.
    await refreshCartCount();
  }
});

container.addEventListener('click', async (event) => {
  if (!event.target.classList.contains('remove-button')) return;
  const productId = productIdOf(event.target);
  const name = event.target.closest('tr').querySelector('th').textContent;

  try {
    await api('DELETE', `/api/cart/items/${productId}`);
    const { notice } = await reloadCheckout();
    if (notice) showError(notice);
    else showStatus(`${name}을(를) 장바구니에서 삭제했습니다.`);
    await refreshCartCount();
  } catch (error) {
    showError(error.message);
  }
});

couponForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = couponInput.value.trim();
  const previous = appliedCouponCode;
  appliedCouponCode = code === '' ? null : code;

  try {
    const checkout = await loadCart();
    if (checkout.coupon) {
      showStatus(`쿠폰 ${checkout.coupon.code}을(를) 적용했습니다. ${formatWon(checkout.discount)} 할인`);
    } else {
      showStatus('쿠폰 적용을 해제했습니다.');
    }
  } catch (error) {
    appliedCouponCode = previous; // 적용에 실패하면 이전 상태를 유지한다.
    showError(error.message);
    await loadCart();
  }
});

try {
  await initLayout();
  await loadCart();
  await refreshCoupons();
} catch (error) {
  showError(error.message);
}
