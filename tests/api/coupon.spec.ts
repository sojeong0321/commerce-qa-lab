import { APIRequestContext } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { addToCart, asUser, expectError, getCouponStatus, placeOrder } from '../support/api';
import { COUPONS, MISSING, PRODUCTS, USERS } from '../support/test-data';

const { mug, jeans, shoes } = PRODUCTS;
const preview = (request: APIRequestContext, userId: number, couponCode?: string) =>
  request.post('/api/checkout/preview', {
    headers: asUser(userId),
    data: couponCode ? { couponCode } : {},
  });

test.describe('쿠폰 조회', () => {
  test('내 쿠폰 목록과 상태를 돌려준다', async ({ request }) => {
    const res = await request.get('/api/coupons', { headers: asUser(USERS.alice) });

    expect(res.status()).toBe(200);
    expect((await res.json()).coupons).toEqual([
      { ...COUPONS.welcome, status: 'AVAILABLE' },
      { ...COUPONS.big, status: 'AVAILABLE' },
    ]);
  });

  test('손님마다 보유 쿠폰이 다르다', async ({ request }) => {
    const res = await request.get('/api/coupons', { headers: asUser(USERS.bob) });

    expect((await res.json()).coupons).toEqual([{ ...COUPONS.welcome, status: 'AVAILABLE' }]);
  });
});

test.describe('쿠폰 적용 (금액 미리보기)', () => {
  test('쿠폰 없이 계산하면 할인 0원이다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);

    const res = await preview(request, USERS.alice);

    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({
      subtotal: jeans.price,
      discount: 0,
      total: jeans.price,
      coupon: null,
      orderable: true,
    });
  });

  test('API-CPN-001 쿠폰을 적용하면 정액만큼 깎인다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);

    const res = await preview(request, USERS.alice, COUPONS.welcome.code);

    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({
      subtotal: jeans.price,
      discount: COUPONS.welcome.discountAmount,
      total: jeans.price - COUPONS.welcome.discountAmount,
      coupon: { code: COUPONS.welcome.code },
    });
  });

  test('API-CPN-003 경계값: 최소 주문금액과 정확히 같으면 적용된다', async ({ request }) => {
    // 머그컵 3개 = 정확히 30,000원
    await addToCart(request, USERS.alice, mug.id, 3);
    expect(mug.price * 3).toBe(COUPONS.welcome.minOrderAmount);

    const res = await preview(request, USERS.alice, COUPONS.welcome.code);

    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({
      subtotal: COUPONS.welcome.minOrderAmount,
      discount: COUPONS.welcome.discountAmount,
      total: COUPONS.welcome.minOrderAmount - COUPONS.welcome.discountAmount,
    });
  });

  test('API-CPN-002 최소 주문금액에 미달하면 422이고 금액도 알려 준다', async ({ request }) => {
    await addToCart(request, USERS.alice, mug.id, 2); // 20,000원

    const res = await preview(request, USERS.alice, COUPONS.welcome.code);

    await expectError(res, 422, 'COUPON_MIN_AMOUNT_NOT_MET');
    const body = await res.json();
    expect(body.error.message).toContain('30,000원');
    expect(body.error.message).toContain('20,000원');
  });

  test('API-CPN-004b 미리보기만으로는 쿠폰이 사용되지 않는다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);

    await preview(request, USERS.alice, COUPONS.welcome.code);
    await preview(request, USERS.alice, COUPONS.welcome.code);

    expect(await getCouponStatus(request, USERS.alice, COUPONS.welcome.code)).toBe('AVAILABLE');
  });

  test('API-CPN-005 발급받지 않은 쿠폰은 404', async ({ request }) => {
    await addToCart(request, USERS.bob, shoes.id, 2); // 178,000원 (금액은 충분하다)

    const res = await preview(request, USERS.bob, COUPONS.big.code);

    await expectError(res, 404, 'COUPON_NOT_FOUND');
  });

  test('없는 쿠폰 코드는 404', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);

    await expectError(await preview(request, USERS.alice, MISSING.couponCode), 404, 'COUPON_NOT_FOUND');
  });

  test('쿠폰 코드는 대소문자를 구분한다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);

    await expectError(
      await preview(request, USERS.alice, COUPONS.welcome.code.toLowerCase()),
      404,
      'COUPON_NOT_FOUND'
    );
  });

  test('API-CPN-004 사용한 쿠폰은 409이고, 사유가 금액 조건보다 먼저 판정된다', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);
    await placeOrder(request, USERS.alice, COUPONS.welcome.code);
    expect(await getCouponStatus(request, USERS.alice, COUPONS.welcome.code)).toBe('USED');

    // 금액이 미달인 장바구니로도 "이미 사용한 쿠폰"이 먼저 나와야 한다
    await addToCart(request, USERS.alice, mug.id, 1); // 10,000원
    const res = await preview(request, USERS.alice, COUPONS.welcome.code);

    await expectError(res, 409, 'COUPON_ALREADY_USED');
  });

  test('쿠폰 코드 형식이 틀리면 400', async ({ request }) => {
    await addToCart(request, USERS.alice, jeans.id, 1);

    await expectError(
      await request.post('/api/checkout/preview', { headers: asUser(USERS.alice), data: { couponCode: 123 } }),
      400,
      'VALIDATION_ERROR'
    );
    await expectError(
      await request.post('/api/checkout/preview', { headers: asUser(USERS.alice), data: { couponCode: '  ' } }),
      400,
      'VALIDATION_ERROR'
    );
  });

  test('미리보기는 주문할 수 없는 상품을 함께 알려 준다', async ({ request }) => {
    await addToCart(request, USERS.alice, shoes.id, shoes.stock);
    await addToCart(request, USERS.bob, shoes.id, shoes.stock);
    await placeOrder(request, USERS.bob); // 러닝화 재고 0

    const res = await preview(request, USERS.alice);

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.orderable).toBe(false);
    expect(body.unavailableItems).toEqual([
      { productId: shoes.id, name: shoes.name, reason: 'OUT_OF_STOCK', stock: 0 },
    ]);
  });

  test('빈 장바구니는 금액 0원이고 주문 가능 상태가 아니다', async ({ request }) => {
    const res = await preview(request, USERS.alice);

    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ subtotal: 0, discount: 0, total: 0, orderable: false });
  });

  test('미리보기도 X-User-Id가 없으면 401', async ({ request }) => {
    await expectError(await request.post('/api/checkout/preview', { data: {} }), 401, 'UNAUTHORIZED');
    await expectError(await request.get('/api/coupons'), 401, 'UNAUTHORIZED');
  });
});
