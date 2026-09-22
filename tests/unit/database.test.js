const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase, resetDatabase, ensureDatabase } = require('../../app/db/database');

const TABLES = ['users', 'products', 'cart_items', 'coupons', 'user_coupons', 'orders', 'order_items'];

function snapshot(db) {
  const result = {};
  for (const table of TABLES) {
    result[table] = db.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
  }
  return result;
}

function newDb() {
  const db = openDatabase(':memory:');
  resetDatabase(db);
  return db;
}

test('reset 후 seed 데이터가 정확히 들어간다', () => {
  const db = newDb();

  assert.deepEqual(db.prepare('SELECT id, name FROM users ORDER BY id').all(), [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
  ]);
  assert.deepEqual(db.prepare('SELECT id, name, price, stock, status FROM products ORDER BY id').all(), [
    { id: 1, name: '머그컵', price: 10000, stock: 20, status: 'ACTIVE' },
    { id: 2, name: '데님 팬츠', price: 35000, stock: 5, status: 'ACTIVE' },
    { id: 3, name: '러닝화', price: 89000, stock: 3, status: 'ACTIVE' },
    { id: 4, name: '에코백', price: 15000, stock: 0, status: 'ACTIVE' },
    { id: 5, name: '단종 모자', price: 20000, stock: 10, status: 'INACTIVE' },
  ]);
  assert.deepEqual(
    db.prepare('SELECT code, discount_amount, min_order_amount FROM coupons ORDER BY id').all(),
    [
      { code: 'WELCOME5000', discount_amount: 5000, min_order_amount: 30000 },
      { code: 'BIG10000', discount_amount: 10000, min_order_amount: 100000 },
    ]
  );
  assert.deepEqual(
    db.prepare('SELECT user_id, coupon_id, status FROM user_coupons ORDER BY id').all(),
    [
      { user_id: 1, coupon_id: 1, status: 'AVAILABLE' },
      { user_id: 1, coupon_id: 2, status: 'AVAILABLE' },
      { user_id: 2, coupon_id: 1, status: 'AVAILABLE' },
    ]
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM cart_items').get().c, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM orders').get().c, 0);
});

test('reset을 두 번 해도 완전히 같은 상태가 된다', () => {
  const db = newDb();
  const first = snapshot(db);

  resetDatabase(db);

  assert.deepEqual(snapshot(db), first);
});

test('데이터를 바꾼 뒤 reset하면 seed 상태로 돌아온다', () => {
  const db = newDb();
  const initial = snapshot(db);

  db.prepare('UPDATE products SET stock = 0 WHERE id = 2').run();
  db.prepare("UPDATE user_coupons SET status = 'USED' WHERE id = 1").run();
  db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (1, 1, 2)').run();
  db.prepare(
    "INSERT INTO orders (user_id, status, subtotal_amount, total_amount, created_at) VALUES (1, 'PLACED', 10000, 10000, 'now')"
  ).run();
  assert.notDeepEqual(snapshot(db), initial);

  resetDatabase(db);

  assert.deepEqual(snapshot(db), initial);
});

test('ensureDatabase는 이미 있는 데이터를 지우지 않는다', () => {
  const db = newDb();
  db.prepare('UPDATE products SET stock = 7 WHERE id = 1').run();

  ensureDatabase(db);

  assert.equal(db.prepare('SELECT stock FROM products WHERE id = 1').get().stock, 7);
});

test('ensureDatabase는 빈 DB를 seed 상태로 만든다', () => {
  const db = openDatabase(':memory:');

  ensureDatabase(db);

  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM products').get().c, 5);
});

test('DB 제약조건: 재고는 음수가 될 수 없다', () => {
  const db = newDb();

  assert.throws(() => db.prepare('UPDATE products SET stock = -1 WHERE id = 1').run(), /CHECK constraint failed/);
});
