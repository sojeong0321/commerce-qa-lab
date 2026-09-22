const { createApp } = require('./app');
const { openDatabase, resetDatabase, ensureDatabase } = require('./db/database');
const { NODE_ENV, PORT, DB_PATH } = require('./config');

const db = openDatabase(DB_PATH);

// 테스트 서버는 항상 seed 상태로 시작한다.
if (NODE_ENV === 'test') {
  resetDatabase(db);
} else {
  ensureDatabase(db);
}

const app = createApp({ db, env: NODE_ENV });

app.listen(PORT, () => {
  console.log(`commerce-qa-lab listening on http://localhost:${PORT} (env=${NODE_ENV}, db=${DB_PATH})`);
});
