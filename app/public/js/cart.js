import { api, formatWon, escapeHtml } from './api.js';
import { initLayout, refreshCartCount, clearMessages, showStatus, showError } from './layout.js';

const container = document.getElementById('cart-content');
const couponSection = document.getElementById('coupon-section');
const couponForm = document.getElementById('coupon-form');
const couponInput = document.getElementById('coupon-code');
const couponList = document.getElementById('coupon-list');

// 적용 중인 쿠폰 코드. 금액은 항상 서버가 다시 계산한다. (BR-O4)
let appliedCouponCode = null;
// 응답이 엇갈려 도착해도 최신 요청의 결과만 그린다.
let checkoutToken = 0;
// 한 번에 하나의 동작만 처리한다. (연타로 인한 중복 요청과 메시지 뒤섞임 방지)
let busy = false;

function renderRow(item) {
  const qtyId = `cart-qty-${item.productId}`;
  const soldOutNote = item.purchasable
    ? ''
    : `<p class="row-warning">${item.status !== 'ACTIVE' ? '판매 중지된 상품입니다' : `재고가 ${item.stock}개 남았습니다`}</p>`;
  return `
    <tr data-product-id="${escapeHtml(item.productId)}" data-testid="cart-row-${escapeHtml(item.productId)}">
      <th scope="row"><span class="item-name">${escapeHtml(item.name)}</span>${soldOutNote}</th>
      <td class="num">${formatWon(item.price)}</td>
      <td>
        <form class="qty-form" novalidate>
          <label class="visually-hidden" for="${qtyId}">${escapeHtml(item.name)} 수량</label>
          <input id="${qtyId}" name="quantity" type="number" min="1" step="1" value="${escapeHtml(item.quantity)}" inputmode="numeric">
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

  // 주문할 수 없는 상품이 있으면 주문 버튼을 막고 이유를 먼저 보여 준다.
  const blockedNotice = checkout.orderable
    ? ''
    : `<p class="row-warning" data-testid="cart-blocked">지금 주문할 수 없는 상품이 있습니다: ${checkout.unavailableItems
        .map((item) => escapeHtml(item.name))
        .join(', ')}</p>`;

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
    ${blockedNotice}
    <button type="button" id="order-button" class="order-button"${checkout.orderable ? '' : ' disabled'}>주문하기</button>`;

  // 쿠폰 입력칸을 서버가 알려 준 실제 적용 상태와 맞춘다.
  couponInput.value = checkout.coupon ? checkout.coupon.code : '';
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
  const token = ++checkoutToken;
  const checkout = await api('POST', '/api/checkout/preview', { couponCode: appliedCouponCode ?? undefined });
  if (token !== checkoutToken) return null; // 더 최신 요청이 있으면 이 결과는 버린다.
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

// 모든 동작을 같은 방식으로 감싼다: 이전 메시지 지우기 → 처리 → 결과 메시지 → 중복 실행 방지 해제.
async function runAction(fn) {
  if (busy) return;
  busy = true;
  clearMessages();
  try {
    await fn();
  } catch (error) {
    showError(error.message);
    try {
      await reloadCheckout(); // 실패해도 화면은 서버의 실제 상태로 맞춘다.
      await refreshCartCount();
    } catch {
      // 복구 요청까지 실패하면 이미 보여 준 에러 메시지를 유지한다.
    }
  } finally {
    busy = false;
  }
}

function productIdOf(element) {
  return Number(element.closest('tr').dataset.productId);
}

container.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  const productId = productIdOf(form);
  const quantity = Number(form.elements.quantity.value);
  const name = form.closest('tr').querySelector('.item-name').textContent;

  runAction(async () => {
    await api('PATCH', `/api/cart/items/${productId}`, { quantity });
    const { notice } = await reloadCheckout();
    if (notice) showError(notice);
    else showStatus(`${name} 수량을 ${quantity}개로 변경했습니다.`);
    await refreshCartCount();
  });
});

container.addEventListener('click', (event) => {
  const target = event.target;

  if (target.id === 'order-button') {
    // 주문 생성. 금액과 재고, 쿠폰 사용 여부는 모두 서버가 다시 확인한다.
    runAction(async () => {
      const order = await api('POST', '/api/orders', { couponCode: appliedCouponCode ?? undefined });
      window.location.href = `/order-complete.html?orderId=${order.id}`;
    });
    return;
  }

  if (target.classList.contains('remove-button')) {
    const productId = productIdOf(target);
    const name = target.closest('tr').querySelector('.item-name').textContent;

    runAction(async () => {
      await api('DELETE', `/api/cart/items/${productId}`);
      const { notice } = await reloadCheckout();
      if (notice) showError(notice);
      else showStatus(`${name}을(를) 장바구니에서 삭제했습니다.`);
      await refreshCartCount();
    });
  }
});

couponForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = couponInput.value.trim();

  runAction(async () => {
    const previous = appliedCouponCode;
    appliedCouponCode = code === '' ? null : code;
    try {
      const checkout = await loadCart();
      if (checkout?.coupon) {
        showStatus(`쿠폰 ${checkout.coupon.code}을(를) 적용했습니다. ${formatWon(checkout.discount)} 할인`);
      } else {
        showStatus('쿠폰 적용을 해제했습니다.');
      }
    } catch (error) {
      appliedCouponCode = previous; // 적용에 실패하면 이전 상태를 유지한다.
      throw error;
    }
  });
});

document.getElementById('coupon-clear').addEventListener('click', () => {
  runAction(async () => {
    appliedCouponCode = null;
    await loadCart();
    showStatus('쿠폰 적용을 해제했습니다.');
  });
});

try {
  await initLayout();
} catch (error) {
  showError(error.message);
}
try {
  await loadCart();
  await refreshCoupons();
} catch (error) {
  showError(error.message);
}
