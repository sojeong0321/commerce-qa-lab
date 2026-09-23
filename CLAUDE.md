# commerce-qa-lab — 작업 규칙

이 파일은 **어느 터미널/세션에서 이어서 작업하든 동일하게 행동하기 위한 규칙**이다. 작업을 시작하기 전에 반드시 읽고, 아래 규칙을 그대로 따른다.

## 이 프로젝트가 무엇인가

Manual SW QA 경력자가 **QA Automation Engineer로 전환하기 위한 GitHub 포트폴리오**다.
실제로 동작하는 작은 Commerce Application을 직접 만들고, 그 Application을 대상으로 API Test와 Playwright E2E Test를 수행하며, GitHub Actions CI에서 모든 테스트가 자동 실행되는 것이 목표다.
단순 Playwright 예제 프로젝트가 아니다. **면접에서 설명 가능한가**가 모든 판단의 기준이다.

## 사용자에 대해

- **코딩 비전문가다.** 모든 설명은 한국어로, 비유와 쉬운 말로 한다. 기술 용어를 쓸 때는 풀어서 설명한다.
- 결과를 보고할 때 "무엇을 만들었나 / 어떻게 확인했나 / 어떤 문제를 찾아 고쳤나"를 구분해서 쓴다.
- 과장하지 않는다. 실패했거나 확인하지 못한 것은 그대로 말한다.

## 절대 원칙 (위반 금지)

1. 모든 기능은 **실제로 실행**되어야 한다. 실행해서 확인하지 않은 것을 "완료"라고 하지 않는다.
2. README/문서에만 존재하고 구현되지 않은 기능을 만들지 않는다.
3. Mock 결과만 출력해서 PASS시키지 않는다. 테스트는 **실제 Application/API**를 호출한다.
4. 테스트를 통과시키려고 **assertion을 약화하지 않는다.** 실패하면 원인을 고친다.
5. 불필요한 기술/라이브러리를 추가하지 않는다. (현재 런타임 의존성: express, better-sqlite3뿐)
6. 사용자가 이해할 수 없는 과도한 abstraction을 피한다.
7. **각 Phase가 완전히 동작하는 것을 검증한 후에만** 다음 Phase로 진행한다.
8. 기존 정상 기능을 변경할 때는 반드시 **Regression Test**(이전 단계 검사 전체 재실행)를 돌린다.
9. 고정 sleep(`waitForTimeout`)으로 테스트를 안정화하지 않는다. 명확한 조건과 auto-wait를 쓴다.
10. flaky 테스트를 retry로 숨기지 않는다. 원인을 찾아 고친다.

## Phase 진행 순서

0 설계 ✅ · 1 App 뼈대+DB ✅ · 2 Product/Cart ✅ · 3 Coupon ✅ · **4 Order/Cancel/Stock** · 5 API 자동화 · 6 Playwright E2E · 7 GitHub Actions CI · 8 Failure Evidence/Reporting · 9 Documentation · 10 Final Regression

한 번에 여러 Phase를 진행하지 않는다. 한 Phase를 끝내고 사용자 확인을 받는다.

## Phase를 끝내기 전 반드시 하는 검증 (DoD)

1. `npm run test:unit` — 새 단위 테스트 + **이전 단계 전체 회귀**, 전부 통과
2. **실제 서버에 직접 요청**(curl)으로 해당 Phase의 정상/실패/검증 케이스 확인. 실패 케이스는 **상태가 변하지 않았는지**(재고·쿠폰·장바구니·주문)까지 확인한다.
3. 화면이 있는 Phase는 **실제 브라우저로 클릭 확인**. 스크린샷을 찍어 눈으로 확인한다.
   - Phase 5 이전에는 프로젝트 밖(scratchpad)의 임시 Playwright 스크립트로 확인하고, 그 스크립트는 저장소에 커밋하지 않는다.
4. 브라우저/E2E 확인은 **3회 연속 통과**해야 한다. (테스트 독립성·안정성 확인)
5. 가능하면 **일부러 버그를 주입해 테스트가 실패하는지** 확인하고 즉시 원복한다. (가짜 통과 방지)
6. 발견한 버그는 고치고, 같은 문제가 재발하면 잡히도록 검사 기준을 추가한다.

## 단계별 HTML 가이드 (매 Phase 필수)

Phase를 끝낼 때마다 `docs/`에 **코딩을 모르는 사람도 이해할 수 있는 HTML 가이드**를 추가하고, 진행 현황 페이지를 갱신한다.

- 파일명: `docs/phase-<번호>-<주제>-guide.html` (예: `phase-3-coupon-guide.html`)
- 스타일: `<link rel="stylesheet" href="guide.css">` 공용 스타일을 쓴다. 새 스타일이 필요하면 `docs/guide.css`에 추가한다.
- 필수 구성: 상단 crumbs(진행 현황·이전 Phase 링크) → 한 줄 요약 → 만든 것 → 실제 화면 스크린샷(화면이 있으면 `docs/images/`에 저장) → 규칙 표 → 검사 결과 숫자 → **찾은 버그** → 다음 단계 링크
- 설명은 가게/손님 비유를 유지한다. 코드 조각을 붙여 넣지 않는다.
- `docs/index.html`의 진행 현황(완료 표시, 검사 개수, 현재 단계 `class="now"`)을 항상 함께 갱신한다.
- 가이드에는 **실제로 확인한 사실만** 쓴다. 검사 개수는 실행 결과에서 가져온다.

## Application 규칙 (설계 확정 사항)

- 금액은 원 단위 정수. 재고 0 또는 `INACTIVE` 상품은 구매 불가(`soldOut`은 저장하지 않고 stock에서 계산).
- 장바구니에 담아도 재고는 줄지 않는다. 재고는 **주문 시 감소, 취소 시 복구**.
- 쿠폰: 정액 할인, 최소 주문금액 **이상**(경계값 포함), 본인 발급 + AVAILABLE만 사용 가능, 할인은 상품 금액을 넘지 않는다.
- **쿠폰은 주문 생성 시에만 USED가 된다.** preview는 어떤 상태도 바꾸지 않는다.
- **주문 취소 시 쿠폰은 AVAILABLE로 복구되어 재사용 가능하다.** (확정된 정책)
- 주문/취소는 하나의 transaction. 일부 실패 시 전체 rollback(재고·쿠폰·장바구니 모두 원상).
- 같은 주문을 두 번 취소할 수 없고, 재고가 두 번 복구되면 안 된다.
- 인증은 로그인 없이 `X-User-Id` 헤더. 없거나 없는 사용자면 401.
- 에러 응답 형식: `{ "error": { "code", "message" } }`
  - 400 VALIDATION_ERROR · 401 UNAUTHORIZED · 404 *_NOT_FOUND · 409 상태 충돌(OUT_OF_STOCK, COUPON_ALREADY_USED, ORDER_ALREADY_CANCELED) · 422 비즈니스 규칙 위반(COUPON_MIN_AMOUNT_NOT_MET, PRODUCT_NOT_PURCHASABLE, CART_EMPTY)
- `POST /api/test/reset`은 **NODE_ENV=test에서만 등록**한다. 다른 환경에서 404인지 확인하는 테스트를 유지한다.

## 테스트 전략

- Testing Pyramid: Unit(순수 계산·검증) > API(비즈니스 규칙·Edge Case) > E2E(핵심 사용자 Journey 5개만).
- 모든 테스트는 독립적이어야 하며 실행 순서에 의존하지 않는다. 각 테스트 전 `POST /api/test/reset`으로 DB를 seed 상태로 되돌린다.
- DB가 하나이므로 Playwright는 `workers: 1`, `fullyParallel: false`. (결정성 우선, 이유를 문서에 남긴다)
- 기대값은 seed 상수에서 가져온다. 매직 넘버를 쓰지 않는다.
- Locator 우선순위: `getByRole` → `getByLabel` → `getByTestId`. XPath와 brittle CSS selector 금지.
- 화면을 만들 때 접근 가능한 이름(버튼 텍스트, label, aria-label)을 먼저 설계한다.
- 상태 변화 검증은 DB를 직접 읽지 않고 공개 조회 API로 한다(Black-box).

## Seed 데이터 (테스트 기대값의 기준)

- users: 1 Alice, 2 Bob
- products: 1 머그컵 10,000/20 ACTIVE(3개=30,000 경계값용) · 2 데님 팬츠 35,000/5 · 3 러닝화 89,000/3 · 4 에코백 15,000/**0**(품절) · 5 단종 모자 20,000/10 **INACTIVE**
- coupons: WELCOME5000(5,000 / 최소 30,000) · BIG10000(10,000 / 최소 100,000)
- user_coupons: Alice = WELCOME5000, BIG10000 / Bob = WELCOME5000

## 명령어

```
npm install        # 설치
npm run db:setup   # DB 초기화(seed)
npm start          # 개발 서버 http://localhost:3000
npm run start:test # 테스트 서버 http://localhost:3100 (NODE_ENV=test, 기동 시 reset)
npm run test:unit  # 단위 테스트
```

## 커밋/푸시

- Phase 단위로 커밋한다. 커밋 전 `npm run test:unit`이 통과해야 한다.
- 커밋 메시지는 한국어 본문으로 무엇을/왜를 남긴다. 커밋 말미에 다음 줄을 넣는다:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- 저장소: https://github.com/sojeong0321/commerce-qa-lab (현재 **private**)
- `node_modules/`, `data/`, `test-results/`, `playwright-report/`는 커밋하지 않는다.

## 현재 상태 (Phase를 끝낼 때마다 갱신할 것)

- 완료: Phase 0~3. 단위 테스트 **61개** 통과.
- 동작: 상품 목록/장바구니 화면, 상품·장바구니·쿠폰 API, checkout preview.
- 다음: **Phase 4 — 주문 / 취소 / 재고**
