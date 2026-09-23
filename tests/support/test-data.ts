// app/db/seed.js 의 초기 데이터와 같은 값.
// 테스트 기대값을 매직 넘버 대신 여기서 가져온다.
// 일부러 복사해 두었다: 애플리케이션 코드를 그대로 import 하면
// seed가 잘못 바뀌어도 테스트가 같이 따라가 버려 오류를 잡지 못한다.

export const USERS = {
  alice: 1,
  bob: 2,
} as const;

export const PRODUCTS = {
  mug: { id: 1, name: '머그컵', price: 10_000, stock: 20 }, // 3개 = 30,000원 (쿠폰 경계값)
  jeans: { id: 2, name: '데님 팬츠', price: 35_000, stock: 5 },
  shoes: { id: 3, name: '러닝화', price: 89_000, stock: 3 },
  soldOut: { id: 4, name: '에코백', price: 15_000, stock: 0 },
  inactive: { id: 5, name: '단종 모자', price: 20_000, stock: 10 },
} as const;

export const COUPONS = {
  welcome: { code: 'WELCOME5000', discountAmount: 5_000, minOrderAmount: 30_000 }, // alice, bob
  big: { code: 'BIG10000', discountAmount: 10_000, minOrderAmount: 100_000 }, // alice only
} as const;

export const MISSING = {
  productId: 999,
  orderId: 999,
  couponCode: 'NO_SUCH_COUPON',
} as const;
