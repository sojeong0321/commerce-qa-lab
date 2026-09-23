// 금액 계산은 DB 없이 입력만으로 결과가 정해지는 순수 함수로 둔다. (Unit Test 대상)
// 금액은 모두 원 단위 정수다.

function calculateSubtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// BR-CP2: 최소 주문금액 "이상"이면 사용 가능하다. (정확히 같은 금액도 사용 가능)
function isCouponApplicable(subtotal, coupon) {
  return subtotal >= coupon.minOrderAmount;
}

// BR-CP1: 정액 할인. 단, 상품 금액보다 많이 깎아서 결제금액이 음수가 되지 않게 한다.
function calculateDiscount(subtotal, coupon) {
  if (!coupon) return 0;
  return Math.min(coupon.discountAmount, subtotal);
}

// BR-O4: 결제금액 = 상품 금액 - 할인 금액
function calculateTotal(subtotal, discount) {
  return subtotal - discount;
}

module.exports = { calculateSubtotal, isCouponApplicable, calculateDiscount, calculateTotal };
