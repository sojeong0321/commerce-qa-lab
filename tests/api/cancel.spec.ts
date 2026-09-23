import { test, expect } from '../support/fixtures';
import { addToCart, asUser, expectError, getCouponStatus, getStock, placeOrder } from '../support/api';
import { COUPONS, MISSING, PRODUCTS, USERS } from '../support/test-data';

const { mug, jeans, shoes } = PRODUCTS;
const cancel = (request: any, userId: number, orderId: number) =>
  request.post(`/api/orders/${orderId}/cancel`, { headers: asUser(userId) });

test.describe('주문 취소', () => {
  test('API-CNL-001 정상 주문을 취소하면 상태가 바뀐다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 2);
    const created = await placeOrder(request, USERS.alice);

    const res = await cancel(request, USERS.alice, created.id);

    expect(res.status()).toBe(200);
    const canceled = await res.json();
    expect(canceled.status).toBe('CANCELED');
    expect(canceled.canceledAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  test('API-CNL-002 취소하면 재고가 원래대로 복구된다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 2);
    const created = await placeOrder(request, USERS.alice);
    expect(await getStock(request, jeans.id)).toBe(jeans.stock - 2);

    await cancel(request, USERS.alice, created.id);

    expect(await getStock(request, jeans.id)).toBe(jeans.stock);
  });

  test('여러 상품 주문을 취소하면 모든 상품의 재고가 복구된다', async ({ request }) => {
    await addToCart(request, USERS.alice, mug.id, 2);
    await addToCart(request, USERS.alice, shoes.id, 1);
    const created = await placeOrder(request, USERS.alice);

    await cancel(request, USERS.alice, created.id);

    expect(await getStock(request, mug.id)).toBe(mug.stock);
    expect(await getStock(request, shoes.id)).toBe(shoes.stock);
  });

  test('API-CPN-006 취소하면 쿠폰이 복구되어 다시 쓸 수 있다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);
    const created = await placeOrder(request, USERS.alice, COUPONS.welcome.code);
    expect(await getCouponStatus(request, USERS.alice, COUPONS.welcome.code)).toBe('USED');

    await cancel(request, USERS.alice, created.id);

    expect(await getCouponStatus(request, USERS.alice, COUPONS.welcome.code)).toBe('AVAILABLE');

    // 복구된 쿠폰으로 다시 주문할 수 있어야 한다
    await addToCart(request, USERS.alice, jeans.id, 1);
    const second = await placeOrder(request, USERS.alice, COUPONS.welcome.code);
    expect(second.totalAmount).toBe(jeans.price - COUPONS.welcome.discountAmount);
  });

  test('취소하면 그 주문에 쓴 쿠폰만 복구된다', async ({ request }) => {
    await addToCart(request, USERS.alice, shoes.id, 2); // 178,000원 → BIG10000 사용
    const created = await placeOrder(request, USERS.alice, COUPONS.big.code);

    await cancel(request, USERS.alice, created.id);

    expect(await getCouponStatus(request, USERS.alice, COUPONS.big.code)).toBe('AVAILABLE');
    expect(await getCouponStatus(request, USERS.alice, COUPONS.welcome.code)).toBe('AVAILABLE');
  });
});

test.describe('취소가 거절되는 경우', () => {
  test('API-CNL-003 같은 주문을 두 번 취소할 수 없고 재고도 두 번 늘지 않는다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 2);
    const created = await placeOrder(request, USERS.alice);
    await cancel(request, USERS.alice, created.id);

    const res = await cancel(request, USERS.alice, created.id);

    await expectError(res, 409, 'ORDER_ALREADY_CANCELED');
    expect(await getStock(request, jeans.id)).toBe(jeans.stock); // 7이 되면 안 된다
  });

  test('두 번째 취소는 쿠폰 상태도 건드리지 않는다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);
    const created = await placeOrder(request, USERS.alice, COUPONS.welcome.code);
    await cancel(request, USERS.alice, created.id);
    // 복구된 쿠폰을 새 주문에 다시 사용한다
    await addToCart(request, USERS.alice, jeans.id, 1);
    await placeOrder(request, USERS.alice, COUPONS.welcome.code);

    await expectError(await cancel(request, USERS.alice, created.id), 409, 'ORDER_ALREADY_CANCELED');

    // 두 번째 취소가 무시되었으므로 새 주문의 쿠폰은 사용 상태 그대로여야 한다
    expect(await getCouponStatus(request, USERS.alice, COUPONS.welcome.code)).toBe('USED');
  });

  test('API-CNL-004 없는 주문을 취소하면 404', async ({ request }) => {
    await expectError(await cancel(request, USERS.alice, MISSING.orderId), 404, 'ORDER_NOT_FOUND');
  });

  test('API-CNL-005 남의 주문은 취소할 수 없고 상태도 변하지 않는다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);
    const created = await placeOrder(request, USERS.alice);

    await expectError(await cancel(request, USERS.bob, created.id), 404, 'ORDER_NOT_FOUND');

    expect(await getStock(request, jeans.id)).toBe(jeans.stock - 1);
    const detail = await (await request.get(`/api/orders/${created.id}`, { headers: asUser(USERS.alice) })).json();
    expect(detail.status).toBe('PLACED');
  });

  test('API-VAL-004 주문 id 형식이 틀리면 400', async ({ request }) => {
    await expectError(await cancel(request, USERS.alice, 'abc' as unknown as number), 400, 'VALIDATION_ERROR');
    await expectError(await cancel(request, USERS.alice, 0), 400, 'VALIDATION_ERROR');
  });

  test('취소 API도 X-User-Id가 없으면 401', async ({ request }) => {
    await expectError(await request.post('/api/orders/1/cancel'), 401, 'UNAUTHORIZED');
  });
});
