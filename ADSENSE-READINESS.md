# 애드센스 재신청 준비 체크리스트 (roadmap #14)

승인 거절 원인 진단과 대응 결과, 재신청 전 사장님이 확인/실행할 항목.

## 1. 애드센스 코드 · ads.txt
- [x] 허브(`index.html`)에 애드센스 스크립트 + `google-adsense-account` 메타 삽입 (`ca-pub-5567719201265106`)
- [x] 전 서비스 랜딩(196개)에 동일 스크립트 삽입 — 누락 0건 확인
- [x] 루트 `ads.txt` = `google.com, pub-5567719201265106, DIRECT, f08c47fec0942fa0` (퍼블리셔ID 일치)
- [ ] (사장님) 배포 후 `https://tomatoeggcat.com/ads.txt` 200 응답·내용 확인, AdSense 콘솔의 ads.txt 경고 해제 확인

## 2. 접근성(크롤링·응답)
- [x] `robots.txt` = `Allow: /` — Googlebot/Mediapartners-Google(애드센스 봇) 차단 없음
- [x] `sitemap.xml` 자동 생성, about/privacy/terms/contact 포함
- [x] 정적 페이지라 200 응답(로컬 생성 확인)
- [ ] (사장님) 배포 후 Search Console에서 주요 URL "색인 생성됨"·"페이지를 가져올 수 있음" 확인, 404/리디렉션 없는지 점검
- [ ] (사장님) `site.config.mjs`의 `GOOGLE_SITE_VERIFICATION` 실제 코드로 교체(현재 `REPLACE_GOOGLE_CODE` 플레이스홀더 — 애드센스 승인 자체를 막진 않으나 소유확인/색인엔 필요)

## 3. 콘텐츠 품질 (핵심 — 거절 주원인: thin/doorway + "가치 낮은 콘텐츠")
- [x] **thin/doorway 탈피**: 모든 랜딩에 고유 본문 추가
- [x] **깊이 강화(v2)**: 소개 / 알아두면 좋은 배경지식 / 이렇게 사용하세요(단계) / 이럴 때 유용해요(활용 시나리오) / 활용 팁 / 주의사항 / 자주 묻는 질문(FAQ 4~6) — 페이지당 본문 대폭 확대
- [x] **복제/독창성**: 서비스별 개별 작성(`data/landing-content.json`, slug당). 관점·예시·표현이 서로 다르게. 자동생성 반복 문구·내부 은어 제거(생성기 sanitize)
- [x] **구조화 데이터**: FAQPage + BreadcrumbList JSON-LD
- [x] **면책**: 금융·세금·건강·법률·투자류에 참고용 면책 자동 삽입
- [x] **콘텐츠 정책 전수감사**: 196개 스캔(`data/policy-audit.json`) — 위험/주의 서비스는 건전·정보성 프레이밍으로 서술
- [ ] (사장님) 재신청 전 감사에서 flagged된 페이지 직접 확인 권장

## 4. 내비게이션 · 필수 페이지
- [x] 허브: 검색 + 카테고리 필터칩 + 추천 + 카드 그리드 + 내부링크(관련 서비스)
- [x] `about.html`(소개) 신규 추가
- [x] `privacy.html` / `terms.html` / `contact.html` 존재(광고·쿠키·제휴 고지 포함)
- [x] 전 페이지 푸터에서 소개·개인정보·약관·문의 링크

## 5. 종합 재신청 가능 상태
코드/콘텐츠 측면 준비 완료. 남은 것은 **배포**와 **사장님 직접 확인**:
1. `node gen-pages.mjs` 결과를 배포(Vercel). *현재 배포 인증 막힘 → 커밋만 완료, 사장님 배포 필요.*
2. 배포 후 라이브에서 무작위 5~10개 랜딩을 열어 본문·FAQ가 정상 노출되는지 육안 확인.
3. ads.txt / robots.txt / sitemap.xml 라이브 200 확인.
4. Search Console 색인 상태 확인(최소 며칠 크롤링 시간 필요).
5. AdSense 콘솔에서 **재검토(재신청)** 요청.

> 참고: 애드센스는 재신청 후에도 수일~2주 걸릴 수 있음. 색인이 어느 정도 쌓인 뒤 신청하는 편이 유리.
