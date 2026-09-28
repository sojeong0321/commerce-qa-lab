const { AppError } = require('../errors');

function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `${req.method} ${req.originalUrl} 경로가 없습니다.` },
  });
}

// Express는 인자가 4개인 함수를 에러 핸들러로 인식한다. (next를 쓰지 않아도 생략하면 안 된다)
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  // express.json()이 잘못된 JSON을 받았을 때
  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { code: 'VALIDATION_ERROR', message: '요청 본문이 올바른 JSON이 아닙니다.' } });
  }

  // 본문이 너무 크거나(413) 압축이 깨진 경우처럼 body-parser가 걸러낸 요청도 클라이언트 잘못이다.
  // 이런 요청까지 500으로 답하면 손님 실수가 서버 장애로 기록된다.
  const status = err.status ?? err.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res
      .status(status)
      .json({ error: { code: 'VALIDATION_ERROR', message: '요청을 처리할 수 없습니다. 요청 형식과 크기를 확인해 주세요.' } });
  }

  console.error(err);
  return res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: '서버 내부 오류가 발생했습니다.' } });
}

module.exports = { notFoundHandler, errorHandler };
