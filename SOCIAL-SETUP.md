# 카드뉴스 SNS 자동 게시 활성화 가이드 (Instagram · Facebook)

`news-cards.yml` 워크플로는 매일 KST 07:00 에 헤드라인 수집 → PNG 카드 렌더 →
사이트 배포까지 **자동으로 완료**됩니다. Instagram/Facebook 게시는 아래 시크릿
3개를 등록하는 순간 켜집니다 (없으면 게시 단계만 조용히 스킵).

## 0. 전제 조건
- **Facebook 페이지** 1개 (개인 프로필 아님)
- **Instagram 비즈니스/크리에이터 계정** 1개 — 프로필 설정에서 위 Facebook 페이지에 **연결**되어 있어야 함
- Meta 개발자 계정 (developers.facebook.com)

## 1. Meta 앱 만들기
1. https://developers.facebook.com → My Apps → **Create App** → 유형 "Business".
2. 앱 대시보드 → Add Product → **Instagram Graph API** 와 **Facebook Login for Business** 추가.

## 2. 액세스 토큰 발급 (장기 토큰)
1. https://developers.facebook.com/tools/explorer/ (Graph API Explorer) 접속.
2. 우측에서 방금 만든 앱 선택 → User Token 발급 시 아래 권한 체크:
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `instagram_basic`, `instagram_content_publish`, `business_management`
3. 발급된 **단기 사용자 토큰**을 장기(60일) 토큰으로 교환:
   ```
   https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token
     &client_id={앱ID}&client_secret={앱시크릿}&fb_exchange_token={단기토큰}
   ```
4. 장기 사용자 토큰으로 **페이지 토큰** 조회 (이 페이지 토큰은 만료 없음):
   ```
   https://graph.facebook.com/v21.0/me/accounts?access_token={장기사용자토큰}
   ```
   응답의 해당 페이지 항목에서 `access_token`(→ META_ACCESS_TOKEN)과 `id`(→ META_PAGE_ID)를 복사.

## 3. Instagram 계정 ID 조회
```
https://graph.facebook.com/v21.0/{META_PAGE_ID}?fields=instagram_business_account&access_token={META_ACCESS_TOKEN}
```
응답의 `instagram_business_account.id` → **META_IG_USER_ID**.

## 4. GitHub Secrets 등록
리포 → Settings → Secrets and variables → Actions → New repository secret:

| 이름 | 값 |
|---|---|
| `META_ACCESS_TOKEN` | 2-4에서 얻은 **페이지 액세스 토큰** |
| `META_PAGE_ID` | Facebook 페이지 ID |
| `META_IG_USER_ID` | Instagram 비즈니스 계정 ID |

## 5. 테스트
Actions 탭 → "Daily news cards" → **Run workflow** 수동 실행 → 로그에서
`✅ Instagram 캐러셀 게시` / `✅ Facebook 게시` 확인.

## 운영 메모
- 게시물: 커버 1장 + 헤드라인 카드 5장 캐러셀(IG), 커버+캡션(FB).
  캡션에 제목·출처 목록과 사이트 링크, 저작권 안내가 자동 포함됩니다.
- **저작권**: 카드에는 기사 "제목·출처"만 실립니다(본문·기사 이미지 미사용).
  제목은 저작물성이 인정되지 않는 영역이지만, 특정 언론사가 문제를 제기하면
  `scripts/fetch-news.mjs` 의 FEEDS 에서 해당사를 빼면 됩니다.
- IG API 제한: 계정당 24시간 내 게시 50회 — 일 1회 발행은 여유.
- 앱을 Live 모드로 전환해야 본인 외 계정에서도 보입니다(본인 계정 게시는 개발 모드로도 가능).
