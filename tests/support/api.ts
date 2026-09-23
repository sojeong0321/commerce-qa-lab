// 테스트에서 반복되는 요청을 모아 둔 얇은 helper.
// 검증 대상 요청은 테스트 안에서 직접 호출하고, 준비/확인용 요청만 여기서 처리한다.
import { APIRequestContext, expect } from '@playwright/test';

export const asUser = (userId: number) => ({ 'X-User-Id': String(userId) });

export async function resetDatabase(request: APIRequestContext) {
  const res = await request.post('/api/test/reset');
  expect(res.status(), 'DB 초기화 실패').toBe(204);
}

/** 준비 단계에서 장바구니에 담는다. 실패하면 테스트를 바로 멈춘다. */
export async function addToCart(
  request: APIRequestContext,
  userId: number,
  productId: number,
  quantity: number
) {
  const res = await request.post('/api/cart/items', {
    headers: asUser(userId),
    data: { productId, quantity },
  });
  expect(res.status(), `준비 실패: 상품 ${productId} ${quantity}개 담기`).toBe(201);
}

/** 준비 단계에서 주문한다. 생성된 주문을 돌려준다. */
export async function placeOrder(request: APIRequestContext, userId: number, couponCode?: string) {
  const res = await request.post('/api/orders', {
    headers: asUser(userId),
    data: couponCode ? { couponCode } : {},
  });
  expect(res.status(), '준비 실패: 주문 생성').toBe(201);
  return res.json();
}

// ---- 상태 확인 (DB를 직접 보지 않고 공개 조회 API로 확인한다) ----

export async function getStock(request: APIRequestContext, productId: number): Promise<number> {
  const res = await request.get(`/api/products/${productId}`);
  expect(res.status()).toBe(200);
  return (await res.json()).stock;
}

export async function getCart(request: APIRequestContext, userId: number) {
  const res = await request.get('/api/cart', { headers: asUser(userId) });
  expect(res.status()).toBe(200);
  return res.json();
}

export async function getCouponStatus(request: APIRequestContext, userId: number, code: string) {
  const res = await request.get('/api/coupons', { headers: asUser(userId) });
  expect(res.status()).toBe(200);
  const { coupons } = await res.json();
  return coupons.find((coupon: { code: string }) => coupon.code === code)?.status;
}

export async function getOrders(request: APIRequestContext, userId: number) {
  const res = await request.get('/api/orders', { headers: asUser(userId) });
  expect(res.status()).toBe(200);
  return (await res.json()).orders;
}

/** 에러 응답 형식({ error: { code, message } })과 상태 코드를 함께 확인한다. */
export async function expectError(
  res: { status(): number; json(): Promise<any> },
  status: number,
  code: string
) {
  expect(res.status(), `기대한 상태 코드 ${status}`).toBe(status);
  const body = await res.json();
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe('string');
  expect(body.error.message.length).toBeGreaterThan(0);
}
