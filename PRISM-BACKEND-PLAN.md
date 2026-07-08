# PRISM 실백엔드 전환 계획
# tomatoeggcat.com/prism/ — 데모(로컬 전용) → 실서비스(서버·실매칭) 전환

작성일: 2026-07-08
대상: 엔지니어링 실행 계획. 실제 계정/키/결제는 사용자(운영자) 본인이 직접 처리(하단 "사용자 액션" 참조).
연결: [`AUTH-BILLING-PLAN.md`](./AUTH-BILLING-PLAN.md)(인증·과금 아키텍처, 안1 채택), [`PRISM-BUSINESS.md`](./PRISM-BUSINESS.md)(사업 계획, Phase 2/3), [`data/review-scores.json`](./data/review-scores.json)(리뷰 이력)

---

## 0. 왜 필요한가 — 2026-07-08 리뷰 루프 진단

PRISM을 90점 게이트로 5루프(상한) 리뷰한 결과 **48.2점**에서 멈췄다(`data/review-scores.json` slug `prism`). 루프가 고친 것과 못 고친 것을 구분하면:

**루프로 고쳐진 것** (버그 수준, 4커밋): KST 타임존 경계, 좋아요/슈퍼라이크 한도 우회, 저장 실패 무시, 좁은 뷰포트 오버플로우, 스와이프 중복 커밋 레이스, 만 나이 계산 정밀화 등.

**루프로 못 고치는 것** (아키텍처 수준 — 이 문서의 대상):
1. **실매칭 부재**: 모든 프로필이 로컬 더미 데이터고 앱 스스로 "가상 인물"이라 명시. 페르소나 리뷰어 전원이 "재방문 이유 없음"을 1순위로 지적.
2. **포지셔닝-수익모델 충돌**: "아우팅 방지·안전 최우선"을 내세우면서 확률형 가챠(N/R/SR/SSR·천장·픽업)를 얹었고, 카드 레벨이 좋아요 한도·슈퍼라이크를 실제로 강화해(PRISM-BUSINESS.md 부록B) 사실상 페이투윈 — 디자인/40대 실용주의 페르소나 모두 "신뢰를 깎아먹는다"고 지적.
3. **결제가 전부 모의(mock)**: PRISM-BUSINESS.md가 이미 명시. 실용주의 페르소나는 "돈 낼 가치가 있는지 판단할 근거 자체가 없다"고 평가.

즉 지금 데모 아키텍처(무서버·로컬 더미)가 점수의 물리적 천장이다. 뚫으려면 AUTH-BILLING-PLAN.md 안1(통합 SSO+중앙 과금)을 PRISM에 실제로 붙이고, 가짜 매칭을 실매칭으로 바꿔야 한다.

---

## 1. 범위와 원칙

- **재사용**: AUTH-BILLING-PLAN.md 안1 아키텍처를 그대로 채택(허브 통합 SSO, Supabase Postgres, JWT stateless 검증). PRISM만을 위한 별도 Auth/DB를 새로 설계하지 않는다.
- **안전 설계 유지·강화**: PIN 잠금·스텔스 모드·위치 퍼징 등 클라이언트 안전 기능은 그대로 두되, **위치 퍼징은 서버에서도 강제**(클라이언트가 정밀 위치를 보내도 서버가 구 단위로 뭉개서 저장·응답 — 클라이언트만 믿지 않는다).
- **가챠 재설계 필수 조건**: 매칭 관련 수치(좋아요 한도·슈퍼라이크 등)를 강화하는 카드 효과는 **제거**한다. 가챠는 순수 코스메틱(프로필 프레임·이펙트)으로만 남기거나, 아예 드롭하고 구독+아이템샵 2트랙으로 단순화한다(이번 리뷰에서 페이투윈 비판이 가장 반복적이었던 항목).
- **에이전트(나) 제약**: 유료 서드파티 API 직접 호출 금지, 계정 생성/결제 금지(REVIEW-LOOP.md §7). 이 문서는 계획이며, 실제 Supabase/Stripe/토스페이먼츠 계정·키 발급은 사용자가 직접 한다.

---

## 2. 아키텍처

```
사용자 브라우저 (prism/ PWA, 정적 파일 유지)
    │
    ▼
tomatoeggcat.com (허브) — AUTH-BILLING-PLAN.md 안1
    ├─ Auth (Clerk 또는 Supabase Auth) — 카카오·구글 OAuth
    ├─ Billing (Stripe + 토스페이먼츠 웹훅)
    └─ 공유 JWT ({userId, plan, credits, exp})
            │
            ▼
    PRISM API (허브 하위 서버리스 함수, /api/prism/*)
    ├─ /api/prism/profile        — CRUD, 서버측 위치 퍼징
    ├─ /api/prism/deck           — 매칭 후보 조회(필터·궁합 스코어링)
    ├─ /api/prism/swipe          — 좋아요/패스/슈퍼라이크 (원자적 카운터 차감)
    ├─ /api/prism/match          — 상호 매치 성사 판정
    ├─ /api/prism/messages       — 채팅(Supabase Realtime 구독)
    ├─ /api/prism/report         — 신고/차단 (모더레이션 큐 적재)
    └─ /api/prism/billing/*      — PRISM+/Black 웹훅 반영(AUTH-BILLING-PLAN 패턴 그대로)
            │
            ▼
    Supabase Postgres (Row-Level Security)
    ├─ profiles, swipes, matches, messages, reports, blocks
    └─ 민감정보(성적 지향 관련) 컬럼 암호화 저장 + RLS로 본인/매치 상대만 조회
```

- **클라이언트(prism/app.js)는 지금 구조를 최대한 유지**: `localStorage`를 오프라인 캐시/낙관적 UI 레이어로 남기고, 진실 원천(source of truth)만 서버로 이전. 화면·인터랙션·안전 UX(PIN, 스텔스 등)는 재작성하지 않는다.
- **실시간 채팅**: Supabase Realtime(Postgres 변경분 구독) 또는 Pusher. 서버리스 폴링보다 지연·비용이 낮음.

---

## 3. 데이터 모델 (초안)

```sql
profiles(
  user_id uuid PK references auth.users,
  nickname text, age int, region_fuzzed text,  -- 서버가 구 단위로 뭉갠 값만 저장
  height int, mbti text, looking_for text, tags text[],
  bio text, avatar_url text,
  plan text default 'free', -- free | plus | black
  stealth_mode bool default false,
  created_at timestamptz, updated_at timestamptz
)
swipes(id, from_user uuid, to_user uuid, kind text /*like|pass|superlike*/, created_at)
matches(id, user_a uuid, user_b uuid, created_at, unread_a bool, unread_b bool)
messages(id, match_id, sender uuid, body text, created_at)
reports(id, reporter uuid, target uuid, reason text, status text, created_at)
blocks(user_id uuid, blocked_user uuid, created_at)
```

- `swipes`/`matches`에 unique 제약 + 트랜잭션으로 좋아요 한도·중복 스와이프 레이스를 DB 레벨에서 원천 차단(오늘 루프에서 클라이언트 레벨로만 막다가 놓친 것과 같은 클래스의 버그를 구조적으로 방지).
- 민감정보(성적 지향 관련 필드) 컬럼은 pgcrypto 또는 애플리케이션 레벨 암호화 + RLS `auth.uid() = user_id OR auth.uid() IN (SELECT ... FROM matches ...)`로 매치 성사 전에는 상대에게 노출 안 됨.

---

## 4. 단계별 로드맵

### Phase 2-A — Auth만 우선 연동 (1주)
- [ ] 허브 SSO(카카오·구글 OAuth) 연동 — AUTH-BILLING-PLAN Phase 1과 동일 작업, PRISM이 첫 파일럿 서비스가 됨
- [ ] PRISM 웰컴 화면에 "로그인/게스트 체험" 분기 추가(비로그인은 지금처럼 데모 유지 — 급격한 단절 방지)
- [ ] JWT 검증 미들웨어를 PRISM API 라우트에 적용

### Phase 2-B — 프로필·매칭 서버 이전 (1~2주)
- [ ] `profiles` 테이블 + 온보딩 데이터 서버 저장(클라이언트 온보딩 화면은 유지, 마지막 제출만 API 호출로 교체)
- [ ] 서버측 위치 퍼징 함수(정밀 좌표 입력 → 구 단위 저장, 원본 폐기)
- [ ] `/api/prism/deck` — 실제 가입자 풀에서 후보 조회 + 기존 궁합 스코어링 로직(app.js의 점수 함수)을 서버로 이식
- [ ] `swipes`/`matches` 원자적 처리(트랜잭션), 좋아요 한도를 서버가 카운트(클라이언트 카운터는 낙관적 UI 표시용으로만 유지)

### Phase 2-C — 채팅·신고·차단 (1~2주)
- [ ] `messages` + Supabase Realtime 구독으로 실시간 채팅(현재 랜덤 대사 봇 로직 제거)
- [ ] 신고/차단 API + 모더레이션 큐(24시간 내 1차 대응 — PRISM-BUSINESS.md §7 기준 그대로)
- [ ] 스캠 방지 문구 감지(계좌·송금·카톡 유도) 로직을 클라이언트뿐 아니라 서버 메시지 저장 시점에도 적용(감사 로그 목적)

### Phase 2-D — 결제 실연동 + 가챠 재설계 (1주)
- [ ] Stripe/토스페이먼츠 웹훅 → `profiles.plan` 갱신(AUTH-BILLING-PLAN 표 그대로)
- [ ] **가챠 매칭 효과 제거**: 카드 레벨이 좋아요 한도·슈퍼라이크를 강화하던 로직 삭제. 코스메틱 전용으로 재설계하거나 드롭 — 이번 리뷰 지적사항 정면 반영
- [ ] "데모 결제" 문구 제거, 구독 관리(해지) 화면 연결

### Phase 3 — 안정화 (지속)
- [ ] 레이트리밋(비로그인/free), Sentry 에러 추적
- [ ] 프로필 인증(라이브니스) — 도용 방지 (PRISM-BUSINESS.md Phase 3 목표와 합류)
- [ ] 웹 푸시(새 매치/메시지 알림) — 리텐션 훅 보강(오늘 teen-study-circle 리뷰에서도 "재방문 알림 부재"가 동일하게 지적된 패턴)
- [ ] **재리뷰**: 백엔드 전환 완료 후 REVIEW-LOOP를 90점 게이트로 재실행 — 이번 루프의 구조적 감점 요인(실매칭 부재·페이투윈 가챠·모의결제)이 해소됐는지 검증

---

## 5. 사용자(운영자) 액션 필요 항목

에이전트가 직접 할 수 없는 것 — AUTH-BILLING-PLAN.md·PRISM-BUSINESS.md와 동일한 제약:

- [ ] Supabase 프로젝트 생성 + `DATABASE_URL`/`DIRECT_URL` 발급 (`data/owner-todos.json`에 이미 자리 있음)
- [ ] Google/카카오 OAuth 앱 등록(콘솔) + 클라이언트 ID/시크릿
- [ ] Stripe/토스페이먼츠 상점 계정 + API 키
- [ ] 위 키를 Vercel 환경변수로 등록(코드에 커밋 금지)

이 항목들이 채워지기 전까지는 Phase 2-A부터 순서대로 **코드/마이그레이션/API 라우트는 미리 준비**해둘 수 있고, 실제 배포·검증은 키가 채워진 뒤 진행한다.

---

## 6. 예상 소요 & 리스크

- **총 기간**: Phase 2-A~D 합산 약 4~6주(단일 개발자 기준, 허브 SSO를 PRISM이 최초 적용하는 비용 포함).
- **최대 리스크**: 성적 지향은 개인정보보호법상 민감정보 — 서버 전환 시점부터 암호화·RLS·삭제권 보장이 선택이 아니라 전제조건(PRISM-BUSINESS.md §7과 동일 인식).
- **가챠 재설계는 리스크 아님, 오히려 리스크 제거**: 페이투윈 요소를 없애는 쪽이 AdSense 데이팅 카테고리 심사·사용자 신뢰 양쪽에 유리.
