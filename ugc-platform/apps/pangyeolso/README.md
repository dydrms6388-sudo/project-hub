# 판결소 (@ggu/pangyeolso)

사연을 올리면 대중이 A/B로 판결하는 서비스. **`@ggu/ugc-core` 의 첫 실제 소비자 앱**이며,
`INTEGRATION.md` 의 판결소 프리셋을 그대로 사용한다 (도그푸딩).

## 실행

```bash
cd ugc-platform
npm install
npm run dev -w @ggu/pangyeolso   # http://localhost:3001
```

기본은 인메모리 스토어(외부 서비스 불필요). `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY` 환경변수를 주면 `SupabaseStore` 로 전환된다 —
파이프라인 코드는 동일 (`app/ugc.ts` 의 `makeStore()`).

## 코어 루프

1. **사연 제출** — 제목 + 사연(100자↑) + A/B 양측 입장. 허니팟·소요시간 봇차단,
   IP 레이트리밋(시간당 3건). PII(전화·주민번호 등)는 자동 차단.
2. **검수** — 보수적 임계치(autoPublish 75): 대부분 사람 이야기라 애매하면 큐로.
   `/admin` 에서 공개 승인/반려.
3. **판결(투표)** — A/B 버튼, **IP당 사연 1회** (`bumpCounter` 가드).
   투표는 engage로 기록되어 contentScore 재계산 → noindex 사연이 표를 받으면
   사이트맵으로 승격된다.
4. **신고** — 3회 누적 자동 비공개.

## SEO / 정책

- `generateMetadata`: canonical + 미달 시 noindex. Article + BreadcrumbList JSON-LD.
- 사이트맵은 `indexed` 사연만. `/admin` 은 robots disallow + noindex.
- 모든 판결 결과에 **재미용 고지** (법률 자문 아님) — CLAUDE.md 정책 준수.
- 광고는 아직 없음. 붙일 땐 결과(판결 게이지) 하단 1개만.

## 실배포 전 필수

- [ ] `/admin` 관리자 인증 (현재 무인증 — 데모)
- [ ] Supabase 프로젝트 연결 + `0000_ugc_core.sql` 적용
- [ ] 도메인/`NEXT_PUBLIC_SITE_URL` 설정
- [ ] 시드 사연 (관리자 명의, 사람 검수 — INTEGRATION.md 5장)

## 검증

`next build` 6 라우트. Playwright E2E **9/9**: 사연 공개 → JSON-LD → A 투표
100% 반영 → 같은 IP 재투표 무시 → 사이트맵 승격 → 스팸 신호 사연 검수 대기 →
관리자 승인 → 홈 노출.
