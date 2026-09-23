// 장바구니 규칙은 DB 상태(이미 담긴 수량, 현재 재고)에 달려 있으므로 메모리 DB로 확인한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase, resetDatabase } = require('../../app/db/database');
const { createProductService } = require('../../app/services/productService');
const { createCartService } = require('../../app/services/cartService');

const ALICE = 1;
const BOB = 2;
const MUG = 1; // 10,000원 / 재고 20
const JEANS = 2; // 35,000원 / 재고 5
const SOLD_OUT = 4; // 재고 0
const INACTIVE = 5; // 판매 중지

function setup() {
  const db = openDatabase(':memory:');
  resetDatabase(db);
  const productService = createProductService(db);
  return { db, cartService: createCartService(db, productService) };
}

function assertRejected(fn, status, code) {
  assert.throws(fn, (err) => err.status === status && err.code === code);
}

const stockOf = (db, id) => db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock;

test('BR-C1/C4: 담으면 장바구니에 들어가지만 재고는 줄지 않는다', () => {
  const { db, cartService } = setup();

  cartService.addItem(ALICE, JEANS, 2);

  const cart = cartService.getCart(ALICE);
  assert.equal(cart.items.length, 1);
  assert.deepEqual(cart.items[0], {
    productId: JEANS,
    name: '데님 팬츠',
    price: 35000,
    quantity: 2,
    lineTotal: 70000,
    stock: 5,
    status: 'ACTIVE',
    purchasable: true,
  });
  assert.equal(stockOf(db, JEANS), 5);
});

test('장바구니 합계는 상품별 금액의 합이고 수량도 합산된다', () => {
  const { cartService } = setup();
  cartService.addItem(ALICE, MUG, 3);
  cartService.addItem(ALICE, JEANS, 1);

  const cart = cartService.getCart(ALICE);

  assert.equal(cart.subtotal, 65000);
  assert.equal(cart.totalQuantity, 4);
  assert.equal(cart.orderable, true);
});

test('BR-C2: 같은 상품을 다시 담으면 수량이 합산된다', () => {
  const { cartService } = setup();
  cartService.addItem(ALICE, JEANS, 2);

  cartService.addItem(ALICE, JEANS, 1);

  const cart = cartService.getCart(ALICE);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 3);
});

test('BR-C2: 합산 수량이 재고를 넘으면 거절하고 기존 수량을 유지한다', () => {
  const { cartService } = setup();
  cartService.addItem(ALICE, JEANS, 3);

  assertRejected(() => cartService.addItem(ALICE, JEANS, 3), 409, 'OUT_OF_STOCK');

  assert.equal(cartService.getCart(ALICE).items[0].quantity, 3);
});

test('BR-C2 경계값: 재고와 같은 수량까지는 담을 수 있다', () => {
  const { cartService } = setup();

  cartService.addItem(ALICE, JEANS, 5);

  assert.equal(cartService.getCart(ALICE).items[0].quantity, 5);
  assertRejected(() => cartService.addItem(ALICE, JEANS, 1), 409, 'OUT_OF_STOCK');
});

test('BR-P2: 품절 상품은 담을 수 없다', () => {
  const { cartService } = setup();

  assertRejected(() => cartService.addItem(ALICE, SOLD_OUT, 1), 409, 'OUT_OF_STOCK');

  assert.deepEqual(cartService.getCart(ALICE).items, []);
});

test('BR-P3: 판매 중지 상품은 담을 수 없다', () => {
  const { cartService } = setup();

  assertRejected(() => cartService.addItem(ALICE, INACTIVE, 1), 422, 'PRODUCT_NOT_PURCHASABLE');

  assert.deepEqual(cartService.getCart(ALICE).items, []);
});

test('없는 상품은 담을 수 없다', () => {
  const { cartService } = setup();

  assertRejected(() => cartService.addItem(ALICE, 999, 1), 404, 'PRODUCT_NOT_FOUND');
});

test('BR-C3: 수량을 늘릴 때 재고를 넘으면 거절하고 기존 수량을 유지한다', () => {
  const { cartService } = setup();
  cartService.addItem(ALICE, JEANS, 2);

  assertRejected(() => cartService.changeQuantity(ALICE, JEANS, 6), 409, 'OUT_OF_STOCK');

  assert.equal(cartService.getCart(ALICE).items[0].quantity, 2);
});

test('BR-C3: 재고 범위 안에서는 수량을 바꿀 수 있다', () => {
  const { cartService } = setup();
  cartService.addItem(ALICE, JEANS, 2);

  cartService.changeQuantity(ALICE, JEANS, 5);

  assert.equal(cartService.getCart(ALICE).subtotal, 175000);
});

test('담아 둔 사이 품절되어도 수량을 줄일 수는 있다', () => {
  const { db, cartService } = setup();
  cartService.addItem(ALICE, JEANS, 3);
  db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run(JEANS);

  cartService.changeQuantity(ALICE, JEANS, 1); // 줄이기는 허용

  const cart = cartService.getCart(ALICE);
  assert.equal(cart.items[0].quantity, 1);
  assert.equal(cart.items[0].purchasable, false); // 다만 이 상태로는 주문할 수 없다
  assert.equal(cart.orderable, false);
  assertRejected(() => cartService.changeQuantity(ALICE, JEANS, 2), 409, 'OUT_OF_STOCK');
});

test('장바구니에 없는 상품의 수량 변경과 삭제는 404', () => {
  const { cartService } = setup();

  assertRejected(() => cartService.changeQuantity(ALICE, JEANS, 1), 404, 'CART_ITEM_NOT_FOUND');
  assertRejected(() => cartService.removeItem(ALICE, JEANS), 404, 'CART_ITEM_NOT_FOUND');
});

test('삭제하면 장바구니에서 빠지고 합계가 줄어든다', () => {
  const { cartService } = setup();
  cartService.addItem(ALICE, MUG, 1);
  cartService.addItem(ALICE, JEANS, 1);

  cartService.removeItem(ALICE, MUG);

  const cart = cartService.getCart(ALICE);
  assert.deepEqual(cart.items.map((i) => i.productId), [JEANS]);
  assert.equal(cart.subtotal, 35000);
});

test('빈 장바구니는 주문 가능 상태가 아니다', () => {
  const { cartService } = setup();

  assert.deepEqual(cartService.getCart(ALICE), { items: [], totalQuantity: 0, subtotal: 0, orderable: false });
});

test('손님끼리 장바구니가 섞이지 않는다', () => {
  const { cartService } = setup();
  cartService.addItem(ALICE, JEANS, 1);

  assert.deepEqual(cartService.getCart(BOB).items, []);
  assertRejected(() => cartService.removeItem(BOB, JEANS), 404, 'CART_ITEM_NOT_FOUND');
  assert.equal(cartService.getCart(ALICE).items.length, 1);
});
