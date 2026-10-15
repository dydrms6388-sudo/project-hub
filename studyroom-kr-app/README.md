# studyroom-kr (스터디룸)

학생용 도구 사이트. `tool-site-template` 을 복제해 만들었고 **별도 Vercel 프로젝트**
(root = `studyroom-kr-app`)로 배포한다. 허브의 `gen-pages.mjs` 파이프라인과는 무관하다.

> 같은 저장소의 `studyroom-kr/` 는 팩2에서 만든 **정적 버전**이며 이 앱과 별개다.

## 로컬 실행
```bash
pnpm install
cp .env.example .env.local        # NEXT_PUBLIC_SITE_URL 채우기
pnpm dev                          # http://localhost:3000/tools/timetable
pnpm build
```

`public/fonts/` 에 Pretendard 파일을 넣으면 본문·OG 이미지 한글이 안정적으로 렌더된다
(없어도 시스템 폰트로 동작한다). 필요한 파일명은 `public/fonts/README.md` 참고.

## 도구 추가
```bash
pnpm new-tool <slug> "<제목>" [text|image|file|calc|fun|dev]
```
생성된 컴포넌트와 `src/tools/registry.ts` 의 TODO(설명·키워드·사용법·원리·FAQ·related)를
실제 문구로 채운다. 페이지는 `/tools/<slug>` 로 자동 생성되고 sitemap·OG 이미지도 따라온다.

## 지금 들어 있는 도구
| slug | 제목 | 특징 |
|---|---|---|
| `timetable` | 시간표 만들기 | 대학(30분 단위)·중고등(1~7교시) 모드, 겹침 레인 배치, 배경화면 PNG, `?d=` 공유 링크 |
| `gpa` | 학점 계산기 | 4.5/4.3/4.0 스케일, 학기별·전공 평점, 목표 평점 역산 |
| `exam-dday` | 시험 디데이 | KST 자정 기준 D-day/D+, 배경화면 PNG |
| `pomodoro` | 뽀모도로 타이머 | 시각 차이 기반 카운트다운, Web Audio 알림음, Wake Lock, 오늘 세션 수 |

## 구조
- `src/site.config.ts` 사이트 메타 + 카테고리 색
- `src/tools/registry.ts` 도구 목록(메타 + lazy component)
- `src/components/ToolShell.tsx` H1 → 도구 → 광고 → 사용법 → 원리 → FAQ → 관련 도구
- `src/lib/storage.ts` localStorage 훅(`useLocalStorage`) + `newId`
- `src/lib/kst.ts` 한국 시간 기준 날짜 계산 — 날짜 다루는 도구는 전부 이걸 쓴다
- `src/lib/saveImage.ts` DOM → PNG 저장. `offscreen` 은 **캡처 대상의 부모**에만 쓸 것
  (대상 자신에 주면 클론에도 복사돼 빈 이미지가 나온다)

## 배포
1. GitHub push
2. Vercel Import → **Root Directory = `studyroom-kr-app`**
3. 환경변수 `NEXT_PUBLIC_SITE_URL` 에 실제 도메인
4. `/sitemap.xml` 을 Search Console·네이버 서치어드바이저에 제출
5. 2~4주 뒤 AdSense 신청 → 승인되면 `NEXT_PUBLIC_ADSENSE_CLIENT` 설정
   (비어 있는 동안 광고 슬롯은 렌더되지 않는다). `AdSlot` 의 `slot` 은 애드센스가 발급한
   **숫자 슬롯 ID** 로 바꿔야 한다.
