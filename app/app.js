const express = require('express');
const { createHealthRouter } = require('./routes/health');
const { createUsersRouter } = require('./routes/users');
const { createTestSupportRouter } = require('./routes/testSupport');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// 서버 실행(server.js)과 테스트가 같은 app을 쓰도록 app 생성만 담당한다.
function createApp({ db, env }) {
  const app = express();

  app.use(express.json());

  app.use('/api', createHealthRouter(db));
  app.use('/api', createUsersRouter(db));

  // 운영 환경에서 DB 초기화 API가 노출되지 않도록 test 환경에서만 등록한다.
  if (env === 'test') {
    app.use('/api', createTestSupportRouter(db));
  }

  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
