// app을 임시 포트로 띄워서 환경별 라우트 등록과 공통 에러 응답을 확인한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../../app/app');
const { openDatabase, resetDatabase } = require('../../app/db/database');

async function startServer(env) {
  const db = openDatabase(':memory:');
  resetDatabase(db);
  const app = createApp({ db, env });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { db, baseUrl, close: () => new Promise((resolve) => server.close(resolve)) };
}

test('GET /api/health는 200과 status ok를 반환한다', async (t) => {
  const server = await startServer('development');
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/health`);

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('GET /api/users는 seed 사용자 목록을 반환한다', async (t) => {
  const server = await startServer('development');
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/users`);

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    users: [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ],
  });
});

test('test 환경에서 POST /api/test/reset은 DB를 seed 상태로 되돌린다', async (t) => {
  const server = await startServer('test');
  t.after(server.close);
  server.db.prepare('UPDATE products SET stock = 0 WHERE id = 2').run();

  const res = await fetch(`${server.baseUrl}/api/test/reset`, { method: 'POST' });

  assert.equal(res.status, 204);
  assert.equal(server.db.prepare('SELECT stock FROM products WHERE id = 2').get().stock, 5);
});

for (const env of ['development', 'production']) {
  test(`${env} 환경에는 reset API가 없다 (404, DB 변경 없음)`, async (t) => {
    const server = await startServer(env);
    t.after(server.close);
    server.db.prepare('UPDATE products SET stock = 0 WHERE id = 2').run();

    const res = await fetch(`${server.baseUrl}/api/test/reset`, { method: 'POST' });

    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'NOT_FOUND');
    assert.equal(server.db.prepare('SELECT stock FROM products WHERE id = 2').get().stock, 0);
  });
}

test('없는 API 경로는 404 NOT_FOUND JSON을 반환한다', async (t) => {
  const server = await startServer('development');
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/unknown`);

  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), {
    error: { code: 'NOT_FOUND', message: 'GET /api/unknown 경로가 없습니다.' },
  });
});

test('잘못된 JSON 본문은 400 VALIDATION_ERROR를 반환한다', async (t) => {
  const server = await startServer('test');
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/test/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ broken json',
  });

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
});

// ---------------------------------------------------------------------------
// 점검에서 드러난 구멍: 서비스가 올바른 에러를 "던지는가"는 확인했지만
// 그 에러가 HTTP 응답으로 제대로 "전달되는가"는 확인하지 않았다.
// 아래는 실제 HTTP 요청으로 상태 코드와 응답 형식을 고정한다.
// ---------------------------------------------------------------------------

function request(server, method, path, { userId, body } = {}) {
  const headers = {};
  if (userId !== undefined) headers['X-User-Id'] = String(userId);
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  return fetch(`${server.baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function expectError(res, status, code) {
  assert.equal(res.status, status);
  const payload = await res.json();
  assert.equal(payload.error.code, code);
  assert.equal(typeof payload.error.message, 'string');
  assert.ok(payload.error.message.length > 0);
}

// 인증: 사용자별 API는 모두 X-User-Id가 필요하다.
for (const [name, path, method] of [
  ['장바구니 조회', '/api/cart', 'GET'],
  ['쿠폰 목록', '/api/coupons', 'GET'],
  ['주문 목록', '/api/orders', 'GET'],
]) {
  test(`${name}: X-User-Id 헤더가 없으면 401`, async (t) => {
    const server = await startServer('test');
    t.after(server.close);

    await expectError(await request(server, method, path), 401, 'UNAUTHORIZED');
  });
}

for (const [label, userId] of [
  ['형식이 틀린 값', 'abc'],
  ['0', '0'],
  ['존재하지 않는 사용자', '999'],
  ['아주 큰 수', '99999999999999999999'],
]) {
  test(`X-User-Id가 ${label}이면 401`, async (t) => {
    const server = await startServer('test');
    t.after(server.close);

    await expectError(await request(server, 'GET', '/api/cart', { userId }), 401, 'UNAUTHORIZED');
  });
}

test('장바구니 담기: 정상 요청은 201과 장바구니 내용을 돌려준다', async (t) => {
  const server = await startServer('test');
  t.after(server.close);

  const res = await request(server, 'POST', '/api/cart/items', { userId: 1, body: { productId: 2, quantity: 2 } });

  assert.equal(res.status, 201);
  const cart = await res.json();
  assert.equal(cart.items[0].quantity, 2);
  assert.equal(cart.subtotal, 70000);
});

// 비즈니스 규칙 위반이 각각 약속된 상태 코드로 전달되는지 확인한다.
test('재고 초과 담기는 409 OUT_OF_STOCK', async (t) => {
  const server = await startServer('test');
  t.after(server.close);

  const res = await request(server, 'POST', '/api/cart/items', { userId: 1, body: { productId: 2, quantity: 6 } });

  await expectError(res, 409, 'OUT_OF_STOCK');
});

test('판매 중지 상품은 422 PRODUCT_NOT_PURCHASABLE', async (t) => {
  const server = await startServer('test');
  t.after(server.close);

  const res = await request(server, 'POST', '/api/cart/items', { userId: 1, body: { productId: 5, quantity: 1 } });

  await expectError(res, 422, 'PRODUCT_NOT_PURCHASABLE');
});

test('없는 상품은 404 PRODUCT_NOT_FOUND', async (t) => {
  const server = await startServer('test');
  t.after(server.close);

  const res = await request(server, 'POST', '/api/cart/items', { userId: 1, body: { productId: 999, quantity: 1 } });

  await expectError(res, 404, 'PRODUCT_NOT_FOUND');
});

for (const quantity of [0, -1, 1.5, '1', 'abc', null]) {
  test(`수량이 ${JSON.stringify(quantity)}이면 400 VALIDATION_ERROR`, async (t) => {
    const server = await startServer('test');
    t.after(server.close);

    const res = await request(server, 'POST', '/api/cart/items', { userId: 1, body: { productId: 1, quantity } });

    await expectError(res, 400, 'VALIDATION_ERROR');
    const cart = await (await request(server, 'GET', '/api/cart', { userId: 1 })).json();
    assert.deepEqual(cart.items, []); // 거절된 요청은 장바구니를 바꾸지 않는다
  });
}

test('빈 장바구니 주문은 422 CART_EMPTY', async (t) => {
  const server = await startServer('test');
  t.after(server.close);

  await expectError(await request(server, 'POST', '/api/orders', { userId: 1, body: {} }), 422, 'CART_EMPTY');
});

test('최소 주문금액 미달 쿠폰은 422 COUPON_MIN_AMOUNT_NOT_MET', async (t) => {
  const server = await startServer('test');
  t.after(server.close);
  await request(server, 'POST', '/api/cart/items', { userId: 1, body: { productId: 1, quantity: 2 } });

  const res = await request(server, 'POST', '/api/checkout/preview', {
    userId: 1,
    body: { couponCode: 'WELCOME5000' },
  });

  await expectError(res, 422, 'COUPON_MIN_AMOUNT_NOT_MET');
});

test('사용한 쿠폰 재사용은 409 COUPON_ALREADY_USED', async (t) => {
  const server = await startServer('test');
  t.after(server.close);
  await request(server, 'POST', '/api/cart/items', { userId: 1, body: { productId: 2, quantity: 1 } });
  await request(server, 'POST', '/api/orders', { userId: 1, body: { couponCode: 'WELCOME5000' } });
  await request(server, 'POST', '/api/cart/items', { userId: 1, body: { productId: 2, quantity: 1 } });

  const res = await request(server, 'POST', '/api/orders', { userId: 1, body: { couponCode: 'WELCOME5000' } });

  await expectError(res, 409, 'COUPON_ALREADY_USED');
});

test('중복 취소는 409 ORDER_ALREADY_CANCELED', async (t) => {
  const server = await startServer('test');
  t.after(server.close);
  await request(server, 'POST', '/api/cart/items', { userId: 1, body: { productId: 2, quantity: 1 } });
  const order = await (await request(server, 'POST', '/api/orders', { userId: 1, body: {} })).json();
  await request(server, 'POST', `/api/orders/${order.id}/cancel`, { userId: 1 });

  const res = await request(server, 'POST', `/api/orders/${order.id}/cancel`, { userId: 1 });

  await expectError(res, 409, 'ORDER_ALREADY_CANCELED');
  const product = await (await request(server, 'GET', '/api/products/2')).json();
  assert.equal(product.stock, 5); // 재고가 두 번 복구되지 않는다
});

test('남의 주문 취소는 404 ORDER_NOT_FOUND', async (t) => {
  const server = await startServer('test');
  t.after(server.close);
  await request(server, 'POST', '/api/cart/items', { userId: 1, body: { productId: 2, quantity: 1 } });
  const order = await (await request(server, 'POST', '/api/orders', { userId: 1, body: {} })).json();

  await expectError(await request(server, 'POST', `/api/orders/${order.id}/cancel`, { userId: 2 }), 404, 'ORDER_NOT_FOUND');
});

test('주문 id 형식이 틀리면 400 VALIDATION_ERROR', async (t) => {
  const server = await startServer('test');
  t.after(server.close);

  await expectError(await request(server, 'POST', '/api/orders/abc/cancel', { userId: 1 }), 400, 'VALIDATION_ERROR');
});

test('본문이 너무 크면 서버 오류(500)가 아니라 요청 오류로 답한다', async (t) => {
  const server = await startServer('test');
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/cart/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': '1' },
    body: JSON.stringify({ productId: 1, quantity: 1, pad: 'a'.repeat(200000) }),
  });

  assert.ok(res.status >= 400 && res.status < 500, `4xx를 기대했지만 ${res.status}`);
  assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
});

test('/api 밖의 없는 주소도 같은 JSON 형식으로 답한다', async (t) => {
  const server = await startServer('test');
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/nope`);

  assert.equal(res.status, 404);
  assert.equal(res.headers.get('content-type')?.includes('application/json'), true);
  assert.equal((await res.json()).error.code, 'NOT_FOUND');
});
