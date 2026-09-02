# 정화 머리방 — Phase 1 (고객 관리 + 알림톡)

원주 정화 머리방(붙임머리·가발) 고객 관리 웹앱. 모바일 전용, 운영자 1인용.

- **스택**: Next.js 15 App Router · Supabase (DB + Auth 매직링크) · Vercel Cron · Solapi 알림톡
- **배포**: 허브(`tomatoeggcat.com`)와 무관한 **별도 Vercel 프로젝트** (Root Directory = `salon`)
- **원칙**: Phase 1 배포 → 친구가 실제 1주 사용 → 그 다음에 Phase 2(콘텐츠 에이전트) 시작

## 화면
| 경로 | 내용 |
|---|---|
| `/` | 오늘 예약 + "시술 완료"(취소 가능), 곧 리터치(7일 이내), 고객 검색 |
| `/customers/new` | 신규 고객 등록 (+ 첫 예약, 사진·마케팅 동의 체크) |
| `/customers/[id]` | 방문 이력, 누적 방문·금액, 다음 리터치일, 발송 이력(실패 사유 포함), 예약 추가 |
| `/login` | Supabase 매직링크 로그인 (신규 가입 불가) |
| `/not-authorized` | 로그인은 됐지만 운영자로 등록되지 않은 계정 안내 + 로그아웃 |

## 접근 제어 (3중)
1. **middleware** — 미로그인 요청은 전부 `/login`으로. 보안 헤더(noindex, DENY, nosniff 등) 부착.
2. **`requireOwner()`** — 로그인했더라도 `owners` 테이블에 없으면 `/not-authorized`. 모든 페이지·서버액션 진입점에서 호출.
3. **RLS** — DB 레벨 최종 방어선. `owners`에 등록된 `auth.uid()`만 전체 접근, 크론은 service role로 우회.

`lib/supabase.ts`는 `server-only`를 import하므로 service role 키가 클라이언트 번들에 섞이면 빌드가 실패한다.

## 자동 발송 (Vercel Cron, `vercel.json`)
| 경로 | 스케줄(UTC) | 동작 |
|---|---|---|
| `/api/cron/review` | `0 10 * * *` (KST 19시) | 시술 **완료**된 방문 → 후기 요청 |
| `/api/cron/touchup` | `0 0 * * *` (KST 9시) | 리터치 예정일 도래 + **마케팅 동의** → 리터치 안내 |
| `/api/cron/winback` | `0 0 * * 1` (월 KST 9시) | 90일+ 미방문 + 마케팅 동의 → 재방문 쿠폰 |

- 인증: `Authorization: Bearer $CRON_SECRET`을 **타이밍 세이프 비교**. `CRON_SECRET` 미설정이면 503으로 거부(열린 엔드포인트 방지).
- 붙임머리(extension) 방문 등록 시 `next_touchup_at = 방문일 + 35일` 자동 세팅.
- 예약(오늘 이후 방문) 등록 시 예약 확인 알림톡 즉시 발송. 지난 날짜 소급 입력은 발송하지 않음.
- 실패 시 재시도 없음 — `*_sent_at`이 null로 남아 **다음 2일간** 크론이 다시 잡는다. 1회 실행당 최대 100건.
- 발송은 10초 타임아웃. 실패 사유는 `messages.error`에 저장되어 고객 상세 화면에 표시된다.
- 환경변수가 비어 있으면 발송 대신 `status='skipped_unconfigured'`로 기록만 함
  → 템플릿 심사 대기 중에도 앱을 그대로 쓸 수 있다.
- winback은 `ALIMTALK_TEMPLATE_WINBACK`이 비어 있으면 **집계만** 하고, 채워지면 발송 모드로 전환된다.
  같은 고객에게 180일 내 재발송하지 않는다.

## 알림톡 템플릿 (솔라피에서 심사 제출, 버튼형 웹링크)
1. `booking_confirm`: `#{이름}님, 정화 머리방 예약이 확인되었습니다. #{날짜} #{시간} 뵙겠습니다. 변경은 이 채널로 말씀해주세요.`
2. `review_request`: `#{이름}님, 오늘 시술은 만족스러우셨나요? 후기 한 줄이 큰 힘이 됩니다. #{리뷰링크}`
3. `touchup_reminder`: `#{이름}님, 붙임머리 시술 후 5주가 지났습니다. 리터치 시기예요. 예약: #{예약링크}`

심사 통과 후 템플릿 ID를 `ALIMTALK_TEMPLATE_*` 환경변수에 넣는다.
알림톡 실패 시 문자 대체발송은 하지 않는다(`disableSms: true` — 비용·동의 이슈).

## 처음 세팅 순서
1. **Supabase**: 새 프로젝트 생성 → SQL Editor에 `supabase/migrations/0001_init.sql` 실행.
2. **Auth**: Authentication → 친구 이메일로 매직링크 1회 로그인 → `auth.users`에서 id 복사 →
   ```sql
   insert into owners (user_id) values ('<복사한 id>');
   ```
   그리고 Authentication → Sign In / Up 에서 **신규 가입 비활성화** (계정 1개만 유지).
3. **Vercel**: 이 repo 연결, Root Directory = `salon`, `.env.example`의 환경변수 입력
   (API 키는 친구가 직접 발급해 Vercel에 입력 — 채팅으로 키 주고받지 않기).
4. 배포 후 친구 폰에서 홈 화면에 추가 (PWA 매니페스트·아이콘 포함, 앱처럼 전체화면으로 뜬다).

## 배포 게이트 (Phase 2 시작 전 필수)
- [ ] Vercel 배포, 친구 폰에 홈화면 추가
- [ ] 실제 고객 5명 입력, 리뷰 알림톡 실제 수신 확인
- [ ] 여기까지 끝나기 전에 Phase 2 시작 안 함

## 개발
```bash
cd salon
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
npm run check                # 타입체크 + 단위 테스트
```
크론 수동 테스트: `curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/review`

테스트는 `node --experimental-strip-types --test`로 순수 유틸(`lib/dates.ts`, `lib/validate.ts`)을 검증한다
— KST 경계, 윤년, 전화번호·가격 형식, PostgREST 필터 인젝션 방지 등.

## 스키마 메모 (스펙 대비 추가분)
- `visits.completed_at` — "시술 완료" 버튼이 채움. 후기 알림톡은 완료된 방문에만 발송(노쇼 방지).
  후기 발송 전이면 "완료 취소"로 되돌릴 수 있다.
- `visits.reserved_time` — 예약 시간. 예약 확인 알림톡의 `#{시간}` 치환용 (선택 입력).
- `messages.error` — 발송 실패 사유.
- `owners` — 운영자 계정 화이트리스트 (RLS 기준).
- CHECK 제약: 전화번호 형식, 이름·메모 길이, 가격 범위, 리터치일 ≥ 방문일.
- 부분 인덱스: 크론이 매일 훑는 미발송 건만 인덱싱.
