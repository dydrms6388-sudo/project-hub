# P7 — SEO 마감 · 배포 · 애드센스 제출 체크리스트

## 1. 색인 자산 지표 (launch 시점)

| 지표 | 값 |
|---|---|
| 색인 페이지 수 | **13** (홈 1 + 카테고리 허브 12) |
| 허브 intro 평균 글자수 | **1,362자** (1,242 ~ 1,523) |
| 시드 해설 평균 글자수 | **362자** |
| 고유 텍스트 비율 | **~100%** (허브·해설 전부 페이지 전용 서술, 변수 치환 템플릿 없음) |
| 승격 UGC 수 | **0** (투표 n≥30 + 7일 전까지 승격 없음 — 정상) |
| 시드 : 유저 비율 | **60 : 0** (전부 @운영자, 정직) |

> 색인 "수"보다 "밀도". 13개 전부 1,200자+ / 800자+ 고유. 시드 설문 60·UGC는 noindex로
> 품질 신호를 지킨다. 투표가 쌓이면 승격 게이트를 통과한 설문이 sitemap에 편입되며 색인이 늘어난다.

## 2. Search Console / 네이버 등록 + sitemap 제출

배포(별도 도메인 등록) 후:

1. Google Search Console에 도메인 속성 추가 → 소유확인 코드 발급.
2. Vercel 환경변수 `GOOGLE_SITE_VERIFICATION`(및 네이버 `NAVER_SITE_VERIFICATION`) 설정 → 재배포.
   (layout metadata.verification 으로 `<head>`에 자동 주입)
3. Search Console → Sitemaps → `https://{도메인}/sitemap.xml` 제출.
4. 네이버 서치어드바이저도 동일하게 사이트 등록 + sitemap 제출.
5. robots.txt 는 자동 노출: `/s/ /api/ /pending/ /vote/` Disallow + sitemap 링크.

## 3. 색인 요청 우선 페이지 (13 core)

sitemap에 포함된 밀도 통과 페이지. Search Console URL 검사 → 색인 요청.

1. `/` (홈)
2. `/c/living` 3. `/c/food` 4. `/c/sleep` 5. `/c/dating` 6. `/c/couple`
7. `/c/family` 8. `/c/money` 9. `/c/work` 10. `/c/school`
11. `/c/body` 12. `/c/mind` 13. `/c/quirks`

> 정보/약관 페이지(about·contact·privacy·terms·disclaimer·community-guidelines)는 필수라
> footer로 접근·크롤 가능하지만 1,200자 미만이라 sitemap·색인 요청 대상에서 제외한다.
> 나머지 "핵심 20"은 시드 승격이 시작되면 승격 설문 페이지로 채워진다.

## 4. 애드센스 제출 자가진단

| 항목 | 상태 |
|---|---|
| □ 오픈 2주 경과 + 실제 유입 | ⏳ 배포 후 (트래픽 확보 필요) |
| ☑ 필수 9페이지 실동작 | ✅ about·contact·privacy·terms·disclaimer·community-guidelines·report·takedown·sitemap |
| ☑ 광고 코드 미삽입 | ✅ `.ad-slot` 자리만 확보, 광고 스크립트 0 |
| □ 도메인 인증 | ⏳ 별도 도메인 등록 후 (`NEXT_PUBLIC_SITE_URL` 플레이스홀더 교체) |
| ☑ /s/ noindex 확인 | ✅ 헤더 X-Robots-Tag + 메타 robots + robots.txt 삼중 |
| ☑ 미승격 UGC 색인 0건 | ✅ 시드/UGC 설문 전부 noindex, sitemap 미포함 |
| ☑ 정책 위반 표현 0건 | ✅ 도박/의료진단/투자권유/성인/혐오 콘텐츠 없음, 상투구 0 |

**배포 전 필수 교체:** `NEXT_PUBLIC_SITE_URL`(실제 도메인), Supabase 3종, `VOTER_SALT`.
스키마 적용: `supabase/schema.sql` 실행 → `npm run seed`로 시드 60 투입.
UGC 개방: 투표 트래픽 확인 후 `NEXT_PUBLIC_UGC_ENABLED=1`.

## 5. 배포 순서 (Vercel + Supabase)

1. Supabase 프로젝트 생성 → SQL editor에서 `supabase/schema.sql` 실행 (RLS·RPC 포함).
2. 별도 도메인 등록 → Vercel 프로젝트에 연결.
3. Vercel 환경변수 설정(위 필수 4종 + 검색엔진 확인 코드).
4. 배포 → `SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npx tsx supabase/seed.ts`.
5. Lighthouse 실측(모바일): Perf90+ / SEO100 / A11y95+ / BP95+ / CLS<0.1 확인.
6. Search Console·네이버 등록 + sitemap 제출 (§2).
7. 2주 운영 + 유입 확인 후 애드센스 신청.

## 6. 다음 앱 재사용 모듈

| 모듈 | 경로 |
|---|---|
| 투표 엔진 | `app/api/vote/route.ts` + `lib/voter.ts` |
| 승격 게이트 | `lib/promotion-gate.ts` |
| 모더레이션 + 법무 스캐너 | `lib/moderation.ts` |
| 카드 생성기 | `lib/card.ts` + `app/s/[shortId]/opengraph-image.tsx` + `components/CardPreview.tsx` |
| shortId 라우트 | `lib/shortid.ts` + `lib/shortlink.ts` + `app/s/*` + `app/api/share/route.ts` |
| 어뷰징 방어 | 투표 dedup(ip+fp) + rate limit (`app/api/vote/route.ts`) |
| 통계 집계 | `lib/stats.ts` + `supabase/schema.sql`(get_survey_stats RPC) |
| 검증 스크립트 | `scripts/verify.ts` (`npx tsx scripts/verify.ts`) |
| 콘텐츠 스키마/오버레이 | `content/schema.ts` + `scripts/merge-overrides.mjs` |
| 승격 파이프라인 | `lib/promote-run.ts` + `supabase/promote.ts` + `app/api/cron/promote` + `lib/promotion-data.ts` |
| 관리자 대시보드 | `app/admin/*` + `lib/admin.ts` + `lib/admin-stats.ts` + `app/api/admin/*` |
| 댓글(한 줄 의견) | `app/api/comment` + `lib/comments.ts` + `components/CommentBox.tsx` |
| 알림 opt-in | `app/api/notify` + `components/NotifyOptin.tsx` |
| UGC 설문 렌더 리졸버 | `lib/surveys.ts`(resolveSurvey) |

## 7. 운영 파이프라인 (배포 후 자동)

- **승격 잡**: Vercel Cron이 매일 03:00 `/api/cron/promote` 호출(`CRON_SECRET` 보호).
  n≥30·7일·밀도(고유 800/총 1,200) 통과분만 `is_indexed=true` → 설문 페이지 index 전환 + sitemap 편입.
  승격 페이지엔 실측 결과 요약 + `promotion_commentary`(운영자 작성 고유 해설) 노출.
- **관리자**(`/admin`, `ADMIN_TOKEN`): UGC 승인/반려, 삭제요청 48h SLA 큐, 신고·문의, K값·봇 추정.
- **어뷰징**: 투표 dedup(ip+fp), rate limit(투표50·작성3·댓글20/일), UGC 급등 자동 홀드(V2).
