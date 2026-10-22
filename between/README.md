# BETWEEN

한국형 성인 남성 소개팅·친구찾기 모바일 웹서비스 — 가입 없이 익명으로 시작, Grindr 식 탐색 + Tinder 식 스와이프 매칭 + 카카오톡 오픈채팅 중심 연락.

- **탐색**: 2열 사진 그리드/리스트, 지역·나이·키·체형·성향·스타일·목적·관심사·사진·최근활동·지금가능 필터, 저장 필터, 6가지 정렬
- **스와이프**: 터치 드래그/버튼/키보드, 되돌리기, 상호 좋아요 시 매칭
- **좋아요·매칭**: 매칭 / 받은 좋아요(바로 매칭) / 보낸 좋아요
- **외부 연락**: 카카오 오픈채팅·LINE·Instagram·Telegram·https 링크, 전체 공개 또는 매칭 상대만
- **지금 만나기**: 지금 가능(1~6시간 자동 해제)/오늘 저녁/이번 주말/일정 조율
- **안전**: 신고·차단, 신고 누적 자동 보류, 운영자 콘솔, 필드별 공개 설정, 숨김, 자동 만료, 완전 삭제, EXIF 제거

## 빠른 시작

```bash
cd between && npm install
cp .env.example .env.local
npm run db:reset && npm run db:seed   # 로컬 PostgreSQL 16 필요
npm run dev
```

자세한 내용: [CLAUDE.md](CLAUDE.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [DEPLOYMENT.md](DEPLOYMENT.md) · [PROGRESS.md](PROGRESS.md)
