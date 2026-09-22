// app을 임시 포트로 띄워서 환경별 라우트 등록과 공통 에러 응답을 확인한다.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../../app/app');
const { openDatabase, resetDatabase } = require('../../app/db/database');

async function startServer(env) {
  const db = openDatabase(':memory:');
  resetDatabase(db);
  const app = createApp({ db, env });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { db, baseUrl, close: () => new Promise((resolve) => server.close(resolve)) };
}

test('GET /api/health는 200과 status ok를 반환한다', async (t) => {
  const server = await startServer('development');
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/health`);

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('GET /api/users는 seed 사용자 목록을 반환한다', async (t) => {
  const server = await startServer('development');
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/users`);

  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    users: [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ],
  });
});

test('test 환경에서 POST /api/test/reset은 DB를 seed 상태로 되돌린다', async (t) => {
  const server = await startServer('test');
  t.after(server.close);
  server.db.prepare('UPDATE products SET stock = 0 WHERE id = 2').run();

  const res = await fetch(`${server.baseUrl}/api/test/reset`, { method: 'POST' });

  assert.equal(res.status, 204);
  assert.equal(server.db.prepare('SELECT stock FROM products WHERE id = 2').get().stock, 5);
});

for (const env of ['development', 'production']) {
  test(`${env} 환경에는 reset API가 없다 (404, DB 변경 없음)`, async (t) => {
    const server = await startServer(env);
    t.after(server.close);
    server.db.prepare('UPDATE products SET stock = 0 WHERE id = 2').run();

    const res = await fetch(`${server.baseUrl}/api/test/reset`, { method: 'POST' });

    assert.equal(res.status, 404);
    assert.equal((await res.json()).error.code, 'NOT_FOUND');
    assert.equal(server.db.prepare('SELECT stock FROM products WHERE id = 2').get().stock, 0);
  });
}

test('없는 API 경로는 404 NOT_FOUND JSON을 반환한다', async (t) => {
  const server = await startServer('development');
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/unknown`);

  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), {
    error: { code: 'NOT_FOUND', message: 'GET /api/unknown 경로가 없습니다.' },
  });
});

test('잘못된 JSON 본문은 400 VALIDATION_ERROR를 반환한다', async (t) => {
  const server = await startServer('test');
  t.after(server.close);

  const res = await fetch(`${server.baseUrl}/api/test/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ broken json',
  });

  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'VALIDATION_ERROR');
});
