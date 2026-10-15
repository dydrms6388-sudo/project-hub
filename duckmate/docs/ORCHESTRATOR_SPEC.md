# 덕메이트(DuckMate) — 취미/덕질 기반 데이팅 서비스 · Claude Code 오케스트레이터 프롬프트

> 이 파일 전체를 Claude Code에 붙여넣어라. 너는 오케스트레이터다. 아래 30개 서브에이전트를 `Task` 툴로 순서대로 스폰하고, 각 에이전트 산출물을 `/docs/agents/{번호}_{역할}.md`에 저장한 뒤 다음 에이전트에 컨텍스트로 넘긴다. **모든 코드는 Phase 1 배포 게이트를 통과할 때까지 Phase 2 기능을 만들지 않는다.** 이 규칙은 어떤 에이전트도 무시할 수 없다.

---

## 0. 절대 규칙 (오케스트레이터가 매 단계 검증)

1. **배포 우선**: Phase 1 완료 = Vercel 프로덕션 URL + Supabase 프로덕션 + 실제 회원가입/매칭/채팅 1회 성공. 이 전에 게임/결제/앱 래핑 코드 작성 금지.
2. **성인 전용**: 만 19세 미만 진입 완전 차단. 본인인증 없이는 프로필 공개·채팅·결제 불가.
3. **안전 > 성장**: 신고/차단/증거보존/24h 내 조치 파이프라인이 매칭 알고리즘보다 먼저 완성된다.
4. **법적 요건 하드코딩**: 사업자 정보·통신판매업 번호·개인정보처리방침·위치정보 이용약관·청소년보호정책 페이지는 첫 배포에 포함. 값이 없으면 `[TODO_사업자정보]` 플레이스홀더를 노출하고 빌드에서 경고를 띄운다(차단은 안 함).
5. **UGC 인덱싱 게이트**: 회원 프로필/채팅/게시물은 전부 `noindex`. 검색 노출은 공식 콘텐츠(취미 위키, 블로그, 회사 소개)만.
6. **비밀값 커밋 금지**: `.env.example`만 커밋, 실제 키는 Vercel/Supabase 대시보드.
7. 각 에이전트 산출물 상단에 `## 다음 에이전트에게 넘기는 결정사항` 섹션 필수.

---

## 1. 서비스 정의

**한 줄**: "같은 걸 좋아하는 사람이랑 만나는 앱." 외모 스와이프가 아니라 **취미·덕질 궁합 → 함께 하는 활동 → 만남** 순서.

**타겟**: 20~34세, 뚜렷한 취미/팬덤(게임, 애니, 아이돌, 보드게임, 러닝, 클라이밍, 카페투어, 공연, 웹툰, 사진, 코딩, 독서 등)이 있고 "취미가 안 맞는 사람이랑은 못 만나겠다"는 사람. 남녀 비율 문제를 완화하기 위해 **초기에는 성별 무관 '취미 친구' 모드와 '데이팅' 모드를 분리**하고 데이팅 모드는 인증 회원만.

**차별점**
- 프로필의 첫 화면이 사진이 아니라 **덕질 카드**(내 취미 Top 3 + 최애 + 요즘 빠진 것).
- 매칭 = 궁합 퀴즈 결과 + 취미 태그 겹침 + 활동 시간대 겹침의 가중합.
- 매칭 후 첫 대화가 자동으로 **"같이 할 수 있는 것" 제안 카드**로 시작 (예: "이번 주 토요일 홍대 보드게임카페 어때요?").
- 게임 요소가 데이팅의 어색함을 대신 깨준다.

**하지 않는 것**: 무제한 스와이프, 외모 점수, 위치 실시간 노출, 미인증 유저 간 DM.

---

## 2. 기술 스택 (고정)

- **Web**: Next.js 15 App Router, TypeScript strict, Tailwind, shadcn/ui, Zustand(클라이언트 상태), TanStack Query
- **Backend**: Supabase (Postgres, Auth, Realtime, Storage, Edge Functions), RLS 전면 적용
- **결제**: Toss Payments (국내 카드/간편결제) — Phase 3. 앱 내 결제는 스토어 규정에 따라 IAP 필요 → Phase 4에서 RevenueCat
- **본인인증**: 포트원(PortOne) 본인인증(PASS/다날) — Phase 1에서는 어댑터 인터페이스만, 실키 연동은 배포 후
- **이미지**: Supabase Storage + 서버측 리사이즈, 프로필 사진 얼굴 유무 검사(Edge Function + 경량 모델 또는 외부 API 어댑터)
- **알림**: Web Push(VAPID) → 앱 래핑 후 FCM/APNs
- **앱**: Capacitor로 웹 래핑 (Phase 4). 네이티브 코드 최소화.
- **회사 소개 사이트**: 같은 모노레포 `apps/company` (Next.js SSG, 완전 정적)
- **모노레포**: pnpm workspaces + Turborepo. `apps/web`, `apps/company`, `packages/ui`, `packages/db`(타입·마이그레이션), `packages/game-engine`
- **배포**: Vercel (web, company 각각 프로젝트), Supabase 프로덕션 1개
- **테스트**: Vitest + Playwright(가입→인증→매칭→채팅 E2E 1개는 Phase 1 필수)

---

## 3. 30 에이전트 편성 & 실행 순서

각 에이전트는 `Task`로 스폰. 괄호 안은 산출물. **같은 그룹 내 에이전트는 병렬 가능, 그룹 간은 순차.**

### 그룹 A · 기획 (6) — 병렬 후 A6이 통합
- **A1 시장/경쟁 리서치**: 국내 데이팅앱(글램·위피·틴더·아만다·정오의데이트) 유료 구조/온보딩/안전정책 비교표, 취미 기반 앱 실패 사례 원인 3개 (`docs/agents/01_market.md`)
- **A2 페르소나/JTBD**: 페르소나 4개(덕질 몰입형/취미 입문형/오프모임 선호형/온라인 대화 선호형), 각각의 이탈 지점 (`02_persona.md`)
- **A3 핵심 루프 설계**: 일일 루프(접속→오늘의 궁합 카드→게임 1개→매칭/대화→내일 예고), 주간 루프(취미 이벤트, 랭킹 리셋) (`03_core_loop.md`)
- **A4 수익 모델**: 무료/플러스/프로 3티어 확정, 소모성 아이템, 가격, 무료 유저가 결제할 이유 5개, 다크패턴 금지 목록 (`04_monetization.md`)
- **A5 안전/신뢰 정책**: 인증 단계별 권한표, 신고 사유 택소노미, 제재 등급, 증거 보존 기간, 성희롱/사기(로맨스 스캠) 탐지 룰 (`05_trust_safety.md`)
- **A6 PRD 통합**: A1~A5를 PRD 1개로 통합, 기능별 Phase 배정, MoSCoW (`06_PRD.md`)

### 그룹 B · 법무/컴플라이언스 (3) — A 완료 후
- **B1 국내 규제 체크리스트**: 사업자등록, 통신판매업 신고, 위치정보 이용약관(위치기반서비스사업 신고 필요 여부 판정), 개인정보처리방침(민감정보·생체정보 X), 청소년보호책임자, 정보통신망법 고지 의무, 전자상거래법 청약철회 규정 → **각 항목마다 "코드에서 무엇을 해야 하는지"** (`07_legal_checklist.md`)
- **B2 약관/정책 문서 초안**: 이용약관, 개인정보처리방침, 위치정보 이용약관, 청소년보호정책, 커뮤니티 가이드라인, 환불정책 — 전부 `apps/web/content/legal/*.md` 로 생성, 변수는 `{{COMPANY_NAME}}` 등 플레이스홀더 (`08_legal_docs.md` + 실제 파일)
- **B3 앱스토어 규정 사전 검토**: Apple 4.3/5.1.1(데이팅 카테고리), Google 데이팅 정책, IAP 의무 범위, 웹 결제 유도 금지 조항 → Phase 4 리스크 리스트 (`09_store_policy.md`)

### 그룹 C · 디자인 (4) — B와 병렬 가능
- **C1 브랜드/톤**: 이름 확정(가칭 덕메이트, 대안 3개 + 상표 검색 필요 표시), 컬러(활기 있되 유치하지 않게: 딥 바이올렛 + 코랄 액센트 + 오프화이트), 폰트(Pretendard Variable), 보이스&톤 가이드 (`10_brand.md`)
- **C2 디자인 시스템**: shadcn 기반 토큰, 컴포넌트 목록(덕질카드, 궁합게이지, 스트릭 뱃지, 매칭 리빌 애니메이션), 다크모드 (`11_design_system.md` + `packages/ui` 스켈레톤)
- **C3 화면 플로우**: 온보딩(연령확인→휴대폰→취미 5개 선택→궁합 퀴즈 10문항→덕질카드 작성→사진)→홈→탐색→매칭→채팅→프로필→설정, 각 화면 와이어(텍스트 ASCII 또는 mermaid) (`12_flows.md`)
- **C4 회사 소개 사이트 IA**: 홈/서비스 소개/팀·비전/안전정책/보도자료·블로그/채용/문의/법적고지, 카피 초안 (`13_company_site.md`)

### 그룹 D · 백엔드 (8) — C 완료 후, D1→D2 순차, 나머지 병렬
- **D1 DB 스키마**: 아래 §4 스키마를 Supabase 마이그레이션 SQL로. RLS 정책 전부. 인덱스. `supabase/migrations/` (`14_schema.md`)
- **D2 Auth/인증 파이프라인**: 이메일+휴대폰 → 본인인증 어댑터 인터페이스(`IdentityVerifier`), 프로필 사진 검수 큐, 인증 레벨 0~3 (`15_auth.md`)
- **D3 매칭 엔진**: 점수 = 0.4×취미태그 자카드 + 0.35×궁합퀴즈 코사인 + 0.15×활동시간대 겹침 + 0.1×상호 관심 신호. 일 추천 N명(무료 5/플러스 15/프로 30), 이미 본 사람 재노출 규칙, 성비 불균형 시 큐 조정. Edge Function + Postgres 함수 (`16_matching.md`)
- **D4 채팅/Realtime**: Supabase Realtime, 읽음, 이미지 전송(인증 레벨 2 이상), 금칙어/연락처 패턴 마스킹(전화번호·카톡ID는 매칭 3일 후 해제), 신고 시 대화 스냅샷 보존 (`17_chat.md`)
- **D5 신고/제재/모더레이션**: 신고 테이블, 자동 제재 룰(동일인 3회 신고 시 임시정지), 어드민 큐, 감사로그 (`18_moderation.md`)
- **D6 결제/구독(Toss)**: 구독 상태 머신, 웹훅 검증, 청약철회, 소모성 아이템 원장(ledger) — **Phase 3 코드지만 스키마와 인터페이스는 지금 확정** (`19_payments.md`)
- **D7 알림/스케줄러**: Web Push, 매일 오전 "오늘의 궁합 카드" 발송, 미접속 D3/D7 리마인더(스팸 방지 상한), Supabase cron (`20_notifications.md`)
- **D8 어드민 대시보드**: 신고 큐, 사진 검수, 유저 검색, 제재, 지표(DAU/매칭율/신고율) — `apps/web/app/(admin)` 로 admin role만 (`21_admin.md`)

### 그룹 E · 프론트엔드 (6) — D1 완료 후 병렬
- **E1 온보딩/인증 UI** (`22_fe_onboarding.md`)
- **E2 홈/탐색/덕질카드/매칭 리빌** (`23_fe_discover.md`)
- **E3 채팅 UI + 첫 대화 제안 카드** (`24_fe_chat.md`)
- **E4 프로필/설정/구독 관리/차단목록/데이터 다운로드·탈퇴** (`25_fe_profile.md`)
- **E5 회사 소개 사이트 구현** `apps/company` SSG (`26_fe_company.md`)
- **E6 접근성/성능/SEO 게이트**: Lighthouse 90+, 공식 페이지만 sitemap, UGC noindex 검증 스크립트 (`27_fe_quality.md`)

### 그룹 F · 게임/리텐션 (3) — Phase 1 배포 게이트 통과 후에만 스폰
- **F1 게임 시스템 설계** (§5) (`28_game_design.md`)
- **F2 게임 엔진 구현** `packages/game-engine` + UI (`29_game_impl.md`)
- **F3 리텐션 실험 설계**: 스트릭, 데일리 퀘스트, 주간 취미 이벤트, 푸시 카피 A/B, 이탈 예측 룰 (`30_retention.md`)

### 그룹 G · QA (3) — 각 Phase 말에 스폰
- **G1 E2E 테스트** (Playwright: 가입→인증→매칭→채팅→신고)
- **G2 보안 리뷰**: RLS 우회 시도, IDOR, 웹훅 위조, Storage 공개 버킷 점검
- **G3 배포 러너**: 실제 `vercel --prod`, Supabase 마이그레이션 적용, 프로덕션 URL과 스크린샷을 `docs/DEPLOY_LOG.md`에 기록. **URL이 없으면 Phase 통과 불가.**

---

## 4. DB 스키마 (핵심 테이블 — D1이 SQL로 확정)

```
profiles          id, user_id, nickname, birth_year, gender, region_code, bio,
                  verify_level(0~3), status(active/paused/banned), mode(friend/dating),
                  last_active_at, created_at
hobbies           id, slug, name, category, icon, is_active
profile_hobbies   profile_id, hobby_id, rank(1~3=Top3), intensity(1~5), fav_note
quiz_questions    id, category, text, options(jsonb), weight
quiz_answers      profile_id, question_id, choice
photos            id, profile_id, path, is_primary, review_status, reviewed_by
availability      profile_id, weekday, slot(morning/afternoon/evening/night)
daily_recommendations  id, profile_id, target_id, score, reasons(jsonb), date, seen_at
likes             from_id, to_id, type(like/super), created_at
matches           id, a_id, b_id, matched_at, first_suggestion(jsonb), status
messages          id, match_id, sender_id, body, image_path, masked_body, read_at
blocks            blocker_id, blocked_id
reports           id, reporter_id, target_id, match_id, reason_code, detail,
                  evidence(jsonb snapshot), status, handled_by, handled_at
sanctions         id, profile_id, level, reason, starts_at, ends_at
subscriptions     id, user_id, tier, provider, provider_sub_id, status,
                  current_period_end, cancel_at
item_ledger       id, user_id, item_type, delta, balance_after, ref
game_profiles     profile_id, level, xp, streak_days, last_played_at, coins
game_sessions     id, game_type, participants(jsonb), state(jsonb), result, created_at
quests            id, key, title, kind(daily/weekly), reward
quest_progress    profile_id, quest_id, progress, completed_at, date
events            id, hobby_id, title, region, starts_at, capacity, host_id
event_rsvps       event_id, profile_id
audit_logs        id, actor_id, action, target, meta, created_at
```

RLS 원칙: 자기 행만 쓰기, 매칭 상대는 프로필 읽기만, 차단 관계는 양방향 불가시, 신고/제재/감사로그는 service role 전용.

---

## 5. 게임 & 리텐션 요소 (F그룹 상세 스펙 — Phase 2)

**핵심 원칙**: 게임은 "대화 시작의 핑계"와 "내일 다시 올 이유"를 만든다. 게임 자체가 목적이 되면 안 됨.

1. **오늘의 궁합 카드** (일 1회): 매일 오전 1명, 궁합 % + 이유 3줄. 카드 뒤집기 애니메이션. 무료 유저에게도 반드시 매일 1장 → 리텐션 앵커.
2. **취향 배틀 (Would You Rather)**: 같은 취미 태그를 가진 사람들 사이 익명 2지선다 투표. 결과 페이지에서 "당신과 87% 같은 선택을 한 사람" 노출 → 관심 표시 가능.
3. **덕질 퀴즈 대전**: 취미별 5문제 실시간 1:1(또는 비동기) 퀴즈. 승패보다 "같이 풀었다"는 경험. 완료 시 대화방 자동 오픈 옵션.
4. **매칭 리빌 미니게임**: 매칭되면 서로의 덕질카드가 스크래치 카드처럼 긁혀 나옴 (5초짜리 즐거움).
5. **스트릭 & 데일리 퀘스트**: 접속/카드 확인/투표 1회/대화 답장 = 퀘스트. 7일 스트릭 보상 = 슈퍼라이크 1개. 스트릭 끊겨도 죄책감 카피 금지(다크패턴 금지 목록 준수).
6. **주간 취미 이벤트**: 취미별 온라인 이벤트(예: "이번 주 최애 사진 한 장") + 오프라인 모임(호스트 인증 회원만). RSVP 명단에서 관심 표시.
7. **취미 랭킹**: "이번 주 클라이밍 덕후 TOP 10" 등 활동량 기준, 매주 리셋. 익명 옵션.
8. **첫 대화 제안 카드**: 매칭 즉시 3개 제안(공통 취미 기반 활동, 취향 배틀 결과, 퀴즈 결과) → 클릭 한 번으로 첫 메시지.

리텐션 KPI: D1 40% / D7 20% / D30 10% 목표. 푸시는 일 최대 2건.

---

## 6. 유료 서비스 구조 (A4가 확정, D6·E4가 구현)

| | 무료 | 플러스 (₩9,900/월) | 프로 (₩19,900/월) |
|---|---|---|---|
| 일일 추천 | 5명 | 15명 | 30명 |
| 오늘의 궁합 카드 | 1장 | 3장 | 5장 |
| 나를 좋아한 사람 | 블러 | 공개 | 공개 + 우선 노출 |
| 슈퍼라이크 | 주 1개 | 주 5개 | 주 15개 |
| 취향 배틀 결과 상세 | 상위 1명 | 상위 5명 | 전체 |
| 되돌리기 | X | O | O |
| 이벤트 우선 참가 | X | X | O |
| 광고 | 배너 | 없음 | 없음 |

소모성: 슈퍼라이크 5개 ₩4,900, 부스트(1시간 노출↑) ₩3,900.
금지: 자동갱신 숨기기, 해지 버튼 3뎁스 이상, "지금 안 사면 사라져요" 류 카피, 가짜 좋아요 알림.
환불: 전자상거래법 기준 7일 청약철회 + 사용분 차감 규칙 명시.

---

## 7. 회사 소개 사이트 (`apps/company`)

- 완전 정적, `company.{도메인}` 또는 `{도메인}/company`
- 페이지: 홈(미션 한 줄 + 서비스 스크린샷) / 서비스 소개 / 안전과 신뢰(인증 절차, 신고 처리 SLA 24h, 데이터 정책 요약) / 팀·비전 / 블로그·보도자료 / 채용 / 문의(폼 → Supabase Edge Function 메일) / 법적 고지(사업자 정보, 통신판매업 번호, 개인정보보호책임자, 청소년보호책임자)
- 취미 위키 섹션(공식 콘텐츠, 인덱싱 O): 취미별 입문 가이드 30개 — 유일한 SEO 유입 채널이므로 실질 콘텐츠로.
- 사업자 정보 값은 `apps/company/config/company.ts` 한 곳에서만 관리, 미입력 시 빌드 경고.

---

## 8. Phase 로드맵 & 게이트

**Phase 1 — 배포 가능한 최소 데이팅 (A→B→C→D1~D5,D7→E1~E4,E6→G1~G3)**
- 가입/연령확인/취미 선택/궁합 퀴즈/덕질카드/사진 업로드(검수 큐)
- 일일 추천 5명 + 좋아요/매칭 + 채팅 + 신고/차단
- 법적 페이지 전부 + 회사 소개 사이트 최소 버전(E5는 여기서 홈+법적고지+문의만)
- **게이트**: 프로덕션 URL 2개(web, company), E2E 통과, `DEPLOY_LOG.md`에 스크린샷. 이걸 못 넘기면 오케스트레이터는 F그룹을 스폰하지 않는다.

**Phase 2 — 게임/리텐션 (F1~F3, 그 후 G1~G3)**
- 오늘의 궁합 카드, 취향 배틀, 매칭 리빌, 스트릭·퀘스트, 첫 대화 제안 카드
- 게이트: 배포 + 실제 유저(본인 포함) 7일 스트릭 데이터 1건

**Phase 3 — 결제 (D6 구현, E4 결제 UI, G2 보안 리뷰 재실행)**
- Toss 구독 + 소모성 아이템, 웹훅, 환불 플로우
- 게이트: 테스트 결제 → 실결제 100원 → 환불 1사이클 로그

**Phase 4 — 앱 래핑 (Capacitor) + 실 본인인증 연동 + FCM**
- B3 리스크 리스트 반영, IAP 전환(RevenueCat), 스토어 제출 체크리스트
- 게이트: TestFlight/내부 테스트 트랙 배포

**Phase 5 — 취미 위키 30개 + 이벤트 기능 + 랭킹**

---

## 9. 오케스트레이터 실행 지시

```
1. 리포 초기화: pnpm + turbo 모노레포, apps/web, apps/company, packages/ui, packages/db, packages/game-engine
2. docs/agents/ 생성 후 그룹 A 6개 Task 병렬 스폰 → A6 통합 → 나에게 PRD 요약 10줄 보고
3. 그룹 B, C 병렬 스폰
4. D1 → D2 → (D3,D4,D5,D7,D8 병렬)  ※ D6은 인터페이스/스키마만
5. E1~E4, E6 병렬 (E5는 최소 버전)
6. G1~G3 실행. G3가 프로덕션 URL을 DEPLOY_LOG.md에 기록하지 못하면 여기서 멈추고 나에게 막힌 이유(환경변수/계정/도메인)를 정확히 물어라.
7. Phase 1 게이트 통과 후에만 F1~F3.
8. 각 Phase 종료 시 `docs/PHASE_REPORT_{n}.md`: 완료/미완료/다음 Phase 선행조건.
```

**나에게 물어야 하는 것 (지금 답 없으면 플레이스홀더로 진행)**: 서비스명 최종, 도메인, 사업자 정보, Supabase/Vercel 프로젝트 존재 여부, Toss/포트원 계정 유무.

**시작하라. 첫 보고는 그룹 A 완료 후 PRD 요약 10줄이다.**
