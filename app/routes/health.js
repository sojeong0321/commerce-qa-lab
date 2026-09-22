const express = require('express');

function createHealthRouter(db) {
  const router = express.Router();

  // 서버와 DB가 모두 응답하는지 확인한다. (Playwright webServer가 기동 확인에 사용)
  router.get('/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  });

  return router;
}

module.exports = { createHealthRouter };
