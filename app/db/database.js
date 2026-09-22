const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { insertSeed } = require('./seed');

const SCHEMA_SQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  return db;
}

// 모든 테이블을 지우고 seed 데이터로 다시 채운다.
// 하나의 transaction이라서 중간에 실패하면 이전 상태 그대로 남는다.
function resetDatabase(db) {
  const reset = db.transaction(() => {
    db.exec(SCHEMA_SQL);
    insertSeed(db);
  });
  reset();
}

// 테이블이 아직 없을 때(처음 실행)만 초기화한다.
function ensureDatabase(db) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get();
  if (!row) resetDatabase(db);
}

module.exports = { openDatabase, resetDatabase, ensureDatabase };
