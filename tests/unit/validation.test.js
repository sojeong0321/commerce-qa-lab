const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseIdParam, validateIdField, validateQuantity } = require('../../app/validation');

function assertValidationError(fn) {
  assert.throws(fn, (err) => err.status === 400 && err.code === 'VALIDATION_ERROR');
}

test('validateQuantity: 1 이상의 정수는 통과한다', () => {
  assert.equal(validateQuantity(1), 1);
  assert.equal(validateQuantity(99), 99);
});

// 동등 분할: 0, 음수, 소수, 문자열, 빈 값, 숫자가 아닌 값
for (const invalid of [0, -1, 1.5, '1', 'abc', null, undefined, NaN, Infinity, [], {}]) {
  test(`validateQuantity: ${JSON.stringify(invalid) ?? String(invalid)} 는 거절한다`, () => {
    assertValidationError(() => validateQuantity(invalid));
  });
}

test('validateIdField: 숫자 타입 1 이상만 통과한다', () => {
  assert.equal(validateIdField(3, 'productId'), 3);
  assertValidationError(() => validateIdField('3', 'productId'));
  assertValidationError(() => validateIdField(0, 'productId'));
  assertValidationError(() => validateIdField(undefined, 'productId'));
});

test('parseIdParam: 경로의 id 문자열을 숫자로 바꾼다', () => {
  assert.equal(parseIdParam('12', 'id'), 12);
});

for (const invalid of ['0', '-1', '1.5', 'abc', '', '01', '1e3', '99999999999999999999']) {
  test(`parseIdParam: "${invalid}" 는 거절한다`, () => {
    assertValidationError(() => parseIdParam(invalid, 'id'));
  });
}
