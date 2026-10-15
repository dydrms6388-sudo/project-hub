# sites/ — 10개 독립 도구 사이트 개발 계약

이 디렉터리의 각 하위 폴더는 **독립된 Next.js 15 앱**이며, 각각 별도의 Vercel 프로젝트
(Root Directory = `sites/<project>`) 로 배포되어 자체 도메인을 가진다.
허브(`tomatoeggcat.com`) 의 `gen-pages.mjs` 파이프라인과는 무관하다.

## 절대 규칙
1. **서버 코드 금지.** API Route(`route.ts`) 없음, DB 없음, 외부 API 키 없음.
   모든 페이지는 정적 생성(SSG)되어야 한다. 모든 연산은 브라우저에서만 실행된다.
2. **두 가지 빌드가 모두 통과해야 한다.**
   - `npx next build` (Vercel 개별 프로젝트용)
   - `STATIC_EXPORT=1 STATIC_BASE_PATH=/preview/<project> npx next build` (허브 선배포용)
   두 번째가 통과하려면 동적 서버 기능을 일절 쓰면 안 된다.
3. **무거운 라이브러리는 반드시 지연 로드.** `src/tools/components.tsx` 의
   `dynamic(() => import(...), { ssr: false })` 밖으로 새어나가면 안 되고,
   ffmpeg/transformers/web-llm 같은 대형 의존성은 컴포넌트 내부에서
   `await import("...")` 로 사용자가 실제 동작을 시작한 뒤에 받아야 한다.
4. **생성 산출물 커밋 금지.** `node_modules`, `.next`, `out` 은 `.gitignore` 에 있다.

## 새 사이트 만드는 절차
```bash
cd sites
rsync -a --exclude node_modules --exclude .next --exclude out _template/ <project>/
cd <project>
# 1) package.json 의 name 수정 + 필요한 의존성 추가
# 2) src/site.config.ts 수정 (name/shortName/domain/url/description)
# 3) src/tools/registry.ts 에 도구 메타 전부 작성
# 4) src/tools/impl/<slug>.tsx 에 각 도구 구현
# 5) src/tools/components.tsx 맵에 등록
# 6) 가이드 페이지가 있으면 src/app/guide/<slug>/page.tsx + src/lib/routes.ts 등록
npm install --no-audit --no-fund
npx next build
STATIC_EXPORT=1 STATIC_BASE_PATH=/preview/<project> npx next build
```

## 제공되는 공용 부품 (그대로 쓸 것, 재구현 금지)
| 경로 | 용도 |
|---|---|
| `src/components/ToolShell.tsx` | 도구 페이지 골격. H1 → 도구 → 광고 → 사용법 → 원리 → FAQ → 관련도구. **직접 건드릴 일 없음** |
| `src/components/FileDrop.tsx` | 드래그앤드롭 업로드. 확장자/용량 검증, 파일 목록, "서버 전송 안 됨" 고지 내장 |
| `src/components/DownloadButton.tsx` | `saveBlob(blob, name)`, `saveFiles([{name,blob}], "x.zip")` (2개 이상이면 JSZip) |
| `src/components/CopyButton.tsx` | 클립보드 복사 + 폴백 |
| `src/components/Progress.tsx` | `role="progressbar"` 진행률 바 |
| `src/components/AdSlot.tsx` | 애드센스. `NEXT_PUBLIC_ADSENSE_CLIENT` 없으면 height 0 |
| `src/lib/capability.ts` | `detectWebGPU()`, `detectWasmThreads()`, `isMobile()`, `memoryHint()`, `shouldWarnHeavy()` |
| `src/lib/worker.ts` | `attachWorker(worker, {onProgress,onDone,onError})` — `{type:'progress'\|'done'\|'error', value}` 규약 |
| `src/lib/seo.tsx` | `toolMetadata()`, `toolJsonLd()`(SoftwareApplication+FAQPage+BreadcrumbList), `JsonLd` |

## registry.ts 의 ToolMeta 스키마
```ts
{
  slug: string;            // URL: /tools/<slug>/
  title: string;           // <title> — 검색어 그대로
  h1: string;              // H1 — 한국어 검색어 그대로 (예: "HEIC JPG 변환")
  description: string;     // 메타 설명 (60~90자)
  keywords: string[];
  category: string;        // 홈 화면 그룹 제목
  howto: string[];         // 사용법 3~5단계
  principle: string[];     // 원리/근거 문단 3~5개 (산식·규격 근거 포함)
  sources?: { label: string; url: string }[];  // 공식 출처 링크
  faq: { q: string; a: string }[];             // 정확히 5개
  related: string[];       // 같은 사이트 내 slug
  heavy?: boolean;         // true 면 "PC 권장" 뱃지
}
```

## 콘텐츠 품질 (SEO/애드센스 심사 통과 목적)
- 페이지 = 1 도구 = 1 검색 의도. H1 에 한국어 검색어를 그대로 쓴다.
- `principle` 은 실제 정보를 담아야 한다. "이 도구는 편리합니다" 같은 빈 문장 금지.
  계산기라면 **공식 원문과 한계**, 변환기라면 **포맷이 왜 그런지·화질 손실 여부**를 쓴다.
- FAQ 5개는 실제로 검색되는 질문으로. 각 답변 2~4문장.
- 수치·요율·규격은 **공식 출처를 확인해 `sources` 에 링크**한다. 확인 못 한 값은
  추측하지 말고 UI 에 "확인 필요" 배지를 노출한다.
- 의료·법률·세무·금융은 확정 표기 금지. 참고용 고지를 붙인다.
- 타인 비하·외모평가형 결과 금지. 민감정보(실명/전화/주민번호/이메일) 수집 금지.

## 접근성·반응형
- 모든 버튼에 `aria-label`, 진행률에 `role="progressbar"`.
- **가로 320px 에서 깨지지 않아야 한다.** 좌우 2단 레이아웃은 모바일에서 세로 스택.
- 다크모드 없음. 한국어 고정, i18n 없음.
