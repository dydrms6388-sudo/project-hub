# 덕메이트 배포 로그 (DEPLOY_LOG)

> G3(배포 러너) 기록. **Phase 1 게이트는 프로덕션 URL 2개가 기록돼야 통과한다.**
> 현재 상태: **미통과 — 배포 자격증명·네트워크 부재로 실행 불가.**

## 1. 현재 판정

| 게이트 항목 | 상태 | 근거 |
|---|---|---|
| web 프로덕션 URL | ❌ 없음 | Vercel 배포 미실행 (아래 §2) |
| company 프로덕션 URL | ❌ 없음 | 동일 |
| Supabase 프로덕션 마이그레이션 적용 | ❌ 없음 | 프로젝트·키 부재 |
| E2E 통과 | ⏸ 실행 불가 | DB 없이는 시나리오 실행 불가 (28_e2e.md) |
| 모노레포 빌드 | ✅ 통과 | `pnpm build` — web·company 2개 앱 성공 |
| 타입체크 | ✅ 통과 | `pnpm --filter @duckmate/web exec tsc --noEmit` 에러 0 |

**따라서 오케스트레이터는 그룹 F(게임/리텐션)를 스폰하지 않는다** (절대 규칙 1).

## 2. 막힌 이유 (소유자 조치 필요)

이 세션에서 실제로 확인한 사실이다.

1. **CLI 미설치** — `which vercel supabase` → 둘 다 없음.
2. **자격증명 없음** — 환경변수에 `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`,
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 등이 하나도 설정돼 있지 않다.
3. **아웃바운드 차단** — `curl https://api.vercel.com/v2/user` → HTTP `000`
   (연결 자체가 차단됨). 토큰이 있어도 이 환경에서는 배포 API 를 호출할 수 없다.

즉 **코드가 준비되지 않아서가 아니라, 배포 대상 계정과 네트워크 경로가 이 세션에 없어서**
멈춘 것이다.

## 3. 소유자가 답해야 할 것

스펙 §9 의 "나에게 물어야 하는 것" 항목 그대로다.

| 항목 | 필요한 이유 | 없을 때 현재 동작 |
|---|---|---|
| Vercel 계정/팀 | web·company 2개 프로젝트 생성 | 배포 불가 |
| Supabase 프로젝트(서울 리전) | 마이그레이션 00001~00013 적용 | 앱은 빌드되나 런타임 동작 불가 |
| 도메인 | 프로덕션 URL·OG·쿠키 도메인 | `*.vercel.app` 임시 사용 가능 |
| 사업자 정보 11개 필드 | 법적 고지·약관 플레이스홀더 | `[TODO_사업자정보]` 노출 + 빌드 경고 |
| 포트원(PASS) 계정 | 실제 본인인증 | `IDENTITY_VERIFIER=stub` 로만 동작 |
| 토스페이먼츠 계정 | Phase 3 결제 | Phase 1 범위 밖 — 무관 |

> 사업자 정보 중 **통신판매업 신고번호**는 Phase 3 결제 오픈의 하드 블로커지만
> Phase 1 배포는 막지 않는다 (07_legal_checklist L2).

## 4. 배포 절차 (자격증명 확보 후 그대로 실행)

```bash
# 1) Supabase — 프로젝트 생성(서울 리전) 후
supabase link --project-ref <REF>
supabase db push                      # supabase/migrations/00001~00013 순차 적용
supabase functions deploy daily-recommendations send-message push-dispatch

# 2) Vercel — 프로젝트 2개, 루트 디렉터리를 각각 지정
#    web:     duckmate/apps/web
#    company: duckmate/apps/company
vercel --prod                          # 각 프로젝트에서

# 3) 환경변수 (Vercel 대시보드에만 입력 — 커밋 금지, .env.example 참고)
#    NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
#    SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SITE_URL
#    IDENTITY_VERIFIER=stub (실연동 전) / VAPID 키 2종

# 4) cron 등록 — 00011_notifications.sql 의 플레이스홀더(프로젝트 URL·키)를 치환 후 적용
```

## 5. 빌드 산출 라우트 (배포 시 생성될 것)

- **web** (Next.js 15, 미들웨어 92.3 kB): 랜딩 `/`, 인증 `/login`·`/signup`,
  온보딩 7스텝, 메인 `/home`·`/discover(+[id])`·`/likes`·`/chat(+[matchId])`·`/me`,
  설정 6종, `/verify`·`/appeal`·`/sanctioned`, 법적 문서 `/legal(+6종 SSG)`,
  어드민 7개 라우트, API 3개(`/api/auth/verify-identity`, `/api/push`, `/api/reports`).
- **company** (정적 export 7파일): `/`, `/safety`, `/legal`, `/contact`,
  `sitemap.xml`, `robots.txt`, 404.

빌드 시 의도된 경고가 출력된다 (스펙 §0-4 — 경고만, 차단 없음):
`⚠️ [company] 사업자 정보 미입력 11건`, `⚠️ [duckmate/legal] *.md 플레이스홀더 미입력`.

## 6. 배포 후 기록할 것

자격증명 확보 후 배포를 실행하면 이 문서에 다음을 추가한다 — 그래야 게이트가 닫힌다.

- [ ] web 프로덕션 URL + 첫 화면 스크린샷
- [ ] company 프로덕션 URL + 법적 고지 페이지 스크린샷
- [ ] Supabase 마이그레이션 적용 로그(`supabase db push` 출력)
- [ ] E2E 통과 결과(가입→인증→매칭→채팅→신고)
- [ ] 실제 회원가입/매칭/채팅 1회 성공 기록
