const { AppError } = require('./errors');

function validationError(message) {
  return new AppError(400, 'VALIDATION_ERROR', message);
}

// URL 경로의 id ("/orders/3") 는 문자열로 들어오므로 1 이상의 정수 문자열인지 확인한다.
function parseIdParam(value, fieldName) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw validationError(`${fieldName}는 1 이상의 정수여야 합니다.`);
  }
  return Number(value);
}

// JSON 본문의 id는 숫자 타입이어야 한다. ("1" 같은 문자열은 거절)
function validateIdField(value, fieldName) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw validationError(`${fieldName}는 1 이상의 정수여야 합니다.`);
  }
  return value;
}

// BR-C1: 수량은 1 이상의 정수
function validateQuantity(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw validationError('수량(quantity)은 1 이상의 정수여야 합니다.');
  }
  return value;
}

module.exports = { parseIdParam, validateIdField, validateQuantity };
