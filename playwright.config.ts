import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests',

  // DB가 하나뿐이고 각 테스트가 시작할 때 DB를 초기화하므로 동시 실행하지 않는다.
  // 속도보다 "언제 돌려도 같은 결과"를 우선한 선택이다. (docs/test-strategy 참고)
  fullyParallel: false,
  workers: 1,

  // 재시도로 불안정한 테스트를 감추지 않는다. 실패하면 원인을 고친다.
  retries: 0,

  // 실패 원인을 남긴다. 재시도가 없으므로 on-first-retry가 아니라 retain-on-failure를 쓴다.
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  reporter: [['list'], ['html', { open: 'never' }]],

  // 테스트가 직접 애플리케이션을 띄운다. /api/health가 응답할 때까지 기다린다.
  webServer: {
    command: 'npm run start:test',
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
    },
    {
      // 실제 브라우저로 사용자 여정을 확인한다. 화면이 없는 API 테스트와 분리해서 따로 돌릴 수 있다.
      name: 'e2e',
      testDir: './tests/e2e',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
