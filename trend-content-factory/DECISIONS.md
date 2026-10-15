# DECISIONS — Trend Content Factory

Phase 진행 중 내린 결정을 누적 기록한다. (최신이 위)

## Phase 3 (게시 스케줄러 — 테스트 계정)

### 스코프
- 프롬프트 지시대로 **테스트 계정 1개 검증까지**. 20계정 확장·크론 활성화는 소유자 승인 후(Phase 5).
- 실게시는 계정 토큰/앱 심사가 있어야 가능 → 이 환경에선 **시뮬레이션 모드**로 전체 안전장치를
  검증(가상 시계로 하루 압축 재생). 실제 어댑터는 토큰만 있으면 그대로 동작.

### 게시 상태머신 + 체크리스트 (HARD CONSTRAINTS 반영)
- 상태: `queued → (checklist) → uploading → published | throttled | failed`.
- 게시 전 체크리스트(하나라도 실패 → **throttled 이연**, 단 dedup 은 failed):
  1. `content_publishing_limit` 등 **사용률 ≥ 0.6 → 이연** (HARD #1: 실측 × 0.6 초과 금지)
  2. 워밍업 일일 한도(1주 3 / 2주 6 / 3주 10 / 4주+ 15) (HARD #5)
  3. 최근 게시 간격 **≥ 40분(±12분 지터)** (체크리스트 3)
  4. 캡션 중복도 **< 0.85** (동일 계정 30일) — 초과 시 **failed**(재시도 무의미) (체크리스트 4)
- **중요 설계 수정**: 백프레셔 이연(페이싱/워밍업/레이트리밋 대기)은 "실패"가 아니므로 `attempts`
  카운터를 **올리지 않는다**. 실제 게시 오류(retryable)만 attempts++ → 한도(5) 초과 시 failed.
  (초기 구현은 대기까지 attempts 로 세어 대기 잡이 조기 failed 되는 버그 → 데모에서 발견·수정.)

### 레이트리밋 거버너 (HARD #3)
- 응답 헤더(`X-App-Usage`/`X-Business-Use-Case-Usage`) 사용률 → `rate_limit_log` 기록.
- **80% 초과 → 60분 쿨다운, 95% 초과 → 24시간 중단**(계정 state=cooldown/disabled + cooldown_until).
- 시뮬레이션 실측: 게시마다 사용률 12%↑ → 7건째 84%에서 쿨다운, 8건째 96%에서 24h 중단 확인.

### 플랫폼 어댑터 (5종, 공통 인터페이스 `PlatformPublisher`)
- **IG/FB**: Meta Graph v21 — 컨테이너 생성 → `status_code=FINISHED` 폴링(지수백오프,최대5분) →
  `media_publish`. 릴 `media_type=REELS`. 미디어는 **공개 URL**(Storage) 필요.
- **TikTok**: Content Posting API(PULL_FROM_URL) init → status 폴링. **Threads**: 컨테이너→publish.
- **X**: 미디어 업로드(v1.1 chunked) → 트윗(v2). 사용자 컨텍스트 토큰 필요.
- **SimPublisher**: 네트워크 없이 사용률 램프업 → 거버너/상태머신 검증용.
- 각 플랫폼 API·심사가 상이(Meta/TikTok/Threads/X 별도) → 실연동은 소유자 계정·토큰 준비 후.

### 토큰/시크릿
- 토큰 원문은 **env(테스트) 또는 Supabase Vault(실서비스) 참조만**. 코드/DB/커밋에 하드코딩 0.
- Meta long-lived 토큰: 50일 주기 갱신(`fb_exchange_token`) + 만료 7일 전 알림 헬퍼(`tokens.ts`).
  실제 갱신 크론은 pg_cron/워커가 이 헬퍼 호출.

### 캡션 플랫폼 분기
- 같은 소재를 플랫폼별 한도/톤으로 재조립(`captions.ts`): 해시태그 수·글자수(X 280 등)·CTA 포함 여부.
  결정론적(LLM 불필요) — 계정 간 캡션 중복 방지 제약과 함께 플랫폼별로 달라진다.

## Phase 2 (품질 게이트 + 렌더)

### 대상 플랫폼 확장
- 소유자 지시로 게시 대상 = **TikTok / Facebook / Instagram / Threads / X** 5종.
- `Platform` 타입 확장(`ig|fb|tiktok|threads|x`) + `config/platforms.ts` 에 플랫폼별
  렌더 규격(카드/릴 dims)·캡션·해시태그 한도·톤 정의. 마이그레이션 platform CHECK 도 5종으로.
- 카드 dims: ig/fb/threads 1080×1350, tiktok 1080×1920(포토모드), x 1600×900(가로).
- 릴은 마스터 1080×1920 1편을 릴 지원 플랫폼(모두)에 공유(X 는 세로영상 허용) → 렌더 1회로 다중 게시.

### M3 품질 게이트
- 6-페르소나(scroller/expert/editor/designer/algo/risk) 적대적 패널. 각 페르소나 0~100 +
  "팔로우?" 이진 판정. 가중합 총점 ≥ 80 **및** follow NO ≤ 2 통과.
- 배치 10건 단위 Claude 호출(토큰 절감) + 키 없을 때 결정론적 목업 패널.
- 통과=`approved`, 탈락/심사누락=`rejected`(폐기 아님, 보관). 심사 누락은 안전하게 rejected.

### M4 렌더러 — 이 환경에서 실동작 확인
- **카드**: HTML(파라메트릭 템플릿 엔진, cardTemplate id→레이아웃 variant 0~4 + 팔레트/타이포)
  → Playwright(Chromium) → PNG. 플랫폼 dims 그대로 풀해상도.
  - 대표 플랫폼(ig)은 전체 캐러셀(슬라이드 전부), 나머지 카드 플랫폼은 커버 1장.
- **릴**: 애니메이션 HTML(Ken Burns + 자막 번인 + 진행바 + 상하 220px 세이프존)
  → Playwright 녹화(webm) → **ffmpeg MP4 인코딩(H.264 High/yuv420p/30fps/CRF23/AAC128k)**.
  실측 산출물: `1080x1920, h264, 30fps, aac stereo` — **스펙 준수 확인**.
- **한글 폰트**: Chromium 에 한글 폰트가 없어(Unifont/WQY 만) 반드시 임베드 필요 →
  Pretendard/NanumMyeongjo(명조=GowunBatang 대체)/JetBrainsMono woff2 를 jsdelivr 에서
  받아 `assets/fonts/` 에 번들, data URI @font-face 로 주입.
- **Chromium 실행**: 사전설치 브라우저(빌드 1194) ↔ npm playwright(1.61) 버전 불일치 →
  `executablePath` 를 `/opt/pw-browsers/chromium-*/chrome-linux/chrome` 로 명시 해석
  (env 가이드: `playwright install` 금지 준수).

### 미디어 파이프라인 — 키-옵셔널 추상화 (핵심 결정)
- 소유자가 유료 API를 아직 안 정함 → **추상화 레이어 + 무료 폴백**으로 Phase 2 를 오늘 실행 가능하게:
  - **이미지 배경**: 기본 = 라이선스 안전한 **자체 절차적 CSS 배경**(팔레트 결정론 생성, 외부 이미지 0).
    선택적 fal.ai(`FAL_KEY`) 대표컷은 인터페이스만(없으면 CSS). "웹에서 긁은 이미지 금지" 준수.
  - **TTS**: `TtsProvider` 인터페이스(ElevenLabs 구현 + Supertone/Google 스텁). 키 없으면 무음 →
    ffmpeg 가 무음 AAC 트랙 mux. `ELEVENLABS_API_KEY` 넣으면 실제 나레이션.
  - **ffmpeg**: `@ffmpeg-installer/ffmpeg`(npm 레지스트리 호스팅, github egress 불필요)로 풀빌드
    H.264/AAC 확보. 없으면 Playwright 번들 ffmpeg(VP8/webm)로 폴백(프로덕션은 풀빌드 필요 경고).
- ⚠️ 실제 유료 제공자 선택(ElevenLabs vs Supertone vs Google, fal.ai 도입)은 여전히 **소유자 결정**.
  키만 넣으면 코드 변경 없이 승격됨.

### 렌더 병렬/성능
- 렌더 워커 병렬도 = **CPU 코어수-1**(프롬프트 제약). 초안당 소요시간 측정 → 300건/일 창(06:30~09:00)
  처리 가능성 자동 판정 리포트(phase2-demo). 이 환경 측정치는 참고용, 8코어+ VPS 재측정 권장.

## Phase 0~1 (스캐폴딩 + 수집/생성)

### 저장 위치
- 이 플랫폼은 기존 정적 사이트(TomatoEggCat) 레포와 **스택이 완전히 상충**한다
  (그쪽은 프레임워크/번들러 금지). 소유자 승인에 따라 **별도 자립 서브프로젝트**
  `trend-content-factory/` 로 분리했다. 루트 정적 사이트는 손대지 않는다.

### 스택
- 워커는 **Node + TypeScript(tsx 실행)** 단독. Next.js 대시보드(M7)는 Phase 4로 미룸 —
  Phase 0~1 에는 UI가 불필요하고, 의존성/타입 표면을 줄여 typecheck 안정성을 확보.
- 렌더(M4)는 Playwright/Remotion 을 쓰되 **서버리스 금지**(프롬프트 제약) → 별도 워커 프로세스.
  Phase 2에서 구현.

### 스토어 추상화
- `Store` 인터페이스 하나에 **JsonStore(dry-run) / SupabaseStore(실서비스)** 두 구현.
  `--dry-run` 또는 Supabase env 부재 시 자동으로 로컬 JSON(`output/*.json`)에 적재 →
  키·DB 없이도 파이프라인 전체를 검증 가능.

### 임베딩 / 중복 판정
- 외부 임베딩 API 의존을 피하려 **결정론적 문자 trigram 해싱 임베딩**(256차원)으로 시작.
  코사인 유사도로 dedup(>0.88 병합) + novelty(1 − 최대유사도) 계산.
- ⚠️ 프로덕션 정확도를 위해선 실제 임베딩 API 로 교체 권장. `lib/embedding.ts` 의
  `embed()`/`textSimilarity()` 시그니처만 유지하면 드롭인 교체 가능.

### 소재 생성 (M2)
- `ANTHROPIC_API_KEY` 존재 → **ClaudeComposer**(JSON 강제, 파싱 실패 1회 재시도 후 폐기).
- 키 없음/드라이런 → **MockComposer**(결정론적 목업, `mock=true` 태깅, **게시 불가**).
  파이프라인·스키마·게이트 검증 용도. 게시 워커(Phase 3)는 `mock=true` 를 반드시 배제.
- 사전 게이트: `fact_confidence >= 0.7` 및 (리스크 플래그 있으면 고지문 필수). 탈락분은
  폐기하지 않고 `status='rejected'` 로 보관(주간 실패패턴 분석용, 프롬프트 M3 사양과 정합).

### 안전/거버넌스 유틸 (게시 전 선행 구현)
- `lib/http.ts`: 타임아웃 + 지수백오프(2/4/8/16s) + 서킷브레이커. Meta 사용률 헤더 파서
  (`parseAppUsage`, `parseBusinessUseCaseUsage`)까지 미리 정의 → M5(Phase 3)에서 소비.
- `lib/failures.ts`: 모든 실패를 `job_failures` + 텔레그램으로. **조용한 실패 금지**.
- 시크릿: `.env.local`(git-ignored) + Supabase Vault 참조만. 코드/커밋 하드코딩 0.

### 이 샌드박스에서의 라이브 수집 결과 (2026-07-22 드라이런)
- **통과**: Google Trends KR, Hacker News(Algolia), CoinGecko → 정상 수집.
- **차단**: Reddit, 연합/한겨레 RSS 등은 이 실행 환경의 **egress 정책**에 막혀
  "Blocked by egress policy" 반환(어댑터가 정상적으로 fail-loud 처리). 어댑터 로직 자체는
  정상이며, egress 제약 없는 운영 환경에선 동작한다. (RSS XML 구조 파싱은 Google Trends
  피드로 검증됨.)
- **키 필요 소스**: YouTube/네이버 데이터랩은 키 없어 skip(설계대로).
- 실측: 트렌드 108건 수집 → 초안 54건 생성 → 스키마 54/54 통과 → 사전게이트 44 통과.

### 미해결 / 소유자 결정 필요 (Phase 2 진입 전)
1. **TTS/이미지/영상 유료 API 선택**(Supertone vs ElevenLabs vs Google, fal.ai 등) — 비용 실측은
   Phase 2 렌더 후 가능. 지금은 추상화 레이어 자리만.
2. **임베딩 API 승격 여부**(정확한 중복/신선도) — 비용 대비 효과.
3. **Meta 앱 심사·20계정·렌더 VPS** 등 외부 블로커는 코드로 해결 불가(부록 참고).
