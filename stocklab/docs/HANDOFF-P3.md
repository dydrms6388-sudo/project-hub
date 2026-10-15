# HANDOFF — P3 (모의투자 + 랭킹 시즌 + 게이미피케이션 + PWA/앱) Claude Code 프롬프트

- 전제: P2 완료(구독·게이팅·백테스트 워커·알림 인프라·Upstash·FCM 준비). 참조: `11-feature-specs.md §4`, `20-db-schema.md`(🟪), `21-api-design.md §2.8`, `23-ux-flows.md §6`, `24-design-system.md`, `26-security-rls.md §2.9`.
- 아래 블록을 그대로 Claude Code 에 붙여 넣는다.

```
너는 시니어 풀스택 개발자다. 아래 명세로 주식 데이터 도구 플랫폼 "스톡랩"의 P3(모의투자 시즌제 + 전략 랭킹 시즌 + 예측·출석·포인트·배지 + 주간 리포트 + PWA/Capacitor)를 구현한다. 작업 디렉터리는 /stocklab 이다. 먼저 stocklab/docs/11-feature-specs.md §4, 20-db-schema.md, 21-api-design.md §2.8, 23-ux-flows.md §6, 26-security-rls.md §2.9 를 읽고 시작한다. P1·P2 코드(entitlements, getViewer, Disclaimer, QuotaCard, 알림 dispatch, 워커)를 재사용한다.

[스택] Next.js 15 App Router, TypeScript strict, Supabase(Auth+Postgres+RLS, RPC security definer), Tailwind v4(globals.css 토큰), Upstash Redis(레이트리밋·멱등), FCM(Web Push + Capacitor), Cloudflare Turnstile(출석 봇 방지), Capacitor 6(Android/iOS 래핑, 웹뷰는 배포 URL 로드), next-pwa 또는 수동 service worker(오프라인은 마지막 결과 표시만). 시세는 P2 지연 데이터(전일/당일 확정 종가) 기준, 프로 실시간은 KIS 릴레이가 있을 때만 옵션.

[법적 제약] 표현 금지 목록(scripts/check-expressions.mjs) 유지. 게임·예측 화면 전부에 "재미용" 고지: "모의투자·예측 게임은 학습과 재미를 위한 기능이며 투자 판단 근거가 아닙니다." 가상 자산·포인트는 현금·상품권·구독 할인으로 교환 불가(기능성 보상만: 백테스트 쿠폰, 스크리너 한도, 칭호). 랭킹 표에 MDD 병기, 타인 비하·외모평가형 배지/문구 금지. 주간 리포트는 기본 OFF 옵트인, 활동 요약만(프로모션 포함 시 별도 마케팅 동의 + "(광고)" 표기 — 이번 범위에서는 프로모션 미포함). 푸시 권한은 사용자 동작 후 요청.

[구현 범위 — P3]
1. 시즌·모의투자: seasons(월 단위, 1일 00:00~말일 15:30 KST), /game(시즌 홈·내 순위·티어·Top10), /game/join, /game/trade(종목 검색, 지연가 표시, "체결은 주문 이후 첫 확정 종가" 고지), /game/account, /game/rankings(game_month/game_week), /game/result/[season](티어 카드 + 공유 PNG). RPC place_game_order(auth.uid() 강제, 잔고·일 20건·종목 비중 ≤50%·시총≥500억·관리종목 제외 검증) → pending, /api/cron/game-settle(16:00 KST: 종가 체결, 수수료 0.015%·세금 0.18%, equity 재계산, 주간 랭킹 월~금), /api/cron/season-rollover(1일 00:00: 스냅샷 → rankings(kind='game_month'), 티어 컷 상위 1/5/20/50%, 포인트·배지 지급, 새 시즌 계정 1,000만원 리셋). 악용 방지: game_accounts (user_id, season_id) UNIQUE, device_hash 3계정↑ flagged=true → 랭킹 '검토 중', 15:20~15:30 주문은 다음 거래일 종가.
2. 전략 랭킹 시즌: /api/cron/rankings 를 시즌 체계로 통합(월초 리셋, rankings.season, 전월 1위 is_public), /rankings 에 시즌 선택·전월 1위 무료 공개, 'ranking_change' 알림 연결.
3. 예측 게임: prediction_sets(06:00 cron: 시총 상위 100 중 랜덤 2 + 오늘의 주식 1, closes_at 08:30), /predict(3카드 up/down, 카운트다운, 스트릭 배지), /api/predictions(마감 전만, UNIQUE user/set/code), 16:00 판정 cron(다음 거래일 종가 vs 기준 종가, 보합 void), 포인트 +20/정답, 스트릭 보너스 3/7/30.
4. 출석·포인트·배지·쿠폰: /api/checkin(Turnstile 검증 → RPC checkin(): 하루 1회 +10, 7일 연속 +50 + coupons(feature='backtest.run', amount=1, 90일)), points 원장 append-only + v_point_balance, /me/points(원장·교환 그리드: 백테스트 쿠폰 300P, 스크리너 +10회 100P, 저장 슬롯 +1 1,000P, 칭호), RPC redeem_points 트랜잭션, badges 16종 시드 + 획득 트리거/cron, /me/badges. 쿠폰은 백테스트 한도 판정에서 usage 전에 소비.
5. 주간 리포트: /api/cron/weekly-report(일 19:00 KST): 옵트인 사용자에게 이메일/푸시(스크리너 실행 수, 시그널 수, 모의투자 주간 수익률·순위 변동, 예측 정답률, 스트릭) + 웹뷰 /report/weekly/[week]. 프로모션 문구 없음.
6. PWA·앱: manifest, 아이콘, service worker(정적 자산 캐시 + 마지막 스크리너/오늘의 주식 결과 오프라인 표시), 설치 배너(2회 방문 후), Web Push 구독 → /api/push/tokens, Capacitor 프로젝트(apps/mobile 또는 stocklab/capacitor) 로 Android/iOS 래핑 + FCM 네이티브 토큰 등록, 딥링크 /today·/game. 스토어 심사용 문구(추천 아님·재미용) 포함.
7. 공유 카드 확장: 오늘의 주식·시즌 결과·예측 스트릭 canvas PNG(1200×630, 다크/라이트, 고지 1줄, 워터마크 stocklab.tomatoeggcat.com), 링크 복사/X/navigator.share. 공유 카드 생성 포인트 +5(일 3회).

[DB] 마이그레이션 0020_game.sql(seasons, game_accounts, game_positions, game_trades, push_tokens, RPC place_game_order/join_season, v_game_leaderboard), 0021_points.sql(points, badges seed 16, user_badges, prediction_sets, predictions, coupons, RPC checkin/redeem_points, v_point_balance). RLS: 26-security-rls.md §2.9 — 게임·포인트 테이블은 본인 read, 쓰기는 RPC/cron 만, 리더보드는 뷰(nickname, return_pct, rank, tier)로만 공개, cash·flagged 컬럼 revoke, predictions 는 closes_at 이전·result null 일 때만 본인 insert/update. 보관: game_trades 시즌+12개월, points 12개월 소멸은 음수 원장 행 추가.

[품질 기준] Lighthouse 90+(PWA 항목 포함), 모바일 우선(게임 주문 폼 한 손 조작), 다크모드, 에러 바운더리·빈 상태(시즌 미참가·주문 없음·예측 마감), 상승 빨강/하락 파랑 + 부호, .tnum, WCAG AA(카운트다운 aria-live polite). 시즌 롤오버 리허설 스크립트(스테이징에서 날짜 주입) 와 다계정 플래그 테스트, 체결 cron 멱등(같은 날 2회 실행 시 중복 체결 없음) 테스트. npm run check 통과. 시크릿(FCM_SERVICE_ACCOUNT_JSON, TURNSTILE_SECRET) 은 .env.example 에 키 이름만.

작업 순서: (1) 0020/0021 마이그레이션 + RLS + RPC → (2) 시즌·모의투자 주문/체결/롤오버 cron + 화면 → (3) 랭킹 시즌 통합 → (4) 예측 게임 → (5) 출석·포인트·배지·쿠폰 → (6) 주간 리포트 → (7) PWA·Web Push → (8) Capacitor 래핑·FCM → (9) 공유 카드 확장·QA. 각 단계 완료 시 npm run check 후 커밋하고 다음으로 진행. 모호한 사항은 docs 우선, 없으면 보수적으로 결정 후 docs/DECISIONS-P3.md 에 기록한다.
```
