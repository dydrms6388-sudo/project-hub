# photo-lab

사진 촬영 계산 레퍼런스. Next.js 15 App Router, 100% 정적 export. DB·서버·런타임 API 없음.

## 빌드

```bash
cd photo-lab
npm install
NEXT_PUBLIC_SITE_URL=https://<배포도메인> npm run build   # → out/
```

- **`NEXT_PUBLIC_SITE_URL`은 필수입니다.** sitemap.xml / robots.txt / JSON-LD 절대
  URL이 이 값으로 생성됩니다. 도메인 하드코딩·폴백은 정책상 금지이며, 미설정 시
  빌드가 명확한 에러로 실패합니다.
- Vercel 배포 시 별도 프로젝트로 root를 `photo-lab`으로 지정하고 환경변수에
  `NEXT_PUBLIC_SITE_URL`을 등록하세요 (illusion-lab과 동일한 방식).

## 검증

```bash
npm run verify                     # data/calculators.json 테스트케이스 92건 대조
node scripts/check-coverage.mjs    # 데이터 ↔ 레지스트리/콘텐츠 정합 검사
```

## 구조

- `data/` — 센서·계산기·해설의 단일 소스(JSON). 공식 출처와 검증 케이스 포함.
- `src/lib/engine/` — 순수 계산 모듈 (optics / sun[NOAA·Meeus] / stops).
- `src/lib/registry.ts` — slug별 입력 정의·계산·시각화 스펙. 공통 `CalcShell` 하나가
  전부 소비 (계산기 컴포넌트 복제 금지 정책).
- `src/lib/content/` — 페이지 서술 콘텐츠 (계산기 10섹션 / 해설 본문).
- 새 계산기 추가 시: `data/calculators.json`(테스트케이스 포함) → `registry.ts` →
  `content/calc/` 3곳 등록 후 `check-coverage.mjs`로 확인.

## 정책

- 모든 계산은 클라이언트에서만. 위치 API·외부 호출·localStorage 금지.
  상태 공유는 URL 쿼리로만.
- 출처를 특정할 수 없는 공식은 구현하지 않음 (`data/calculators.json`의
  `meta.excluded`에 제외 사유 기록).
