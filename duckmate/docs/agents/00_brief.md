# 00 — 덕메이트(DuckMate) 공통 브리프 (모든 에이전트 필독)

## 절대 규칙
1. **배포 우선**: Phase 1 = Vercel 프로덕션 URL + Supabase 프로덕션 + 실제 가입/매칭/채팅 1회 성공. 그 전에 게임/결제/앱 래핑 코드 작성 금지.
2. **성인 전용**: 만 19세 미만 진입 완전 차단. 본인인증 없이는 프로필 공개·채팅·결제 불가.
3. **안전 > 성장**: 신고/차단/증거보존/24h 내 조치 파이프라인이 매칭 알고리즘보다 먼저.
4. **법적 요건 하드코딩**: 사업자 정보·통신판매업 번호·개인정보처리방침·위치정보 이용약관·청소년보호정책 페이지는 첫 배포 포함. 값 없으면 `[TODO_사업자정보]` 플레이스홀더 노출 + 빌드 경고(차단 X).
5. **UGC 인덱싱 게이트**: 회원 프로필/채팅/게시물 전부 `noindex`. 검색 노출은 공식 콘텐츠만.
6. **비밀값 커밋 금지**: `.env.example`만 커밋.
7. 각 산출물 상단에 `## 다음 에이전트에게 넘기는 결정사항` 섹션 필수.

## 서비스 정의
**한 줄**: "같은 걸 좋아하는 사람이랑 만나는 앱." 외모 스와이프가 아니라 **취미·덕질 궁합 → 함께 하는 활동 → 만남**.
**타겟**: 20~34세, 뚜렷한 취미/팬덤(게임, 애니, 아이돌, 보드게임, 러닝, 클라이밍, 카페투어, 공연, 웹툰, 사진, 코딩, 독서 등). 초기에는 성별 무관 **'취미 친구' 모드와 '데이팅' 모드 분리**, 데이팅 모드는 인증 회원만.
**차별점**: 프로필 첫 화면 = **덕질 카드**(취미 Top3 + 최애 + 요즘 빠진 것). 매칭 = 궁합 퀴즈 + 취미 태그 겹침 + 활동 시간대 가중합. 매칭 후 첫 대화 = **"같이 할 수 있는 것" 제안 카드**. 게임 요소가 어색함을 깬다.
**하지 않는 것**: 무제한 스와이프, 외모 점수, 위치 실시간 노출, 미인증 유저 간 DM.

## 기술 스택 (고정)
- Web: Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui, Zustand, TanStack Query
- Backend: Supabase (Postgres, Auth, Realtime, Storage, Edge Functions), RLS 전면
- 결제: Toss Payments — Phase 3. 앱 IAP는 Phase 4 RevenueCat
- 본인인증: 포트원(PASS/다날) — Phase 1은 `IdentityVerifier` 어댑터 인터페이스 + mock
- 이미지: Supabase Storage + 서버측 리사이즈, 얼굴 유무 검사 어댑터
- 알림: Web Push(VAPID) → 앱 후 FCM/APNs
- 앱: Capacitor (Phase 4)
- 모노레포: pnpm workspaces + Turborepo. 경로: `duckmate/apps/web`, `duckmate/apps/company`, `duckmate/packages/ui`, `duckmate/packages/db`, `duckmate/packages/game-engine`, `duckmate/supabase/`
- 배포: Vercel (web, company 별도 프로젝트), Supabase 프로덕션 1개
- 테스트: Vitest + Playwright (가입→인증→매칭→채팅 E2E 1개 Phase 1 필수)

## DB 스키마 (핵심 — D1이 SQL 확정)
```
profiles          id, user_id, nickname, birth_year, gender, region_code, bio, verify_level(0~3), status(active/paused/banned), mode(friend/dating), last_active_at, created_at
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
reports           id, reporter_id, target_id, match_id, reason_code, detail, evidence(jsonb snapshot), status, handled_by, handled_at
sanctions         id, profile_id, level, reason, starts_at, ends_at
subscriptions     id, user_id, tier, provider, provider_sub_id, status, current_period_end, cancel_at
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

## 매칭 점수 (D3)
점수 = 0.4×취미태그 자카드 + 0.35×궁합퀴즈 코사인 + 0.15×활동시간대 겹침 + 0.1×상호 관심 신호. 일 추천 N명(무료 5/플러스 15/프로 30).

## 게임 & 리텐션 (Phase 2 — F그룹 전용, Phase 1에서 구현 금지)
1. 오늘의 궁합 카드(일 1회, 무료도 1장) 2. 취향 배틀(Would You Rather) 3. 덕질 퀴즈 대전 4. 매칭 리빌 미니게임(스크래치) 5. 스트릭 & 데일리 퀘스트(7일=슈퍼라이크 1개, 죄책감 카피 금지) 6. 주간 취미 이벤트 7. 취미 랭킹 8. 첫 대화 제안 카드(매칭 즉시 3개).
KPI: D1 40% / D7 20% / D30 10%. 푸시 일 최대 2건.

## 유료 구조 (A4 확정, D6·E4 구현)
| | 무료 | 플러스 ₩9,900/월 | 프로 ₩19,900/월 |
|---|---|---|---|
| 일일 추천 | 5 | 15 | 30 |
| 오늘의 궁합 카드 | 1 | 3 | 5 |
| 나를 좋아한 사람 | 블러 | 공개 | 공개+우선노출 |
| 슈퍼라이크 | 주1 | 주5 | 주15 |
| 취향 배틀 결과 상세 | 상위1 | 상위5 | 전체 |
| 되돌리기 | X | O | O |
| 이벤트 우선 참가 | X | X | O |
| 광고 | 배너 | 없음 | 없음 |
소모성: 슈퍼라이크 5개 ₩4,900, 부스트(1h) ₩3,900.
금지: 자동갱신 숨기기, 해지 3뎁스 이상, "지금 안 사면 사라져요" 카피, 가짜 좋아요 알림. 환불: 전자상거래법 7일 청약철회 + 사용분 차감.

## 회사 소개 사이트 (`apps/company`)
완전 정적. 페이지: 홈 / 서비스 소개 / 안전과 신뢰(인증 절차, 신고 SLA 24h) / 팀·비전 / 블로그·보도자료 / 채용 / 문의 / 법적 고지. 취미 위키(인덱싱 O, Phase 5). 사업자 정보는 `apps/company/config/company.ts` 한 곳, 미입력 시 빌드 경고.

## Phase 로드맵
- **Phase 1**: 가입/연령확인/취미/퀴즈/덕질카드/사진(검수 큐), 일일 추천 5 + 좋아요/매칭 + 채팅 + 신고/차단, 법적 페이지 전부, company 최소(홈+법적고지+문의). 게이트: 프로덕션 URL 2개, E2E 통과, DEPLOY_LOG.md.
- Phase 2 게임/리텐션 · Phase 3 결제 · Phase 4 앱 래핑+실 본인인증+FCM · Phase 5 위키 30개+이벤트+랭킹

## 미확정 값 (플레이스홀더로 진행)
서비스명 최종(가칭 덕메이트), 도메인(`{{DOMAIN}}`), 사업자 정보(`{{COMPANY_NAME}}` 등), Supabase/Vercel 프로젝트 존재 여부(없다고 가정), Toss/포트원 계정(없다고 가정).
