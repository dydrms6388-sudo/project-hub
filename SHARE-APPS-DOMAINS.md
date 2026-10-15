# 공유·바이럴 앱 10종 — 도메인 분리 계획

지금은 **허브 서브경로**(`tomatoeggcat.com/<slug>/`)로 배포한다.
앱별 도메인은 나중에 지표를 보고 붙인다. 이 문서는 그때 그대로 따라 할 수 있는 절차다.

## 왜 지금 바로 도메인을 안 붙이나

새 도메인은 검색엔진 신뢰를 처음부터 쌓아야 하고, AdSense 승인·`ads.txt`·개인정보처리방침 페이지를
도메인마다 따로 갖춰야 한다. 반면 허브 서브경로는 기존 도메인 신뢰를 그대로 쓴다.
**Search Console·Vercel Analytics 숫자로 살아남는 앱을 먼저 가린 뒤**, 그 앱에만 도메인을 붙이는 편이 싸다.

## 지금 상태 (허브 서브경로)

| slug | 앱 | 도메인 후보 |
| --- | --- | --- |
| `chemi-link` | 케미 테스트 | chemi.kr / chemilink.kr |
| `aboutme-quiz` | 나를 맞혀봐 퀴즈 | aboutme.kr / namat.kr |
| `balance-vs` | 밸런스 게임 vs 친구 | balancevs.kr |
| `hanguldaily` | 한글데일리 | hanguldaily.kr |
| `nbbang-link` | N빵 정산 링크 | nbbang.link / nppang.kr |
| `when-link` | 약속 시간 잡기 | when.kr / eonje.kr |
| `fourcut-web` | 웹 인생네컷 | fourcut.kr |
| `fortune-daily` | 오늘의 운세 카드 | unse.kr / todayunse.kr |
| `timecapsule-link` | 미래에 열리는 편지 | timecapsule.kr |
| `yearwrap-kr` | 연말 결산 카드 | yearwrap.kr |

> 도메인 이름은 후보일 뿐이다. 구매 전 상표·유사 서비스 충돌을 확인할 것.

## 분리 절차 (앱 1개 기준)

앱은 단일 파일이고 외부 의존이 없다. 폴더 하나를 그대로 새 프로젝트의 루트로 쓰면 된다.

1. **Vercel 새 프로젝트** 생성 → 같은 저장소 연결 → **Root Directory = `<slug>`** 로 지정.
   빌드 명령 없음(정적), 출력 디렉터리 `.`. 허브의 `gen-pages.mjs` 파이프라인과 무관하게 돈다.
2. 도메인 연결 후 앱 파일에서 **호스트가 박힌 세 곳**을 새 도메인으로 바꾼다.
   - `<link rel="canonical">` / `og:url` / JSON-LD의 `url`
   - 캔버스 카드 워터마크 문자열(`SK.watermark(...)` 인자)
   - 애드센스 퍼블리셔 ID(계정을 나눌 경우에만)
   `SK.stateUrl()` 은 `location.origin` 을 쓰므로 **공유 링크는 자동으로 새 도메인을 따라간다.**
   이미 뿌려진 옛 링크(`tomatoeggcat.com/<slug>/?d=...`)도 3번의 리다이렉트로 살아난다.
3. **새 도메인 루트에 필요한 파일**: `ads.txt`(AdSense 필수), `robots.txt`, `sitemap.xml`,
   개인정보처리방침·이용약관 페이지. 허브 루트의 것을 복사해 도메인만 고친다.
4. **중복 콘텐츠 정리** — 같은 앱이 두 주소에 살아 있으면 검색에서 서로를 갉아먹는다. 둘 중 하나로:
   - (권장) 허브 경로 → 새 도메인 **301 리다이렉트**. 허브 `vercel.json` 의 `redirects` 에 추가.
   - 또는 허브 경로를 남기되 canonical 을 새 도메인으로 지정.
   `gen-pages.mjs` 가 `vercel.json` 을 매 배포마다 **재생성**하므로, 손으로 고치지 말고
   생성기 쪽(`rewrites`/`redirects` 를 만드는 부분)에 규칙을 추가해야 한다.
5. **허브에서 링크 유지** — `gen-pages.mjs` 의 `BUILTINS` 에서 슬러그를 빼지 말고,
   `projects.json` 의 외부 링크 방식(`live`)으로 옮겨 허브 카드가 새 도메인을 가리키게 한다.
   슬러그를 그냥 지우면 생성기의 고아 정리가 폴더를 삭제한다.
6. **Search Console + 네이버 서치어드바이저**에 새 도메인 등록, 사이트맵 제출, 소유확인 메타 주입
   (허브는 `site.config.mjs` / env 에서 주입 — 새 프로젝트는 파일에 직접 넣는다).

## 분리 전 확인 (앱마다)

- `node scripts/check-viral-app.mjs <slug>` 통과
- 실기기 왕복 테스트: 링크 생성 → 다른 기기에서 열기 → 결과 동일 재현
- 카톡 링크 미리보기(OG) 확인 — 결과별 동적 OG 는 서버가 없어 불가하고, 앱 단위 정적 OG 만 뜬다
- Lighthouse 모바일 80+ (단일 파일·외부 의존 0 이므로 대부분 통과)
- 라이브 시작일 기록 → 4주 뒤 유입 숫자로 도메인 투자 여부 판단

## 하지 않기로 한 것

- **결과별 동적 OG 이미지**(Satori/ImageResponse) — 서버가 필요하다. 캔버스 카드로 대체.
- **서버 레이트리밋·cron 자동 발행·DB** — 이 스택에 없다. 도입하려면 소유자 승인(과금)이 필요하다.
- **카카오 SDK** — 키 관리가 필요하고, 링크 복사 + `navigator.share` 로 충분하다.
