// 금액 계산은 DB 없이 입력만으로 결과가 정해지는 순수 함수로 둔다. (Unit Test 대상)
// 금액은 모두 원 단위 정수다.

function calculateSubtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

module.exports = { calculateSubtotal };
