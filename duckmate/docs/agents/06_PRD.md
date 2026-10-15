# 06 — 덕메이트(DuckMate) 통합 PRD (A6)

> 입력: `00_brief.md`(절대 규칙), `01_market.md`(A1), `02_persona.md`(A2), `03_core_loop.md`(A3), `04_monetization.md`(A4), `05_trust_safety.md`(A5).
> 이 문서는 **B(법무)·C(디자인)·D(백엔드)·E(프론트)·F(게임) 그룹의 단일 기준**이다. A1~A5 사이의 충돌은 §0에서 최종 판정했으며, 판정과 원문이 다르면 **이 문서가 우선**한다.
> 코드 없음. 수치·enum·키는 D/E가 그대로 상수로 옮긴다. 변경은 이 문서를 먼저 고친다.

### 담당 에이전트 코드 (브리프에 정의 없음 → 본 PRD에서 확정)
| 코드 | 범위 | 코드 | 범위 |
|---|---|---|---|
| D1 | 스키마·마이그레이션·RLS·시드(`packages/db`, `supabase/migrations`) | E1 | 온보딩 6화면 + 인증 게이트 화면 |
| D2 | Auth·연령 게이트·`IdentityVerifier`·`verify_level`·모드 전환 검증 | E2 | 홈/추천/좋아요/매칭/루프 끝 화면 |
| D3 | 추천 배치·점수식·재노출·제안 카드 생성 | E3 | 채팅(목록·방·이미지·안전 배너) |
| D4 | 채팅 Realtime·마스킹·탐지 룰(`safety-rules.ts`) | E4 | 구독/상점/결제/광고 슬롯 UI (Phase 3) |
| D5 | 신고·차단·제재·증거·이의신청·감사 로그 | E5 | 프로필/설정/신고·차단 UI/법적 페이지/푸시 권한/분석 SDK |
| D6 | 결제·구독·ledger·환불 (Phase 3) | E6 | `apps/company` + 어드민 프론트 |
| D7 | 스토리지·이미지 파이프라인·Web Push·cron 스케줄러·삭제 배치 | F1 | 게임 엔진·오늘의 궁합 카드·취향 배틀 |
| D8 | 어드민 API(검수 큐·신고 큐·SLA·export) | F2 | 덕질 퀴즈 대전·매칭 리빌 미니게임 |
| | | F3 | 스트릭·퀘스트·랭킹·이벤트 |

---

## 다음 에이전트에게 넘기는 결정사항

### 공통 (전 그룹) — 충돌 최종 판정
1. **친구 모드 이용(추천 노출·좋아요·채팅)은 verify_level ≥ 2(본인인증)** — A1 "친구 모드는 L1(휴대폰)"을 기각하고 A5 채택. 근거: 브리프 절대 규칙 2 "본인인증 없이는 프로필 공개·채팅 불가"는 모드를 가리지 않는다.
2. **본인인증 시점 = 온보딩 6화면 완료 후, 첫 추천 화면 진입 직전의 별도 게이트 화면**(온보딩 안에는 넣지 않음). 근거: A1의 "가입 시 인증은 퍼널을 죽인다"는 온보딩 이탈 관점에서 수용하되, 절대 규칙 2를 지키려면 추천 전에는 반드시 통과해야 한다.
3. **Phase 1 프로덕션의 `IdentityVerifier` mock은 `IDENTITY_MOCK_ALLOWLIST`(휴대폰 E.164 sha256 목록, env)에 있는 번호만 성공, 나머지는 실패.** 근거: A5 "프로덕션 mock 항상 실패 + 소유자 화이트리스트 예외"와 브리프 Phase 1 게이트(실제 매칭·채팅 1회 성공)를 동시에 만족하는 유일한 방법. 공개 런칭(불특정 가입자 L2 승격)은 Phase 4 실인증 이후(A1 리스크 5).
4. **데이팅 모드 = verify_level 3(L2 + 승인 사진 1장)** — A1/A2 "L2", A3 "L1"을 기각. 근거: A2 "데이팅 모드만 사진 1장 필수" + A5 L3 정의가 정확히 같은 조건이므로 하나의 정수로 표현하는 것이 RLS에 단순하다.
5. **기본 모드 = `friend`, 데이팅은 설정에서 명시 옵트인(공개 범위 미리보기 1장 필수).** 온보딩에 모드 선택 화면 없음(A2). 매칭은 양쪽 모드가 같을 때만(A2/A3).
6. **사진: 친구 모드 선택, 데이팅 모드 필수(=L3).** 사진 없으면 시스템 기본 아바타. 대표 사진은 본인 얼굴만 승인, 캐릭터·그림·취미 사진은 **보조 사진**으로 허용(A5 §8 `reject_no_face`는 대표 사진에만 적용) — A2 P4의 "아바타 허용" 요구는 이 방식으로 흡수.
7. **연락처 마스킹 해제 = `matched_at + 72h` AND 양쪽 L3** — A2 "첫 7일 또는 20메시지"를 기각하고 A5 채택. 근거: A5는 정책 확정본이며 §10 안전 가이드 문구("매칭 3일 후")가 이미 72h 기준으로 고정, 메시지 수 카운트는 잡담으로 우회 가능.
8. **채팅 이미지 전송 = 양쪽 L3 AND `matched_at + 24h`** — A2 "상호 L2"를 기각, A5 채택. 근거: 첫날 이미지 차단이 불법촬영물 리스크 통제의 핵심.
9. **채팅 이미지는 사전 검수 없이 전달, 수신자 화면에서 블러 + "보기" 탭** — A3 "이미지(검수)"를 A5 방식으로 정정. 근거: 사전 검수는 실시간 대화를 끊고 검수 인력이 Phase 1에 없다.
10. **궁합 퀴즈는 전체 스킵 허용.** 답변 3문항 미만이면 D3 점수식의 퀴즈 항(0.35)을 중립값(0.5)으로 대체하고, 신규 가입자 부스트(A3)는 10문항 완료 시에만. 근거: A1·A2 모두 스킵 허용, A3 부스트 조건은 "완성 프로필" 인센티브로 유지.
11. **취미 선택 = 최소 3 / 최대 5, rank 1~3이 Top3.** A1 "Top3"와 A2 "5개(실제 최소 3)"의 합집합. 자유 입력 태그 금지, 대분류 12·세부 60 상한, 초기 노출 8 카테고리(A1).
12. **연령 게이트는 생년월일(YYYY-MM-DD) 입력, 만 나이, KST 서버 기준** — A2 "생년 4자리"를 기각, A5 채택. 근거: 만 19세는 월일 없이 계산 불가. `profiles.birth_year`(공개용)는 파생값, `profiles.birth_date`는 본인+service role만.
13. **일일 경계 = 07:00 KST(`loop_date`), 주간 경계 = 월요일 07:00 KST.** A4의 "월 00:00 KST"를 07:00으로 정정. 근거: 리셋 시각이 둘이면 슈퍼라이크 쿼터와 추천이 다른 날짜 축을 쓰게 되어 카피("내일 07:00")가 틀려진다.
14. **구독 슈퍼라이크(주 1/5/15)는 ledger 적립이 아니라 쿼터(`likes` 카운트 뷰)** — A3 "item_ledger 적립·소멸"을 기각, A4 채택. 근거: 소멸 배치와 환불 시 회수 로직이 사라진다. Phase 1은 무료 쿼터 1만 존재.
15. **"나를 좋아한 사람" 추천 풀 우선(+0.10, 상한 40%)은 전 티어 공통(A3), 프로 `liker_priority`는 상한 해제 + 리스트 최상단 고정(A4)으로 한정.** 근거: 기본 매칭률 메커니즘을 유료로 가두면 A4 §5-13(무료 감점) 위반.
16. **사진 검수 안내 카피 = "24시간 안에 확인해요"** — A2 "보통 10분 내"를 기각. 근거: A5 검수 SLA 24h, Phase 1은 소유자 1인 검수.
17. **NO_SHOW 누적 제재 = A5(3회 → 이벤트 참가 제한 30일).** A2 "2회 → 데이팅 모드 제한"은 기각. 근거: 노쇼는 P3 수동 판정이며 Phase 1에 이벤트가 없으므로 실질 효과는 Phase 5부터.
18. **신고 사유 코드는 A5의 14개 고정.** A1의 `mode_abuse`는 `OTHER` 자유 서술로 흡수(모드 교차 매칭이 시스템상 불가하므로 발생 경로 제한). Phase 2에서 실측 후 추가 검토.
19. **Phase 1 로그인 수단 = 휴대폰 OTP 단일**(Supabase Auth phone). A5 L0의 "이메일/소셜"은 Phase 4 검토. 따라서 OTP 성공 즉시 L1, L0은 `age_blocked` 등 과도 상태로만 존재.
20. **가짜 신호 절대 금지·죄책감 카피 금지·무제한 스와이프 금지·외모 점수 금지**는 A2 §5 + A4 §5 목록을 합쳐 C/E 리뷰 체크리스트로 쓴다. 두 목록은 충돌 없음.

### B 그룹 (법무)
21. Phase 1 법적 페이지 5종 고정: `/legal/terms`(이용약관), `/legal/privacy`(개인정보처리방침), `/legal/location`(위치정보 이용약관), `/legal/youth`(청소년보호정책), `/legal/business`(사업자·통신판매업 정보). 콘텐츠 원본은 `apps/web/content/legal/*.mdx` 단일, company는 같은 파일을 import.
22. 위치정보: 수집 항목은 **사용자 입력 `region_code`(시/군/구)뿐**, GPS·IP 위치 미수집. 위치정보사업자 신고 대상 여부는 B가 판단하되 약관 페이지는 브리프 규칙 4에 따라 무조건 게시.
23. 개인정보처리방침 필수 반영: A5 §11.1 보존 기간표 전부, 본인인증 대행(포트원/PASS) 제3자 제공, 신고 증거 스냅샷 보존(90/180일·영구정지 5년·legal_hold), 탈퇴 7일 유예, 접속 로그 3개월, 결제 기록 5년.
24. 이용약관 필수 조항: 만 19세 이상 전용, 제재 등급표(1~6)·이의신청(7일 내 1회, 72h 답변), 위반 정지 시 환불 없음, 신고 시 대화 스냅샷 보관 동의, 채팅 원문은 본인·운영자만 열람.
25. 청소년보호정책: 3중 차단(가입 생년월일 / 인증 생년월일 재검증 / CI 해시 재가입 차단), 미성년 확정 시 즉시 영구 차단·사진 삭제.
26. 결제 관련(Phase 3 전 작성 완료 필요): 전자상거래법 7일 청약철회 + A4 §6 사용분 차감 공식·예시 3건, 자동갱신 고지 문구 위치(결제 버튼 위), 갱신 D-7 알림, 해지 2탭.
27. 미입력 값은 `{{COMPANY_NAME}}`·`{{BIZ_NO}}`·`{{ECOM_NO}}`·`{{DOMAIN}}`·`{{PRIVACY_OFFICER}}` 형식 플레이스홀더로 두고 `scripts/check-legal-placeholders.mjs`가 경고(차단 X). `{{COMPANY_NAME}}`·`{{ECOM_NO}}` 미입력 시 `PAYMENTS_ENABLED`는 강제 false.

### C 그룹 (디자인)
28. 카드 1면은 항상 덕질 카드(닉네임·연령대·구 단위 지역·Top3(겹침 강조)·최애·요즘 빠진 것·"같이 할 수 있는 것" 1줄), 사진은 2면(뒤집기/스크롤). 추천·프로필·매칭 화면 공통.
29. 인증 마크 2단: L2 "본인인증", L3 "사진인증". 추천에 노출되는 모든 카드는 L2 이상이므로 L1 마크는 존재하지 않는다.
30. "입문 환영" 배지: Top3 중 intensity 1~2가 있으면 자동 표시(A2). 외모·인기·매력도 관련 라벨은 어떤 형태로도 없음.
31. 온보딩 6화면 순서와 카피는 §4.1 확정본 사용. 진행 바 필수, 스킵 버튼은 퀴즈·사진 화면에만 항상 노출, 어떤 화면에도 "탈락" 표현 금지(A1 §7.4).
32. 신고 버튼은 채팅 헤더·프로필 화면 1탭 위치. 차단은 신고 완료 화면에서 "차단도 할까요?" 기본 체크.
33. 안전 가이드 3종 문구는 A5 §10 확정본을 글자 그대로 사용(모달 1회 / 오프라인 만남 배너 매칭당 1회 / 스캠 배너).
34. 광고·상점·결제 UI는 Phase 3까지 설계만. 상점 시트 "닫기"는 헤더 X + 하단 텍스트 둘 다, 터치 영역 ≥ 44pt(A4 §5-7).
35. 빈 상태(추천 부족·매칭 0건)에는 대체 행동(덕질 카드 다듬기·내일 07:00 안내)을 제공하고 자책 카피 금지. 접근성: 색 대비 4.5:1, 카드 뒤집기는 버튼으로도 가능.

### D 그룹 (백엔드)
36. **D1 스키마 추가분(브리프 §DB에 없음)**: `profiles.birth_date`(본인 전용), `profiles.now_into`("요즘 빠진 것"), `profiles.seeking_gender`(데이팅 모드용), `daily_recommendations.acted_at/action`, `identity_verifications`, `message_flags`, `appeals`, `reports.priority/due_at/legal_hold`, `photos.reject_code`, `blocks.created_at`. Phase 3용 `payments`·`refund_requests`·`skus`·`boosts`는 마이그레이션 파일만 준비(테이블 생성은 Phase 3).
37. **D1 유니크/제약**: `daily_recommendations(profile_id, target_id, date)`, `likes(from_id, to_id)`, `matches` 는 `(least(a,b), greatest(a,b))` 유니크, `identity_verifications.ci_hash` 활성 계정 1개, `profile_hobbies` rank 1~3 각 1개.
38. **RLS 원칙(D1)**: 자기 행만 쓰기 / 매칭 상대는 `profiles` 읽기만 / `blocks` 양방향 존재 시 `profiles`·`messages`·`daily_recommendations` 상호 비가시 / `messages.body`는 `sender_id = auth.uid()`일 때만, 그 외는 `masked_body` 뷰 / `reports`·`sanctions`·`audit_logs`·`identity_verifications`는 service role 전용 / `messages` insert는 양쪽 `verify_level ≥ 2` AND 활성 `sanctions.level < 2` AND `matches.status='active'`.
39. **D2**: `recompute_verify_level(profile_id)` 단일 함수, `IdentityVerifier` 인터페이스(`verify(token) → {name, birth_date, gender, ci, di}`) + `MockIdentityVerifier`(allowlist) + Phase 4 `PortOneIdentityVerifier`. 인증 생년월일 ≠ 입력 생년월일이면 인증값 우선, 미성년이면 즉시 `banned` + CI 블록리스트.
40. **D3 점수식 고정**: `0.40×취미(카테고리+태그 2단 자카드, intensity 차 ≥3 페널티) + 0.35×퀴즈 코사인(3문항 미만이면 0.5) + 0.15×활동시간대 겹침 + 0.10×상호 관심(나를 좋아함=만점)`. 보정: 나를 좋아함 +0.10(상한 40%), 신규 72h +0.05(완성 프로필만, 일 노출 ≤40), 최근 활동 48h +0.03 / 7일↑ −0.10. 사진 관련 피처 0. 최상위 필터: 모드 일치 → 차단·제재·status → 리전(풀 <300이면 전국).
41. **D3 제안 카드**: 매칭 insert 트리거/RPC에서 A3 §5 템플릿 18개로 3장 생성(`kind` online/offline/talk 각 1 이상 시도), LLM 호출 없음. 새 카테고리 추가 시 `*-1` talk 템플릿 동반 추가.
42. **D4 마스킹**: 서버에서만 `masked_body` 생성, 클라이언트는 `masked_body`만 렌더. `CT_*` 7종·`BW_*` 5종·`SC_*` 7종·`MN_*` 3종 룰을 `packages/db/src/safety-rules.ts` 하나에 정의, 채팅·bio·fav_note·now_into 저장 시 동일 평가. 오탐률 20% 초과 룰은 `warn_only`.
43. **D5 신고**: `create_report` RPC(service role)가 신고 insert + 증거 스냅샷(최근 50개 메시지 원문·프로필·사진 복사)을 한 트랜잭션으로 처리, 스냅샷 실패 시 신고 실패. 자동 조치는 level 1·2까지(A5 §3 표), 미성년 확정만 자동 6. 동일 신고자→동일 대상 24h 1건.
44. **D5 차단**: `blocks` insert → `matches.status='blocked'` → 좋아요 삭제까지 한 트랜잭션. 피차단자 통보 없음, 해제해도 매칭 복구 없음, 재추천 30일 후.
45. **D7 배치 시각(KST)**: 06:50 추천 생성 시작 → 07:00 공개, 07:30 푸시 슬롯 A, 19:30~21:00 슬롯 B(우선순위: 온보딩 미완료 24h → 추천 미완료 → 사진 검수 결과), 월 07:00 주간 리셋, 일 1회 증거 만료·탈퇴 7일 유예 삭제·`age_blocked` 30일 삭제. 매칭/답장 알림은 예산 미소비·시간당 1건 뭉침·23:00~07:00 보류.
46. **D6/Phase 3까지 `PAYMENTS_ENABLED=false`**: 결제 버튼·되돌리기 스낵바·나를 좋아한 사람 블러 카드 전부 미노출. `ENTITLEMENTS` 상수는 Phase 1부터 `packages/db/src/entitlements.ts`에 두고 `daily_reco_limit`·`weekly_superlike_quota`만 읽는다.
47. **D8 어드민 권한**: `moderator`(신고 처리·경고·채팅제한·3일 정지·사진 검수) / `admin`(7일 이상·영구·이의신청·데이터 삭제·export). 모든 판정과 증거 열람은 `audit_logs`.
48. 비밀값: `.env.example`만 커밋. 필수 키 목록은 §5.3. Edge Function은 service role 키를 Supabase secrets에서만 읽는다.

### E 그룹 (프론트)
49. 라우트 그룹: `(public)` 랜딩·법적 페이지(인덱싱 O) / `(onboarding)` / `(app)` 홈·추천·매칭·채팅·프로필·설정(전부 `noindex, nofollow` + `robots.txt` Disallow) / `(admin)`. `scripts/check-noindex.mjs`가 `(app)` 하위 metadata를 검사.
50. 온보딩 진행 상태는 단계마다 서버 저장(`profiles` 부분 업데이트), 재진입 시 마지막 미완료 화면으로 복귀. 이탈 24h 후 슬롯 B 푸시 1회.
51. 분석 이벤트는 `packages/db/src/analytics.ts`의 `track(name, props)` 하나로 통일, 이름은 A3 §8 `snake_case` `<object>_<past_verb>`. A2의 `onb_*` 이름은 `onboarding_step_completed{step}`·`onboarding_step_skipped{step}`으로 매핑(A3 규칙 우선).
52. 클라이언트 권한 체크(`can(action, profile)` from `packages/db/src/permissions.ts`)는 UX용이며 보안 경계가 아니다. 서버 4xx를 항상 처리(예: `403 NOT_VERIFIED` → 인증 게이트 화면).
53. E2E(Playwright) Phase 1 필수 1건 = A2 P1 시나리오(가입 → 인증(mock allowlist) → 취미 "아이돌"+fav_note → 퀴즈 10 → 덕질 카드 → 추천 → 좋아요 → 매칭 → 제안 카드 ③ 선택 → 첫 메시지 전송 → 상대 화면 수신). 계정 2개는 D1 시드.
54. company(E6) Phase 1 = 홈 / 법적 고지(web과 같은 mdx) / 문의(Formspree 등 외부 폼 금지 → Supabase `inquiries` 테이블 insert, 민감정보 미수집). 정적 export, 인덱싱 O.

---

## 1. 제품 개요

- **한 줄**: "같은 걸 좋아하는 사람이랑 만나는 앱 — 외모 스와이프 대신 덕질 궁합." (A1 포지셔닝 1안, 브리프 한 줄 정의와 동일 어휘)
- **타겟**: 만 19세 이상, 20~34세, 뚜렷한 취미·팬덤 보유자. 초기 8 카테고리(공연·팬덤 / 보드게임 / 러닝·클라이밍 / 애니·웹툰 / 게임 / 카페투어 / 독서 / 사진·전시), 수도권 우선. 페르소나 P1 몰입형·P2 입문형·P3 오프모임형·P4 온라인형(A2).
- **차별점 3개(경쟁사 미보유, MVP 고정 — A1 §13)**: ① 프로필 첫 화면 = 덕질 카드 ② 매칭 즉시 "같이 할 것" 제안 카드 3장 ③ 취미 친구 / 데이팅 모드를 인증 레벨로 하드 분리.
- **핵심 루프(Phase 1)**: 07:00 새 추천 5명 → 좋아요/패스 → 매칭 → 제안 카드 → 채팅 → 루프 끝 화면. 4~8분, 끝이 있는 하루(A3).
- **하지 않는 것**: 무제한 스와이프, 외모 점수·티어·인기 라벨, 실시간 위치·구 이하 세분화, 미인증 유저 간 DM, 피드/커뮤니티(Phase 1~2), 다인 모임(정원 8 초과), 가짜 좋아요·죄책감 카피, 안전 기능 유료화, 개인화 가격.
- **1순위 지표**: 초기 6개월 데이팅 모드 여성(소수 성별) 비율 ≥ 35%가 매칭 KPI보다 상위(A1). 미달 시 남성 웨이팅 도입.

## 2. 기능 목록

Phase: 1 최소 데이팅 / 2 게임·리텐션 / 3 결제 / 4 앱·실인증·FCM / 5 위키·이벤트·랭킹. MoSCoW는 해당 Phase 내 우선순위.

| ID | 기능명 | 설명 | Phase | MoSCoW | 담당 | 관련 테이블 | 의존성 |
|---|---|---|---|---|---|---|---|
| F-001 | 휴대폰 OTP 가입/로그인 | Supabase Auth phone, 재전송 30초, 코드 자동 입력 | 1 | Must | D2/E1 | auth.users, profiles | — |
| F-002 | 연령 게이트 | 생년월일 입력 → 만 19세 미만 `age_blocked` + 로그아웃, 30일 후 삭제 | 1 | Must | D2/E1 | profiles | F-001 |
| F-003 | 기본 정보 | 닉네임(2~10자, 금칙어 검사)·성별·지역(시/군/구)·활동 시간대 | 1 | Must | E1/D1 | profiles, availability | F-002 |
| F-004 | 취미 선택 | 최소 3/최대 5, rank 1~3 = Top3, intensity 1~5 라벨, 인라인 fav_note | 1 | Must | E1/D1 | hobbies, profile_hobbies | F-003, F-005 |
| F-005 | 취미 시드 데이터 | 대분류 12·세부 60 상한, 초기 8 카테고리 우선 노출, 운영자만 추가 | 1 | Must | D1 | hobbies | — |
| F-006 | 궁합 퀴즈 | 생활 궁합 10문항, 문항당 1탭, 전체 스킵 가능 | 1 | Must | E1/D1 | quiz_questions, quiz_answers | F-004 |
| F-007 | 덕질 카드 작성 | Top3 자동 + 최애(fav_note) + 요즘 빠진 것(`now_into`), 예시 칩 | 1 | Must | E1/D1 | profiles, profile_hobbies | F-004 |
| F-008 | 사진 업로드 파이프라인 | 최대 6장, 서버 리사이즈 1600px·EXIF 제거·얼굴 검사 어댑터 → `pending` | 1 | Must | D7/E1 | photos | F-003 |
| F-009 | 사진 검수 큐 | 어드민 승인/반려 9코드, 반려 한국어 안내, 24h 목표 | 1 | Must | D8/E6 | photos, audit_logs | F-008, F-047 |
| F-010 | IdentityVerifier 어댑터 + mock | 인터페이스 + allowlist mock, 인증 결과 저장·CI 해시 | 1 | Must | D2 | identity_verifications | F-001 |
| F-011 | verify_level 산정 | `recompute_verify_level` 서버 단일 함수, 강등 포함 | 1 | Must | D2 | profiles, photos | F-010 |
| F-012 | 본인인증 게이트 화면 | 온보딩 완료 후 추천 진입 전, 미인증 시 프로필 편집만 허용 | 1 | Must | E1 | profiles | F-010 |
| F-013 | 온보딩 진행 저장/복귀 | 단계별 서버 저장, 재진입 복귀, 24h 후 푸시 1회 | 1 | Must | E1/D1 | profiles | F-003, F-044 |
| F-014 | 일일 추천 배치 + 온디맨드 | 06:50 생성·07:00 공개, 미생성 유저 접속 시 생성, 하루 1회 | 1 | Must | D3/D7 | daily_recommendations | F-015, F-050 |
| F-015 | 매칭 점수식 | §0-40 산식, 보정, 사진 피처 0 | 1 | Must | D3 | profile_hobbies, quiz_answers, availability, likes | F-004 |
| F-016 | 재노출/제외 규칙 | pass 30일, seen-only 7일 1회, 매칭·차단·제재·모드 불일치 제외 | 1 | Must | D3 | daily_recommendations, blocks, sanctions | F-014 |
| F-017 | 리전 폴백 | 리전 풀 < 300이면 전국 확장 | 1 | Must | D3 | profiles | F-014 |
| F-018 | 홈(오늘 탭) | 오늘 추천 N·07:00 갱신·미읽음 배지·결과 대기 카운터·프로필 완성 넛지 | 1 | Must | E2 | daily_recommendations, likes, matches | F-014 |
| F-019 | 추천 카드 | 1면 덕질 카드(겹침 강조·사유·"같이 할 것" 1줄), 2면 사진, seen 기록 | 1 | Must | E2 | daily_recommendations, photos | F-018 |
| F-020 | 좋아요/패스 | 확인창 없음, `likes` insert + `acted_at/action` | 1 | Must | D3/E2 | likes, daily_recommendations | F-019 |
| F-021 | 슈퍼라이크(주간 쿼터) | 무료 주 1, 월 07:00 리셋, 일 상한 5, `send_super_like` RPC | 1 | Should | D3/E2 | likes | F-020 |
| F-022 | 매칭 생성 | 상호 좋아요 시 `matches` insert(트랜잭션·유니크), 양쪽 알림 | 1 | Must | D3 | matches | F-020 |
| F-023 | 첫 대화 제안 카드 생성 | 룰 템플릿 18개로 3장, `first_suggestion` jsonb | 1 | Must | D3 | matches | F-022 |
| F-024 | 매칭 화면 + 제안 카드 선택 | 애니메이션 → 카드 3장 → 선택 시 첫 메시지 자동 전송, 건너뛰기 가능 | 1 | Must | E2/E3 | matches, messages | F-023 |
| F-025 | 루프 끝 화면 | "오늘 5명을 모두 봤어요" + 결과 대기·매칭 수·내일 07:00 | 1 | Must | E2 | daily_recommendations | F-020 |
| F-026 | 채팅(텍스트·Realtime) | 매칭별 방, 목록, Realtime 구독, 전송 실패 재시도 | 1 | Must | D4/E3 | messages, matches | F-022 |
| F-027 | 연락처 마스킹 | `CT_*` 7종, 72h+L3 해제, 발신자 안내, 우회 3회 → 자동 신고 | 1 | Must | D4 | messages, message_flags | F-026 |
| F-028 | 탐지 룰(금칙어·스캠·미성년·성희롱) | `BW_*`·`SC_*`·`MN_*` 서버 평가, hold/경고/자동 신고 | 1 | Must | D4/D5 | message_flags, reports | F-027 |
| F-029 | 채팅 이미지 | 양쪽 L3 + 24h, 블러+보기, 신고 시 `held` | 1 | Should | D4/D7/E3 | messages, photos | F-026 |
| F-030 | 읽음 처리 | `read_at` 갱신(무료 티어에는 표시 안 함 — Phase 3 권한) | 1 | Must | D4/E3 | messages | F-026 |
| F-031 | 안전 가이드 3종 | 첫 매칭 모달·오프라인 만남 배너·스캠 배너(A5 §10 문구) | 1 | Must | E3 | matches | F-024, F-028 |
| F-032 | 신고 | 14 사유 enum, 자유 서술, `create_report` RPC + 증거 스냅샷 | 1 | Must | D5/E5 | reports | F-026 |
| F-033 | 차단 | 즉시·양방향·무통보, 매칭 종료, 차단 관리 화면 | 1 | Must | D5/E5 | blocks, matches | F-026 |
| F-034 | 자동 제재 | 경고/채팅 제한 24h, 누적 규칙, `AUTO:` 접두어, dismissed 시 해제 | 1 | Must | D5 | sanctions, reports | F-032 |
| F-035 | 신고 큐 + SLA 어드민 | P0~P3 큐, due_at 카운트다운, 배정/판정/통보, 초과 알림 | 1 | Must | D8/E6 | reports, sanctions, audit_logs | F-032, F-047 |
| F-036 | 수동 제재 + 정지 화면 + 이의신청 | level 3~6 수동, 정지 화면, 7일 내 1회 이의신청, 72h 판정 | 1 | Should | D5/D8/E5 | sanctions, appeals | F-035 |
| F-037 | 프로필 보기/편집 | 내 덕질 카드·사진 관리·취미/퀴즈 수정, 상대 프로필(매칭·추천만) | 1 | Must | E5 | profiles, profile_hobbies, photos | F-007 |
| F-038 | 모드 전환 | friend↔dating, 서버 L3 검증, 공개 범위 미리보기, 자동 공개 금지 | 1 | Must | E5/D2 | profiles | F-011 |
| F-039 | 설정(알림·차단 관리·휴면·탈퇴) | 탈퇴 확인 1회 + 7일 유예, 휴면 시 노출·푸시 중단 | 1 | Must | E5/D1 | profiles, blocks | F-037 |
| F-040 | 삭제/보존 배치 | 탈퇴 7일 후 삭제, 메시지 90일, 증거 만료, age_blocked 30일 | 1 | Must | D7/D1 | profiles, messages, reports | F-039 |
| F-041 | 법적 페이지 5종 + 사업자 정보 | `/legal/*` mdx, 인덱싱 O, 플레이스홀더 허용 | 1 | Must | E5/B | — | — |
| F-042 | 플레이스홀더 빌드 경고 | `check-legal-placeholders.mjs`, 차단 X | 1 | Must | E5 | — | F-041 |
| F-043 | noindex 가드 | `(app)` 라우트 metadata 검사 스크립트 + robots.txt | 1 | Must | E5 | — | — |
| F-044 | Web Push(VAPID) | 구독 저장, 슬롯 A/B, 즉시 알림 뭉침·야간 보류, 소프트 권한 배너 | 1 | Should | D7/E5 | push_subscriptions | F-022 |
| F-045 | 분석 이벤트 SDK | `track()` 단일 진입, A3 §8 ★ 이벤트 전부 | 1 | Must | E5 | analytics_events | — |
| F-046 | 감사 로그 | 판정·증거 열람·레벨 변경·데이터 삭제 기록 | 1 | Must | D5/D8 | audit_logs | — |
| F-047 | 어드민 인증/권한 | moderator/admin 역할, service role 경유 API | 1 | Must | D8 | admin_users, audit_logs | — |
| F-048 | company 최소 사이트 | 홈·법적 고지·문의(`inquiries` insert) | 1 | Must | E6 | inquiries | F-041 |
| F-049 | E2E 시나리오 P1 | Playwright 가입→인증→매칭→채팅 | 1 | Must | E1/E2/E3 | — | F-051 |
| F-050 | RLS 전면 + 마이그레이션 | 브리프 스키마 + §0-36 추가분, 정책 전부 | 1 | Must | D1 | 전체 | — |
| F-051 | 시드 데이터 | 페르소나 4쌍 계정, 취미 60, 퀴즈 10, 템플릿 18 | 1 | Must | D1 | profiles, hobbies, quiz_questions | F-050 |
| F-052 | 우선 노출 보정 | 나를 좋아함 +0.10(40%), 신규 72h +0.05, 최근 활동 | 1 | Should | D3 | daily_recommendations | F-015 |
| F-053 | 인증 마크 표시 | 카드·프로필·채팅 헤더에 L2/L3 마크 | 1 | Must | E2/E3 | profiles | F-011 |
| F-054 | 사진 검수 결과 알림 | 승인/반려 인앱 + 슬롯 B 푸시 | 1 | Should | D7/E5 | photos | F-009, F-044 |
| F-055 | 개인정보 다운로드(수동) | 문의 폼 → 어드민 JSON export 10일 내 | 1 | Should | D8 | 전체 | F-047 |
| F-056 | 데이팅 모드 성별 선호 | `seeking_gender`, 데이팅 추천 필터에만 적용 | 1 | Must | D1/D3/E5 | profiles | F-038 |
| F-057 | 남성 웨이팅 리스트 | 성비 KPI 미달 시 데이팅 모드 남성 신규 대기열 | 2 | Should | D3/E5 | profiles | F-056 |
| F-058 | 비슷한 몰입도 우선 토글 | 추천 설정, intensity 유사도 가중 | 2 | Could | D3/E5 | profiles | F-015 |
| F-059 | 모드 전환 권유(양쪽 동의) | 친구 모드 채팅에서 데이팅 의도 감지 시 동의형 카드, P4 억제 | 2 | Could | D4/E3 | matches | F-038 |
| F-060 | 게임 엔진 패키지 | `packages/game-engine` 상태 기계·결과 환류 인터페이스 | 2 | Must | F1 | game_sessions | Phase 1 게이트 |
| F-061 | 오늘의 궁합 카드 | 일 1장(무료), 최고 점수 1명 뒤집기, `draw_daily_card` RPC | 2 | Must | F1 | daily_recommendations, game_sessions | F-060 |
| F-062 | 취향 배틀(Would You Rather) | 요일 슬롯, 일 22:00 마감·월 07:00 결과, 상위 N 제한 | 2 | Must | F1 | game_sessions, quiz_answers | F-060 |
| F-063 | 덕질 퀴즈 대전 | 취미 지식 퀴즈, 5문항, 결과 매칭 신호 환류 | 2 | Should | F2 | game_sessions | F-060 |
| F-064 | 매칭 리빌 스크래치 | 매칭 화면 미니게임(선택) | 2 | Could | F2 | matches | F-024 |
| F-065 | 스트릭 & 데일리 퀘스트 | 7일 = 슈퍼라이크 1개(ledger `quest:`), 죄책감 카피 금지 | 2 | Should | F3 | game_profiles, quests, quest_progress, item_ledger | F-060 |
| F-066 | 주간 배치(게임) | 배틀 결과 확정·랭킹 스냅샷·퀘스트 리셋 월 07:00 | 2 | Must | F3/D7 | game_*, quests | F-062 |
| F-067 | 결과 화면 광고 슬롯(빈 컴포넌트) | `AdSlot` allowlist 라우트, 네트워크 미연결 | 3 | Could | E4 | — | F-071 |
| F-068 | 온보딩 미완료 리마인드 | 슬롯 B ⓪ 우선순위(Phase 1 포함) | 1 | Should | D7 | profiles | F-044 |
| F-069 | 취미 카테고리 인접도 | 세부 태그 미겹침 시 카테고리 일치 점수 | 1 | Should | D3 | hobbies | F-015 |
| F-070 | Toss 구독 결제 | `plus_monthly`·`pro_monthly`, 자동갱신 고지, webhook | 3 | Must | D6/E4 | subscriptions, payments, skus | F-071 |
| F-071 | ENTITLEMENTS + `get_effective_tier` | 12 권한 키, 서버 체크 포인트 8곳 | 3 | Must | D6 | subscriptions | — |
| F-072 | 소모성 아이템 상점 + ledger | `superlike_5`·`boost_1h`·`rewind_3`·`card_refill_3`, SUM(delta), advisory lock | 3 | Must | D6/E4 | item_ledger, payments, skus | F-071 |
| F-073 | 부스트 | 1h ×3 가중(같은 취미 상위 후보), "부스트 중" 라벨 | 3 | Should | D6/D3 | boosts, item_ledger | F-072 |
| F-074 | 되돌리기 | `undo_last_pass` 300초, 플러스↑ 또는 3회권 | 3 | Should | D6/E2 | daily_recommendations, item_ledger | F-071 |
| F-075 | 나를 좋아한 사람 탭 | 블러(실제 수)/공개, like 0건이면 유료 안내 없음 | 3 | Must | D6/E4 | likes | F-071 |
| F-076 | 환불 `compute_refund` | A4 §6 공식, `refund_requests` 스냅샷, 3영업일 실행 | 3 | Must | D6 | payments, refund_requests | F-070 |
| F-077 | 구독 관리/해지 | 2탭 + 확인 1회, 만류 오퍼 없음, D-7·D-3 알림 | 3 | Must | E4/D7 | subscriptions | F-070 |
| F-078 | 읽음 표시·고급 필터·profile_stats 권한 | 티어별 UX 차등(비대칭 읽음 허용) | 3 | Should | D6/E3/E5 | messages, profiles | F-071 |
| F-079 | 가격 실험(`skus.experiment_group`) | 코호트 단위, 무료 하한 불변 | 3 | Could | D6 | skus | F-070 |
| F-080 | 결제 화면 사업자 정보 | `{{COMPANY_NAME}}`·`{{ECOM_NO}}` 없으면 `PAYMENTS_ENABLED` 강제 false | 3 | Must | E4/B | — | F-041 |
| F-081 | Capacitor 앱 래핑 | iOS/Android, 17+/19+ 등급, 딥링크 | 4 | Must | E5/E6 | — | Phase 3 게이트 |
| F-082 | 실 본인인증(포트원 PASS/다날) | `PortOneIdentityVerifier`, CI 해시, allowlist 폐기 | 4 | Must | D2 | identity_verifications | F-010 |
| F-083 | FCM/APNs | Web Push → 네이티브 푸시, 슬롯 규칙 동일 | 4 | Must | D7 | push_subscriptions | F-044 |
| F-084 | RevenueCat IAP | 스토어 구독·환불 경로 연결, 웹/앱 가격 차이 고지 | 4 | Must | D6/E4 | subscriptions, payments | F-070 |
| F-085 | 아는 사람 차단 | 기기 해시(sha256 E.164) 업로드, 서버 해시만 저장 | 4 | Should | D5/E5 | contact_hashes, blocks | F-081 |
| F-086 | 개인정보 다운로드 자동화 | 설정에서 JSON 생성 | 4 | Should | D8/E5 | 전체 | F-055 |
| F-087 | AdMob 연결 | 성인 인벤토리, 카테고리 차단, 비개인화 폴백 | 4 | Could | E4 | — | F-067 |
| F-088 | `reject_no_face` 자동화 검토 | 얼굴 검사 자동 반려(대표 사진만) | 4 | Could | D8 | photos | F-009 |
| F-089 | 취미 위키 30개 | `apps/company` 인덱싱 O 콘텐츠 | 5 | Must | E6 | — | — |
| F-090 | 취미 이벤트 + RSVP | 운영팀 호스트, 정원 ≤ 8, 프로 우선 24h | 5 | Must | F3/D1 | events, event_rsvps | F-071 |
| F-091 | 취미 랭킹 | 주간 활발한 덕후 Top 10(좋아요 수 제외) | 5 | Should | F3 | game_profiles | F-066 |
| F-092 | company 전체 페이지 | 서비스 소개·안전과 신뢰(SLA 도식)·팀·블로그·채용 | 5 | Should | E6 | — | F-048 |

## 3. Phase 1 범위 재확인

Phase 1 = F-001~F-056 + F-068·F-069 중 Must/Should. **Phase 1에서 작성 금지**: `game_*`·`quests`·`events` 읽기/쓰기 코드, 결제 UI, 광고 슬롯, Capacitor. 테이블은 D1이 전부 만들되 Phase 1 앱 코드가 참조하지 않는다.

### 3.1 D1 스키마 델타 (브리프 §DB 대비 추가·변경분 요약)

| 테이블 | 추가/변경 | 타입·제약 | 출처 | Phase |
|---|---|---|---|---|
| `profiles` | `birth_date` | date, 본인+service role만 읽기 | §0-12 | 1 |
| `profiles` | `now_into` | text(40), 룰 평가 대상 | §0-36 | 1 |
| `profiles` | `seeking_gender` | enum(any/male/female), 데이팅 모드 필수 | §0-36 | 1 |
| `profiles` | `consented_at` | timestamptz, 약관 동의 시각 | §4.7 | 1 |
| `profiles.status` | enum 확장 | active/paused/banned/**age_blocked**/**deleting** | A5 §2.1·§11.1 | 1 |
| `daily_recommendations` | `acted_at`, `action` | timestamptz, enum(like/super/pass) | A3 | 1 |
| `daily_recommendations` | 유니크 | `(profile_id, target_id, date)` | A3 §9 | 1 |
| `identity_verifications` | 신규 | `user_id, provider, ci_hash, di_hash, verified_at, birth_date, gender` / `ci_hash` 활성 1개 | A5 §1 | 1 |
| `message_flags` | 신규 | `message_id, rule_id, created_at` | A5 §7 | 1 |
| `appeals` | 신규 | `id, sanction_id, profile_id, body, attachment_path, status, decided_by, decided_at` | A5 §4.5 | 1 |
| `reports` | `priority`, `due_at`, `legal_hold` | enum(P0~P3), timestamptz, bool | A5 §5·§6 | 1 |
| `reports.status` | enum | queued/in_review/need_info/confirmed/dismissed | A5 §6 | 1 |
| `reports.reason_code` | enum `report_reason` | A5 §3 14개 | A5 | 1 |
| `sanctions.level` | 정수 1~6 | 6 = 영구(`profiles.status='banned'` 동시) | A5 §4 | 1 |
| `photos` | `reject_code` | enum 9개(approved 제외) | A5 §8 | 1 |
| `photos.review_status` | enum | pending/approved/rejected/held | A5 §8 | 1 |
| `blocks` | `created_at` | timestamptz | A5 §9 | 1 |
| `push_subscriptions` | 신규 | `user_id, endpoint, keys(jsonb), created_at, last_sent_at` | A3 §7 | 1 |
| `analytics_events` | 신규 | `id, user_id_hash, name, props(jsonb), loop_date, created_at` | A3 §8 | 1 |
| `admin_users` | 신규 | `user_id, role(moderator/admin)` | A5 결정 | 1 |
| `inquiries` | 신규 | `id, email(선택), category, body, created_at` — 민감정보 필드 없음 | §0-54 | 1 |
| `subscriptions.status` | enum | active/past_due/canceled/expired/refunded | A4 | 3(파일만) |
| `payments`, `refund_requests`, `skus`, `boosts` | 신규 | A4 결정사항 정의 그대로 | A4 | 3(파일만) |
| `events.capacity` | 제약 | `≤ 8` | A1 §10 | 5 |

- 삭제·보존 배치가 참조하는 기준 컬럼: `profiles.deleted_requested_at`(탈퇴 요청), `reports.handled_at`(증거 만료 기산), `matches.status='left'` 전환 시각.
- 모든 enum은 Postgres 타입으로 만들고 `packages/db/src/enums.ts`에 동일 문자열로 export(클라이언트·서버 단일 소스).

## 4. Phase 1 상세 요구사항 (화면별 수용 기준)

### 4.1 온보딩 6화면 (E1) — 목표 3분 이내, 추천 화면 도달 ≥ 45%

**S1 연령 확인**
- Given 미로그인 사용자가 `/onboarding/age`에 진입 When 생년월일을 입력하고 만 나이가 19 이상(KST 서버 기준) Then S2로 이동하고 `onboarding_step_completed{step:age_gate}` 기록.
- Given 만 19세 미만 When 계속 누름 Then "덕메이트는 성인만 이용해요" 안내 화면, 계정 생성 없음, 어떤 다른 화면으로도 이동 불가.
- Given S2 OTP 성공 후 서버 재검증에서 미성년 판정 Then `profiles.status='age_blocked'` + 즉시 로그아웃 + 30일 후 삭제 배치 대상.
- 카피: "덕메이트는 성인만 이용해요. 안전한 만남을 위해 먼저 확인할게요." 입력은 YYYY-MM-DD 숫자 키패드.

**S2 휴대폰 인증**
- Given 유효한 국내 번호 When OTP 요청 Then 6자리 SMS 발송, 재전송 버튼은 30초 후 활성, 코드 자동 입력(WebOTP) 시도.
- Given 올바른 코드 Then 계정 생성, `profiles` 행 생성(verify_level=1, mode='friend', status='active'), S3 이동.
- 카피 필수: "번호는 본인 확인용이며 프로필에 절대 표시되지 않아요." 이 화면 전에는 이름·사진을 요구하지 않는다.

**S3 기본 정보**
- Given 닉네임 2~10자 When 저장 Then 금칙어(`BW_*`)·연락처 패턴(`CT_*`) 검사 통과 시에만 저장, 실패 시 인라인 오류.
- When 성별·지역(시/군/구 선택기, 동 이하 없음)·활동 시간대(요일×아침/오후/저녁/밤 그리드, 최소 1칸) 입력 Then `profiles`·`availability` 저장, `onboarding_step_completed{step:basic}`·`{step:availability}` 기록.

**S4 취미 선택**
- Given 초기 8 카테고리 칩 + "더보기" + 검색창 최상단 When 3개 미만 선택 상태 Then 다음 버튼 비활성 + "3개만 골라도 시작할 수 있어요".
- When 칩 탭 Then 인라인으로 intensity(1 관심 있음 / 2 가끔 / 3 주 1회 / 4 거의 매일 / 5 이게 인생) 선택 + fav_note(선택, 30자) 입력 가능.
- When 5개 초과 선택 시도 Then 안내 후 거부. Then 선택 순서 1~3이 rank 1~3(드래그로 변경 가능), `profile_hobbies` 저장.
- Given fav_note 입력 Then `CT_*`·`BW_*` 검사 후 저장. 자유 입력 태그 기능은 존재하지 않는다("직접 추가 요청" 버튼은 `inquiries`로만 접수).

**S5 궁합 퀴즈**
- Given 10문항, 진행 바, 문항 텍스트 ≤ 30자, 선택지 2~4개 When 1탭 Then 다음 문항, 답변마다 `quiz_answers` upsert.
- Given "나중에 할게요" 버튼(항상 노출) When 탭 Then S6 이동, `onboarding_step_skipped{step:quiz, answered:n}` 기록. 카피: "3문항만 답해도 추천이 시작돼요. 나머지는 나중에 답하면 정확도가 올라가요."
- 취미 지식 문항 금지(생활 궁합만).

**S6 덕질 카드 + 사진**
- Given Top3가 S4에서 자동 채워진 카드 미리보기 When 최애(rank 1 fav_note 기본값)·"요즘 빠진 것"(`now_into`, 40자, 예시 칩) 입력 Then 실시간으로 카드 미리보기 갱신, 카피 "이 카드가 사진보다 먼저 보여요 — 나답게 써주세요."
- Given 사진 영역 When 업로드 Then 클라이언트 압축 → 서버 리사이즈·EXIF 제거 → `photos.review_status='pending'`, 상태 텍스트 "24시간 안에 확인해요".
- When "사진은 나중에" 탭 Then `onboarding_step_skipped{step:photos}`, 다음 단계로. 사진 없이도 통과 가능.
- Then `onboarding_completed{hobby_count, quiz_count, photo_count}` 기록 후 **인증 게이트 화면**으로 이동.

**인증 게이트(S7, 온보딩 밖)**
- Given verify_level=1 When 게이트 진입 Then "본인인증 후 추천이 시작돼요" + [인증하기] + [프로필 먼저 다듬기]. 인증 없이는 홈·추천·채팅 라우트 접근 시 항상 이 화면으로 리다이렉트.
- When mock 인증(allowlist 번호) 성공 Then `identity_verifications` insert, `recompute_verify_level` → 2, 홈으로 이동. 실패 시 "지금은 초대된 번호만 인증할 수 있어요" (프로덕션) / 개발 환경은 항상 성공.
- Given 인증 생년월일이 미성년 Then 즉시 `banned`, CI 블록리스트, 로그아웃.

### 4.2 홈 / 추천 (E2)
- Given L2 이상, 오늘 `loop_date`의 추천이 없음 When 홈 진입 Then 온디맨드 생성 후 표시(P95 ≤ 2s), `daily_reco_opened{reco_count}` 기록.
- Given 추천 5장 When 세로 스크롤 Then 카드 1면(덕질 카드·겹치는 취미 강조·`reasons` 1줄·인증 마크·"입문 환영" 배지 조건부), 뷰포트 50% 1초 시 `seen_at` + `reco_card_seen`.
- When 카드 뒤집기(버튼 또는 탭) Then 사진 면(승인 사진 없으면 기본 아바타), `reco_card_flipped`.
- When 좋아요 Then `likes` insert(RPC, 서버에서 L2·제재·차단 검증), 카드에 "보냈어요" 상태, 되돌리기 없음(Phase 3). When 패스 Then 확인창 없이 다음 카드, 스낵바 없음.
- When 슈퍼라이크 Then 주간 쿼터(월 07:00 기준) 잔여 확인, 0이면 "이번 주 슈퍼라이크를 다 썼어요 · 월요일 07:00에 1개 충전" (구매 안내 없음).
- Given 후보 < 5 Then 빈 칸에 "이 지역/취미에 아직 사람이 적어요 · 내일 07:00 다시 추천해요", 재노출로 채우지 않음.
- Given 5장 모두 acted Then 루프 끝 화면: "오늘 5명을 모두 봤어요", 결과 대기 N건, 매칭 M건, "내일 07:00 새 추천", `daily_reco_exhausted`·`daily_loop_completed`. 광고·카운트다운 없음.
- Given 추천 목록 When 모드가 다른 사용자·차단 관계·`status != active`·활성 `sanctions.level ≥ 3` Then 절대 포함되지 않음(E2E 검증 항목).
- Given 알림 미허용 When 홈 진입(하루 1회) Then 소프트 배너 "새 추천이 오면 알려드릴까요?" → `push_permission_prompted`.

### 4.3 매칭 (E2/E3)
- Given A가 B를 좋아요, B가 A를 좋아요 When 두 번째 좋아요 insert Then 같은 트랜잭션에서 `matches` 1행(유니크), `first_suggestion` 3장 생성, 양쪽에 `match_created`, 상대에게 즉시 알림(뭉침 규칙).
- When 매칭 화면 표시 Then 양쪽 덕질 카드 겹침 애니메이션 + 겹친 태그 강조 + "서로 좋아요" 표기, `match_screen_viewed`.
- Given 첫 매칭 Then A5 §10.1 안전 모달(확인 필수) 1회, 이후 매칭에는 미표시.
- When 제안 카드 3장 렌더 Then `suggestion_shown{template_ids, kinds}`; 카드 본문은 존댓말 1~2문장·질문으로 끝남·장소명/연락처/시간 확정 표현 없음(D3 단위 테스트).
- When 카드 1개 "이걸로 시작하기" Then 채팅방 진입 + 본문이 첫 메시지로 자동 전송(sender = 선택자), `suggestion_selected`. When "건너뛰기" Then 빈 채팅방 진입, `suggestion_skipped` — 단 상단에 제안 카드 3장 접힌 상태로 재노출.
- Given `mode` 또는 `region` 폴백 Then 카드 ②(offline)는 `same_region` 충족 시에만 생성.

### 4.4 채팅 (E3)
- Given 활성 매칭 When 텍스트 전송 Then 서버가 룰 평가 → `body`·`masked_body`·`message_flags` 저장 → Realtime으로 상대에게 `masked_body`만 전달(P95 ≤ 1s), `message_sent{is_first, length_bucket}`.
- Given 매칭 후 72h 이전 또는 어느 한쪽 L2 When 전화번호/카톡ID/URL/계좌 포함 Then 수신자에게 `[연락처 숨김]`/`[링크 숨김]`/`[계좌 숨김]`, 발신자에게 인라인 안내(A5 §10.4). 같은 매칭에서 3회 hit Then 경고 배너 + `OFF_PLATFORM_LURE` 자동 신고(P2).
- Given 72h 경과 AND 양쪽 L3 Then 원문 전달, `message_flags`는 계속 기록.
- Given `SC_MONEY`/`SC_INVEST` hit Then 상대 화면 상단 스캠 배너(A5 §10.3). 점수 ≥ 5 → 자동 신고 P0, ≥ 8 → 발신자 채팅 제한 24h + 비노출.
- Given 오프라인 만남 키워드 Then 매칭당 1회 인라인 배너(A5 §10.2) + "만남 안전 가이드 전체 보기" 링크.
- Given 양쪽 L3 AND 24h 경과 When 이미지 전송 Then 리사이즈 후 전달, 수신자 화면 블러 + "보기" 탭. 조건 미충족 시 버튼 비활성 + 이유 문구; 서버는 `403 NOT_ENTITLED`.
- Given 활성 `sanctions.level=2`(채팅 제한) Then 읽기 가능·전송 불가·상단 안내(사유 카테고리·해제 시각).
- Given 상대가 차단/탈퇴 Then 방은 "대화가 종료되었습니다" 상태, 입력 불가, 목록에서는 차단자 화면에서만 제거.
- 헤더: 상대 닉네임·인증 마크·[신고]·[더보기: 차단]. 첫 진입 시 "안전 수칙 3줄" 1회. `read_at` 갱신은 방 포커스 시(`message_read`).

### 4.5 프로필 / 설정 (E5)
- Given 내 프로필 When 편집 Then 덕질 카드(취미·intensity·fav_note·now_into)·사진(최대 6, 대표 지정, 상태 표시)·퀴즈 재응답·활동 시간대·bio(200자, 룰 평가) 수정 가능. 닉네임 변경은 30일 1회.
- Given 상대 프로필 When 열람 Then 추천 대상 또는 매칭 상대일 때만 조회 가능(RLS), 1면 덕질 카드·2면 사진·인증 마크·구 단위 지역. 생년은 연령대(20대 초반 등)로만.
- Given L3 미만 When 데이팅 모드 토글 Then 서버 `403 NOT_ENTITLED` + "본인인증 + 승인된 대표 사진 1장이 필요해요" 안내. Given L3 When 토글 Then 공개 범위 미리보기 1장 → "전환하기" 확정 → `profiles.mode='dating'` + `seeking_gender` 선택 필수. 자동 공개 확대 없음.
- 설정: 알림(슬롯별 on/off), 차단 관리(닉네임·차단일·해제), 휴면(`paused`: 추천·노출·푸시 중단, 매칭 보존), 탈퇴(확인 1회 → 즉시 로그아웃·7일 유예·유예 중 재로그인 시 취소), 법적 페이지 링크, 개인정보 다운로드 안내(문의 폼), 이의신청(활성 제재 있을 때만).
- 탈퇴 시 할인·만류 팝업 없음.

### 4.6 신고 / 차단 (E5/D5)
- Given 프로필 또는 채팅 헤더 When [신고] Then 사유 14개 라디오(A5 라벨) + 자유 서술(500자, `OTHER`는 필수) + "증거는 자동으로 첨부돼요" 안내. 제출 시 `create_report` RPC 1회 호출.
- Then 서버는 신고 insert + 증거 스냅샷(최근 50개 메시지·프로필·사진 복사·관계 타임스탬프·탐지 hit·이력)을 한 트랜잭션으로 처리, 실패 시 사용자에게 재시도 안내(부분 저장 없음). `report_submitted{reason_code, surface}`.
- Then 자동 분류(priority P0~P3, `due_at`)와 A5 §3 자동 조치 적용. 완료 화면: "접수됐어요. 24시간 안에 확인해요" + "차단도 할까요?" 기본 체크.
- Given 같은 대상에 24h 내 재신고 Then 기존 신고 `detail`에 append, 새 행 없음.
- When 차단 Then 트랜잭션(`blocks` insert → `matches.status='blocked'` → 좋아요 삭제), 즉시 양방향 비가시, 피차단자 통보 없음, `block_submitted`.
- Given 처리 완료 Then 신고자에게 "조치가 완료되었어요" 수준 통보(내용 비공개), 피신고자에게 사유 카테고리·기간·이의신청 방법.

### 4.7 법적 페이지 (E5/E6/B)
- Given `/legal/{terms|privacy|location|youth|business}` When 미로그인 접근 Then 200, 인덱싱 허용, 푸터에서 1탭 도달, `apps/web`과 `apps/company` 동일 내용(같은 mdx).
- Given `{{...}}`/`[TODO_...]` 잔존 When 빌드 Then 경고 출력, 빌드 성공, 페이지에는 플레이스홀더가 그대로 노출된다(숨기지 않음).
- Given 회원가입 S2 Then 이용약관·개인정보처리방침·청소년보호정책 동의 체크(필수 3개 개별, 전체 동의 1개), 동의 시각을 `profiles.consented_at`에 저장.
- Given 법적 페이지 내용 변경(mdx 커밋) Then 페이지 하단 "시행일" 갱신, 기존 회원에게 재동의는 B가 필요하다고 판단한 항목(예: 보존 기간 변경)에만 홈 상단 배너 1회.

### 4.8 푸시 알림 (D7/E5)
- Given 알림 허용 + 최근 7일 내 접속 When 07:30 KST Then 슬롯 A "새 추천 5명 도착"(결과 대기 N건이면 함께) 1건, `push_sent{slot:A}`. 30일 미접속 유저는 월요일만.
- Given 슬롯 B 후보(온보딩 미완료 24h → 오늘 추천 미완료 → 사진 검수 결과) When 19:30~21:00 사이 유저 `availability`에 맞는 시각 Then 최고 우선순위 1건만 발송, 해당 없으면 발송하지 않음.
- Given 매칭 성사 또는 답장 도착 When 23:00~07:00 Then 보류 후 07:00 일괄; 그 외 시각은 시간당 1건으로 뭉침("새 메시지 3개"). 예산(일 2건)에 포함하지 않는다.
- Given 어떤 푸시든 Then 본문에 상대 메시지 원문·닉네임 외 개인정보 미포함, 가짜·추정 수치 미포함, 심야 마케팅 0건. 설정에서 슬롯별 off 가능.
- Given 알림 미허용 Then 인앱 배너로만 대체(이메일 발송 없음).

### 4.9 어드민 최소 화면 (D8/E6)
- Given `moderator` 로그인 When `/admin/photos` Then `pending`·`held` 사진 목록(업로드순), 얼굴 검사 참고값(`face_count`, `confidence`), 승인/반려(코드 선택) 버튼, 처리 시 `photos.reviewed_by`·`audit_logs` 기록 + `recompute_verify_level` 호출.
- Given `/admin/reports` Then priority·`due_at` 카운트다운·reason_code·피신고자 누적 신고 수·탐지 hit 수·담당자 컬럼, "가져오기"로 `in_review` 전환, 증거 열람 시 `audit_logs{action:'evidence_viewed'}`.
- When 판정 `confirmed` Then A5 §4.2 기본 등급 제안값이 미리 채워진 제재 폼(moderator는 level ≤ 3만 선택 가능, 4~6은 admin), 통보 문구 자동 생성(사유 카테고리·기간·이의신청 방법). When `dismissed` Then `AUTO:` 조치 즉시 해제.
- Given `due_at` 초과 P0~P2 Then 상단 배너 + 이메일(Slack은 Phase 2). Given `/admin/users` Then 닉네임·verify_level·status·활성 제재 조회 및 admin 전용 수동 export(JSON) 버튼.
- 어드민 화면은 `noindex` + `admin_users` 역할 없으면 404.

## 5. 비기능 요구사항

### 5.1 성능
- 랜딩·법적 페이지: LCP ≤ 2.0s(모바일 4G), CLS < 0.1. `(app)` 화면: LCP ≤ 2.5s, 추천 온디맨드 생성 포함 첫 카드 표시 P95 ≤ 2s, 채팅 전송→상대 수신 P95 ≤ 1s, 이미지 카드는 WebP 2단(썸네일 400px/원본 1600px).
- 배치: 추천 생성 10분 내 완료(06:50→07:00) — 활성 유저 5만 명 기준. 초과 시 온디맨드 폴백이 커버.

### 5.2 접근성
- WCAG 2.1 AA: 색 대비 4.5:1, 모든 인터랙션 키보드 도달, 카드 뒤집기·좋아요·패스는 버튼(스와이프 제스처 없음), 터치 영역 ≥ 44pt, `prefers-reduced-motion` 시 매칭 애니메이션 생략, 이미지 alt("사용자 사진"), 폼 오류는 인라인 텍스트 + `aria-live`.

### 5.3 보안
- RLS 전 테이블 활성(§0-38). service role 키는 Edge Function·서버 액션에서만, 클라이언트 번들에 절대 포함 안 됨(빌드 시 `grep SUPABASE_SERVICE_ROLE` 가드).
- `.env.example` 키: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `IDENTITY_PROVIDER=mock|portone`, `IDENTITY_MOCK_ALLOWLIST`, `IDENTITY_CI_SALT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PAYMENTS_ENABLED=false`, `GOOGLE_SITE_VERIFICATION`, `NEXT_PUBLIC_DOMAIN`.
- 채팅 원문 `body`는 발신자 + service role만. 증거 열람은 audit. 이미지 업로드는 MIME·매직바이트 검사, 10MB 상한, EXIF 제거. Rate limit: 좋아요 일 상한 = 추천 수×2 초과 시 `SC_MASS_LIKE`, 메시지 분당 30건, OTP 번호당 시간당 5회.
- 어드민은 별도 라우트 그룹 + Supabase `admin_users` 역할 + IP allowlist(선택).

### 5.4 개인정보
- `(app)` 전 라우트 `noindex, nofollow` + `robots.txt` Disallow, OG 이미지는 앱 단위 정적만(사용자 사진 OG 금지). 검사 스크립트 통과가 배포 조건.
- 보존: A5 §11.1 표 그대로. 위치는 `region_code`만, IP는 접속 로그 3개월. 분석 이벤트는 `user_id_hash`(sha256+salt)만, 원문 메시지 미포함.
- 본인인증 결과 중 이름은 저장하지 않고 생년월일·성별·CI/DI 해시만 저장.

### 5.5 가용성·운영
- Supabase 프로덕션 1개(리전 ap-northeast-2), 일일 자동 백업, PITR(Pro 플랜) 활성. Vercel 프로젝트 2개(web, company), preview 배포는 `noindex` 헤더 강제.
- 배치 실패 시 온디맨드 폴백으로 사용자 영향 0. Realtime 장애 시 5초 폴링 폴백.
- 모니터링: Vercel Analytics + Supabase 로그 + 신고 SLA 초과 알림(이메일). 목표 가용성 99.5%/월.
- `DEPLOY_LOG.md`에 배포마다 커밋·마이그레이션 버전·확인자 기록.

## 6. 지표 / KPI

| 영역 | KPI | 정의(A3 이벤트 기준) | Phase 1 목표 | 소유 |
|---|---|---|---|---|
| 성비(1순위) | 데이팅 모드 여성 비율 | `profiles.mode='dating'` 중 여성 / 전체 | ≥ 35% | A1/D3 |
| 온보딩 | 추천 화면 도달률 | `onboarding_completed` ∧ verify_level ≥ 2 / S1 진입 | ≥ 45% | E1 |
| 온보딩 | 단계 이탈률 | `onboarding_step_completed{step}` 연속 비교 | 퀴즈 이탈 ≤ 20% | E1 |
| 온보딩 | 소요 시간 | `duration_ms` 합 | 중앙값 ≤ 3분 | E1 |
| 리텐션 | D1 / D7 / D30 | `app_opened` 기준 코호트 | 40% / 20% / 10% | A3 |
| 루프 | 루프 완주율 | `daily_loop_completed` / `app_opened` (같은 `loop_date`) | ≥ 50% | E2 |
| 루프 | 추천 부족 유저 비율 | `daily_reco_opened{reco_count<5}` / 전체 | ≤ 30% | D3 |
| 매칭 | 좋아요→매칭 전환 | `match_created` / `like_sent` | ≥ 8% | D3 |
| 매칭 | 매칭 0건 D7 이탈 | 매칭 0 코호트의 D7 | 모니터링 | A2 |
| 대화 | 매칭→첫 메시지 | `message_sent{is_first}` / `match_created` | ≥ 70% | E3 |
| 대화 | 제안 카드 채택률 | `suggestion_selected` / `suggestion_shown` | ≥ 40% | D3 |
| 대화 | 24h 응답률 | `conversation_reciprocated` / `match_created` | ≥ 50% | E3 |
| 안전 | 신고율 | `report_submitted` / `match_created` | ≤ 3% | D5 |
| 안전 | SLA 준수율 | `handled_at - created_at ≤ due` 비율 | P0~P2 100% | D8 |
| 안전 | 마스킹 우회 시도 | `message_flags{CT_*}` per 매칭 | 모니터링 | D4 |
| 안전 | 사진 검수 24h 내 처리율 | `reviewed_at - created_at ≤ 24h` | ≥ 95% | D8 |
| 푸시 | 푸시 오픈율 | `push_opened` / `push_sent` (슬롯별) | A ≥ 15% | D7 |
| 품질 | 프로필 완성률 | 퀴즈 10 + 승인 사진 1 비율 | ≥ 50% | E5 |
| Phase 3 | 유료 전환율 | `subscription_started` / 인증 MAU | 2~3.5% | D6 |

가드레일: 실험·기능 변경 후 환불율·신고율·D30이 악화되면 롤백(A4 §7).

### 6.1 Phase 1 필수 분석 이벤트 (A3 §8 ★ 전량, 구현 담당)

| 이벤트 | 주요 속성 | 발생 위치 | 담당 |
|---|---|---|---|
| `onboarding_step_completed` / `onboarding_step_skipped` | `step(age_gate/phone/basic/availability/hobbies/quiz/card/photos)`, `duration_ms`, `answered` | 온보딩 각 화면 | E1 |
| `onboarding_completed` | `hobby_count, quiz_count, photo_count` | S6 완료 | E1 |
| `verify_gate_viewed` / `verify_succeeded` / `verify_failed` | `provider(mock/portone)`, `level_after` | 인증 게이트(§4.1 S7, PRD 추가) | E1/D2 |
| `app_opened` | `source(direct/push/link)`, `push_slot` | 세션 시작 | E5 |
| `push_permission_prompted` / `push_permission_granted` | `attempt_no` | 소프트 배너·브라우저 프롬프트 | E5 |
| `daily_reco_opened` | `reco_count, from_like_count, boosted_count` | 추천 진입 | E2 |
| `reco_card_seen` / `reco_card_flipped` | `target_id_hash, position, score_bucket` | 카드 | E2 |
| `like_sent` / `pass_sent` | `type(like/super), position, reasons_shown` | 버튼 | E2 |
| `daily_reco_exhausted` / `daily_loop_completed` | `liked, passed, unseen, matches, pending_results, duration_ms` | 루프 끝 | E2 |
| `match_created` / `match_screen_viewed` | `match_id_hash, hours_since_first_like, initiator` | 서버/매칭 화면 | D3/E2 |
| `suggestion_shown` / `suggestion_selected` / `suggestion_skipped` | `template_ids[3], kinds[3], template_id, position` | 제안 카드 | E2 |
| `message_sent` / `message_read` / `conversation_reciprocated` | `match_id_hash, is_first, has_image, length_bucket, latency_min` | 채팅 | E3/D4 |
| `report_submitted` / `block_submitted` | `reason_code, surface(profile/chat)` | 신고·차단 | E5 |
| `push_sent` / `push_opened` | `slot(A/B/instant), kind` | 서버/클라이언트 | D7/E5 |
| `weekly_grant_applied` | `item_type:'superlike', amount` — Phase 1은 쿼터 리셋 로그로 기록 | 월 07:00 배치 | D7 |
| `mode_changed` | `from, to, preview_viewed` (PRD 추가) | 설정 | E5 |
| `account_paused` / `account_delete_requested` / `account_delete_canceled` | — (PRD 추가) | 설정 | E5 |

공통 속성 `{user_id_hash, loop_date, session_id, mode, plan, platform}`은 `track()`이 자동 부착. 원문 메시지·닉네임·전화번호는 어떤 이벤트에도 넣지 않는다.

## 7. 오픈 이슈 / 소유자 결정 필요

| 항목 | 상태 | 없을 때 플레이스홀더 처리 | 결정 기한 |
|---|---|---|---|
| 서비스명 최종 | 가칭 "덕메이트" | 코드·카피에 `SERVICE_NAME` 상수(`apps/web/config/site.ts`) 1곳, 기본값 "덕메이트". 변경 시 상수만 교체 | Phase 1 배포 전 |
| 도메인 | 미정 | `NEXT_PUBLIC_DOMAIN` 미설정 시 Vercel 기본 도메인 사용, 법적 페이지에는 `{{DOMAIN}}` 노출 + 빌드 경고 | Phase 1 배포 전 |
| 사업자 정보(상호·대표·사업자번호·통신판매업·주소·개인정보책임자) | 없음 | `apps/company/config/company.ts` 단일 소스, `{{COMPANY_NAME}}` 등 플레이스홀더 노출 + 경고. `PAYMENTS_ENABLED` 강제 false | Phase 3 전 필수 |
| Supabase 프로젝트 | 없다고 가정 | 소유자가 프로젝트 생성 후 URL/키 전달. 그 전엔 로컬 `supabase start`로 개발, 프로덕션 게이트 보류 | Phase 1 게이트 |
| Vercel 프로젝트 2개 | 없다고 가정 | 소유자 계정에 web/company 생성, 환경변수 입력. 그 전엔 preview 없음 | Phase 1 게이트 |
| 포트원(PASS/다날) 계약 | 없다고 가정 | `IDENTITY_PROVIDER=mock` + allowlist. 공개 런칭 불가(초대제 베타) | Phase 4 |
| Toss Payments 계약 | 없다고 가정 | `PAYMENTS_ENABLED=false`, 상점 UI "준비 중" | Phase 3 |
| 시드 유저 500명(성비 5:5) | 미확보 | 공개 런칭 게이트. 확보 전엔 allowlist 베타로만 운영 | Phase 1 이후 GTM |
| 검수·신고 온콜 인력 | 소유자 1인 | P0 1h SLA는 자동 조치로 방어, 초과 알림 이메일 | Phase 1 |
| 위치정보사업자 신고 필요 여부 | B 판단 대기 | 약관 페이지는 게시, 신고 여부는 법무 의견서로 확정 | Phase 1 |
| 앱 IAP 가격(웹 대비) | 미정 | Phase 4 법무 확인 후 | Phase 4 |
| 커뮤니티 문의 폼 스팸 대책 | 미정 | `inquiries` insert에 Turnstile 등 무료 CAPTCHA 검토 | Phase 1 Should |

## 8. Phase 게이트

브리프 §Phase 로드맵 원문: **Phase 1** 가입/연령확인/취미/퀴즈/덕질카드/사진(검수 큐), 일일 추천 5 + 좋아요/매칭 + 채팅 + 신고/차단, 법적 페이지 전부, company 최소(홈+법적고지+문의). 게이트: 프로덕션 URL 2개, E2E 통과, DEPLOY_LOG.md. **Phase 2** 게임/리텐션 · **Phase 3** 결제 · **Phase 4** 앱 래핑+실 본인인증+FCM · **Phase 5** 위키 30개+이벤트+랭킹.

### Phase 1 → 2 통과 체크리스트
- [ ] Vercel 프로덕션 URL 2개(web, company) 응답 200, 법적 페이지 5종 노출(플레이스홀더 허용)
- [ ] Supabase 프로덕션에 마이그레이션 전부 적용, RLS 활성 테이블 100%, service role 키 클라이언트 번들 미포함
- [ ] Playwright E2E(P1 시나리오) 프로덕션 대상 통과 + 실제 계정 2개로 가입→인증(allowlist)→매칭→채팅 1회 성공 스크린샷
- [ ] `check-legal-placeholders` 경고 목록 확인, `check-noindex` 통과, `광고 영역`/`REPLACE_` 잔재 0
- [ ] 신고 1건 제출 → 증거 스냅샷 생성 → 어드민 큐 표시 → 판정 → 통보까지 수동 QA 1회
- [ ] 사진 업로드 → 검수 승인 → L3 승격 → 데이팅 모드 전환 수동 QA 1회
- [ ] 마스킹(전화번호) 동작·차단 시 양방향 비가시 수동 QA(A2 P4 시나리오)
- [ ] 07:00 배치 1회 성공 로그 + 온디맨드 폴백 확인
- [ ] `DEPLOY_LOG.md` 작성, `.env.example` 최신, 비밀값 커밋 0(git history grep)
- [ ] 게임/결제/Capacitor 코드 0줄 (`packages/game-engine`는 스텁만)

### Phase 2 → 3
- [ ] 궁합 카드·취향 배틀·스트릭/퀘스트 운영 2주, 죄책감 카피 리뷰 통과, 푸시 일 2건 상한 로그 검증
- [ ] D1 ≥ 40% / D7 ≥ 20% 2주 연속, 루프 완주율 ≥ 50%
- [ ] 여성 비율 ≥ 35% 또는 남성 웨이팅(F-057) 가동
- [ ] 사업자 정보·통신판매업 번호 입력 완료(플레이스홀더 0) — 결제 전제

### Phase 3 → 4
- [ ] Toss 실결제·환불 각 1건 E2E, `compute_refund` 단위 테스트(A4 §6.2 예시 3건) 통과
- [ ] 해지 2탭·자동갱신 고지·갱신 D-7 알림 QA, 다크패턴 목록 16항 리뷰 통과
- [ ] `ENTITLEMENTS` 서버 체크 포인트 8곳 테스트, 무료 티어 감점 항목 0 코드 리뷰

### Phase 4 → 5
- [ ] 포트원 실인증 연동 + allowlist 폐기 + 미성년 인증 케이스 테스트
- [ ] 스토어 심사 통과(17+/19+), FCM/APNs 슬롯 규칙 동일 동작, 앱 내 환불 경로 안내
- [ ] 공개 런칭 조건: 시드 500명·성비 5:5 목표·안전 페이지 SLA 도식 게시

### Phase 5 완료
- [ ] 취미 위키 30개 인덱싱 확인, 이벤트 3주 운영(정원 ≤ 8·운영팀 호스트), 랭킹에 좋아요 수 미포함 검증

---

부록 A. Phase 1 라우트 맵: `/`(랜딩) · `/legal/*` · `/onboarding/{age,phone,basic,hobbies,quiz,card}` · `/verify` · `/home` · `/reco` · `/match/[id]` · `/chat` · `/chat/[matchId]` · `/me` · `/me/edit` · `/me/photos` · `/settings/{notifications,blocks,mode,account}` · `/report/new` · `/appeal` · `/suspended` · `/admin/{photos,reports,users}`.

부록 B. Phase 1 배치·크론 목록(D7): `reco_generate`(06:50 KST 일), `push_slot_a`(07:30), `push_slot_b`(19:30~21:00 유저별), `weekly_reset`(월 07:00), `purge_daily`(03:00: 탈퇴 유예 만료·증거 만료·age_blocked 30일·메시지 90일·인증 기록 1년), `sla_watch`(10분 간격: due_at 초과 알림).
