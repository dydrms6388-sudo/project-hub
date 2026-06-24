# Phase 2 — 각 서비스 앱을 tomatoeggcat.com/&lt;slug&gt;/ 에서 직접 서빙

목표: 데일리 앱을 `*.vercel.app` 링크아웃이 아니라 **apex(tomatoeggcat.com/&lt;slug&gt;/)에서 네이티브 서빙** → SEO 권위를 한 도메인에 통합.

## 핵심 제약 (왜 단순 rewrite로 안 되나)
Next.js 앱은 자산을 **절대경로 `/_next/...`** 로 참조한다. project-hub에서 `/&lt;slug&gt;/:path*` → `app.vercel.app/:path*` 로만 프록시(A안 단독)하면, 브라우저는 자산을 `tomatoeggcat.com/_next/...`(slug 없는 루트)로 요청 → **앱마다 `/_next`가 충돌**하고 404. 즉 A안 단독은 깨진다.

## 결정: 하이브리드 B+A (앱별 basePath + 허브 rewrite)
| 단계 | 내용 |
|---|---|
| 1. 앱 설정 | 각 앱 `next.config`에 `basePath:"/<slug>"` + `assetPrefix:"/<slug>"` 추가 → 자산이 **`/<slug>/_next/...`로 네임스페이스화**(충돌 제거) |
| 2. 앱 재배포 | `npx vercel --prod`(또는 git push 자동배포). 이후 `app.vercel.app/`는 `/<slug>`로 리다이렉트 |
| 3. 허브 rewrite | project-hub `vercel.json`: `"/<slug>/:path*"` → `"https://<app>.vercel.app/<slug>/:path*"` (+ bare `/<slug>`) |
| 4. 랜딩 제거 | project-hub의 정적 랜딩 `/<slug>/index.html` **삭제**(파일이 있으면 rewrite보다 우선되어 앱이 안 뜸). gen-pages는 apex-서빙 slug를 **랜딩 생성 스킵** |
| 5. 중복 차단 | 앱 `*.vercel.app`에 `X-Robots-Tag: noindex` + `<link rel=canonical href=apex/<slug>/>` → apex만 색인 |

### 앱 유형별 최적안
- **Next.js (app/pages router)** — 대다수. 위 B+A 그대로. `<Link>`는 basePath 자동 prefix되지만, **raw `<a href="/...">`·`fetch("/api/...")`·`<img src="/...">` 절대경로는 깨질 수 있음** → 앱별 점검 필요(상대경로나 basePath 접두 필요).
- **r3f / three.js (여전히 Next.js)** — 동일 B+A. WebGL 텍스처·워커·동적 import 자산이 `/<slug>/_next` 아래로 가는지 라이브 검증(하드케이스).
- **순수 정적 HTML** — rewrite 대신 **project-hub로 직접 복사**(`/<slug>/`에 정적 파일, 상대경로화)가 가장 견고. rewrite 불필요.

## 프로토타입(대량 전 실증)
- 1차: **dalian-weekend** (Next + r3f, 하드케이스) — basePath 적용 → 재배포 → 허브 rewrite → `tomatoeggcat.com/dalian-weekend/` 화면·자산·기능 라이브 검증.
- 통과 시 2~3개 추가(단순 Next 1 + 정적 1)로 유형 커버.

## 롤아웃 계획 (프로토타입 성공 시)
1. **유형 분류**: 130개를 Next(app/pages) / r3f / 정적으로 분류(레포 스캔).
2. **웨이브(8~10개씩)**: 유형별 일괄 스크립트 —
   - (a) next.config에 basePath/assetPrefix 주입(멱등), (b) 앱 빌드·배포, (c) 빌드 성공·`app.vercel.app/<slug>/` 200 확인,
   - (d) 검증 통과만 project-hub `vercel.json` rewrite 추가 + 정적 랜딩 제거 + gen-pages skip-list 등록,
   - (e) 허브 1회 배포, (f) `tomatoeggcat.com/<slug>/` 200 + 자산 로드 검증.
3. **게이트**: apex에서 깨지는 앱(절대경로·라우팅 문제)은 롤백(landing 유지) 후 "막힌 앱" 목록에 기록 → 개별 수정.
4. **skip-list**: gen-pages.mjs에 `APEX_SERVED` 집합 → 해당 slug는 랜딩 대신 rewrite 유지, sitemap은 동일 URL(apex)이라 변동 없음.

## 제약 준수
유료 서드파티 API 호출 금지(구독 기능만), Vercel 배포 OK, 비밀번호/계정생성 금지.

## 리스크
- 앱 내 절대경로 자산/링크/fetch → basePath 미반영 시 깨짐(유형별 점검·롤백 게이트로 흡수).
- 외부 URL rewrite=프록시: Host/쿠키/CSP 차이(무상태 도구앱은 영향 적음), 프록시 비용·지연 소폭.
- 130개 앱 재배포 = 시간·빌드 비용(웨이브로 분산).
