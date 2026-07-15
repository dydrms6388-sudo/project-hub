# tomatoeggcat 블로그 자동 발행 시스템

`tomatoeggcat.com/blog` 에 Claude 가 생성한 글을 자동 발행하는 Next.js App Router 앱.
티스토리 등 남의 플랫폼 대신 **우리 사이트에 직접** 발행하고, `/blog/[slug]` 로 노출하며,
사이트맵에 자동 포함시킨다. 저품질/봇 패턴 회피(확률적 발행 + 하루 상한 + 프롬프트 랜덤화)가 핵심.

## 왜 별도 앱(`blog/`)인가

저장소 루트는 `gen-pages.mjs` 가 `projects.json` 으로부터 200여 개의 정적
`/<slug>/index.html` 과 `sitemap.xml`·`vercel.json` 을 **생성**하는 순수 정적 사이트다.
루트에 `package.json` + `app/` 을 두면 Vercel 이 프로젝트 전체를 Next.js 빌드로
전환해 기존 정적 도구 서빙이 깨진다. 그래서 블로그는 자체 완결된 Next.js 앱으로
분리하고, 기존 `dalian-weekend` 처럼 루트에서 `/blog` 를 rewrite 로 연결한다.
(루트 레이아웃으로 바꾸고 싶으면 `blog/` 내용을 루트로 옮기고 정적 도구들을
`public/` 로 이동하면 된다.)

## 구조

```
blog/
  app/
    layout.tsx                 루트 레이아웃
    globals.css
    blog/page.tsx              /blog 목록
    blog/[slug]/page.tsx       /blog/{slug} 상세 (metadata·JSON-LD·도구 버튼)
    api/cron/blog/route.ts     Vercel Cron 발행 엔드포인트 (nodejs, maxDuration 60)
    sitemap.ts                 동적 사이트맵 (기존 도구 URL + 모든 블로그 글)
  lib/
    blog-topics.ts             발행 주제 배열 (여기에 추가만 하면 자동 반영)
    blog-prompt.ts             buildBlogPrompt() — 구조·길이·톤 랜덤화
    supabase.ts                anon(읽기)/service_role(쓰기) 클라이언트
    site-urls.ts               기존 정적 URL 스냅샷 (사이트맵용)
  supabase/blog_posts.sql      테이블 DDL + 인덱스 + RLS
  vercel.json                  cron 설정
```

## 설치 / 배포

1. **DB**: Supabase SQL Editor 에서 `supabase/blog_posts.sql` 실행.
2. **의존성**: `cd blog && npm install`
3. **환경변수** (`.env.example` 참고): `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ANTHROPIC_API_KEY`, `CRON_SECRET`.
4. **Vercel**: 이 `blog/` 폴더를 Root Directory 로 하는 **별도 Vercel 프로젝트**로
   배포. 위 환경변수 등록. `vercel.json` 의 cron 이 자동 등록된다.
   `CRON_SECRET` 이 설정되면 Vercel 이 크론 요청에 `Authorization: Bearer <CRON_SECRET>`
   헤더를 자동으로 붙인다.
   - Hobby 플랜은 크론이 하루 1회로 제한된다. 더 잦은 발행은 Pro 플랜에서
     `schedule` 을 `0 */3 * * *` 등으로.
5. **루트에서 `/blog` 연결**: 메인 사이트(루트 정적 사이트)의 `vercel.json` 에
   아래 rewrite 를 추가한다. `<BLOG_APP>` 는 4번에서 배포한 블로그 프로젝트 도메인.
   ⚠️ 루트 `vercel.json` 은 `gen-pages.mjs` 가 재생성하므로, 영구 반영하려면
   `gen-pages.mjs` 의 rewrite 생성부에도 동일 항목을 넣는다(본 PR 에 반영됨).

   ```json
   { "source": "/blog",        "destination": "https://<BLOG_APP>/blog" },
   { "source": "/blog/:path*", "destination": "https://<BLOG_APP>/blog/:path*" }
   ```

## 발행 페이스 조절

`app/api/cron/blog/route.ts` 상단 상수:

- `PUBLISH_PROBABILITY = 0.35` — 크론 1회당 실제 발행 확률(발행 시각 랜덤화)
- `DAILY_MAX = 2` — 하루 최대 발행 수

발행량을 늘리려면 이 값을 올리기만 하면 된다.

## 새 주제 추가

`lib/blog-topics.ts` 의 `blogTopics` 배열에 `{ searchTopic, keyword, toolSlug, angle }`
객체를 추가하면 다음 크론부터 자동으로 후보에 포함된다.
