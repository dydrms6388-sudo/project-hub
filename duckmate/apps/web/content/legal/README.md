# `apps/web/content/legal/` — 법적 문서 원본

이 폴더의 마크다운 6개가 `apps/web`(`/legal/<slug>`)과 `apps/company`(법적 고지 페이지) 양쪽에서 렌더되는 **단일 원본**이다. 문서를 고칠 때는 이 파일만 고치고, 렌더 코드나 company 앱에 사본을 두지 않는다.

| 파일 | slug | 가입 시 동의 | 비고 |
|---|---|---|---|
| `terms.md` | `terms` | 필수 | 이용약관 |
| `privacy.md` | `privacy` | 필수 | 개인정보처리방침 |
| `youth-policy.md` | `youth-policy` | 필수 | 청소년보호정책 (PRD 라우트 `/legal/youth`는 이 slug로 별칭 처리) |
| `location.md` | `location` | 게시만 | 단말 위치정보 미수집 전제. GPS 도입 시 별도 동의 항목으로 승격 |
| `community-guidelines.md` | `community-guidelines` | 게시만 | 첫 매칭 안전 모달·신고 화면에서 링크 |
| `refund-policy.md` | `refund-policy` | 게시만 | 결제 화면·환불 요청 화면에서 링크 (Phase 3) |

`/legal/business`(사업자·통신판매업 정보 페이지)는 마크다운 없이 `company.ts` 값을 직접 렌더한다.

## Frontmatter

```yaml
title: "이용약관"            # 페이지 제목
slug: "terms"                # 라우트 및 consents.doc_slug 값
version: "1.0.0"             # semver. 아래 버전 규칙 참조
effective_date: "{{EFFECTIVE_DATE}}"   # 시행일. 변수 또는 YYYY-MM-DD
last_updated: "2026-09-02"   # 마지막 편집일 (YYYY-MM-DD)
consent_required: true       # 가입 시 동의 체크 대상 여부
```

## 변수 (`{{UPPER_SNAKE}}`)

- 문서 안의 값은 전부 `{{UPPER_SNAKE}}` 형식의 변수만 쓴다. `[TODO_...]`·하드코딩 값 금지.
- **단일 소스는 `apps/web/config/company.ts`** (E4 구현). 렌더 시 `{{KEY}}` → `company[KEY]` 치환. `apps/company`는 같은 모듈을 import(또는 빌드 시 복사)한다.
- 값이 비어 있으면 치환하지 않고 `{{KEY}}`를 **그대로 노출**하며 빌드 경고를 낸다(`scripts/check-legal-placeholders.mjs`, 차단 X). `COMPANY_NAME`·`ECOMMERCE_REG_NUMBER`가 비어 있으면 `PAYMENTS_ENABLED`는 강제 false.
- 알 수 없는 변수(아래 표에 없는 키)가 문서에 있으면 같은 스크립트가 경고한다.

| 키 | 의미 | 예시 | 사용 문서 |
|---|---|---|---|
| `COMPANY_NAME` | 법인/사업자 상호 | 주식회사 덕메이트 | 전체 |
| `SERVICE_NAME` | 서비스명 (기본값 `덕메이트`) | 덕메이트 | 전체 |
| `DOMAIN` | 서비스 도메인 (scheme 없이) | duckmate.kr | terms, privacy |
| `BUSINESS_NUMBER` | 사업자등록번호 | 123-45-67890 | terms, privacy, refund-policy |
| `ECOMMERCE_REG_NUMBER` | 통신판매업 신고번호 | 2026-서울마포-1234 | terms, privacy, refund-policy |
| `ADDRESS` | 사업장 주소 | 서울특별시 마포구 … | 전체 |
| `CEO_NAME` | 대표자 성명 | 홍길동 | 전체 |
| `CONTACT_EMAIL` | 고객센터 이메일 | help@duckmate.kr | 전체 |
| `CONTACT_PHONE` | 고객센터 전화 | 02-000-0000 | 전체 |
| `EFFECTIVE_DATE` | 문서 시행일 (문서별로 다를 수 있음 → 문서별 override 허용) | 2026-10-01 | 전체 |
| `PRIVACY_OFFICER_NAME` | 개인정보보호책임자 성명 | 홍길동 | privacy |
| `PRIVACY_OFFICER_EMAIL` | 개인정보보호책임자 이메일 | privacy@duckmate.kr | privacy |
| `PRIVACY_OFFICER_PHONE` | 개인정보보호책임자 전화 | 02-000-0001 | privacy |
| `LOCATION_OFFICER_NAME` | 위치정보 관리책임자 성명 (개인정보보호책임자 겸임 가능) | 홍길동 | location |
| `LOCATION_OFFICER_EMAIL` | 위치정보 관리책임자 이메일 | privacy@duckmate.kr | location |
| `YOUTH_OFFICER_NAME` | 청소년보호책임자 성명 | 홍길동 | youth-policy |
| `YOUTH_OFFICER_EMAIL` | 청소년보호책임자 이메일 | youth@duckmate.kr | youth-policy |
| `SUPABASE_REGION` | Supabase 프로젝트 리전 (국외이전 표) | ap-northeast-2 (대한민국 서울) | privacy |

`company.ts` 예상 형태(E4가 확정): `export const company = { COMPANY_NAME: "", SERVICE_NAME: "덕메이트", ... } as const satisfies Record<LegalVar, string>`. 키 이름은 위 표와 **정확히 일치**해야 한다.

> PRD §0-27의 `{{BIZ_NO}}`·`{{ECOM_NO}}`·`{{PRIVACY_OFFICER}}` 표기는 이 표의 `BUSINESS_NUMBER`·`ECOMMERCE_REG_NUMBER`·`PRIVACY_OFFICER_NAME`으로 대체한다.

## 문서 버전 관리 규칙

`version`은 semver(`MAJOR.MINOR.PATCH`). 문서를 수정하는 PR은 반드시 아래 4가지를 함께 바꾼다: `version`, `last_updated`, 문서 하단 **변경 이력** 표 행 추가, (시행일이 바뀌면) `effective_date`.

| 변경 종류 | bump | 사전 고지 | 기존 회원 재동의 (`consents`) |
|---|---|---|---|
| 오탈자·서식·변수값 치환·링크 수정 (의미 불변) | PATCH | 없음 | 불필요 |
| 조항 명확화, 회원에게 **유리한** 변경 (보유기간 단축, 환불 조건 완화, 금지행위 완화, 연락처 변경) | MINOR | 7일 전 공지 | 불필요 (홈 배너 1회 선택) |
| 회원에게 **불리한** 변경 (혜택 축소, 보유기간 연장, 금지행위·제재 강화, 관할 변경, 면책 확대) | MAJOR | **30일 전** 공지 + 개별 통지 | **필요** — 재동의 배너, 미동의 시 서비스 이용 전 재동의 화면 |
| 개인정보 수집 항목·목적 확대, 제3자 제공·국외이전 신설, 위치정보 수집 신설 | MAJOR | 30일 전 공지 + 개별 통지 | **필요** — 명시적 동의(체크박스), 거부 시 해당 기능 또는 서비스 이용 불가 |
| 새 필수 동의 문서 추가 (`consent_required: true` 신설) | 새 문서 1.0.0 | 30일 전 공지 | **필요** |

- 재동의 필요 여부는 **MAJOR bump = 필요, 그 외 = 불필요**로 코드가 판단한다. 즉 `consents` 테이블은 `(user_id, doc_slug, version)`을 저장하고, 로그인 시 `consent_required: true` 문서 각각에 대해 `major(consented.version) < major(current.version)`이면 재동의 화면을 띄운다 (D1·E4). 이 규칙 때문에 **불리한 변경을 MINOR로 올리면 안 된다.**
- 시행일 전에는 현행 버전과 개정 예정 버전을 **둘 다** 게시한다(약관규제법·표준약관 관행). 렌더는 `effective_date > 오늘`이면 "개정 예정" 배지와 현행 버전 링크를 함께 보여준다. 구현 편의상 개정 예정본은 `terms.next.md`처럼 `.next.md` 접미사로 두고 시행일에 rename한다.
- 이전 버전은 git 이력으로 보존하며, 개인정보처리방침은 법령상 이전 버전 열람이 가능해야 하므로 변경 이력 표에 git 태그(`legal/privacy@1.0.0`)를 함께 적는다.
- `(변호사 검토)` 표시가 남아 있는 조항은 변호사 검토 후 표시를 제거하는 PATCH 커밋으로 정리한다. 배포 차단 조건은 아니다.
