// 쿠폰 사용 자격 판단은 DB 상태(누구의 쿠폰인지, 이미 썼는지)에 달려 있으므로
// 메모리 DB를 띄워서 확인한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase, resetDatabase } = require('../../app/db/database');
const { createCouponService } = require('../../app/services/couponService');

const ALICE = 1;
const BOB = 2;

function newService() {
  const db = openDatabase(':memory:');
  resetDatabase(db);
  return { db, couponService: createCouponService(db) };
}

function assertRejected(fn, status, code) {
  assert.throws(fn, (err) => err.status === status && err.code === code);
}

test('내 쿠폰 목록과 상태를 돌려준다', () => {
  const { couponService } = newService();

  assert.deepEqual(couponService.listMyCoupons(ALICE), [
    { code: 'WELCOME5000', discountAmount: 5000, minOrderAmount: 30000, status: 'AVAILABLE' },
    { code: 'BIG10000', discountAmount: 10000, minOrderAmount: 100000, status: 'AVAILABLE' },
  ]);
  assert.deepEqual(couponService.listMyCoupons(BOB), [
    { code: 'WELCOME5000', discountAmount: 5000, minOrderAmount: 30000, status: 'AVAILABLE' },
  ]);
});

test('BR-CP2: 최소 주문금액을 넘으면 할인 금액이 계산된다', () => {
  const { couponService } = newService();

  const amounts = couponService.calculateAmounts(ALICE, 35000, 'WELCOME5000');

  assert.equal(amounts.subtotal, 35000);
  assert.equal(amounts.discount, 5000);
  assert.equal(amounts.total, 30000);
  assert.equal(amounts.coupon.code, 'WELCOME5000');
});

test('BR-CP2 경계값: 정확히 30,000원이면 적용된다', () => {
  const { couponService } = newService();

  assert.equal(couponService.calculateAmounts(ALICE, 30000, 'WELCOME5000').total, 25000);
});

test('BR-CP2: 최소 주문금액 미달이면 422 COUPON_MIN_AMOUNT_NOT_MET', () => {
  const { couponService } = newService();

  assertRejected(
    () => couponService.calculateAmounts(ALICE, 20000, 'WELCOME5000'),
    422,
    'COUPON_MIN_AMOUNT_NOT_MET'
  );
});

test('쿠폰 없이 계산하면 할인 0원', () => {
  const { couponService } = newService();

  const amounts = couponService.calculateAmounts(ALICE, 20000, undefined);

  assert.deepEqual({ ...amounts, coupon: amounts.coupon }, {
    subtotal: 20000,
    discount: 0,
    total: 20000,
    coupon: null,
    userCouponId: null,
  });
});

test('BR-CP3: 이미 사용한 쿠폰은 409 COUPON_ALREADY_USED', () => {
  const { db, couponService } = newService();
  db.prepare("UPDATE user_coupons SET status = 'USED' WHERE user_id = 1 AND coupon_id = 1").run();

  assertRejected(() => couponService.getUsableCoupon(ALICE, 'WELCOME5000'), 409, 'COUPON_ALREADY_USED');
});

test('BR-CP3: 발급받지 않은 쿠폰은 404 COUPON_NOT_FOUND', () => {
  const { couponService } = newService();

  // BIG10000은 Alice에게만 발급되어 있다.
  assertRejected(() => couponService.getUsableCoupon(BOB, 'BIG10000'), 404, 'COUPON_NOT_FOUND');
});

test('존재하지 않는 쿠폰 코드는 404 COUPON_NOT_FOUND', () => {
  const { couponService } = newService();

  assertRejected(() => couponService.getUsableCoupon(ALICE, 'NOPE'), 404, 'COUPON_NOT_FOUND');
});

test('사용 여부 확인이 최소 주문금액 확인보다 먼저다', () => {
  const { db, couponService } = newService();
  db.prepare("UPDATE user_coupons SET status = 'USED' WHERE user_id = 1 AND coupon_id = 1").run();

  // 금액이 미달이어도 "이미 사용한 쿠폰" 이유가 먼저 나와야 한다.
  assertRejected(() => couponService.calculateAmounts(ALICE, 1000, 'WELCOME5000'), 409, 'COUPON_ALREADY_USED');
});

test('BR-CP4: 금액 계산만으로는 쿠폰 상태가 바뀌지 않는다', () => {
  const { db, couponService } = newService();

  couponService.calculateAmounts(ALICE, 35000, 'WELCOME5000');

  const status = db.prepare('SELECT status FROM user_coupons WHERE user_id = 1 AND coupon_id = 1').get().status;
  assert.equal(status, 'AVAILABLE');
});
