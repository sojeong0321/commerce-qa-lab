const express = require('express');
const { resetDatabase } = require('../db/database');

// 테스트 전용 API. app.js에서 NODE_ENV=test일 때만 등록한다.
function createTestSupportRouter(db) {
  const router = express.Router();

  router.post('/test/reset', (req, res) => {
    resetDatabase(db);
    res.status(204).end();
  });

  return router;
}

module.exports = { createTestSupportRouter };
