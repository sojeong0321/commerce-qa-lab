# 아키텍처

## 1. 전체 구조

```
┌─────────────────────────── commerce-qa-lab ────────────────────────────┐
│                                                                        │
│  브라우저 (public/)                                                     │
│    index.html · cart.html · order-complete.html · orders.html          │
│    js/api.js (fetch + X-User-Id) · layout.js · 화면별 스크립트           │
│                      │ fetch                                           │
│  ┌───────────────────▼──────────── Express 5 ──────────────────────┐   │
│  │  express.json() → express.static() → routes                     │   │
│  │                                                                 │   │
│  │  routes/       HTTP 입출력, 요청 형식 검증                        │   │
│  │     │          (products, cart, coupons, checkout, orders)       │   │
│  │  services/     비즈니스 규칙 + 트랜잭션                            │   │
│  │     │          productService · cartService                      │   │
│  │     │          couponService · orderService                      │   │
│  │     │          pricing.js (순수 함수, DB 의존 없음)                │   │
│  │  db/           better-sqlite3 (동기)                              │   │
│  │                                                                 │   │
│  │  middleware/   userContext(X-User-Id) · errorHandler              │   │
│  └─────────────────────────┬───────────────────────────────────────┘   │
│                            │                                            │
│                     SQLite 파일 (data/*.db)                             │
└────────────────────────────────────────────────────────────────────────┘
```

## 2. 계층 책임

| 계층 | 책임 | 하지 않는 것 |
|---|---|---|
| `routes/` | HTTP 메서드·경로 매핑, 요청 형식 검증, 상태 코드 결정 | 비즈니스 판단 |
| `services/` | 비즈니스 규칙, 트랜잭션 경계, 도메인 에러 발생 | HTTP 개념 |
| `services/pricing.js` | 금액 계산 (순수 함수) | DB 접근, 에러 발생 |
| `db/` | 스키마, seed, 연결, 초기화 | 규칙 판단 |
| `middleware/` | 사용자 식별, 에러 → 응답 변환 | — |

계층을 나눈 이유는 테스트 때문입니다. `pricing.js`는 DB 없이 경계값을 검증할 수 있고, 서비스는 in-memory DB로 상태 전이를 검증할 수 있으며, 라우트는 HTTP 계약만 검증하면 됩니다.

## 3. 데이터베이스 스키마

```sql
users(id, name, email)
products(id, name, price, stock, status)            -- status: ACTIVE | INACTIVE
cart_items(id, user_id, product_id, quantity)       -- UNIQUE(user_id, product_id)
coupons(id, code, discount_amount, min_order_amount)
user_coupons(id, user_id, coupon_id, status, used_at)  -- status: AVAILABLE | USED
orders(id, user_id, status, subtotal_amount, discount_amount,
       total_amount, user_coupon_id, coupon_code, created_at, canceled_at)
order_items(id, order_id, product_id, product_name, unit_price, quantity)
```

### 설계 원칙

**품절 상태를 저장하지 않는다**
`soldOut`은 `stock === 0`에서 계산합니다. 같은 사실을 두 곳에 저장하면 반드시 어긋납니다.

**주문은 시점 값을 보존한다**
`order_items.product_name`, `unit_price`, `orders.coupon_code`는 주문 시점 스냅샷입니다. 이후 상품 가격이나 쿠폰 코드가 바뀌어도 과거 주문 기록은 변하지 않습니다.
(초기 구현에서 쿠폰 코드만 JOIN으로 조회하고 있었고, 중간 점검에서 발견해 스냅샷으로 변경했습니다.)

**DB 제약을 마지막 방어선으로 둔다**
`CHECK (stock >= 0)`, `CHECK (quantity >= 1)`, `CHECK (total_amount >= 0)` 등. 애플리케이션이 실수해도 데이터가 오염되지 않습니다. 이 제약이 동작하는지 확인하는 테스트도 있습니다.

## 4. 트랜잭션 경계

better-sqlite3는 동기 API이므로 `db.transaction(...)`으로 묶인 구간에 다른 요청이 끼어들 수 없습니다.

### 주문 생성 (단일 트랜잭션)

```
장바구니 조회 → 비어 있으면 CART_EMPTY
  ↓
각 항목의 현재 재고·판매 상태 재확인   ← 담은 시점 이후 변경 대응
  ↓
쿠폰 자격·최소 주문금액 확인 → 금액 계산
  ↓ ───────── 이 지점부터 쓰기 ─────────
재고 차감 → 쿠폰 USED → 주문 저장 → 주문 항목 저장 → 장바구니 비우기
```

모든 검증이 첫 쓰기보다 앞에 있습니다. 트랜잭션은 그 이후 단계의 안전망입니다. 이 안전망이 실제로 동작하는지는 **쓰기 이후에 실패를 강제하는 테스트**로 확인합니다(존재하지 않는 쿠폰 id로 외래키 위반 유발).

### 주문 취소 (단일 트랜잭션)

```
주문 조회 → 없거나 타인 주문이면 ORDER_NOT_FOUND
  ↓
이미 CANCELED면 ORDER_ALREADY_CANCELED   ← 재고 이중 복구 방지
  ↓
재고 복구 → 쿠폰 복구(AVAILABLE, used_at NULL) → 주문 상태 변경
```

취소 트랜잭션의 롤백은 SQLite 트리거로 상태 변경 단계를 실패시켜 검증합니다.

### 동시 요청

두 사용자가 마지막 재고를 동시에 주문하는 상황을 테스트로 고정했습니다(`tests/api/order.spec.ts` "두 손님이 마지막 재고를 동시에 주문하면 한 명만 성공한다"): 한 쪽 201, 다른 쪽 409, 최종 재고 0, 주문은 1건. 음수 재고는 발생하지 않습니다.

## 5. 에러 처리

모든 에러는 `AppError(status, code, message)`로 표현하고 `errorHandler`가 응답으로 변환합니다.

```json
{ "error": { "code": "OUT_OF_STOCK", "message": "재고가 부족합니다. (러닝화 남은 재고: 1개, 요청 수량: 3개)" } }
```

| 상태 | 의미 | 코드 |
|---|---|---|
| 400 | 요청 형식 오류 | `VALIDATION_ERROR` |
| 401 | 사용자 식별 실패 | `UNAUTHORIZED` |
| 404 | 대상 없음 (타인 리소스 포함) | `PRODUCT_NOT_FOUND`, `CART_ITEM_NOT_FOUND`, `COUPON_NOT_FOUND`, `ORDER_NOT_FOUND`, `NOT_FOUND` |
| 409 | 현재 상태와 충돌 | `OUT_OF_STOCK`, `COUPON_ALREADY_USED`, `ORDER_ALREADY_CANCELED` |
| 422 | 비즈니스 규칙 위반 | `COUPON_MIN_AMOUNT_NOT_MET`, `PRODUCT_NOT_PURCHASABLE`, `CART_EMPTY` |
| 500 | 예상 못 한 서버 오류 | `INTERNAL_ERROR` |

**409 vs 422:** 409는 "지금 상태 때문에 불가"(재고가 늘면 가능), 422는 "요청 자체가 규칙 위반"입니다.
**타인 리소스를 404로 응답하는 이유:** 403으로 답하면 "그 주문은 존재한다"는 정보가 노출됩니다.
**클라이언트 오류를 500으로 내지 않는다:** body-parser가 거르는 4xx(본문 과대 등)도 `VALIDATION_ERROR`로 매핑합니다.

## 6. 인증

로그인 대신 `X-User-Id` 헤더로 사용자를 식별합니다. 인증 구현은 이 프로젝트의 검증 대상이 아니며, 복잡도만 늘리고 QA 관점의 학습 가치는 낮다고 판단했습니다.
대신 **사용자 격리**는 엄격히 검증합니다: 장바구니 분리, 쿠폰 소유권, 타인 주문 접근 차단.

## 7. 프런트엔드

프레임워크 없이 작성했습니다. 이유는 **접근 가능한 이름을 직접 설계하기 위해서**입니다. E2E 테스트가 안정적으로 요소를 찾으려면 화면 설계 단계에서 이름이 정해져야 합니다.

| 요소 | 설계 |
|---|---|
| 상품 카드 | `<article aria-labelledby>` → `getByRole('article', { name: '머그컵' })` |
| 수량 입력 | `<label>머그컵 수량</label>` → 상품별 고유 이름 |
| 알림 | `role="status"`(성공) / `role="alert"`(실패), 동작 시작 시 초기화 |
| 금액 | role이 없으므로 `data-testid` (`cart-total` 등) |
| 주문 일시 | `<time datetime>` + 시간대 무관 고정 형식 |

**상태 관리 원칙:** 금액과 재고는 항상 서버가 재계산한 값을 표시합니다. 화면은 계산하지 않습니다. 응답이 엇갈려 도착할 수 있으므로 최신 요청의 결과만 반영합니다(요청 토큰).

## 8. 테스트 환경

| 구분 | 개발 | 테스트 |
|---|---|---|
| 포트 | 3000 | 3100 |
| DB | `data/commerce.db` | `data/test.db` |
| 기동 시 | 테이블 없으면 생성 | **항상 초기화** |
| `/api/test/reset` | 없음 (404) | 있음 |

테스트 전용 엔드포인트가 운영에 노출되는 것은 실제 사고로 이어지는 패턴이라, 환경별 등록 여부를 확인하는 테스트를 유지합니다.

## 9. 기술 선택 근거

| 선택 | 이유 | 대안과 비교 |
|---|---|---|
| better-sqlite3 | 동기 API로 트랜잭션 흐름이 단순 | 비동기 드라이버는 await 체인이 길어지고 트랜잭션 경계가 흐려짐 |
| SQLite | 설치 없이 파일 하나, CI에서 서비스 컨테이너 불필요 | Postgres는 CI 설정 복잡도 증가 |
| Express 5 | 최소 구성, async 에러 처리 내장 | — |
| `node:test` | 의존성 0으로 순수 로직 검증 | Jest는 이 규모에 과함 |
| Playwright | API와 E2E를 한 도구로, 리포트·트레이스 통일 | supertest + 별도 E2E 도구는 리포트가 분산됨 |

런타임 의존성은 `express`, `better-sqlite3` 두 개뿐입니다.
