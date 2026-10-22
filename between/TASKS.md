# TASKS

## 완료

- [x] DB 스키마/RLS/뷰/RPC/Storage 마이그레이션 + 로컬 auth shim
- [x] 서버 계층 (db role switching, auth 2드라이버, storage 2드라이버, 이미지 정화, 레이트리밋, CSRF origin 검사)
- [x] Server Actions / Route Handlers / proxy(CSP nonce + Supabase 세션 갱신)
- [x] UI: 온보딩, 복구, 탐색(그리드/리스트, 필터 시트, 저장 필터, 무한 스크롤), 스와이프, 좋아요/매칭, 상세, 내 프로필, 수정, 차단 목록, 운영자, 법적 고지, PWA
- [x] 단위 62 + 통합 42 테스트, Playwright E2E (12단계 + 안전/보안)
- [x] 문서 (CLAUDE/README/ARCHITECTURE/DEPLOYMENT/PROGRESS)

## 남은 작업 (사용자 승인·외부 계정 필요)

- [ ] Supabase 프로젝트 생성·연결, `supabase db push`, Anonymous sign-ins + CAPTCHA 활성화
- [ ] Vercel 프로젝트 생성(root=between), 환경변수 등록, 배포, 공개 URL 검증
- [ ] 실제 개인정보 보호책임자 연락처(`src/lib/domain/legal.ts`), 국외이전 고지 구체화
- [ ] 실 본인인증(PASS 등) 연동 여부 결정 — 현재 성인 확인은 자기 신고

## 백로그 (개선)

- [ ] 키셋 페이지네이션 (현재 offset, 상한 2400)
- [ ] 신고 대상 사진 미리보기 및 사진 단위 제재 UI
- [ ] 이미지 유해성 자동 검사(외부 API·과금 필요)
- [ ] 웹 푸시(매칭 알림)
