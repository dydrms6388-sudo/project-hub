# REVIEW-LOOP — 품질 리뷰 루프 (만족도 80 게이트)

> "결국 좋아야 쓴다." 지금까지 만든 모든 프로젝트(약 170개, `daily/*` 실앱 소스 + `project-hub/*` 랜딩·허브)를
> 리뷰 → 재개발 → 재평가 루프로 **유저 관점 평균 만족도 80점 이상**까지 끌어올린다.
> 기존 [FACTORY-LOOP](../2026-06-20-factory-dash/FACTORY-LOOP.md)의 만족도 게이트를 이 스펙으로 확장·강화한다.

## 0. 리뷰 대상 정의 (중요)
- **실앱(제품)** = `daily/<날짜>-<이름>/` (Next.js 소스) → 외부 배포 URL(예: `https://salary-net-pay.vercel.app`).
- **랜딩** = `project-hub/<slug>/index.html` — 실앱으로 보내는 SEO/콘텐츠 페이지(CTA `바로 실행하기`).
- 리뷰는 **실앱**을 채점한다(기능·모바일·디자인·실사용가치는 제품의 것). 랜딩은 콘텐츠 품질 축의 보조 근거.
- 실앱 소스 폴더 + 라이브 URL의 매핑은 랜딩 CTA(`class="cta" href`)에서 추출한다.

## 1. 에이전트 구성 (프로젝트당)
### 리뷰 에이전트 5 (5개 렌즈 = 루브릭 5축)
1. **기능** — 계산/로직 정확성, 엣지케이스, 입력검증, 에러상태, 저장/오프라인 동작.
2. **모바일 UX** — seam(레이아웃 이음새)·가로 오버플로우 없음, 터치타겟 ≥44px, 뷰포트/safe-area, 가독성.
3. **디자인 완성도** — 시각 위계, 여백/정렬, 색·대비, 마이크로인터랙션, 일관성, 완결성.
4. **콘텐츠 품질** — 독창성·깊이, 도메인 정확성, 카피 톤, YMYL 면책, 얄팍/중복 없음.
5. **실사용 가치** — 다시 쓸 이유(리텐션), 듀얼모드(개인/그룹), 니치 충족, 대체재 대비 우위.

### 만족도 평가 에이전트 5 (유저 관점 페르소나)
- (a) 20대 모바일 헤비유저 (b) 40대 실용주의 (c) 디자인 민감 사용자 (d) 도메인 까다로운 전문가 (e) 첫방문 캐주얼.
- 각자 "이걸 또 쓸까?"를 **0~100 홀리스틱**으로 채점. 페르소나가 달라 점수가 갈리도록 한다(인플레 금지).

## 2. 루브릭 & 점수 계산 (0~100)
- `reviewerAvg` = 5축(기능·모바일·디자인·콘텐츠·실사용) 평균.
- `userAvg` = 유저 5명 평균.
- **`overall` = (reviewerAvg + userAvg) / 2** ← 게이트 기준 점수.
- 채점은 **적대적·정직하게**. 근거 없는 80+ 금지. 각 축은 구체적 결함/증거로 뒷받침.

## 3. 게이트 & 루프
- `overall ≥ 80` → **pass**(통과). `data/review-scores.json` 기록 + 대시보드 "통과".
- `overall < 80` → 지적사항 상위 3~5개를 **실앱 소스에 반영(재개발)** → **재평가**.
- **반복 상한: 항목당 최대 5루프.** 5루프 내 80 미달이면 **정지 → `review-needed`(검토필요)**. 큐를 막지 않는다.
- 각 루프의 before/after 점수와 변경 요약을 기록한다.

## 4. 기록 & 대시보드
- 프로젝트별 점수·상태: **`project-hub/data/review-scores.json`** (스키마 §6).
- 대시보드: **`project-hub/review-dash/index.html`** — `data/review-scores.json`을 fetch해 프로젝트별
  만족도(overall)·통과/검토필요/진행중·5축 막대·루프 수를 표시. 정적 파일이라 메인 사이트(Vercel Pro)로 배포.

## 5. 실행 (배치 루프)
- **웨이브 = 5개**. 각 웨이브: 5개 프로젝트를 병렬 리뷰 에이전트로 채점 → 미달분 재개발 1루프 → 재평가 → 점수 기록 → 대시보드 반영 → 다음 웨이브.
- **규모 대응**: GLM 러너(`factory-glm`) 연동 가능. **과부하/호스트·Vercel 한도 감지 시 배치 크기 자동 축소(백오프)** — 멈추지 말고 줄여서 계속.
- 배포는 웨이브 통과분 커밋(한도 초과 시 커밋만 → 드립 크론이 배포). 실앱 개별 배포는 별 트랙.

## 6. `data/review-scores.json` 스키마
```jsonc
{
  "updatedAt": "YYYY-MM-DD",
  "gate": 80,                     // 통과 기준
  "maxLoops": 5,                  // 항목당 상한
  "summary": { "total": N, "pass": N, "reviewNeeded": N, "reviewing": N, "avgOverall": N },
  "projects": [
    {
      "slug": "salary-net-pay",
      "name": "월급 실수령액 계산기",
      "source": "daily/2026-06-20-salary-net-pay",
      "live": "https://salary-net-pay.vercel.app",
      "status": "pass | review-needed | reviewing",
      "loops": 1,                 // 수행한 재개발 루프 수
      "axes": { "functional": 0, "mobileUX": 0, "design": 0, "content": 0, "realValue": 0 },
      "reviewerAvg": 0,
      "userScores": [0,0,0,0,0],
      "userAvg": 0,
      "overall": 0,               // 게이트 점수
      "findings": ["..."],        // 핵심 지적
      "changes": ["..."],         // 재개발로 반영한 것
      "history": [ { "loop": 0, "overall": 0 } ],  // before/after 추이
      "reviewedAt": "YYYY-MM-DD"
    }
  ]
}
```

## 7. 안전 제약
- **에이전트(나) 유료 서드파티 API 직접 호출 금지.** 실앱 런타임 자기키는 무관. 라이브 URL 공개 fetch는 허용.
- **비밀번호/계정생성/결제 금지.** 결제·OAuth 키 등록은 `owner-todos.json`(사장님 할 일)로만.
- 실앱은 기존 스택(Next.js) 유지, 한국어 UI, AdSense/쿠팡/SEO 슬롯 보존.

## 8. autopilot / FACTORY-LOOP 연결
- 우선순위 큐 최상단에 **"리뷰 루프 재개발"**을 둔다(피드백 큐와 동급 우선). REVIEW-LOOP를 만족도 게이트의 정본으로 삼는다.
- autopilot이 유휴일 때 `review-scores.json`에서 `status != pass && loops < 5`인 항목을 다음 웨이브로 자동 선정.
