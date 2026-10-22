# BETWEEN — Deployment

> ⚠️ 아래 단계는 외부 계정·비용·공개 배포를 수반하므로 **소유자 승인 후** 진행한다.
> 현재 저장소에는 Supabase/Vercel 자격 증명이 없어 실제 배포는 수행하지 않았다.

## 1. Supabase

1. 프로젝트 생성 (리전: Northeast Asia (Seoul) 권장).
2. Authentication → Sign In / Providers → **Anonymous sign-ins 활성화**. 남용 방지를 위해 CAPTCHA(Turnstile/hCaptcha) 활성화 권장.
3. Authentication → URL Configuration: Site URL = 배포 URL, Redirect URLs 에 `https://<도메인>/auth/callback`.
4. 마이그레이션 적용 (`supabase/local/` 는 로컬 전용이므로 제외됨):
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
5. Storage 버킷 `profile-photos`(비공개)는 `20261020000003_storage.sql` 이 생성한다. 확인만 할 것.
6. Database → Settings → SSL 인증서(CA) 다운로드 → `DATABASE_SSL_CA` 에 PEM 내용 등록.
7. 운영자 지정: 운영자가 앱에서 이메일 연결(영구 계정) 후 SQL Editor:
   `insert into public.admin_roles (user_id, role) values ('<uuid>', 'admin');`

## 2. Vercel

1. New Project → 이 저장소, **Root Directory = `between`**, Framework = Next.js.
2. 환경변수 (Production):
   | 변수                                                         | 값                                                               |
   | ------------------------------------------------------------ | ---------------------------------------------------------------- |
   | `APP_ORIGIN`                                                 | `https://<도메인>`                                               |
   | `DATABASE_URL`                                               | Supavisor transaction pooler URL (포트 6543) — **postgres 역할** |
   | `DATABASE_SSL_CA`                                            | Supabase CA PEM                                                  |
   | `DATABASE_POOL_MAX`                                          | `3`                                                              |
   | `AUTH_PROVIDER` / `STORAGE_PROVIDER`                         | `supabase`                                                       |
   | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 프로젝트 설정                                                    |
   | `SUPABASE_SERVICE_ROLE_KEY`                                  | 서버 전용 (절대 NEXT_PUBLIC 금지)                                |
   | `CRON_SECRET`                                                | 랜덤 32자+                                                       |
3. `vercel.json` 이 리전(icn1)과 일일 정리 크론(`/api/cron/cleanup`)을 설정한다.
4. 배포 후 검증: `/start` 200, 응답 헤더 CSP/HSTS, 익명 시작 → 프로필 생성, 사진 업로드, `/api/explore` 401(비로그인).

## 3. 배포 전 체크리스트

- [ ] `npm run check` (typecheck, lint, unit+integration, build) 통과
- [ ] `npm run test:e2e` 통과
- [ ] 개인정보 보호책임자·국외이전 고지 갱신 (`src/lib/domain/legal.ts`, `/privacy`)
- [ ] Supabase Anonymous + CAPTCHA, RLS 활성 상태 확인 (Database Advisors)
- [ ] 소유자 공개 배포 승인
