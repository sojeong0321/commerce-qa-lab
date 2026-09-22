// 비즈니스 규칙 위반을 표현하는 에러.
// errorHandler가 { error: { code, message } } 형태의 응답으로 바꾼다.
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = { AppError };
