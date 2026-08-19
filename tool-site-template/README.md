# tool-site-template

서버 없는(정적 + 브라우저 처리) 한국어 도구 사이트 스타터. Next.js 15 App Router · TypeScript · Tailwind v4 · Vercel.

## 처음 한 번 (템플릿 자체 세팅)
```bash
pnpm install
cp .env.example .env.local        # NEXT_PUBLIC_SITE_URL 채우기
# public/fonts/ 에 Pretendard 서브셋 woff2 2개 + Pretendard-Bold.otf 넣기 (README 참고)
pnpm dev                          # http://localhost:3000/tools/char-count 확인
pnpm build                        # 통과하면 이 레포를 GitHub에 push → 템플릿 완성
```

## 새 프로젝트 만들기 (프로젝트마다 반복)
```bash
npx degit <github-user>/tool-site-template my-new-site
cd my-new-site && pnpm install
```
1. `src/site.config.ts` 의 name / description / url / contactEmail 수정
2. `src/tools/registry.ts` 의 샘플(char-count) 삭제 또는 유지
3. 도구 추가: `pnpm new-tool <slug> "<제목>" [category]` → 생성된 컴포넌트와 registry의 TODO 채우기
4. `pnpm build` 통과 → GitHub 새 레포 push → Vercel Import → 환경변수 `NEXT_PUBLIC_SITE_URL` 설정 → 배포
5. 배포 URL로 Google Search Console + 네이버 서치어드바이저 등록, `/sitemap.xml` 제출
6. 라이브 시작일 기록. 2~4주 뒤 AdSense 신청 → 승인 후 `NEXT_PUBLIC_ADSENSE_CLIENT` 설정 (그 전엔 광고 슬롯이 아예 렌더되지 않음)

## 구조
- `src/site.config.ts` 사이트 메타 + 카테고리 색
- `src/tools/registry.ts` 도구 목록(메타 + lazy component). 페이지는 `/tools/[slug]`로 자동 생성
- `src/components/ToolShell.tsx` H1 → 도구 → 광고 → 사용법 → 원리 → FAQ → 관련 도구 고정 레이아웃
- `src/components/FileDrop.tsx`, `DownloadButton.tsx` 파일 입출력 공통 UI
- `src/lib/seo.ts` metadata + JSON-LD(SoftwareApplication/FAQPage/HowTo)
- `src/lib/capability.ts` WebGPU/WASM 스레드/모바일 감지 → "PC 권장" 판단
- `src/lib/worker.ts` Comlink 워커 헬퍼 + 진행률 메시지 규약
- `src/app/og/[slug]/route.tsx` 도구별 OG 이미지(카테고리 색). Pretendard-Bold.otf 필요
- `next.config.ts` COOP/COEP 헤더(ffmpeg.wasm 멀티스레드 등 SharedArrayBuffer용)

## 규칙
- 각 도구 페이지 = 검색어 1개. `title`은 검색어 그대로, FAQ 5개, principle에 근거.
- 무거운 라이브러리는 컴포넌트 안에서 dynamic import (첫 로딩 가볍게).
- 브라우저 저장은 localStorage만, 서버·DB 없음.
