const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateSubtotal } = require('../../app/services/pricing');

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
