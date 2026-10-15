# share-kit — 서버 없는 공유·바이럴 엔진

`templates/share-kit.js` 는 **백엔드 없이 "링크 = 결과"** 를 구현하는 자기완결 모듈이다.
외부 의존 0(라이브러리·CDN·API 키 없음). 각 앱의 `<script>` 최상단에 **그대로 붙여넣어** 쓴다.

> 왜 `<script src="/lib/share-kit.js">` 가 아닌가 — 이 저장소의 앱은 **단일 파일 완결형**이고,
> 나중에 앱별 도메인으로 떼어낼 예정이라 엔진이 파일 안에 함께 따라가야 한다.

---

## 1. 상태는 전부 URL

```js
const url = SK.stateUrl({ v: 1, a: ["민수", [3,1,4,1,5]] });
// → https://tomatoeggcat.com/chemi-link/?d=1eyJ2IjoxLCJhIjpb...
const state = SK.readState();   // 로드 시 ?d 파싱 (없거나 손상되면 null)
SK.writeState(state);           // history.replaceState — 뒤로가기 오염 없음
SK.clearState();                // ?d 제거
```

* 인코딩은 **UTF-8 안전 base64url**. 접두 `1` = 무압축, `2` = LZW 압축(긴 한글 본문에서 2~3배 절약).
  `SK.enc()` 가 둘 중 짧은 쪽을 자동 선택하고, `SK.dec()` 는 둘 다 읽는다.
* 손상·위조된 값은 예외를 던지지 않고 **`null`** 을 돌려준다. 호출부는 항상 스키마를 검증할 것.

### 상태 스키마 규칙 (URL 길이 = 전송률)

| 규칙 | 예 |
| --- | --- |
| 객체 키 반복 금지 → **배열 튜플** | `{v:1,a:["민수",[3,1,4]]}` (O) / `{version:1,me:{nick:"민수",answers:[3,1,4]}}` (X) |
| 0/1 대량 상태는 **비트맵** | `SK.bitsToStr(bits)` / `SK.strToBits(str, n)` — 336비트 → 56자 |
| 개인정보는 **절대 금지** | 실명·전화·계좌·주민번호·이메일·생년월일 전체 값 금지. 닉네임(12자)만 |
| 용량 가드 | `SK.sizeOf(obj)` → `{bytes, warn(>8KB), ok(<=12KB)}`. `warn` 이면 UI로 알리고, `!ok` 면 차단 |

### 링크 체인 (서버 없는 다자 합산)

A가 만든 링크를 B가 열고 답하면, B의 데이터를 **덧붙여** 새 링크를 만든다.

```js
const r = SK.appendChain(state.r, ["영희", 8], 20);   // 최대 20명
if (!r.ok) return SK.toast("최대 20명까지 참여할 수 있어요");
const next = { ...state, r: r.list };
if (!SK.sizeOf(next).ok) return SK.toast("링크가 너무 길어졌어요");
```

---

## 2. 결정론 (데일리·운세)

```js
SK.kstYMD()                  // KST 기준 20260819
SK.kstDayIndex(20260901)     // 기준일로부터 며칠째 → 데일리 회차 번호
SK.dailySeed("word")         // KST 자정에 바뀌는 시드
const rnd = SK.prng(seed);   // mulberry32
SK.shuffle(rnd, arr); SK.pick(rnd, arr);
SK.countdownToKstMidnight(); // {h,m,s,ms}
```

**KST 기준이 핵심.** 사용자의 기기 시계가 어느 타임존이든 한국 자정에 정답이 바뀐다.
데일리 게임의 정답 스케줄은 시드가 아니라 **미리 섞어 둔 정적 배열 + `kstDayIndex`** 로 정한다
(시드 방식은 배열이 바뀌면 과거 회차가 흔들린다).

---

## 3. 공유 UI

```js
SK.copy(text).then(ok => ok && SK.toast("링크를 복사했어요. 카톡·인스타에 붙여넣으세요"));
SK.share({ title, text, url });        // navigator.share → 없으면 복사 폴백
location.href = SK.xUrl(text, url);    // X(트위터)
SK.emojiGrid(rows, "한글데일리 #123 4/6");
```

## 4. 결과 카드(PNG)

```js
const { cv, ctx, W, H, font } = SK.card("story");   // "story" 1080×1920 · "square" 1080×1080 · "card" 1080×1350
ctx.font = "800 64px " + font;
SK.wrapText(ctx, 문구, 80, 400, W - 160, 84, 3);    // 한글 공백 없는 줄도 글자 단위 재분할
SK.roundRect(ctx, 60, 300, W - 120, 500, 36); ctx.fill();
SK.watermark(ctx, W, H, "tomatoeggcat.com/chemi-link");
SK.sharePng(cv, "chemi-link.png", "케미 테스트");    // navigator.share(files) → 폴백 다운로드
```

폰트는 **시스템 폰트만** 사용한다(웹폰트 로드 = 외부 의존). 이모지는 시스템 폴백에 맡긴다.

---

## 5. 앱 작성 규칙 (모든 공유·바이럴 앱 공통)

1. `/<slug>/index.html` **단일 파일**. 외부 스크립트는 애드센스뿐. 백엔드·API 키 없음.
2. VIRAL 5요소를 모두 구현: ① `?d=` URL 상태 ② 공유 유입 시 "나도 해보기" CTA
   ③ 캔버스 PNG 카드 + `tomatoeggcat.com/<slug>` 워터마크 ④ 링크·텍스트·X·`navigator.share`
   ⑤ 리믹스(이전 입력 프리필 재생성).
3. 광고는 **결과 하단 1개**만. 입력 화면 광고 금지. `광고 영역` 같은 플레이스홀더 텍스트 금지.
4. 고유 `title`/`description`, 고유 본문(소개·사용법·FAQ 2,500자 이상),
   JSON-LD 3종(`SoftwareApplication` + `FAQPage` + `BreadcrumbList`).
5. 개인정보(실명·전화·주민번호·이메일·계좌) 수집 금지. 닉네임은 `SK.nick()` 으로 12자 정제.
6. 진단·의료·법률·금융 확정 표기 금지 → **"재미용" 고지 필수**. 타인 비하·외모 평가 금지.
   미성년 안전: 연애·신체·성적 문항 금지(연애운은 "인간관계운" 등으로 표기).
7. 저작권 콘텐츠(가사·시·유료 심리검사 문항) 복제 금지. 실존 인물·브랜드 금지. 문항은 자체 작성.
8. `gen-pages.mjs` 의 `BUILTINS` + `BUILTIN_CATS` 에 슬러그를 등록해야 허브·사이트맵에 반영되고
   생성기의 고아 정리에서 보호된다.

### 검증

```bash
node scripts/check-viral-app.mjs <slug>   # 품질 게이트(메타·JSON-LD·문법·VIRAL 5요소·광고·본문량)
node gen-pages.mjs                        # 경고 0 확인
```

---

## 6. 다른 프로젝트(별도 도메인)로 옮길 때

앱은 도메인에 독립적이다. 옮길 때 바꿀 곳은 세 군데뿐이다.

1. `<link rel="canonical">` / `og:url` / JSON-LD `url` 의 호스트
2. 카드 워터마크 문자열(`SK.watermark` 인자)
3. 애드센스 퍼블리셔 ID(계정이 다를 경우)

`SK.stateUrl()` 은 `location.origin` 을 쓰므로 공유 링크는 자동으로 새 도메인을 따라간다.

---

## 7. 정적 스택의 한계 (정직한 고지)

* **결과별 동적 OG 이미지는 불가.** 서버(Satori/ImageResponse)가 없다. OG는 앱 단위 정적 이미지로 두고,
  결과 공유는 사용자가 저장·업로드하는 **캔버스 카드**로 대체한다.
* URL 상태는 **암호가 아니다.** 타임캡슐 본문처럼 "나중에 열림"을 다루는 앱은
  기술적으로 미리 열 수 있음을 FAQ에 정직히 밝히고, 민감한 비밀을 넣지 말라고 안내한다.
* 서버 레이트리밋·cron 자동 발행·DB가 필요한 기능은 이 스택에서 미구현이며 도입에는 소유자 승인이 필요하다.
