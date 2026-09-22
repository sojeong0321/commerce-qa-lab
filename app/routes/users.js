const express = require('express');

function createUsersRouter(db) {
  const router = express.Router();

  router.get('/users', (req, res) => {
    const users = db.prepare('SELECT id, name, email FROM users ORDER BY id').all();
    res.json({ users });
  });

  return router;
}

module.exports = { createUsersRouter };
