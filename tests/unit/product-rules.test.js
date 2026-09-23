const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toProductDto, assertCanBuy } = require('../../app/services/productService');

const active = { id: 2, name: '데님 팬츠', price: 35000, stock: 5, status: 'ACTIVE' };

function assertRejected(fn, status, code) {
  assert.throws(fn, (err) => err.status === status && err.code === code);
}

test('재고가 있는 ACTIVE 상품은 구매 가능하다', () => {
  assert.deepEqual(toProductDto(active), { ...active, soldOut: false, purchasable: true });
});

test('BR-P2: 재고 0이면 품절이고 구매 불가다', () => {
  const dto = toProductDto({ ...active, stock: 0 });
  assert.equal(dto.soldOut, true);
  assert.equal(dto.purchasable, false);
});

test('BR-P3: INACTIVE 상품은 재고가 있어도 구매 불가다', () => {
  const dto = toProductDto({ ...active, status: 'INACTIVE' });
  assert.equal(dto.soldOut, false);
  assert.equal(dto.purchasable, false);
});

test('BR-C2 경계값: 재고와 같은 수량은 허용한다', () => {
  assert.doesNotThrow(() => assertCanBuy(active, 5));
});

test('BR-C2 경계값: 재고 + 1 수량은 OUT_OF_STOCK', () => {
  assertRejected(() => assertCanBuy(active, 6), 409, 'OUT_OF_STOCK');
});

test('BR-P2: 품절 상품은 1개도 OUT_OF_STOCK', () => {
  assertRejected(() => assertCanBuy({ ...active, stock: 0 }, 1), 409, 'OUT_OF_STOCK');
});

test('BR-P3: 판매 중지 상품은 PRODUCT_NOT_PURCHASABLE', () => {
  assertRejected(() => assertCanBuy({ ...active, status: 'INACTIVE' }, 1), 422, 'PRODUCT_NOT_PURCHASABLE');
});
