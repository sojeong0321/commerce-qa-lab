import { test, expect } from '../support/fixtures';
import { addToCart, asUser, expectError, getCart, getStock } from '../support/api';
import { MISSING, PRODUCTS, USERS } from '../support/test-data';

const { mug, jeans, soldOut, inactive } = PRODUCTS;

test.describe('장바구니 담기', () => {
  test('API-CRT-001 상품을 담으면 201과 장바구니를 돌려주고, 재고는 줄지 않는다', async ({ request }) => {
    const res = await request.post('/api/cart/items', {
      headers: asUser(USERS.alice),
      data: { productId: jeans.id, quantity: 2 },
    });

    expect(res.status()).toBe(201);
    const cart = await res.json();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({
      productId: jeans.id,
      name: jeans.name,
      price: jeans.price,
      quantity: 2,
      lineTotal: jeans.price * 2,
      purchasable: true,
    });
    expect(cart.subtotal).toBe(jeans.price * 2);
    expect(cart.totalQuantity).toBe(2);
    expect(cart.orderable).toBe(true);
    // BR-C4: 담기만 해서는 재고가 줄지 않는다
    expect(await getStock(request, jeans.id)).toBe(jeans.stock);
  });

  test('API-CRT-002 같은 상품을 다시 담으면 수량이 합산된다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 2);

    const res = await request.post('/api/cart/items', {
      headers: asUser(USERS.alice),
      data: { productId: jeans.id, quantity: 1 },
    });

    expect(res.status()).toBe(201);
    const cart = await res.json();
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
  });

  test('API-CRT-005 재고보다 많이 담으면 409이고 장바구니는 그대로다', async ({ request }) => {
    const res = await request.post('/api/cart/items', {
      headers: asUser(USERS.alice),
      data: { productId: jeans.id, quantity: jeans.stock + 1 },
    });

    await expectError(res, 409, 'OUT_OF_STOCK');
    expect((await getCart(request, USERS.alice)).items).toEqual([]);
  });

  test('API-CRT-006 합산 수량이 재고를 넘으면 409이고 기존 수량이 유지된다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 3);

    const res = await request.post('/api/cart/items', {
      headers: asUser(USERS.alice),
      data: { productId: jeans.id, quantity: 3 },
    });

    await expectError(res, 409, 'OUT_OF_STOCK');
    expect((await getCart(request, USERS.alice)).items[0].quantity).toBe(3);
  });

  test('경계값: 재고와 같은 수량까지는 담을 수 있다', async ({ request }) => {
    const ok = await request.post('/api/cart/items', {
      headers: asUser(USERS.alice),
      data: { productId: jeans.id, quantity: jeans.stock },
    });
    expect(ok.status()).toBe(201);

    const over = await request.post('/api/cart/items', {
      headers: asUser(USERS.alice),
      data: { productId: jeans.id, quantity: 1 },
    });
    await expectError(over, 409, 'OUT_OF_STOCK');
  });

  test('API-CRT-008 품절 상품은 409', async ({ request }) => {
    const res = await request.post('/api/cart/items', {
      headers: asUser(USERS.alice),
      data: { productId: soldOut.id, quantity: 1 },
    });

    await expectError(res, 409, 'OUT_OF_STOCK');
    expect((await getCart(request, USERS.alice)).items).toEqual([]);
  });

  test('API-CRT-009 판매 중지 상품은 422', async ({ request }) => {
    const res = await request.post('/api/cart/items', {
      headers: asUser(USERS.alice),
      data: { productId: inactive.id, quantity: 1 },
    });

    await expectError(res, 422, 'PRODUCT_NOT_PURCHASABLE');
    expect((await getCart(request, USERS.alice)).items).toEqual([]);
  });

  test('없는 상품은 404', async ({ request }) => {
    const res = await request.post('/api/cart/items', {
      headers: asUser(USERS.alice),
      data: { productId: MISSING.productId, quantity: 1 },
    });

    await expectError(res, 404, 'PRODUCT_NOT_FOUND');
  });
});

test.describe('장바구니 수량 변경과 삭제', () => {
  test('API-CRT-003 수량을 바꾸면 합계도 함께 바뀐다', async ({ request }) => {
    await addToCart(request, USERS.alice, mug.id, 1);

    const res = await request.patch(`/api/cart/items/${mug.id}`, {
      headers: asUser(USERS.alice),
      data: { quantity: 3 },
    });

    expect(res.status()).toBe(200);
    const cart = await res.json();
    expect(cart.items[0].quantity).toBe(3);
    expect(cart.subtotal).toBe(mug.price * 3);
  });

  test('API-CRT-007 재고를 넘는 수량 변경은 409이고 기존 수량이 유지된다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 2);

    const res = await request.patch(`/api/cart/items/${jeans.id}`, {
      headers: asUser(USERS.alice),
      data: { quantity: jeans.stock + 1 },
    });

    await expectError(res, 409, 'OUT_OF_STOCK');
    expect((await getCart(request, USERS.alice)).items[0].quantity).toBe(2);
  });

  test('담아 둔 사이 품절되어도 수량을 줄일 수는 있다', async ({ request }) => {
    await addToCart(request, USERS.alice, PRODUCTS.shoes.id, 2);
    // 다른 손님이 남은 재고를 모두 사 간다
    await addToCart(request, USERS.bob, PRODUCTS.shoes.id, PRODUCTS.shoes.stock);
    await request.post('/api/orders', { headers: asUser(USERS.bob), data: {} });
    expect(await getStock(request, PRODUCTS.shoes.id)).toBe(0);

    const res = await request.patch(`/api/cart/items/${PRODUCTS.shoes.id}`, {
      headers: asUser(USERS.alice),
      data: { quantity: 1 },
    });

    expect(res.status()).toBe(200);
    const cart = await res.json();
    expect(cart.items[0].quantity).toBe(1);
    expect(cart.items[0].purchasable).toBe(false); // 다만 이 상태로는 주문할 수 없다
    expect(cart.orderable).toBe(false);
  });

  test('API-CRT-004 삭제하면 204이고 장바구니에서 빠진다', async ({ request }) => {
    await addToCart(request, USERS.alice, mug.id, 1);
    await addToCart(request, USERS.alice, jeans.id, 1);

    const res = await request.delete(`/api/cart/items/${mug.id}`, { headers: asUser(USERS.alice) });

    expect(res.status()).toBe(204);
    const cart = await getCart(request, USERS.alice);
    expect(cart.items.map((i: { productId: number }) => i.productId)).toEqual([jeans.id]);
    expect(cart.subtotal).toBe(jeans.price);
  });

  test('장바구니에 없는 상품의 변경/삭제는 404', async ({ request }) => {
    await expectError(
      await request.patch(`/api/cart/items/${jeans.id}`, { headers: asUser(USERS.alice), data: { quantity: 1 } }),
      404,
      'CART_ITEM_NOT_FOUND'
    );
    await expectError(
      await request.delete(`/api/cart/items/${jeans.id}`, { headers: asUser(USERS.alice) }),
      404,
      'CART_ITEM_NOT_FOUND'
    );
  });

  test('빈 장바구니는 주문 가능 상태가 아니다', async ({ request }) => {
    expect(await getCart(request, USERS.alice)).toEqual({
      items: [],
      totalQuantity: 0,
      subtotal: 0,
      orderable: false,
    });
  });
});

test.describe('장바구니 요청 검증', () => {
  // 동등 분할: 0, 음수, 소수, 문자열, 값 없음
  for (const quantity of [0, -1, 1.5, '1', 'abc', null]) {
    test(`API-VAL-001 수량이 ${JSON.stringify(quantity)}이면 400이고 장바구니는 비어 있다`, async ({ request }) => {
      const res = await request.post('/api/cart/items', {
        headers: asUser(USERS.alice),
        data: { productId: mug.id, quantity },
      });

      await expectError(res, 400, 'VALIDATION_ERROR');
      expect((await getCart(request, USERS.alice)).items).toEqual([]);
    });
  }

  test('API-VAL-001b 필수 값이 빠지면 400', async ({ request }) => {
    await expectError(
      await request.post('/api/cart/items', { headers: asUser(USERS.alice), data: { productId: mug.id } }),
      400,
      'VALIDATION_ERROR'
    );
    await expectError(
      await request.post('/api/cart/items', { headers: asUser(USERS.alice), data: { quantity: 1 } }),
      400,
      'VALIDATION_ERROR'
    );
  });

  test('API-VAL-002 본문이 올바른 JSON이 아니면 400', async ({ request }) => {
    const res = await request.post('/api/cart/items', {
      headers: { ...asUser(USERS.alice), 'Content-Type': 'application/json' },
      data: '{ broken json',
    });

    await expectError(res, 400, 'VALIDATION_ERROR');
  });

  test('API-VAL-003 X-User-Id가 없거나 잘못되면 401', async ({ request }) => {
    await expectError(await request.get('/api/cart'), 401, 'UNAUTHORIZED');
    await expectError(await request.get('/api/cart', { headers: { 'X-User-Id': 'abc' } }), 401, 'UNAUTHORIZED');
    await expectError(await request.get('/api/cart', { headers: { 'X-User-Id': '0' } }), 401, 'UNAUTHORIZED');
    await expectError(await request.get('/api/cart', { headers: { 'X-User-Id': '999' } }), 401, 'UNAUTHORIZED');
  });

  test('API-VAL-004 경로의 상품 id 형식이 틀리면 400', async ({ request }) => {
    await expectError(
      await request.patch('/api/cart/items/abc', { headers: asUser(USERS.alice), data: { quantity: 1 } }),
      400,
      'VALIDATION_ERROR'
    );
  });

  test('손님끼리 장바구니가 섞이지 않는다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);

    expect((await getCart(request, USERS.bob)).items).toEqual([]);
    await expectError(
      await request.delete(`/api/cart/items/${jeans.id}`, { headers: asUser(USERS.bob) }),
      404,
      'CART_ITEM_NOT_FOUND'
    );
    expect((await getCart(request, USERS.alice)).items).toHaveLength(1);
  });
});
