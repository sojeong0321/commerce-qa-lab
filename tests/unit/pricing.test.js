const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateSubtotal,
  isCouponApplicable,
  calculateDiscount,
  calculateTotal,
} = require('../../app/services/pricing');

const WELCOME5000 = { code: 'WELCOME5000', discountAmount: 5000, minOrderAmount: 30000 };

test('빈 장바구니의 상품 금액은 0원이다', () => {
  assert.equal(calculateSubtotal([]), 0);
});

test('상품 금액은 가격 × 수량의 합이다', () => {
  const items = [
    { price: 10000, quantity: 3 },
    { price: 35000, quantity: 1 },
  ];

  assert.equal(calculateSubtotal(items), 65000);
});

// BR-CP2 경계값 분석: 최소 주문금액 30,000원
test('경계값: 29,999원은 쿠폰을 쓸 수 없다', () => {
  assert.equal(isCouponApplicable(29999, WELCOME5000), false);
});

test('경계값: 정확히 30,000원이면 쿠폰을 쓸 수 있다', () => {
  assert.equal(isCouponApplicable(30000, WELCOME5000), true);
});

test('경계값: 30,001원이면 쿠폰을 쓸 수 있다', () => {
  assert.equal(isCouponApplicable(30001, WELCOME5000), true);
});

test('쿠폰이 없으면 할인은 0원이다', () => {
  assert.equal(calculateDiscount(50000, null), 0);
});

test('정액 쿠폰은 정해진 금액만큼 할인한다', () => {
  assert.equal(calculateDiscount(35000, WELCOME5000), 5000);
});

test('할인 금액은 상품 금액을 넘지 않는다 (결제금액이 음수가 되지 않는다)', () => {
  const bigCoupon = { code: 'BIG10000', discountAmount: 10000, minOrderAmount: 0 };

  const discount = calculateDiscount(3000, bigCoupon);

  assert.equal(discount, 3000);
  assert.equal(calculateTotal(3000, discount), 0);
});

test('결제금액 = 상품 금액 - 할인 금액', () => {
  assert.equal(calculateTotal(35000, 5000), 30000);
});
