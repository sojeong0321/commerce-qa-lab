const { AppError } = require('../errors');

function notFoundHandler(req, res) {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `${req.method} ${req.originalUrl} 경로가 없습니다.` },
  });
}

// Express는 인자가 4개인 함수를 에러 핸들러로 인식한다.
// eslint-disable-next-line no-unused-vars
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

  console.error(err);
  return res
    .status(500)
    .json({ error: { code: 'INTERNAL_ERROR', message: '서버 내부 오류가 발생했습니다.' } });
}

module.exports = { notFoundHandler, errorHandler };
