import { APIRequestContext } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { addToCart, asUser, expectError, getCart, getCouponStatus, getOrders, getStock, placeOrder } from '../support/api';
import { COUPONS, MISSING, PRODUCTS, USERS } from '../support/test-data';

const { mug, jeans, shoes, inactive } = PRODUCTS;
const order = (request: APIRequestContext, userId: number, couponCode?: string) =>
  request.post('/api/orders', { headers: asUser(userId), data: couponCode ? { couponCode } : {} });

test.describe('주문 생성', () => {
  test('API-ORD-001 장바구니 상품으로 주문이 만들어진다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 2);

    const res = await order(request, USERS.alice);

    expect(res.status()).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({
      status: 'PLACED',
      subtotalAmount: jeans.price * 2,
      discountAmount: 0,
      totalAmount: jeans.price * 2,
      couponCode: null,
      canceledAt: null,
    });
    expect(created.items).toEqual([
      {
        productId: jeans.id,
        productName: jeans.name,
        unitPrice: jeans.price,
        quantity: 2,
        lineTotal: jeans.price * 2,
      },
    ]);
    expect(created.id).toBeGreaterThan(0);
  });

  test('API-ORD-002 주문하면 재고가 줄고 장바구니가 비워진다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 2);

    await order(request, USERS.alice);

    expect(await getStock(request, jeans.id)).toBe(jeans.stock - 2);
    expect((await getCart(request, USERS.alice)).items).toEqual([]);
  });

  test('여러 상품을 한 번에 주문하면 각각의 재고가 줄어든다', async ({ request }) => {
    await addToCart(request, USERS.alice, mug.id, 2);
    await addToCart(request, USERS.alice, shoes.id, 1);

    const created = await (await order(request, USERS.alice)).json();

    expect(created.items).toHaveLength(2);
    expect(created.subtotalAmount).toBe(mug.price * 2 + shoes.price);
    expect(await getStock(request, mug.id)).toBe(mug.stock - 2);
    expect(await getStock(request, shoes.id)).toBe(shoes.stock - 1);
  });

  test('API-ORD-003 쿠폰을 쓰면 결제금액이 깎이고 쿠폰이 사용 처리된다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);

    const created = await (await order(request, USERS.alice, COUPONS.welcome.code)).json();

    expect(created).toMatchObject({
      subtotalAmount: jeans.price,
      discountAmount: COUPONS.welcome.discountAmount,
      totalAmount: jeans.price - COUPONS.welcome.discountAmount,
      couponCode: COUPONS.welcome.code,
    });
    expect(await getCouponStatus(request, USERS.alice, COUPONS.welcome.code)).toBe('USED');
  });

  test('내가 쿠폰을 써도 다른 손님의 같은 쿠폰은 그대로다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);

    await order(request, USERS.alice, COUPONS.welcome.code);

    expect(await getCouponStatus(request, USERS.bob, COUPONS.welcome.code)).toBe('AVAILABLE');
  });

  test('주문 목록과 상세를 조회할 수 있고, 최신 주문이 먼저 온다', async ({ request }) => {
    await addToCart(request, USERS.alice, mug.id, 1);
    const first = await placeOrder(request, USERS.alice);
    await addToCart(request, USERS.alice, jeans.id, 1);
    const second = await placeOrder(request, USERS.alice);

    const orders = await getOrders(request, USERS.alice);
    expect(orders.map((o: { id: number }) => o.id)).toEqual([second.id, first.id]);

    const detail = await request.get(`/api/orders/${first.id}`, { headers: asUser(USERS.alice) });
    expect(detail.status()).toBe(200);
    expect(await detail.json()).toMatchObject({ id: first.id, totalAmount: mug.price });
  });
});

test.describe('주문이 거절되는 경우', () => {
  test('API-ORD-006 빈 장바구니로 주문하면 422', async ({ request }) => {
    const res = await order(request, USERS.alice);

    await expectError(res, 422, 'CART_EMPTY');
    expect(await getOrders(request, USERS.alice)).toEqual([]);
  });

  test('API-ORD-004 담아 둔 사이 다른 손님이 사 가면 409이고 상태가 변하지 않는다', async ({ request }) => {
    await addToCart(request, USERS.alice, shoes.id, shoes.stock);
    await addToCart(request, USERS.bob, shoes.id, shoes.stock - 1);
    await placeOrder(request, USERS.bob); // 재고 1만 남는다

    const res = await order(request, USERS.alice);

    await expectError(res, 409, 'OUT_OF_STOCK');
    expect(await getStock(request, shoes.id)).toBe(1);
    expect((await getCart(request, USERS.alice)).items).toHaveLength(1);
    expect(await getOrders(request, USERS.alice)).toEqual([]);
  });

  test('API-ORD-005 여러 상품 중 하나만 부족해도 주문 전체가 취소된다', async ({ request }) => {
    await addToCart(request, USERS.alice, mug.id, 2);
    await addToCart(request, USERS.alice, shoes.id, shoes.stock);
    await addToCart(request, USERS.bob, shoes.id, shoes.stock);
    await placeOrder(request, USERS.bob); // 러닝화 재고 0

    const res = await order(request, USERS.alice, COUPONS.welcome.code);

    await expectError(res, 409, 'OUT_OF_STOCK');
    // 부족하지 않았던 상품의 재고, 쿠폰, 장바구니 모두 그대로여야 한다
    expect(await getStock(request, mug.id)).toBe(mug.stock);
    expect(await getCouponStatus(request, USERS.alice, COUPONS.welcome.code)).toBe('AVAILABLE');
    expect((await getCart(request, USERS.alice)).items).toHaveLength(2);
    expect(await getOrders(request, USERS.alice)).toEqual([]);
  });

  test('API-ORD-007 사용한 쿠폰으로 다시 주문하면 409이고 재고도 줄지 않는다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);
    await placeOrder(request, USERS.alice, COUPONS.welcome.code);
    await addToCart(request, USERS.alice, jeans.id, 1);

    const res = await order(request, USERS.alice, COUPONS.welcome.code);

    await expectError(res, 409, 'COUPON_ALREADY_USED');
    expect(await getStock(request, jeans.id)).toBe(jeans.stock - 1); // 첫 주문 몫만 반영
    expect((await getCart(request, USERS.alice)).items).toHaveLength(1);
    expect(await getOrders(request, USERS.alice)).toHaveLength(1);
  });

  test('최소 주문금액 미달 쿠폰으로 주문하면 422이고 아무것도 바뀌지 않는다', async ({ request }) => {
    await addToCart(request, USERS.alice, mug.id, 2); // 20,000원

    const res = await order(request, USERS.alice, COUPONS.welcome.code);

    await expectError(res, 422, 'COUPON_MIN_AMOUNT_NOT_MET');
    expect(await getStock(request, mug.id)).toBe(mug.stock);
    expect(await getCouponStatus(request, USERS.alice, COUPONS.welcome.code)).toBe('AVAILABLE');
    expect((await getCart(request, USERS.alice)).items).toHaveLength(1);
    expect(await getOrders(request, USERS.alice)).toEqual([]);
  });

  test('없는 쿠폰 코드로 주문하면 404이고 재고가 줄지 않는다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);

    await expectError(await order(request, USERS.alice, MISSING.couponCode), 404, 'COUPON_NOT_FOUND');
    expect(await getStock(request, jeans.id)).toBe(jeans.stock);
  });

  test('주문 API도 X-User-Id가 없으면 401', async ({ request }) => {
    await expectError(await request.post('/api/orders', { data: {} }), 401, 'UNAUTHORIZED');
    await expectError(await request.get('/api/orders'), 401, 'UNAUTHORIZED');
  });
});

test.describe('동시 주문', () => {
  test('두 손님이 마지막 재고를 동시에 주문하면 한 명만 성공한다', async ({ request }) => {
    await addToCart(request, USERS.alice, shoes.id, shoes.stock);
    await addToCart(request, USERS.bob, shoes.id, shoes.stock);

    // 두 요청을 동시에 보낸다
    const [aliceRes, bobRes] = await Promise.all([order(request, USERS.alice), order(request, USERS.bob)]);

    const statuses = [aliceRes.status(), bobRes.status()].sort();
    expect(statuses).toEqual([201, 409]); // 한쪽은 성공, 한쪽은 재고 부족
    expect(await getStock(request, shoes.id)).toBe(0); // 음수가 되지 않는다
    expect((await getOrders(request, USERS.alice)).length + (await getOrders(request, USERS.bob)).length).toBe(1);
  });
});

test.describe('주문 기록', () => {
  test('주문 항목에 그 시점의 상품 이름과 가격이 저장된다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);
    const created = await placeOrder(request, USERS.alice);

    // 주문 이후 상품 가격이 바뀌어도 기록이 유지되는지는
    // 상품 정보를 직접 수정할 수 있는 서비스 테스트에서 확인한다.
    // (tests/unit/order-rules.test.js '주문 상품은 주문 시점의 이름과 가격을 저장한다')
    const detail = await (await request.get(`/api/orders/${created.id}`, { headers: asUser(USERS.alice) })).json();

    expect(detail.items[0]).toMatchObject({ productName: jeans.name, unitPrice: jeans.price });
    expect(detail.totalAmount).toBe(jeans.price);
  });

  test('판매 중지 상품은 장바구니에 담는 단계에서 막힌다', async ({ request }) => {
    // 담은 뒤에 판매 중지된 경우의 주문 거절은 서비스 테스트에서 확인한다.
    // (tests/unit/order-rules.test.js 'BR-O2: 주문 전에 판매 중지된 상품이...')
    const res = await request.post('/api/cart/items', {
      headers: asUser(USERS.alice),
      data: { productId: inactive.id, quantity: 1 },
    });

    await expectError(res, 422, 'PRODUCT_NOT_PURCHASABLE');
  });

  test('없는 주문 조회는 404, 남의 주문도 404', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);
    const created = await placeOrder(request, USERS.alice);

    await expectError(
      await request.get(`/api/orders/${MISSING.orderId}`, { headers: asUser(USERS.alice) }),
      404,
      'ORDER_NOT_FOUND'
    );
    await expectError(
      await request.get(`/api/orders/${created.id}`, { headers: asUser(USERS.bob) }),
      404,
      'ORDER_NOT_FOUND'
    );
  });
});
