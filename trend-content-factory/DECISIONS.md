# DECISIONS — Trend Content Factory

Phase 진행 중 내린 결정을 누적 기록한다. (최신이 위)

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
