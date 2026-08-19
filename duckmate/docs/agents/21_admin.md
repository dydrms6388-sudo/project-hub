# D8 · 어드민 대시보드 (운영 콘솔)

> 작성: 서브에이전트 D8 (어드민) · 기준일 2026-08-19
> 입력: 12_flows §0/§7 (라우트 트리) + 05_trust_safety(A5 §1/§3/§4/§6) +
> 18_moderation(D5 호출 계약) + 15_auth(가드·ActionResult 패턴) + 11_design_system.
> 산출물: `apps/web/lib/admin/{service,reports,photos,users,appeals,metrics}.ts`,
> `apps/web/app/(admin)/**` (layout + 대시보드/신고/사진/유저/이의제기 5개 큐).

---

## 다음 에이전트에게 넘기는 결정사항

### 판단 확정

| # | 쟁점 | 확정 | 근거 |
|---|---|---|---|
| D8-1 | 조치 실행 경로 | 현재 `lib/admin/*` 가 **service role 다중 문장**으로 직접 집행 (RPC 미사용) | 최초 구현 시 `00004_functions.sql` 만 확인해 "resolve_report 없음"으로 판단. **00010 에 RPC 가 실재하므로 이 결정은 되돌려야 한다 → §7-1, G2-1** |
| D8-2 | 어드민 UI 상호작용 | **Server Component + `<form action={서버액션}>` 만.** 클라이언트 컴포넌트 0개 | 조치는 전부 서버 확정이 필요하고, service role 모듈이 클라이언트 번들에 유입될 경로를 원천 차단 |
| D8-3 | 조치 결과 피드백 | 토스트 대신 **redirect 쿼리 플래시**(`?m=` 성공 / `?e=` 실패) + `_components/flash.tsx` | 전역 ToastProvider 설치는 E그룹 앱 셸 소관(파일 소유권). 서버 렌더만으로 성립 |
| D8-4 | 사진 확정의 비가역성 | 승인/반려는 **pending 에서만** 확정. 번복은 재업로드로만 | 검수 우회(반려→재승인 루프) 방지. 12_flows §5.2 반려 사유 렌더와 정합 |
| D8-5 | 사진 원본 열람 지면 | `/admin/photos` 검수 큐 **한 곳**. 유저 상세는 사진 메타(장수·상태)만 | 개인정보 최소 열람. 서명 URL 은 10분 만료 · service role 발급 |
| D8-6 | 유저 검색 이메일 노출 | 목록에는 이메일 미노출(닉네임 검색 시 `null`), **상세에서만** `auth.admin.getUserById` 로 1건 조회 | 최소 노출 원칙(A5 §4.1). 이메일 검색은 GoTrue `listUsers` 5페이지(=1,000명) 스캔 상한 |
| D8-7 | 수동 제재와 신고 제재의 분리 | 수동 제재는 `report_id = null` 로 기록하고, 화면에서 "신고 건은 신고 상세에서 처리" 안내 | 신고↔제재 연결이 끊기면 통보 문안·SLA 측정(`handled_at`)이 성립하지 않음 |
| D8-8 | 4-eyes 구현 형태 | Lv5 부과 = **부승인 어드민 닉네임 입력**(선언식), 이의제기 = **세션 실검증**(원 처리자 == 로그인 어드민이면 거부) | 2단계 승인 워크플로 테이블이 없음. 이의제기 쪽만 진짜 4-eyes → G2-2 |
| D8-9 | 큐 정렬 | 신고 = P0→P1→P2 + `sla_due_at` 임박순 / 사진·이의제기 = **접수 오래된 순(FIFO)** | 기한 초과분이 자동으로 최상단에 오고 별도 정렬 로직이 필요 없음 |

### → G2 (보안 리뷰) — 반드시 확인할 지점

1. **service role 경계**: `lib/admin/*` 가 클라이언트 번들에 유입되지 않는가 (`assertAdminServerContext` 는 런타임 방어일 뿐, 빌드 시 경계는 "클라이언트 컴포넌트 0개" 규약에 의존).
2. **선언식 4-eyes 우회**: Lv5 부과의 부승인은 닉네임 입력만으로 성립한다 — 부승인자의 실제 동의가 없다(§6-2).
3. **RPC 미사용으로 인한 원자성 상실**: 조치 중간 실패 시 남는 상태(§7-1).
4. **개인정보 열람 감사 커버리지**: evidence 열람은 audit 하지만 유저 상세 열람·사진 서명 URL 발급은 audit 하지 않는다(§5).
5. **Server Action 입력 신뢰**: 폼 값(`profileId`, `sanctionId`, `photoId`)은 URL/폼에서 오며 lib 함수의 존재·상태 검증에만 의존한다.

### → D7 (알림/cron)

- 조치 확정은 `status=ACTIONED|DISMISSED` + `handled_at` 까지만 진행한다. **통보(NOTIFIED) 전이는 D7 이 발송 성공 후** `mark_report_notified()` 로 수행한다 (D5-5 계약 유지 — 어드민 화면은 NOTIFIED 를 만들지 않는다).
- 사진 반려·제재 부과·이의 결정의 사용자 통보 문안 원천은 각각 `photos.reject_reason` / `sanctions.reason` / `appeals.decided_reason` 이다. 어드민이 입력한 문장이 **그대로** 읽히므로 별도 가공 금지.
- 제재 `EXPIRED` 자동 전환이 없다 — 큐 화면은 `status='ACTIVE'` 를 그대로 신뢰한다(§7-3).

### → D6 (결제, Phase 3)

- 이의 인용 시 정지 기간 구독 보상은 미구현. `/admin/refunds` 는 라우트 자체를 만들지 않았다(12_flows Ph3 예약).

---

## 1. 라우트 / 파일 소유 맵

| 라우트 | 파일 | 기능 ID |
|---|---|---|
| — | `app/(admin)/layout.tsx` | 사이드바 + `requireAdmin` + noindex |
| `/admin` | `admin/page.tsx` | 지표 대시보드 F-ADM-04 |
| `/admin/reports` | `admin/reports/page.tsx` | 신고 큐 F-ADM-01 |
| `/admin/reports/[reportId]` | `.../[reportId]/page.tsx` + `reports/actions.ts` | 증거 열람·조치 확정 |
| `/admin/photos` | `admin/photos/page.tsx` + `photos/actions.ts` | 사진 검수 큐 F-ADM-02 |
| `/admin/users` | `admin/users/page.tsx` | 유저 검색 F-ADM-03 |
| `/admin/users/[userId]` | `.../[userId]/page.tsx` + `users/actions.ts` | 상세·제재 부과/해제 |
| `/admin/appeals` | `admin/appeals/page.tsx` + `appeals/actions.ts` | 이의제기 큐 F-SAF-07 |
| 공통 | `admin/_components/flash.tsx` | 조치 결과 배너 |

`[userId]` 는 **`profiles.id`** 다 (auth `user_id` 아님). 화면 간 링크는 전부 이 규약을 따른다.

## 2. 권한 모델

3층 가드 — 어느 한 층이 뚫려도 나머지가 막는다.

1. **미들웨어**(D2 소유): 세션 없으면 진입 전 차단.
2. **`app/(admin)/layout.tsx`**: `requireAdmin()` — `profiles.role='admin' && status='active'` 아니면 `/home` 리다이렉트. 라우트 그룹 전체에 적용.
3. **`lib/admin/*` 각 함수 첫 줄**: `requireAdminActor()` = `requireAdmin()` + `assertAdminServerContext()`. **Server Action 은 layout 을 거치지 않으므로 이 층이 실질 경계다.** 페이지 가드만 믿고 lib 호출을 건너뛰는 코드를 추가하지 말 것.

DB 층: `00003_rls.sql` 의 admin 정책은 큐 "읽기"만 허용하며 `reports.evidence` 는 admin 세션에도 grant 되지 않는다. 원문 열람·모든 쓰기는 service role 전용이다.

`role='admin'` 부여 경로는 UI 에 없다 — DB 직접 변경만 가능(의도된 설계, 승격 화면 미제공).

## 3. 큐 운영 절차

### 3.1 신고 큐 (`/admin/reports`)
1. 기본 뷰 = 미종결. **P0 는 접수 1시간 내 착수**, 전체 24시간 내 조치(A5 §6). SLA 컬럼이 음수(빨강)면 초과.
2. 상세에서 evidence 원문 확인 → 조치 확정(제재 레벨 선택 or 기각). **열람 시점에 audit 가 남는다** — 목적 외 열람 금지.
3. Lv5 는 부승인 어드민 닉네임 필수. 확정 시 계정 `banned` + CI 해시 `blocked_hashes` 등록(재가입 차단).
4. 처리 사유에 **신고자 정보·신고 건수를 적지 않는다** — 피신고자에게 그대로 노출된다(D5-3).

### 3.2 사진 검수 큐 (`/admin/photos`)
1. pending FIFO, 최대 50건. 24시간 이상 대기 건은 대기 시간이 빨강으로 뜬다.
2. 기준: 얼굴 식별 가능 · 본인 사진 · 연락처/개인정보 노출 없음 · 부적절 콘텐츠 없음 · AI 생성 의심 없음.
3. **승인** → 대상이 Lv2 이면 `verify_level=3` 자동 승급(카드에 사전 안내 배지 노출).
   **반려** → 사유 코드 필수, 승인 사진이 0장이 되면 Lv3 → Lv2 자동 강등.
4. 확정은 번복 불가. 오확정은 유저에게 재업로드를 안내한다.

### 3.3 유저 관리 (`/admin/users`)
1. 닉네임 부분일치 / `@` 포함 시 이메일 검색(최대 20건).
2. 상세에서 프로필·제재 이력·신고 이력(피신고/제기)·감사로그 확인.
3. **수동 제재**는 신고 없는 건(외부 제보, 운영 판단)에만 사용. 신고 건은 반드시 신고 상세에서 처리.
4. **제재 해제**는 사유 필수. Lv5 해제 시 계정 복구 + 블랙리스트 회수가 함께 일어난다.
5. `이 유저가 제기한 신고 10건 이상`이면 무고성 신고 감시 문구가 뜬다 — 판단 보조일 뿐 자동 조치는 없다.

### 3.4 이의제기 큐 (`/admin/appeals`)
1. 접수 +7일 기한. FIFO 정렬이라 초과분이 최상단.
2. **4-eyes**: 원 제재 처리자 본인의 건은 폼 대신 "다른 어드민 배정" 안내가 뜬다(서버에서도 거부).
3. 인용 → 제재 `REVOKED` + `appeal_status=ACCEPTED`, Lv5 였다면 계정 복구·블랙리스트 회수.
   기각 → `appeal_status=REJECTED`, **사유가 신청자 통보 문안 원천**.

## 4. 함수 계약 (`lib/admin/*` — 화면이 호출하는 전부)

모든 함수는 `AdminResult<T>` = `{ok:true,data:T} | {ok:false,code,message}` 를 돌려준다. `message` 는 한국어 사용자 문구이며 화면은 그대로 노출한다. 권한 미달은 결과가 아니라 **redirect** 다.

| 함수 | 입력 | 성공 데이터 | 주요 실패 코드 |
|---|---|---|---|
| `listReports({scope,priority,reason})` | 필터 | 큐 행 배열 | `DB_ERROR` |
| `getReportDetail(reportId)` | | 신고+대상 요약+30일 신고수 | `NOT_FOUND` |
| `resolveReport({reportId,decision,sanctionLevel,reason,coApproverNickname})` | | — | `ALREADY_HANDLED` `FOUR_EYES_REQUIRED` `TARGET_MISSING` |
| `listPendingPhotos(limit)` | | 사진+닉네임+서명URL+승인장수 | `DB_ERROR` |
| `approvePhoto(photoId)` | | `{promotedToLv3}` | `ALREADY_HANDLED` |
| `rejectPhoto(photoId, reasonCode)` | 사유 코드 6종 | `{demotedToLv2}` | `INVALID_INPUT` `ALREADY_HANDLED` |
| `searchUsers(query)` | 2자 이상 | 검색 행 배열 | `INVALID_INPUT` |
| `getUserDetail(profileId)` | | 프로필·이메일·제재·신고·사진·감사로그 | `NOT_FOUND` |
| `imposeSanction({profileId,level,reason,coApproverNickname})` | Lv5 는 부승인 필수 | `{sanctionId}` | `INVALID_INPUT` `FOUR_EYES_REQUIRED` |
| `revokeSanction(sanctionId, reason)` | | — | `ALREADY_HANDLED` |
| `listAppeals(scope)` | | 이의+제재+기한+4eyes 플래그 | `DB_ERROR` |
| `decideAppeal({appealId,decision,reason})` | | — | `ALREADY_HANDLED` `FOUR_EYES_SELF` |
| `getDashboardMetrics()` | | 퍼널·코호트·신고율 | `DB_ERROR` |

Server Action 래퍼(`*/actions.ts`)의 책임은 **FormData 파싱 → lib 호출 → `revalidatePath` → 플래시 redirect** 뿐이다. 검증·권한·감사는 lib 안에서만 한다(이중 구현 금지).

## 5. 감사로그 규약

`audit_logs(actor_id, action, target, meta)` — `actor_id` 는 조치한 어드민의 **profiles.id**.

| action | target | meta 주요 키 |
|---|---|---|
| `admin.report.evidence_view` | `report:{id}` | 열람 시각·대상 |
| `admin.report.resolve` / `admin.report.dismiss` | `report:{id}` | `sanction_id` `level` `reason` `co_approver_id` |
| `admin.photo.approve` / `admin.photo.reject` | `photo:{id}` | `profile_id` `reason_code` |
| `admin.photo.level3_promote` / `admin.photo.level2_demote` | `profile:{id}` | `trigger_photo_id` |
| `admin.sanction.impose` | `profile:{id}` | `sanction_id` `level` `reason` `co_approver_id` |
| `admin.sanction.revoke` | `sanction:{id}` | `profile_id` `level` `reason` |
| `admin.appeal.accept` / `admin.appeal.reject` | `appeal:{id}` | `sanction_id` `original_handler_id` `reason` |

규약:
- **접두는 항상 `admin.`** — 시스템/자동 조치(`created_by is null`)와 구분된다.
- `target` 은 `{테이블 단수}:{uuid}` 고정. 유저 상세 화면은 `target='profile:{id}'` 만 필터해 보여준다 → 사진·제재·신고 로그는 각 큐에서 확인해야 한다(§7-4).
- 신고자 식별 정보는 meta 에도 넣지 않는다.
- 보존 3년(A5). 삭제·수정 경로는 코드에 없다.

## 6. 보안 검토 메모 (G2 상세)

1. **번들 경계** — `lib/admin/*` 는 `"use client"` 파일에서 import 되면 `assertAdminServerContext()` 가 던지지만, 이는 런타임 방어다. `(admin)` 하위에 클라이언트 컴포넌트를 추가할 때 service role 모듈 import 여부를 반드시 확인.
2. **Lv5 선언식 4-eyes** — 부승인자는 "다른 활성 admin 닉네임"인지만 검증된다. 부승인자 세션 동의가 없으므로, 어드민 1인이 닉네임만 알면 영구정지를 단독 확정할 수 있다. 실제 2단계 승인(대기 상태 + 두 번째 세션 확인)이 필요하면 승인 대기 테이블이 필요하다.
3. **서명 URL** — 사진 서명 URL(10분)은 발급 후 인증 없이 재사용 가능하다. 검수 화면 스크린샷/URL 유출 시 만료 전까지 열람 가능.
4. **이메일 스캔** — `auth.admin.listUsers` 를 최대 1,000명까지 순회한다. 규모가 커지면 결과 누락(검색 실패로 보임) + 응답 지연이 발생한다.
5. **입력 신뢰 경계** — Server Action 은 폼의 id 값을 그대로 lib 에 넘긴다. 대상 존재·상태 검증은 lib 안에 있으나, "이 어드민이 이 대상을 볼 자격이 있는가" 같은 대상 단위 스코프는 존재하지 않는다(어드민 = 전체 권한 모델).
6. **CSRF** — Next Server Action 기본 방어(Origin 검증)에만 의존한다. 추가 토큰 없음.
7. **에러 문구 노출** — `DB_ERROR` 는 Postgrest 원문 메시지를 그대로 플래시에 싣는다. 어드민 전용 화면이지만 스키마 정보가 노출된다.

## 7. 미결 / 후속

1. **(최우선) `00010_moderation.sql` RPC 로의 이관** — `resolve_report()` / `resolve_appeal()` / `mark_report_notified()` 가 실재한다(D5 §→D8 계약). 현재 `lib/admin/{reports,appeals}.ts` 는 이를 쓰지 않아 다음이 어긋난다:
   - 자동 임시 제재(`created_by is null`, AUTO_P0_FREEZE 등)의 **REVOKED 대체가 일어나지 않아 제재가 스태킹**된다.
   - 다중 문장이 트랜잭션이 아니어서 중간 실패 시 "신고는 종결, 제재는 미생성" 등 반쪽 상태가 남는다(감사로그로만 추적 가능).
   - `resolve_appeal` 반환의 `deadline_met`(7일) · `subscription_compensation_needed` 신호를 얻지 못한다.
   → `lib/admin/**` 소유 에이전트가 RPC 호출로 교체하고, 화면은 계약(`AdminResult`)이 같으므로 수정 불필요.
2. **Lv5 phone 해시 블랙리스트 미이관** — `identity_hashes` 에 CI 해시만 있어 CI 만 등록된다(D5 계약은 phone 도 요구).
3. **`sanctions.EXPIRED` 전환 cron 부재** — `ends_at` 이 지나도 `ACTIVE` 로 남는다. 화면은 상태 텍스트와 기간을 함께 보여줘 오독을 줄이지만, 집계(활성 제재 수)는 과대 계상된다. D7 소관.
4. **감사로그 뷰 부재** — 유저 상세는 `target='profile:{id}'` 만 본다. 그 유저의 사진/신고/제재 로그를 한 화면에 모으려면 `target LIKE` 조합 또는 별도 감사로그 검색 화면이 필요하다.
5. **Lv1 이하에서 승인된 사진의 승급 회수** — 승인 시점에 Lv0/1 이면 승급하지 않고, 이후 Lv2 도달 시 자동으로 3 이 되지 않는다. 본인 인증 완료(D2 verify) 지점에서 승인 사진 유무를 확인해 승급시키는 처리가 필요하다.
6. **신고 남용 제한 미집행** — "30일 기각 5건 → 신고 기능 30일 제한"(D5 §6-2)은 화면 안내(10건 이상 문구)뿐, 자동 집행 없음.
7. **`/admin/refunds`(F-ADM-05) 미생성** — Phase 3 결제 도입 시 D6 과 함께.
8. **큐 페이지네이션 없음** — 신고 100건 / 사진 50건 / 이의 100건 상한. 초과분은 화면에 나타나지 않는다(초기 규모 전제).
