# sound-lab — 소리실험실

인터랙티브 소리 실험실. Next.js 15 App Router, 100% 정적 export.
모든 소리는 Web Audio API로 브라우저에서 실시간 합성 (음원 파일 없음).

## 빌드

```bash
cd sound-lab
npm install
NEXT_PUBLIC_SITE_URL=https://<배포 도메인> npm run build   # → out/
```

`NEXT_PUBLIC_SITE_URL` 은 **필수**다. 미설정 시 빌드가 의도적으로 실패한다
(도메인 하드코딩·폴백 금지 정책). Vercel 프로젝트(root=`sound-lab`)의
환경변수로 설정할 것.

## 구조

- `data/sounds.json` — 40개 항목의 단일 소스 (파라미터 정의 포함)
- `src/lib/audio/` — 마스터 리미터 체인(core) + slug별 엔진 40종
- `src/lib/content/` — 카테고리별 본문(도입/들리는 것/신호/이유/연구사/FAQ/프리셋)
- `src/app/` — 허브 / `sound/[slug]` / `category/[cat]` / 정책 3종 / 404 / 500 /
  sitemap / robots / OG 이미지(ImageResponse + Pretendard)

## 검사 스크립트

```bash
node scripts/check-content.mjs    # 커버리지·본문 길이·금지어·프리셋 범위
node scripts/similarity.mjs       # 본문 유사도 상위 10쌍
node scripts/measure-levels.mjs   # 슬라이더 양끝값 출력 레벨 실측 (헤드리스 Chromium)
```

## 청력 보호 설계

- 모든 신호는 `DynamicsCompressor(threshold -12dB, ratio 20)` 리미터와
  -6dBFS 천장 게인을 거친다.
- 첫 진입 시 볼륨 주의 배너, `hearingRisk: "주의"` 항목은 상시 경고 표시.
- 페이지 이탈(pagehide)·언마운트 시 AudioContext를 닫아 소리 잔류를 막는다.
- 자동 재생 없음 — 사용자 제스처(재생 버튼) 후에만 시작.
