# SEO 체크리스트 — 구글 + 네이버 (tomatoeggcat.com)

> 코드/파일 세팅은 모두 완료됨. 아래는 **사용자가 직접 콘솔에서 해야 하는 단계**입니다.
> verification 코드 넣는 곳: **`site.config.mjs`** 한 곳 → `node gen-pages.mjs` 재실행 → `git push`.

---

## ⚠️ STEP 0 (선행 필수) — Vercel 배포 연결 고치기

현재 **github에 푸시해도 tomatoeggcat.com에 반영되지 않습니다.** (Vercel 프로젝트 `dydrms-hub`가 github 자동배포에 연결돼 있지 않거나 끊김 + 로컬에 Vercel CLI 인증 없음.)
**이걸 먼저 풀지 않으면 아래 SEO 세팅이 다 적용돼도 라이브에 안 나옵니다.**

택1:
- **(권장) Vercel ↔ GitHub 연동**: Vercel 대시보드 → `dydrms-hub` 프로젝트 → Settings → Git → GitHub 레포 `dydrms6388-sudo/project-hub` 연결, **Production Branch = `master`** 확인 → 이후 push 시 자동배포.
- **(대안) CLI 배포**: 터미널에서 `npx vercel login` 1회 → 그 뒤 내가 `npx vercel --prod`로 직접 배포 가능. (노블링·온새미로 배포 잠김도 이걸로 동시 해결.)

확인법: 배포 후 `https://tomatoeggcat.com/sitemap.xml` 이 **141개 URL**, `https://tomatoeggcat.com/dydrms-dalian/` 이 **200**이면 정상.

---

## STEP 1 — verification 코드 입력 (공통)

1. 아래 STEP 2·3에서 구글·네이버 콘솔이 주는 **content 코드**를 받는다.
2. `site.config.mjs` 열어서 교체:
   ```js
   export const GOOGLE_SITE_VERIFICATION = "여기에_구글코드";   // 기존 REPLACE_GOOGLE_CODE
   export const NAVER_SITE_VERIFICATION  = "여기에_네이버코드"; // 기존 REPLACE_NAVER_CODE
   ```
3. 재생성 + 배포: `node gen-pages.mjs && git add -A && git commit -m "seo: verification codes" && git push`
   → 허브 index.html + 랜딩 128개 + 내장 9개 전 페이지 `<head>`에 메타가 박힘.

---

## STEP 2 — 구글 Search Console

1. https://search.google.com/search-console → 구글 로그인.
2. **속성 추가** → "URL 접두어" 선택 → `https://tomatoeggcat.com` 입력. (또는 "도메인" 방식이면 DNS TXT 사용)
3. **소유확인** → "HTML 태그" 방법 선택 → 표시된 `<meta name="google-site-verification" content="●●●">`에서 **`●●●` 값만 복사** → STEP 1대로 `site.config.mjs`의 `GOOGLE_SITE_VERIFICATION`에 넣고 배포 → 콘솔에서 **"확인"** 클릭.
4. **사이트맵 제출**: 좌측 "Sitemaps" → `sitemap.xml` 입력 → 제출. (전체 URL: `https://tomatoeggcat.com/sitemap.xml`)
5. **색인 요청**: 상단 "URL 검사"에 주요 페이지 입력 → "색인 생성 요청". (나머지는 sitemap+내부링크로 자연 색인)
6. 참고: 구글은 IndexNow 미지원 → **sitemap + 내부링크 + 신선도**가 색인 동력. (IndexNow는 빙/네이버용)

---

## STEP 3 — 네이버 서치어드바이저

1. https://searchadvisor.naver.com → 네이버 로그인 → "웹마스터 도구".
2. **사이트 등록**: `https://tomatoeggcat.com` 입력.
3. **소유확인** → "HTML 태그" 선택 → `<meta name="naver-site-verification" content="▲▲▲">`의 **`▲▲▲` 값만 복사** → `site.config.mjs`의 `NAVER_SITE_VERIFICATION`에 넣고 배포 → "소유확인".
4. **요청 → robots.txt**: 확인(이미 `Sitemap:` 선언됨).
5. **요청 → 사이트맵 제출**: `https://tomatoeggcat.com/sitemap.xml`.
6. **요청 → 웹페이지 수집**: 주요 URL 수집 요청.
7. 네이버 선호 요소(이미 반영): 명확한 title/description, 모바일 반응형, 본문 텍스트(소개·주요특징·FAQ), OG 태그.

---

## 자동화 (이미 세팅됨)

- 신규 데일리 서비스 추가 시: 팩토리가 `projects.json` 갱신 후 **`node gen-pages.mjs --ping`** 실행 → 랜딩·허브·sitemap 자동 재생성 + **IndexNow 제출**(빙/네이버 계열 색인 촉진). (FEEDBACK-LOOP.md 배선)
- 구글은 IndexNow 미지원 → 신규 URL은 sitemap 갱신 + 내부링크로 색인. 급하면 GSC에서 수동 "색인 요청".
- 네이버는 IndexNow 일부만 → 신규 대량 시 서치어드바이저에서 사이트맵 재제출/수집 요청 권장.

---

## verification placeholder 위치 요약

| 위치 | 내용 |
|---|---|
| `site.config.mjs` | **교체 지점**: `GOOGLE_SITE_VERIFICATION`, `NAVER_SITE_VERIFICATION` (현재 `REPLACE_*`) |
| `templates/service.html` | `%%VERIFY%%` 토큰 → 랜딩 전 페이지 head |
| `gen-pages.mjs` | `VERIFY_META` 상수가 허브 index.html + 랜딩 + 내장 9개에 주입 |
| 산출물 | 허브 1 + 랜딩 128 + 내장 9 = 전 페이지 `<head>`에 두 메타 박힘 |
