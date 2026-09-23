-- 이 파일은 DB를 "처음 상태"로 만든다.
-- 실행할 때마다 기존 테이블을 지우고 다시 만들기 때문에 resetDatabase()에서 그대로 사용한다.
-- 외래키 제약 때문에 자식 테이블부터 지운다.

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS user_coupons;
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE products (
  id     INTEGER PRIMARY KEY,
  name   TEXT NOT NULL,
  price  INTEGER NOT NULL CHECK (price > 0),
  stock  INTEGER NOT NULL CHECK (stock >= 0),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE cart_items (
  id         INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity   INTEGER NOT NULL CHECK (quantity >= 1),
  UNIQUE (user_id, product_id)
);

CREATE TABLE coupons (
  id               INTEGER PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,
  discount_amount  INTEGER NOT NULL CHECK (discount_amount > 0),
  min_order_amount INTEGER NOT NULL CHECK (min_order_amount >= 0)
);

CREATE TABLE user_coupons (
  id        INTEGER PRIMARY KEY,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  coupon_id INTEGER NOT NULL REFERENCES coupons(id),
  status    TEXT NOT NULL CHECK (status IN ('AVAILABLE', 'USED')),
  used_at   TEXT,
  UNIQUE (user_id, coupon_id)
);

CREATE TABLE orders (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  status          TEXT NOT NULL CHECK (status IN ('PLACED', 'CANCELED')),
  subtotal_amount INTEGER NOT NULL,
  discount_amount INTEGER NOT NULL DEFAULT 0,
  total_amount    INTEGER NOT NULL CHECK (total_amount >= 0),
  user_coupon_id  INTEGER REFERENCES user_coupons(id),
  coupon_code     TEXT,                                  -- 주문 시점 snapshot (쿠폰 이름이 바뀌어도 주문 기록은 그대로)
  created_at      TEXT NOT NULL,
  canceled_at     TEXT
);

CREATE TABLE order_items (
  id           INTEGER PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id),
  product_id   INTEGER NOT NULL REFERENCES products(id),
  product_name TEXT NOT NULL,
  unit_price   INTEGER NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity >= 1)
);
