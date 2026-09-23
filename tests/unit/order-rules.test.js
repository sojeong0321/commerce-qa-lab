// 주문/취소는 여러 테이블을 한 번에 바꾸므로 메모리 DB로 실제 동작을 확인한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase, resetDatabase } = require('../../app/db/database');
const { createProductService } = require('../../app/services/productService');
const { createCartService } = require('../../app/services/cartService');
const { createCouponService } = require('../../app/services/couponService');
const { createOrderService } = require('../../app/services/orderService');

const ALICE = 1;
const BOB = 2;
const MUG = 1; // 10,000원 / 재고 20
const JEANS = 2; // 35,000원 / 재고 5
const SHOES = 3; // 89,000원 / 재고 3

function setup() {
  const db = openDatabase(':memory:');
  resetDatabase(db);
  const productService = createProductService(db);
  const cartService = createCartService(db, productService);
  const couponService = createCouponService(db);
  const orderService = createOrderService(db, { productService, cartService, couponService });
  return { db, productService, cartService, couponService, orderService };
}

const stockOf = (db, id) => db.prepare('SELECT stock FROM products WHERE id = ?').get(id).stock;
const couponStatus = (db, userId, couponId) =>
  db.prepare('SELECT status FROM user_coupons WHERE user_id = ? AND coupon_id = ?').get(userId, couponId).status;

function assertRejected(fn, status, code) {
  assert.throws(fn, (err) => err.status === status && err.code === code);
}

test('BR-O1/O3: 장바구니 상품으로 주문이 만들어진다', () => {
  const { cartService, orderService } = setup();
  cartService.addItem(ALICE, JEANS, 2);

  const order = orderService.createOrder(ALICE, undefined);

  assert.equal(order.status, 'PLACED');
  assert.equal(order.subtotalAmount, 70000);
  assert.equal(order.discountAmount, 0);
  assert.equal(order.totalAmount, 70000);
  assert.deepEqual(order.items, [
    { productId: JEANS, productName: '데님 팬츠', unitPrice: 35000, quantity: 2, lineTotal: 70000 },
  ]);
});

test('BR-O3: 주문하면 재고가 줄고 장바구니가 비워진다', () => {
  const { db, cartService, orderService } = setup();
  cartService.addItem(ALICE, JEANS, 2);

  orderService.createOrder(ALICE, undefined);

  assert.equal(stockOf(db, JEANS), 3);
  assert.deepEqual(cartService.getCart(ALICE).items, []);
});

test('BR-CP4: 쿠폰을 쓴 주문은 금액이 깎이고 쿠폰이 USED가 된다', () => {
  const { db, cartService, orderService } = setup();
  cartService.addItem(ALICE, JEANS, 1);

  const order = orderService.createOrder(ALICE, 'WELCOME5000');

  assert.equal(order.subtotalAmount, 35000);
  assert.equal(order.discountAmount, 5000);
  assert.equal(order.totalAmount, 30000);
  assert.equal(order.couponCode, 'WELCOME5000');
  assert.equal(couponStatus(db, ALICE, 1), 'USED');
});

test('BR-CP3: 이미 사용한 쿠폰으로 다시 주문할 수 없고, 재고도 줄지 않는다', () => {
  const { db, cartService, orderService } = setup();
  cartService.addItem(ALICE, JEANS, 1);
  orderService.createOrder(ALICE, 'WELCOME5000');
  cartService.addItem(ALICE, JEANS, 1);

  assertRejected(() => orderService.createOrder(ALICE, 'WELCOME5000'), 409, 'COUPON_ALREADY_USED');

  assert.equal(stockOf(db, JEANS), 4); // 첫 주문 1개만 반영
  assert.equal(cartService.getCart(ALICE).items.length, 1); // 장바구니도 그대로
  assert.equal(orderService.listOrders(ALICE).length, 1);
});

test('BR-O1: 빈 장바구니로 주문하면 CART_EMPTY', () => {
  const { orderService } = setup();

  assertRejected(() => orderService.createOrder(ALICE, undefined), 422, 'CART_EMPTY');
});

test('BR-O2: 담아 둔 사이 재고가 줄면 주문이 거절된다', () => {
  const { db, cartService, orderService } = setup();
  cartService.addItem(ALICE, SHOES, 3); // 재고 3 전부 담기
  cartService.addItem(BOB, SHOES, 2);
  orderService.createOrder(BOB, undefined); // Bob이 먼저 2개 주문 → 재고 1

  assertRejected(() => orderService.createOrder(ALICE, undefined), 409, 'OUT_OF_STOCK');

  assert.equal(stockOf(db, SHOES), 1);
  assert.equal(cartService.getCart(ALICE).items.length, 1);
});

test('BR-O2: 여러 상품 중 하나만 부족해도 주문 전체가 취소된다 (rollback)', () => {
  const { db, cartService, orderService } = setup();
  cartService.addItem(ALICE, MUG, 2);
  cartService.addItem(ALICE, SHOES, 3);
  cartService.addItem(BOB, SHOES, 3);
  orderService.createOrder(BOB, undefined); // 러닝화 재고 0

  assertRejected(() => orderService.createOrder(ALICE, 'WELCOME5000'), 409, 'OUT_OF_STOCK');

  // 부족하지 않았던 머그컵 재고도 그대로여야 한다.
  assert.equal(stockOf(db, MUG), 20);
  assert.equal(stockOf(db, SHOES), 0);
  assert.equal(couponStatus(db, ALICE, 1), 'AVAILABLE');
  assert.equal(cartService.getCart(ALICE).items.length, 2);
  assert.equal(orderService.listOrders(ALICE).length, 0);
});

test('BR-O2: 주문 전에 판매 중지된 상품이 들어 있으면 주문할 수 없다', () => {
  const { db, cartService, orderService } = setup();
  cartService.addItem(ALICE, MUG, 1);
  db.prepare("UPDATE products SET status = 'INACTIVE' WHERE id = ?").run(MUG);

  assertRejected(() => orderService.createOrder(ALICE, undefined), 422, 'PRODUCT_NOT_PURCHASABLE');

  assert.equal(stockOf(db, MUG), 20);
});

test('BR-X1/X2: 주문을 취소하면 상태가 바뀌고 재고가 복구된다', () => {
  const { db, cartService, orderService } = setup();
  cartService.addItem(ALICE, JEANS, 2);
  const order = orderService.createOrder(ALICE, undefined);
  assert.equal(stockOf(db, JEANS), 3);

  const canceled = orderService.cancelOrder(ALICE, order.id);

  assert.equal(canceled.status, 'CANCELED');
  assert.ok(canceled.canceledAt);
  assert.equal(stockOf(db, JEANS), 5);
});

test('BR-CP6: 취소하면 쿠폰이 복구되어 다시 쓸 수 있다', () => {
  const { db, cartService, orderService } = setup();
  cartService.addItem(ALICE, JEANS, 1);
  const order = orderService.createOrder(ALICE, 'WELCOME5000');
  assert.equal(couponStatus(db, ALICE, 1), 'USED');

  orderService.cancelOrder(ALICE, order.id);
  assert.equal(couponStatus(db, ALICE, 1), 'AVAILABLE');

  // 같은 쿠폰으로 다시 주문할 수 있어야 한다.
  cartService.addItem(ALICE, JEANS, 1);
  const second = orderService.createOrder(ALICE, 'WELCOME5000');
  assert.equal(second.totalAmount, 30000);
});

test('BR-X3: 같은 주문을 두 번 취소할 수 없고, 재고가 두 번 복구되지 않는다', () => {
  const { db, cartService, orderService } = setup();
  cartService.addItem(ALICE, JEANS, 2);
  const order = orderService.createOrder(ALICE, undefined);
  orderService.cancelOrder(ALICE, order.id);

  assertRejected(() => orderService.cancelOrder(ALICE, order.id), 409, 'ORDER_ALREADY_CANCELED');

  assert.equal(stockOf(db, JEANS), 5); // 7이 되면 안 된다
});

test('BR-X3: 두 번째 취소는 쿠폰 상태도 건드리지 않는다', () => {
  const { db, cartService, orderService, couponService } = setup();
  cartService.addItem(ALICE, JEANS, 1);
  const order = orderService.createOrder(ALICE, 'WELCOME5000');
  orderService.cancelOrder(ALICE, order.id);
  // 복구된 쿠폰을 다른 주문에 다시 사용
  cartService.addItem(ALICE, JEANS, 1);
  orderService.createOrder(ALICE, 'WELCOME5000');
  assert.equal(couponStatus(db, ALICE, 1), 'USED');

  assertRejected(() => orderService.cancelOrder(ALICE, order.id), 409, 'ORDER_ALREADY_CANCELED');

  // 두 번째 취소가 무시되었으므로 새 주문의 쿠폰은 USED 그대로여야 한다.
  assert.equal(couponStatus(db, ALICE, 1), 'USED');
  assert.equal(couponService.listMyCoupons(ALICE)[0].status, 'USED');
});

test('BR-X4: 없는 주문 취소는 404', () => {
  const { orderService } = setup();

  assertRejected(() => orderService.cancelOrder(ALICE, 999), 404, 'ORDER_NOT_FOUND');
});

test('BR-X4: 남의 주문은 조회도 취소도 할 수 없다 (404)', () => {
  const { db, cartService, orderService } = setup();
  cartService.addItem(ALICE, JEANS, 1);
  const order = orderService.createOrder(ALICE, undefined);

  assertRejected(() => orderService.getOrder(BOB, order.id), 404, 'ORDER_NOT_FOUND');
  assertRejected(() => orderService.cancelOrder(BOB, order.id), 404, 'ORDER_NOT_FOUND');

  assert.equal(stockOf(db, JEANS), 4); // 재고가 복구되지 않아야 한다
  assert.equal(orderService.getOrder(ALICE, order.id).status, 'PLACED');
});

test('주문 상품은 주문 시점의 이름과 가격을 저장한다', () => {
  const { db, cartService, orderService } = setup();
  cartService.addItem(ALICE, JEANS, 1);
  const order = orderService.createOrder(ALICE, undefined);

  db.prepare('UPDATE products SET price = 50000, name = ? WHERE id = ?').run('데님 팬츠 II', JEANS);

  const saved = orderService.getOrder(ALICE, order.id);
  assert.equal(saved.items[0].unitPrice, 35000);
  assert.equal(saved.items[0].productName, '데님 팬츠');
  assert.equal(saved.totalAmount, 35000);
});

test('주문 목록은 최신 주문이 먼저 나온다', () => {
  const { cartService, orderService } = setup();
  cartService.addItem(ALICE, MUG, 1);
  const first = orderService.createOrder(ALICE, undefined);
  cartService.addItem(ALICE, JEANS, 1);
  const second = orderService.createOrder(ALICE, undefined);

  assert.deepEqual(
    orderService.listOrders(ALICE).map((o) => o.id),
    [second.id, first.id]
  );
});
