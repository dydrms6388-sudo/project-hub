# mention-spike — 코인 언급 급상승 탐지

허브(정적 사이트)와 **별개로 배포되는 상시 서버 프로젝트**. 서버리스 cron 이 아니라
항상 떠 있는 worker 프로세스 + Redis(큐·상태)로 동작한다.

```
 [collector] ──공식 API 폴링/푸시──▶ 필터 ──▶ Redis ZSET (코인별 언급)
                                                │
 [engine] ── 10초마다 tick ─────────────────────┘
    ├─ 코인별 최근 60초 vs 직전 60초 집계 → 후보 분류 → snapshot + PUB/SUB
    └─ 사용자별 임계치·이벤트 상태 판정 → Redis Stream 큐(q:alerts)
 [notifier] ── consumer group 소비 ──▶ Telegram Bot API / SMTP Email (재시도·DLQ)
 [api]      ── 실시간 UI(SSE) · 사용자 설정 · 감사 로그 · 실제 발송 테스트 · push ingest
```

## 탐지 규칙
| 항목 | 기본값 | env |
|---|---|---|
| 탐지 주기 | 10초 (벽시계 10초 경계에 맞춤) | `DETECT_TICK_SEC` |
| 비교 구간 | 최근 60초 `(now-60s, now]` vs 직전 60초 `(now-120s, now-60s]` | `DETECT_WINDOW_SEC` |
| 증가율 | ≥ +200% | `DEFAULT_MIN_GROWTH_PCT` |
| 최신 구간 언급량 | ≥ 20건 | `DEFAULT_MIN_COUNT` |
| 최소 고유 작성자 | ≥ 8명 | `DEFAULT_MIN_UNIQUE_AUTHORS` |
| 데이터 신선도 | 90초 이내 수집 성공한 소스가 1개 이상 | `FRESHNESS_MAX_LAG_SEC` |
| 연속 수집(예열) | 그 소스가 끊김 없이 2구간(120초) 이상 수집 | — |

- **기준 구간 0건**: 증가율을 계산하지 않는다(무한대 표기 없음). `NEW_SURGE`(신규 급증)로
  별도 분류하고, 최소 언급량·작성자 조건은 똑같이 적용. 사용자별로 신규 급증 알림 on/off.
- **예열 조건이 필요한 이유**: 기동 직후나 수집 장애 복구 직후에는 직전 구간이 "언급이 없어서"가
  아니라 "수집을 안 해서" 0건이므로, 그대로 두면 모든 코인이 신규 급증으로 오탐된다.
- 신선도/예열 미달이면 후보 표시·알림 판정을 멈추고 UI 와 감사 로그(`detect.stale`)에 표시한다.

## 봇 / 중복 필터 (수집 단계)
- 원천 이벤트 id 중복(`dup_id`), 24시간
- 작성자명이 봇 패턴(`FILTER_BOT_NAME_PATTERN`) 또는 수동 차단 목록(Redis SET `ms:bots`)에 있음(`bot`)
- 정규화 본문(소문자, URL·멘션·숫자·구두점 제거)이 같은 복붙 게시물은 코인별 첫 건만(`dup_content`), 10분
- 한 작성자가 한 구간에 같은 코인을 N건 넘게 도배하면 초과분 제외(`author_rate`, 기본 2)
- 작성 시각이 5분 넘게 지난 이벤트 제외(`too_old`), 미래 시각은 현재로 보정
- 소스별 제외 사유 카운트는 UI "수집 소스" 표에 노출

## 중복 알림 방지 · 쿨다운 · 재알림
(사용자 × 코인) 단위 **이벤트** 상태 머신 (`src/detect/alertPolicy.js`):
1. 조건이 처음 충족되면 → 새 이벤트, 알림 1회
2. 같은 이벤트 진행 중, 마지막 알림 후 `cooldownSec`(기본 900초) 이내 → 억제
3. 쿨다운이 지났고, 언급량이 마지막 알림 때의 `realertMultiplier`배(기본 2배) 이상 → 재알림
4. 조건 미충족이 `eventResetSec`(기본 300초) 동안 이어지면 이벤트 종료 → 이후 충족은 새 이벤트

추가 멱등 장치: 큐 투입 키 `enq:{jobKey}` (엔진 재시작·다중 인스턴스), tick 락
(`lock:tick:{n}`), 채널별 발송 완료 키 `sent:{jobKey}:{channel}` (한 채널만 실패해 재시도돼도
성공한 채널로는 다시 보내지 않음).

## 수집 주기 ≠ 탐지 주기 (중요)
탐지 엔진은 10초마다 돌지만, **데이터는 각 플랫폼 공식 API 제약에 따른 주기로만 갱신된다.**
UI 상단 고지와 "수집 소스" 표(소스별 수집 주기·마지막 수집·정책)로 이를 명시하며,
10초 주기 수집을 보장하는 것처럼 표시하지 않는다.

| 소스 | 방식 | 제약 / 주기 |
|---|---|---|
| `reddit` | Reddit Data API (OAuth client_credentials) `/r/{subs}/new`, `/comments` | 클라이언트당 ≤100 QPM. 기본 60 QPM 사용, 15초 폴링. `X-Ratelimit-*` 헤더에 따라 일시 정지 |
| push (`/api/ingest`) | 다른 공식 연동(웹훅·스트리밍)을 별도 프로세스가 받아 전달 | 소스가 보고한 `pollIntervalSec` 표시 |
| `simulator` | 합성 데이터 (개발용) | 5초. UI 에 "실제 플랫폼 아님" 표기 |

X(Twitter) API 는 유료 플랜이 필요해서 구현하지 않았다. 도입하려면 소유자가 승인해야 한다(과금 발생). 연동하게 되면 push ingest 로 붙이면 된다.

## 실행
```bash
cp .env.example .env    # API_TOKEN, TELEGRAM_BOT_TOKEN, SMTP_URL, SMTP_FROM, 소스 설정
docker compose --env-file .env up -d        # redis(AOF) + api + engine + collector + notifier
# 또는 로컬: redis-server 를 띄운 뒤
npm ci && npm run api & npm run engine & npm run collector & npm run notifier
```
UI: `http://<host>:8787/` → API_TOKEN 입력. 엔진·notifier 는 여러 개 띄워도 된다
(tick 락 / consumer group). 배포 대상은 상시 프로세스를 돌릴 수 있는 곳이어야 한다
(Fly.io, Railway, VPS 등). Vercel 서버리스는 쓸 수 없다.

### 사용자 설정
UI 의 "사용자별 임계치" 또는 `PUT /api/users/:id` (Bearer API_TOKEN):
```json
{ "telegramChatId": "123456789", "email": "me@example.com", "minGrowthPct": 300,
  "minCount": 30, "minUniqueAuthors": 10, "cooldownSec": 600, "realertMultiplier": 1.5,
  "eventResetSec": 300, "alertOnNewSurge": true, "channels": {"telegram": true, "email": true},
  "coins": ["BTC", "ETH"] }
```
Telegram chat id 는 봇에게 `/start` 를 보낸 뒤 `https://api.telegram.org/bot<TOKEN>/getUpdates` 에서 확인.

### 실제 알림 발송 테스트
- UI 의 "Telegram/Email 실제 발송 테스트" 버튼 → `POST /api/users/:id/test-alert` (감사 로그 `alert.test_sent`/`alert.test_failed`)
- CLI (Redis 불필요): `npm run test:alert -- --telegram <chat_id> --email <addr>` — 실패 시 exit 1

### 감사 로그
Redis Stream `ms:audit` (+ `AUDIT_FILE` 지정 시 JSONL 파일). 유형:
`detect.candidate`, `detect.candidate_ended`, `detect.stale`, `detect.fresh`, `alert.enqueued`,
`alert.suppressed`(사유 바뀔 때만), `alert.event_closed`, `alert.sent`, `alert.failed`,
`alert.dead_letter`, `alert.test_requested`, `alert.test_sent`, `alert.test_failed`,
`settings.updated`(변경 전후, 연락처 마스킹), `settings.deleted`. `GET /api/audit?type=&count=`.

## 테스트
```bash
npm test   # redis-server 필요. 실제 Redis + 가짜 Telegram/SMTP 서버로 수집→탐지→큐→발송 전 구간 검증
```
자동 테스트는 Telegram/SMTP 를 로컬 가짜 서버로 대체한다. **실제 외부 발송**은 운영 자격증명을
넣고 위 "실제 알림 발송 테스트" 로 확인한다.

## 정책 메모
- 공개 게시물 언급량 통계일 뿐 투자 조언이 아님. 알림 본문과 UI 에 이 문구를 넣었다.
- 수집하는 것은 공개 게시물의 id·작성자명·작성 시각뿐이다(본문은 해시만 10분 보관). 15분이 지나면 지운다(`RETENTION_SEC`).
- 이메일·텔레그램 chat id 는 알림 수신용으로 사용자 본인이 입력하고, 감사 로그에는 마스킹해서 남긴다.
