// 모든 API 테스트는 같은 출발선에서 시작한다.
// 테스트마다 DB를 seed 상태로 되돌려서 실행 순서에 영향을 받지 않게 한다.
import { test as base } from '@playwright/test';
import { resetDatabase } from './api';

export const test = base.extend<{ freshDatabase: void }>({
  freshDatabase: [
    async ({ request }, use) => {
      await resetDatabase(request);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from '@playwright/test';
