# 배포 전 체크리스트 — TomatoEggCat (`project-hub` 정적 프론트)

> 대상: `tomatoeggcat.com` 정적 허브 + 랜딩 + 내장 9개 도구.
> `auth-hub`(결제 백엔드)는 **이번 라운드 범위 밖**이며 별도 배포·감사 대상(하단 "알려진 한계" 참고).

---

## 1. 배포 전 반드시 설정할 환경변수 (이름·용도만 — 값은 소유자가 직접 입력, 커밋 금지)

### 1-1. GitHub Actions 배포용 (리포 → Settings → Secrets and variables → Actions)
| 이름 | 용도 |
|---|---|
| `VERCEL_TOKEN` | Vercel CLI 배포 인증 토큰 (없으면 배포 스텝이 조용히 스킵됨) |
| `VERCEL_ORG_ID` | Vercel 팀/계정 ID |
| `VERCEL_PROJECT_ID` | Vercel 프로젝트 ID |
| `GOOGLE_SITE_VERIFICATION` | (선택) Search Console 소유확인 코드. 설정 시에만 `<meta>` 방출 |
| `NAVER_SITE_VERIFICATION` | (선택) 네이버 서치어드바이저 소유확인 코드 |

> 소유확인 코드를 **설정하지 않으면 검증 메타는 아예 생성되지 않는다**(가짜 `REPLACE_` 플레이스홀더가 더 이상 배포되지 않음). 색인/소유확인이 필요할 때 값만 넣고 재배포하면 전 페이지에 자동 반영된다. 값은 영숫자·`_`·`-`만 허용(방어적 검증).

### 1-2. Vercel 네이티브 Git 연동으로 배포하는 경우
- `vercel.json`에 `"buildCommand": "node gen-pages.mjs"`가 이미 포함되어 있어 **네이티브 경로도 매 배포 시 산출물을 재생성**한다. 별도 설정 불필요.
- 소유확인 코드를 쓰려면 Vercel 프로젝트 → Settings → Environment Variables에 `GOOGLE_SITE_VERIFICATION` / `NAVER_SITE_VERIFICATION`를 추가.
- ⚠️ **배포 경로를 하나로 통일 권장**: GitHub Actions 배포와 Vercel 네이티브 자동배포가 **둘 다 켜져 있으면** 같은 push에 두 배포가 경합해 최종 prod alias가 비결정적일 수 있다. 하나만 활성화할 것.

---

## 2. 배포 후 즉시 확인할 스모크 테스트

- [ ] `https://tomatoeggcat.com/` — 허브 로드, 도구 카드 그리드·검색·카테고리 칩·라이트/다크 토글 동작. 히어로 도구 수가 최신(`projects.json` 기준)인지 확인.
- [ ] 허브 검색창에 "연봉"/"대출" 입력 → 해당 카드만 필터링, 없는 키워드 입력 → "검색 결과가 없어요" 빈 상태 표시.
- [ ] 내장 9개 도구 각 1개씩 실제 계산 확인: `/salary/` `/dsr/` `/jeonse-loan/` `/yangdo/` `/refinance/` `/age/` `/dday/` `/bmi/` `/pyeong/` — 입력→결과 정상, 빈 입력 시 경고.
- [ ] **어느 페이지에도 "광고 영역" 플레이스홀더 텍스트나 `REPLACE_GOOGLE_CODE`가 보이지 않는지** (뷰소스로 확인).
- [ ] 랜딩 무작위 5~10개(예 `/animal-face-test/` `/salary-net-pay/` `/bmr-tdee-calc/`) 열어 본문·FAQ 정상 노출, "바로 실행하기 →" CTA가 외부 앱으로 이동하는지 확인.
- [ ] **CTA가 향하는 외부 `*.vercel.app` 앱이 실제로 살아있는지** 표본 확인(하단 한계 참고 — 최대 리스크).
- [ ] `https://tomatoeggcat.com/ads.txt` 200 + 퍼블리셔ID 일치, `/robots.txt` 200, `/sitemap.xml` 200·URL 최신.
- [ ] `about.html` / `privacy.html` / `terms.html` / `contact.html` 접근 가능, 푸터 링크 동작.
- [ ] 모바일(실기기 또는 좁은 뷰포트)에서 허브·랜딩·내장도구 1단 레이아웃·터치 타깃 정상.

---

## 3. 알려진 한계 · 미해결 이슈

1. **핵심 여정이 저장소 경계에서 끊긴다 (최대 리스크).** 랜딩 ~209개의 "바로 실행하기"는 이 repo 밖 외부 `*.vercel.app` 배포로 나간다. 그 앱들이 죽으면 "동작하는 척하는 죽은 도구"가 된다. → 외부 앱 헬스체크(별도 모니터링)를 권장.
2. **광고 수익은 AdSense 승인 + Auto Ads에 전적으로 의존.** 페이지에 수동 `<ins>` 광고 유닛은 없다(head 스크립트 + account 메타만). 승인 전/Auto Ads 미설정 시 광고는 렌더되지 않는다(정상).
3. **콘텐츠 정책 flagged 14건** (`data/policy-audit.json`) — 성인/중독 소재 등 브랜드 안전 리스크. 애드센스 재신청 전 소유자 직접 검토 권장.
4. **커밋된 산출물은 stale일 수 있다.** 커밋된 랜딩·허브 HTML은 `projects.json`과 어긋날 수 있으며(예: 허브가 과거 도구 수를 표기), **배포 시 `gen-pages.mjs` 재생성으로 정합화**된다. 커밋본을 직접 열어 보고 판단하지 말 것 — 배포본이 진실.
5. **소유확인 코드 미설정 시** Search Console/네이버 소유확인·색인이 진행되지 않는다(사이트 동작에는 무해).
6. **`.omc/` 세션 로그가 git 히스토리에는 남아 있다**(이번에 추적만 해제). 스캔상 실 시크릿·PII는 없었으나, 리포를 **공개**할 계획이면 히스토리 퍼지(`git filter-repo --path .omc --invert-paths`) 권장.
7. **`auth-hub` 결제 백엔드는 미배포·미연동 상태이며 심각 취약점 4건 미수정**(크레딧 이중지불·IAP 권한상승·모바일토큰 오픈리다이렉트·Toss 웹훅 무인증). **배포하려면 반드시 별도 보안 수정 후** 진행할 것. 정적 프론트는 이 백엔드를 호출하지 않는다.
8. **소스 파일이 루트에서 공개 서빙된다.** `outputDirectory: "."`라 `gen-pages.mjs`·`lib/*.mjs`·`projects.json` 등이 `https://tomatoeggcat.com/projects.json` 처럼 직접 fetch된다. 시크릿은 없으나 `projects.json`의 `desc`에는 **내부 마케팅 메모(수익화·키워드 등)**가 담겨 있어 노출된다(사용자 페이지는 생성기 `sanitize()`로 정제되지만 원본 JSON은 아님). 민감하다면 소스를 별도 빌드 출력 폴더로 분리하거나 Vercel에서 해당 경로 접근을 차단할 것(빌드 입력이라 `.vercelignore`로는 못 막음 — 구조 변경 필요, 이번 라운드 범위 밖).
9. **배포 산출물 회귀 가드**: `gen-pages.mjs`는 생성 후 전 페이지를 스캔해 `REPLACE_`/`광고 영역` 잔재가 있으면 배포 로그에 `⚠️` 경고를 남긴다(비차단). CI 로그에서 이 경고가 보이면 배포 전 확인할 것.

---

## 4. 롤백 방법

- **Vercel 대시보드**: Project → Deployments → 직전 정상 배포 → **"Promote to Production"** (즉시 이전 배포로 alias 전환). 가장 빠름.
- **Git 되돌리기**: 문제 커밋 확인 후
  ```
  git revert <bad_sha>      # 또는 git revert d843975
  git push origin master
  ```
  → master push가 배포 워크플로를 재실행해 이전 상태 재배포.
- **부분 롤백**(이번 품질 변경만 되돌리기): `git revert d843975 2c518f8` (광고/검증 메타 정리 + `.omc` 추적해제 되돌림). 단 계산 로직·projects.json은 이 커밋들이 건드리지 않았으므로 영향 없음.
- 롤백 후 스모크 테스트(2절) 재실행.
