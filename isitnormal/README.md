# 정상인가요 (isitnormal)

"우리집만 이래?"를 익명 투표로 1탭에 확인하는 통계 커뮤니티. Next.js App Router + TS + Tailwind + Supabase.

## 엔진

`투표(획득) → 통계(콘텐츠) → 알림(리텐션)`. 도구가 아니라 UGC 플랫폼이다.

## 개발

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

Supabase 스키마: `supabase/schema.sql` 실행 → `npm run seed` 로 시드 60개 투입.
Supabase 미설정이어도 로컬 콘텐츠로 렌더되며 통계는 "집계 중"으로 표시된다.

## 구조

- `content/` — 카테고리 12 · 시드 60 · 허브 12 · 카드 문구 (콘텐츠 진실원천)
- `lib/promotion-gate.ts` — 승격 색인 게이트 (재사용 모듈)
- `lib/` — supabase 클라이언트 · 투표자 해시 · 통계 · 계측
- `app/api/vote` — 투표 엔진 (3중 중복방지 · rate limit)
- `supabase/schema.sql` — 스키마 · RLS · 통계 RPC
- `docs/` — P1 IA · 콘텐츠 보이스 가이드

## 원칙 (요약)

- 모든 UGC 기본 noindex. 승격 게이트 통과분만 색인·sitemap.
- 통계 표본 n<30이면 % 미노출, "집계 중". 가짜 숫자 금지.
- 광고 코드는 승인 전 삽입 금지 (자리만 확보).
