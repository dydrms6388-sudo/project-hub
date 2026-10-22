# BETWEEN — Architecture

## 구성

```
Browser (mobile-first PWA)
  │  HTTPS, httpOnly 세션 쿠키 (SameSite=Lax)
  ▼
Next.js 16 (Vercel, icn1)
  proxy.ts ─ 요청별 CSP nonce, Supabase 세션 갱신
  Server Components ─ 페이지 렌더 (전부 동적: nonce + 개인화)
  Server Actions ─ 변경 (Origin 검사 내장, zod, rate limit)
  Route Handlers ─ /api/explore, /api/swipe-deck (GET JSON), /api/photos (업로드/권한 검사 서빙), /api/cron/cleanup
  │  pg (Supavisor transaction pooler)
  ▼
Supabase Postgres ─ RLS + 컬럼 grant + SECURITY DEFINER RPC + 마스킹 뷰
Supabase Auth     ─ Anonymous sign-in (+선택: 이메일 연결로 영구 계정 전환)
Supabase Storage  ─ 비공개 버킷 profile-photos (서버가 signed URL 발급)
```

## 인증·권한 모델

1. 사용자는 가입 없이 익명 세션을 받는다 (`supabase.auth.signInAnonymously()` 또는 local JWT).
2. 서버는 요청마다 세션을 검증해 `{sub, role:'authenticated', is_anonymous}` claims 를 얻는다.
3. DB 트랜잭션 시작 시 `SET LOCAL ROLE authenticated; set_config('request.jwt.claims', …)` →
   Supabase 의 `auth.uid()`, `auth.jwt()` 가 그대로 동작하고 모든 RLS 정책이 적용된다.
4. 익명 사용자도 `authenticated` 이므로 **모든 정책은 소유권(`auth.uid()`)을 검사**한다.
   운영자 권한은 `admin_roles` + `is_anonymous = false` 둘 다 필요하다.
5. 사용자가 바꿀 수 없는 컬럼(status, suspended_until, last_active_at, 동의 시각 등)은 컬럼 grant 에서 제외.

## 데이터 모델

| 테이블                         | 용도                                               | 접근                                     |
| ------------------------------ | -------------------------------------------------- | ---------------------------------------- |
| profiles                       | 1인 1프로필 (id = auth.users.id)                   | 본인/운영자. 타인은 `profile_cards` 뷰   |
| profile_photos                 | 최대 5장, storage_path 는 `<uid>/<uuid>.webp` 강제 | 본인 / 공개(또는 매칭) + 차단 아님       |
| profile_preferences            | 저장 필터 (최대 10)                                | 본인                                     |
| contact_methods                | 외부 메신저, https URL 만 (CHECK)                  | 본인 / 공개 또는 매칭 상대               |
| likes                          | like/pass, PK 로 중복 방지                         | 보낸 기록 + 나에게 온 like (pass 비공개) |
| matches                        | 상호 like 트리거로 생성, unmatch RPC               | 당사자                                   |
| blocks                         | 차단, 트리거로 매칭 해제                           | 본인                                     |
| reports                        | 신고, 대상별 미처리 1건, 누적 시 자동 보류 트리거  | 본인 / 운영자                            |
| moderation_actions             | 운영 조치 감사 기록                                | 운영자                                   |
| activity_status                | 지금 만나기 (now 는 최대 6시간 만료 필수)          | 본인 (타인은 뷰의 availability)          |
| admin_roles                    | 운영자                                             | 본인 행 조회만, 쓰기는 service           |
| rate_limits / account_recovery | 서버 전용                                          | service_role 만                          |

### profile_cards 뷰

- 필드별 공개 설정(`field_visibility` jsonb, 기본 비공개: 몸무게·성향·동)을 마스킹.
- 성향은 `sensitive_consent_at` 이 있어야만 노출.
- 숨김·만료·정지·차단(양방향) 프로필과, **요청자가 정지 상태일 때 전체**를 제외.
- 정확한 마지막 접속 시각 대신 `presence`(online/today/week/away) 와 시간 단위 정렬 키만 노출.

## 탐색·필터

- URL 쿼리스트링 = 필터 상태 (공유/뒤로가기 가능). `filtersFromSearchParams` 는 항목 단위 관대 파싱.
- SQL 은 `buildExploreQuery` 가 파라미터 바인딩으로 생성. 조건 간 AND, 조건 내 OR, 관심사 any/all.
- 정렬: 추천(지역·사진·지금가능·접속·공통관심사 점수), 최근활동, 신규, 나이, 지역.
- 페이지네이션: offset(24) + limit+1 로 다음 페이지 판정, 상한 2400. 인덱스: 활동/지역/생성/출생연도, GIN(관심사·스타일·목적).

## 보안 대책 요약

| 위협                 | 대책                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| IDOR                 | RLS 소유권 정책 + 서버는 세션 ID 만 사용, 통합 테스트로 검증                                         |
| XSS                  | React 이스케이프, dangerouslySetInnerHTML lint 금지, CSP nonce + strict-dynamic, 링크는 https 정규화 |
| CSRF                 | Server Action Origin 검사, Route Handler `assertSameOrigin`, SameSite=Lax                            |
| 피싱/오픈 리다이렉트 | 연락처 화이트리스트 형식, 단축 URL·IDN·IP·redirect 파라미터 차단, 이동 전 경고 다이얼로그            |
| 스팸/봇              | DB 기반 레이트리밋(사용자·IP), 허니팟, 신고 누적 자동 보류                                           |
| 이미지               | 매직바이트+디코딩 검증, 픽셀 폭탄 제한, EXIF/GPS 제거, WebP 재인코딩, 권한 검사 서빙                 |
| 위치 노출            | 좌표 미수집, 동 기본 비공개, 접속 시각 버킷화, 지금가능 자동 만료                                    |
| 민감정보             | 서비스 이용 자체에 대한 민감정보 동의 + 성향 별도 동의(DB 제약)                                      |
| 캐시 유출            | API `private, no-store`, SW 는 정적 자산만 캐시                                                      |

## 한국 개인정보보호 점검 목록

- [x] 수집 항목·목적·보유기간·거부권 고지 및 필수 동의 분리 (제15조)
- [x] 민감정보 별도 동의 (제23조), 세부 성향 추가 동의 + 철회 시 즉시 삭제
- [x] 최소 수집 (실명·전화·주민번호·정확한 위치 미수집, 자기소개 패턴 차단)
- [x] 파기: 즉시 삭제(cascade + 파일), 자동 만료 후 7일 파기 크론
- [x] 안전성 확보 조치: 접근통제(RLS), 전송 암호화, 접근 기록(운영 조치 감사)
- [x] 처리방침 공개 (/privacy), 이용약관, 안전 가이드
- [ ] 개인정보 보호책임자 실명/연락처 지정 (운영 전)
- [ ] 국외 이전 고지 구체화 (Supabase/Vercel 리전 확정 후)
- [ ] 청소년 차단: 자기 신고 한계 — 실 본인인증 도입 여부 결정 필요
