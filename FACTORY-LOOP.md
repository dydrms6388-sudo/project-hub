# 팩토리 핵심 운영 루프 (project-hub 진입본)

> `factory-glm` 러너는 `project-hub`에서 실행되며 이 파일을 먼저 읽는다.
> 원본 스펙(자산·헬퍼 포함)은 [`../2026-06-20-factory-dash/FACTORY-LOOP.md`](../2026-06-20-factory-dash/FACTORY-LOOP.md) ·
> [`../2026-06-20-factory-dash/AGENT-TASKS.md`](../2026-06-20-factory-dash/AGENT-TASKS.md) 이고, 이 문서는 그와 **동기**된 운영 요약이다.
> 헬퍼 스크립트(`fb-helper.mjs`, `_factory_db.mjs`, `.loop-chunk.json`)는 `../2026-06-20-factory-dash/`에 있으므로
> 큐 조회 명령은 해당 폴더에서 실행한다: `node ../2026-06-20-factory-dash/fb-helper.mjs <cmd>`.

## 우선순위 큐 (위가 비어야 아래로)
0. **품질 리뷰 루프 재개발 (최우선)** — [REVIEW-LOOP](./REVIEW-LOOP.md). `data/review-scores.json`에서 `status != pass && loops < 5`인 항목을 **웨이브(5개)**로 리뷰(5리뷰+5만족도 에이전트) → 미달 재개발 → 재평가. 평균 만족도 **80 게이트**. 전 프로젝트 pass까지 피드백 큐와 동급 최우선. 대시보드 `./review-dash/`.
1. **사장님이 시킨 작업물** — `node ../2026-06-20-factory-dash/fb-helper.mjs ideas` (factory.ideas, status=pending).
2. **피드백 작업물** — `node ../2026-06-20-factory-dash/fb-helper.mjs reprocess-list` (재검토/재개발 대상). **피드백 원문을 다시 보고 재개발.**
3. **창작 무한** — 1·2 소진 시 신규 서비스 생성. 신규 아이디어는 반드시 [CONTENT-STRATEGY](./CONTENT-STRATEGY.md) 3대 게이트(듀얼모드·리텐션2+·니치)를 **통과해야** 만족도 루프로 내려간다. 통과 못 하면 반려/재기획. `projects.json` 대조로 중복 금지.

## 만족도 루프 (항목당) — 린 파라미터
1. **개발**: 피드백/요구 반영 구현(기존 코드 위 재개발).
2. **콘텐츠 보강**: 도메인 전문가 관점으로 다각화·깊이.
3. **유저 평가**: 시뮬 유저가 루브릭 0~100 채점 — **기능 / UX / 콘텐츠 / 완성도** 4축 평균(적대적·정직하게, 근거 없는 80+ 금지).
4. **게이트**: 평균 **≥80 통과**. **<80 → 지적 반영해 1로 재개발.**
5. **반복 상한**: 항목당 **최대 5루프**. 5루프 내 80 미달이면 **멈추고 다음 프로젝트로**(대시보드 "검토 필요"만 표시, 큐 막지 말 것).

## 안전 제약 (강제)
- **유료 API 금지**: FAL 등 호출당 과금되는 서드파티 유료 API는 **서비스 런타임 자기키에서만**. 에이전트(러너) 작업 중 **직접 호출 금지** — 필요하면 런타임용 ENV placeholder만 배선.
- **속도 우선 + 자동 백오프**: 웨이브 병렬로 속도 확보. **호스트 먹통/Vercel 한도 감지 시 배치 크기 자동 축소(백오프) — 멈추지 말고 줄여서 계속.** 무한·과동시 금지.
- **배포**: Vercel 한도 내. 막히면(일100·주간) **커밋만** → 일일 드립 크론이 리셋 후 자동 배포. **한도/배포 차단 시 재시도 말고 로컬 커밋만.**
- **비밀정보**: 키·토큰 **출력·커밋 금지**.

## PWA (앱+웹)
각 서비스에 `manifest.json` + Service Worker + 아이콘. 루프 통과 단계에서 동반 적용(없으면). 풀 네이티브는 별도 트랙.

## 애드센스/랜딩 품질 상시 규약
thin/doorway 랜딩 금지. 각 `/<slug>/` 랜딩은 intro·background·steps·scenarios·tips·cautions·faq(4~6)를 갖추고 서비스별로 **확연히 다른** 고유·심층 본문. 콘텐츠 원본 `data/landing-content.json`, 생성 `gen-pages.mjs`. 내부 은어(수익화/애드센스/ca-pub/키워드/OG/JSON-LD 등) 사용자 페이지 노출 금지. FAQPage+BreadcrumbList JSON-LD, 빵부스러기, about/privacy/terms/contact 유지, YMYL 면책. 상세는 [AGENT-TASKS](../2026-06-20-factory-dash/AGENT-TASKS.md).

## 보고 정책
중간 보고 없이 자율로 큐 끝까지. 대시보드 로그만 갱신. **보고는 (a) 사장님이 직접 할 새 항목 생길 때 (b) 큐 전체 완료 시 (c) 호스트/배포 완전 차단으로 진행 불가일 때만.**

## 실행 단위
웨이브 = 큐 상위 5개(과부하 시 백오프). 각 웨이브: 만족도/리뷰 루프 → 통과분 커밋(or 배포) → `gen-pages` 갱신 → 대시보드 반영 → 다음 웨이브. 티어 소진 시 다음 티어. 호스트/한도 신호 시 정지·보고.
