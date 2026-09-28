# commerce-qa-lab

> 테스트하기 위해 직접 만든 작은 커머스 서비스, 그리고 그 서비스를 검증하는 자동화 테스트.
> Manual QA에서 QA Automation으로 전환하며 만든 포트폴리오입니다.

**현재 상태:** Phase 0–10 전체 완료 · 자동 테스트 **206개** 통과 (Unit 125 + API 74 + E2E 7) · GitHub Actions CI 동작
이 문서는 **지금 실제로 동작하는 것만** 적습니다.

---

## 무엇을, 왜 만들었나

테스트 자동화를 보여 주려면 **테스트할 대상**이 필요합니다. 연습용 공개 사이트를 쓰면 비즈니스 규칙을 내가 정할 수 없어서, "규칙대로 동작하는가"를 검증하기 어렵습니다.
그래서 재고·쿠폰·주문·취소 규칙이 명확한 작은 커머스 서비스를 직접 만들고, 그 규칙을 기준으로 테스트를 설계했습니다.

**도메인:** 상품 / 장바구니 / 쿠폰 / 주문 / 취소
**핵심 규칙:** 재고 초과 구매 불가 · 정액 쿠폰(최소 주문금액 조건, 1회 사용) · 주문 시 재고 차감 · 취소 시 재고와 쿠폰 복구 · 중복 취소 불가 · 부분 실패 시 전체 롤백

---

## 실행 방법

```bash
npm install         # 준비물 설치 (Node 22 이상)
npm run db:setup    # 데이터베이스 생성 + 초기 데이터
npm start           # http://localhost:3000 에서 쇼핑몰 열기

npm test            # 전체 테스트 (Unit 125 + API 74 + E2E 7)
npm run test:unit   # 단위/서비스 테스트만
npm run test:api    # API 테스트만 (서버는 테스트가 알아서 띄웁니다)
npm run test:e2e    # 실제 브라우저 E2E 테스트만
npm run typecheck   # TypeScript 타입 검사
npm run report:e2e  # E2E HTML 리포트 열기 (report:api 도 있습니다)
```

테스트는 **실제 서버와 실제 데이터베이스**를 상대합니다. 가짜 응답(mock)으로 통과시키는 테스트는 없습니다.

---

## 테스트 전략

```
        ▲  E2E 7개 (여정 5)     실제 브라우저로 핵심 사용자 여정만
      ▲▲▲  API 74개             비즈니스 규칙과 엣지 케이스
    ▲▲▲▲▲  Unit/서비스 125개    금액 계산, 입력 검증, 상태 전이
```

| 레이어 | 개수 | 도구 | 무엇을 검증하나 |
|---|---|---|---|
| Unit (순수 함수) | 38 | `node:test` | 금액 계산, 경계값(29,999 / 30,000 / 30,001), 입력 검증 |
| 서비스 + DB | 55 | `node:test` + in-memory SQLite | 재고·쿠폰·주문 상태 전이, 트랜잭션 롤백 |
| HTTP 계약 | 32 | `node:test` | 인증 401, 에러 코드 전달, 응답 형식 |
| API | 74 | Playwright | 실제 서버 대상 비즈니스 규칙 + 상태 부작용 검증 (동시 주문 포함) |
| E2E | 7 | Playwright (Chromium) | 실제 브라우저로 5개 사용자 여정. 화면 표시와 서버 상태를 함께 확인 |

**API와 E2E를 나눈 이유:** 브라우저로 모든 경우를 검증하면 느리고, 화면 변화에 취약해 자주 깨집니다. 규칙과 엣지 케이스는 빠른 API 테스트가 맡고, E2E는 "사용자가 화면에서 목표를 달성할 수 있는가"만 검증합니다.

**E2E 5개 여정:** 주문 완주(E2E-001) · 쿠폰 적용 주문(E2E-002) · 취소 후 재고 원복(E2E-003) · 재고 초과 주문 거절(E2E-004) · 최소 주문금액 미충족(E2E-005)

### 이 프로젝트에서 신경 쓴 것

- **부작용까지 검증한다.** 상태 코드만 보지 않고 재고·쿠폰·장바구니·주문 내역을 조회 API로 다시 확인합니다. 실패 케이스에서는 "아무것도 변하지 않았는가"를 확인합니다.
- **테스트 격리.** 모든 테스트는 시작 전에 DB를 초기 상태로 되돌립니다. 3회 연속 실행, 파일 단독 실행, 샤드 분할 실행으로 순서 의존이 없음을 확인했습니다.
- **테스트가 실제로 버그를 잡는지 확인한다.** 코드를 일부러 망가뜨려 테스트가 실패하는지 검증했습니다(변이 테스트). 이 과정에서 "77개가 통과하는데 9종의 결함을 못 잡는" 상태를 발견하고 테스트를 보강했습니다 → [중간 점검 기록](docs/phase-4-5-review-guide.html)
- **안정적인 로케이터.** `getByRole` → `getByLabel` → `getByTestId` 순으로 사용하고, 고정 대기(`waitForTimeout`)와 XPath는 쓰지 않습니다. 목록 안 요소는 카드/행으로 범위를 좁혀 찾습니다.
- **재시도로 감추지 않는다.** `retries: 0`. 불안정한 테스트는 원인을 고칩니다. 그래서 트레이스는 `retain-on-failure`로 남깁니다.
- **테스트 전용 API는 테스트 환경에서만 존재한다.** `POST /api/test/reset`은 `NODE_ENV=test`에서만 등록되며, 다른 환경에서 404인지 확인하는 테스트가 있습니다.

---

## 실패하면 남는 것

테스트가 실패하면 자동으로 다음이 생성됩니다.

- `playwright-report/api`, `playwright-report/e2e` — HTML 리포트 (`npm run report:api` / `report:e2e`)
- `test-results/api/**`, `test-results/e2e/**` — 프로젝트별로 분리 보관 (뒤 실행이 앞 증거를 지우지 않도록)
- `test-results/e2e/**/test-failed-1.png` — E2E 실패 시점 스크린샷
- `test-results/**/trace.zip` — 요청과 응답이 기록된 트레이스 (`npx playwright show-trace <경로>`)
- `test-results/**/error-context.md` — 실패 시점 요약

실제로 코드를 일부러 망가뜨려 이 증거들이 생성되는 것을 확인했습니다. CI에서도 아티팩트로 업로드됩니다.

## CI

`.github/workflows/ci.yml` — Pull Request와 main push에서 자동 실행됩니다.

```
checkout → Node 22 → npm ci → 브라우저 설치 → DB 준비 확인
  → Unit(125) → API(74) → E2E(7) → 리포트/실패 증거 업로드
```

- 앞 단계가 실패해도 모든 레이어를 실행합니다(`if: ${{ !cancelled() }}`). 어느 레이어까지 영향받았는지 한 번에 파악하고 E2E 실패 증거를 확보하기 위해서입니다. 하나라도 실패하면 workflow가 실패합니다.
- 리포트는 성공·실패와 무관하게 업로드하고, 스크린샷·트레이스는 실패했을 때만 업로드합니다.

---

## 기술 스택

| 영역 | 사용 | 이유 |
|---|---|---|
| 애플리케이션 | Node.js, Express 5, SQLite(better-sqlite3), HTML/CSS/Vanilla JS | 동기 API라 트랜잭션 흐름이 단순하고 읽기 쉽습니다. 프레임워크 없이 화면을 만들어 접근성 기반 로케이터를 직접 설계했습니다 |
| 테스트 | Playwright(API·E2E), TypeScript, `node:test` | 도구를 하나로 모아 리포트와 트레이스를 통일했습니다. 순수 로직은 의존성 없는 내장 러너로 빠르게 검증합니다 |

런타임 의존성은 `express`, `better-sqlite3` 두 개뿐입니다.

---

## 프로젝트 구조

```
app/
  routes/        HTTP 입출력과 요청 검증
  services/      비즈니스 규칙과 트랜잭션 (pricing은 순수 함수)
  db/            schema.sql, 결정적 seed 데이터, 초기화
  public/        상품 / 장바구니 / 주문 완료 / 주문 내역 화면
tests/
  unit/          순수 함수 · 서비스+DB · HTTP 계약
  api/           Playwright API 테스트 (테스트 ID로 설계 문서와 연결)
  e2e/           사용자 여정 5개
  pages/         Page Object (화면별 locator)
  support/       공통 요청 helper, seed 상수, 초기화 fixture
docs/            단계별 기록(HTML) + 상세 문서(Markdown)
.github/workflows/ci.yml
playwright.config.ts
```

---

## API 개요

에러 응답은 모두 `{ "error": { "code", "message" } }` 형식입니다.

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/health`, `/api/users` | 상태 확인, 사용자 목록 |
| GET | `/api/products`, `/api/products/:id` | 상품 조회 (`soldOut`, `purchasable` 포함) |
| GET/POST/PATCH/DELETE | `/api/cart`, `/api/cart/items[/:productId]` | 장바구니 |
| GET | `/api/coupons` | 보유 쿠폰과 사용 여부 |
| POST | `/api/checkout/preview` | 쿠폰 적용 금액 미리 계산 (상태 변경 없음) |
| GET/POST | `/api/orders`, `/api/orders/:id`, `/api/orders/:id/cancel` | 주문 생성·조회·취소 |
| POST | `/api/test/reset` | **테스트 환경 전용** DB 초기화 |

사용자 구분은 `X-User-Id` 헤더로 합니다(로그인은 이 프로젝트의 검증 대상이 아니라 의도적으로 제외).

**상태 코드 규칙:** 400 입력 오류 · 401 사용자 없음 · 404 대상 없음 · 409 현재 상태와 충돌(재고 부족, 쿠폰 사용됨, 이미 취소됨) · 422 비즈니스 규칙 위반(최소 주문금액 미달, 판매 중지, 빈 장바구니)

---

## 진행 상황

| Phase | 내용 | 상태 |
|---|---|---|
| 0 | 아키텍처와 테스트 전략 설계 | 완료 |
| 1 | 애플리케이션 뼈대 + DB | 완료 |
| 2 | 상품 / 장바구니 | 완료 |
| 3 | 쿠폰 | 완료 |
| 4 | 주문 / 취소 / 재고 | 완료 |
| — | 중간 점검: 변이 테스트로 커버리지 구멍 발견 → 앱 11건 수정, 테스트 48개 추가 | 완료 |
| 5 | API 자동화 (Playwright 73개) | 완료 |
| 6 | E2E 자동화 (핵심 여정 5개) | 완료 |
| 7 | GitHub Actions CI | 완료 |
| 8 | 실패 증거 / 리포팅 | 완료 |
| 9 | 문서 정리 | 완료 |
| 10 | 최종 회귀 / 코드 리뷰 (15건 수정) | 완료 |

---

## 단계별 기록

각 단계에서 무엇을 만들고 어떻게 검증했는지, **발견한 버그와 실패 사례**를 포함해 기록했습니다. 비개발자도 읽을 수 있게 작성했습니다.
HTML 파일이라 GitHub에서는 소스로 보입니다. 저장소를 내려받아 `docs/index.html`을 브라우저로 열면 됩니다.

- `docs/index.html` — 전체 진행 현황
- `docs/phase-0-design-guide.html` — 설계 (도메인, 스키마, 테스트 전략)
- `docs/phase-1-skeleton-guide.html` ~ `phase-4-order-cancel-guide.html` — 기능 구현과 검증
- `docs/phase-4-5-review-guide.html` — **중간 점검**: 테스트가 버그를 못 잡고 있던 문제와 보강
- `docs/phase-5-api-automation-guide.html` — API 자동화
- `docs/phase-6-e2e-guide.html` — E2E 자동화
- `docs/phase-7-ci-guide.html` — GitHub Actions CI (성공·실패 양쪽 검증)
- `docs/phase-8-evidence-guide.html` — 실패 증거
- `docs/phase-9-documentation-guide.html` — 문서 정리
- `docs/phase-10-final-review-guide.html` — **최종 점검**: 완성 선언 후 발견한 15건

### 상세 문서 (Markdown)

- [docs/test-strategy.md](docs/test-strategy.md) — 테스트 전략: 레이어 배분 근거, 데이터·실행 정책, 변이 테스트
- [docs/test-cases.md](docs/test-cases.md) — 비즈니스 규칙 ↔ 테스트 추적 매트릭스와 전체 케이스
- [docs/architecture.md](docs/architecture.md) — 구조, 스키마 설계 원칙, 트랜잭션 경계, 기술 선택 근거
- [docs/defect-examples.md](docs/defect-examples.md) — 실제 발견 결함 6건, 주입 결함 23종, CI 실패 검증
