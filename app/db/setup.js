// npm run db:setup
// DB 파일을 seed 상태로 초기화하고, 결과를 출력해서 제대로 만들어졌는지 확인한다.
const { openDatabase, resetDatabase } = require('./database');
const { DB_PATH } = require('../config');

const db = openDatabase(DB_PATH);
resetDatabase(db);

const tables = ['users', 'products', 'coupons', 'user_coupons', 'cart_items', 'orders'];
console.log(`DB 초기화 완료: ${DB_PATH}`);
for (const table of tables) {
  const { count } = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
  console.log(`  ${table}: ${count}`);
}
db.close();
