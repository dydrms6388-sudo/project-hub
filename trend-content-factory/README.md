# Trend Content Factory

분야별 트렌드를 매일 자동 수집 → 소재 생성 → 품질 게이트 → 렌더 → 20 버티컬 계정 자동 게시 →
성과 피드백으로 다음날 프롬프트 자동 튜닝하는 무인 콘텐츠 파이프라인.

> ⚠️ 이 디렉터리는 루트의 정적 사이트(TomatoEggCat)와 **별개의 자립 서브프로젝트**다.
> 스택(Node/TS, Supabase)이 다르므로 루트 정적 사이트와 섞지 않는다.

## 현재 상태

| Phase | 모듈 | 상태 |
|---|---|---|
| 0 | 스캐폴딩, 타입, 20 버티컬, Supabase 마이그레이션 | ✅ 완료 |
| 1 | M1 수집기, M2 소재 생성기 (드라이런) | ✅ 완료 |
| 2 | M3 품질 게이트, M4 렌더러 (PNG/MP4 실렌더) | ✅ 완료 |
| 3 | M5 게시 스케줄러 (테스트 계정 1개) | ⬜ 예정 (소유자 승인 게이트) |
| 4 | M6 피드백, M7 대시보드 | ⬜ 예정 |
| 5 | 5플랫폼 × 20계정 전체 확장 | ⬜ 소유자 승인 후 |

게시 대상 플랫폼: **TikTok · Facebook · Instagram · Threads · X** (`config/platforms.ts`).

## 빠른 시작

```bash
cd trend-content-factory
npm install
cp .env.example .env.local     # 필요한 키만 채움 (없어도 dry-run 동작)

npm run typecheck              # 무오류
npm run lint                   # 무오류

# Phase 1 데모: 수집 → 생성 → 스키마검증 → 초안 3건 출력
npm run phase1:demo

# Phase 2 데모: 심사 → 렌더(실제 PNG/MP4) → output/preview + 타이밍 리포트
npm run phase2:demo

# 개별 워커 (dry-run: 로컬 JSON 스토어)
npm run ingest:dry            # 트렌드 수집 → output/trends.json
npm run compose:dry           # 소재 생성 → output/drafts.json
npm run review:dry            # 6-페르소나 심사 → draft를 approved/rejected로
npm run render:dry            # approved → 플랫폼별 PNG/MP4 → output/preview
```

키 없이 dry-run 하면 스토어는 `output/*.json`, 소재 생성/심사는 목업으로 폴백한다.
`ANTHROPIC_API_KEY` 를 넣으면 실제 Claude 로 생성·심사한다.

### 렌더 파이프라인 (M4)

- **카드**: 파라메트릭 HTML 템플릿(버티컬별 팔레트/타이포/레이아웃) → Playwright(Chromium) → PNG.
  대표 플랫폼(ig)은 전체 캐러셀, 나머지 카드 플랫폼은 커버 1장. 한글 폰트는 `assets/fonts/` 번들 임베드.
- **릴**: 애니메이션 HTML(Ken Burns + 자막 번인 + 세이프존) → Playwright 녹화 → **ffmpeg MP4
  (H.264/yuv420p/30fps/CRF23/AAC128k)**. 마스터 1080×1920 1편을 릴 지원 플랫폼에 공유.
- **미디어 키(선택)**: `ELEVENLABS_API_KEY`(TTS 나레이션), `FAL_KEY`(대표컷). 없으면 무음 트랙 +
  절차적 CSS 배경으로 폴백(라이선스 안전). `@ffmpeg-installer/ffmpeg` 로 H.264 확보.

**이 환경 실측(20건, 3코어)**: 카드 ~1.3s/장, 릴 ~25s/편(20s 실시간 녹화 포함), 초안당 ~12s.
→ 300건/일 순차 ~1.0h, 병렬 보정 ~0.34h로 렌더 창(06:30~09:00) 내 처리 가능. 프로덕션 8코어+ VPS 재측정 권장.

## 구조

```
config/
  verticals.ts             20 버티컬 정의 (소스/톤/포맷/팔레트 전부 분기)
  platforms.ts             5 플랫폼 렌더/게시 스펙 (tiktok/fb/ig/threads/x)
lib/
  types.ts                 도메인 타입
  env.ts                   env 로딩/검증 (시크릿 하드코딩 금지)
  http.ts                  타임아웃+지수백오프+서킷브레이커, Meta 사용률 헤더 파서
  ai/provider.ts           Claude 추상화 (서킷브레이커/재시도)
  embedding.ts             결정론적 임베딩 (중복/신선도용, 교체 가능)
  scoring.ts               velocity/novelty 스코어링 + dedup
  store.ts                 JsonStore(dry-run) / SupabaseStore
  draftSchema.ts           zod 스키마 + 사전 품질 게이트
  reviewSchema.ts          M3 심사 스키마 + 점수 집계/통과 판정
  failures.ts              job_failures + 텔레그램 (조용한 실패 금지)
  media/                   ffmpeg(H.264/AAC) / tts(교체가능) / background(절차적 CSS)
  render/                  fonts(임베드) / cardTemplate / reelTemplate
prompts/
  compose.ts               M2 소재 생성 프롬프트 (JSON 강제)
  review.ts                M3 6-페르소나 심사 프롬프트 (배치)
workers/
  ingest/                  M1 수집기 (adapters: google_trends/rss/reddit/hn/coingecko/youtube/naver)
  compose/                 M2 소재 생성기 (Claude/Mock 컴포저)
  review/                  M3 품질 게이트 (Claude/Mock 패널, 배치 10)
  render/                  M4 렌더러 (Playwright 카드 PNG + ffmpeg 릴 MP4)
assets/fonts/              번들 한글 폰트 (Pretendard/NanumMyeongjo/JetBrainsMono)
scripts/                   phase1-demo, phase2-demo
supabase/migrations/       DB 스키마 (RLS service_role 전용)
```

## 트렌드 소스 어댑터

| type | 키 필요 | 비고 |
|---|---|---|
| `google_trends_rss` | ✕ | Google Trends KR RSS |
| `rss_news` | ✕ | 언론사 RSS/Atom |
| `reddit_json` | ✕ | 공개 `.json` 엔드포인트 (로그인/스크래핑 아님) |
| `hackernews` | ✕ | HN Algolia 검색 API |
| `coingecko` | ✕ | 공개 trending |
| `youtube_popular` | ✔ `YOUTUBE_API_KEY` | 없으면 skip |
| `naver_datalab` | ✔ `NAVER_*` | 없으면 skip |

새 어댑터는 `SourceAdapter` 인터페이스(`workers/ingest/adapters/base.ts`)를 구현하고
`registry.ts` 에 등록한다. robots.txt/ToS 준수, 로그인 필요한 사이트 스크래핑 금지.

## 안전/정책 규칙 (설계 제약)

- 게시 상한: 계정별 24시간 상한의 **런타임 실측값 × 0.6** 이내 (M5, Phase 3).
- 게시 전 `content_publishing_limit` 확인 + 워밍업 스케줄 + 40분 간격(±지터) + 캡션 중복 검사.
- Graph API `X-App-Usage` / `X-Business-Use-Case-Usage` 파싱·기록, 80% 초과 시 쿨다운.
- 시크릿은 `.env.local` + Supabase Vault 참조만. 코드/커밋 하드코딩 금지.
- 의료/법률/투자 버티컬은 고지문 필수 + (권장) 수동 승인 큐.

## 다음 단계 (Phase 3 진입 전 소유자 결정/준비 필요)

- **미디어 유료 API 선택**: TTS(ElevenLabs vs Supertone vs Google), 대표컷(fal.ai). 인터페이스는
  이미 구현 — 키만 넣으면 코드 변경 없이 승격. 비용은 Phase 2 실측 원가 × 300 × 30 으로 산정.
- **플랫폼 게시 승인·심사**: 각 플랫폼 API 별도 —
  Meta(`instagram_business_content_publish`, IG 비즈니스 + FB 페이지), TikTok Content Posting API,
  Threads API, X API. 심사 2~4주. 계정은 실제 운영 브랜드 계정으로.
- **렌더 VPS**: 300건/일이면 8코어+ 권장(이 환경 3코어 실측 기준 여유는 있으나 프로덕션 재측정).
- 실제 임베딩 API 승격 여부(중복/신선도 정확도).

자세한 결정 이력은 [`DECISIONS.md`](./DECISIONS.md) 참고.
