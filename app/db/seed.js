// 테스트가 항상 같은 상태에서 시작할 수 있도록 고정된(deterministic) 초기 데이터.
// ID를 직접 지정해서 reset 후에도 ID가 바뀌지 않게 한다.

const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com' },
  { id: 2, name: 'Bob', email: 'bob@example.com' },
];

const products = [
  // 머그컵 3개 = 30,000원 → 쿠폰 최소 주문금액 경계값 테스트용
  { id: 1, name: '머그컵', price: 10000, stock: 20, status: 'ACTIVE' },
  { id: 2, name: '데님 팬츠', price: 35000, stock: 5, status: 'ACTIVE' },
  { id: 3, name: '러닝화', price: 89000, stock: 3, status: 'ACTIVE' },
  // 품절 상품
  { id: 4, name: '에코백', price: 15000, stock: 0, status: 'ACTIVE' },
  // 판매 중지 상품
  { id: 5, name: '단종 모자', price: 20000, stock: 10, status: 'INACTIVE' },
];

const coupons = [
  { id: 1, code: 'WELCOME5000', discountAmount: 5000, minOrderAmount: 30000 },
  { id: 2, code: 'BIG10000', discountAmount: 10000, minOrderAmount: 100000 },
];

const userCoupons = [
  { id: 1, userId: 1, couponId: 1 },
  { id: 2, userId: 1, couponId: 2 },
  { id: 3, userId: 2, couponId: 1 },
];

function insertSeed(db) {
  const insertUser = db.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)');
  for (const u of users) insertUser.run(u.id, u.name, u.email);

  const insertProduct = db.prepare(
    'INSERT INTO products (id, name, price, stock, status) VALUES (?, ?, ?, ?, ?)'
  );
  for (const p of products) insertProduct.run(p.id, p.name, p.price, p.stock, p.status);

  const insertCoupon = db.prepare(
    'INSERT INTO coupons (id, code, discount_amount, min_order_amount) VALUES (?, ?, ?, ?)'
  );
  for (const c of coupons) insertCoupon.run(c.id, c.code, c.discountAmount, c.minOrderAmount);

  const insertUserCoupon = db.prepare(
    "INSERT INTO user_coupons (id, user_id, coupon_id, status) VALUES (?, ?, ?, 'AVAILABLE')"
  );
  for (const uc of userCoupons) insertUserCoupon.run(uc.id, uc.userId, uc.couponId);
}

// 테스트는 이 값을 직접 쓰지 않고 tests/support/test-data.ts에 별도로 적어 둔다.
// (seed가 잘못 바뀌면 테스트가 함께 따라가 버려 오류를 잡지 못하기 때문)
module.exports = { insertSeed };
