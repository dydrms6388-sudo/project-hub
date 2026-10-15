# share-kit — 공유·바이럴 앱 공통 엔진

`lib/share-kit.js` 하나짜리 브라우저 스크립트. 빌드·번들러·npm 의존성이 없다.
"서버 없이 링크 하나로 결과와 체인을 주고받는" 정적 앱을 만들 때 반복되는 부분을 모았다.

```html
<script src="/lib/share-kit.js"></script>
```

전역 `SK` 가 생긴다. 같은 오리진 정적 파일이므로 CLAUDE.md 의 "백엔드·외부 API·키 금지"
원칙은 그대로 지켜진다. (앱 폴더 밖의 유일한 공유 자산이라 `단일 파일 완결형` 규칙의 예외다.
share-kit 을 고칠 때는 이미 쓰고 있는 앱들이 함께 깨질 수 있으니 아래 테스트를 반드시 돌린다.)

```
node scripts/test-share-kit.mjs
```

---

## 1. 상태 = URL

결과·체인은 전부 쿼리 파라미터 `?d=` 에 담는다. 해시(`#`)가 아니라 쿼리를 쓰는 이유는
링크 미리보기·색인 도구가 해시를 읽지 못하기 때문이다. 기존 앱이 쓰던 `?r=` 도 읽어준다.

```js
const enc = SK.encode({ m: "friend", v: 1, a: { n: "토마토", s: "31425..." } });
const url = SK.link(enc);        // https://tomatoeggcat.com/chemi-link/?d=...
SK.writeState(enc);              // history.replaceState — 뒤로가기 오염 없음
const st = SK.readState(isValid); // ?d= 파싱 + 검증. 실패하면 null
```

인코딩은 `JSON → UTF-8 → (LZSS 압축이 이득일 때만) → base64url` 이다.
선두 1바이트가 포맷 플래그(0=원본, 1=압축)라서 짧은 상태가 압축 때문에 길어지는 일이 없다.

### 스키마 검증

`SK.decode(str, validate)` 의 `validate` 는 불리언을 돌려주는 함수다. 남이 만든 URL이
그대로 들어오는 자리이므로 **길이·범위·타입을 전부 확인**하고, 통과하지 못하면 무시한다.

```js
const ok = (o) => o && o.v === 1 && MODES[o.m]
  && o.a && typeof o.a.s === "string" && o.a.s.length === 30 && /^[1-5]{30}$/.test(o.a.s);
```

### 크기 한도

```js
const info = SK.sizeInfo(enc);   // { bytes, warn, block }
```

8KB 초과 → 경고 UI(카톡·문자에서 링크가 잘릴 수 있음), 12KB 초과 → 링크를 만들지 않는다.
수치는 정수로, 반복되는 키는 짧게(`{n,s}`) 두면 대부분 1KB 안쪽에서 끝난다.

### 절대 넣지 않는 것

전화번호·계좌번호·주민번호·이메일·실명. 상태는 링크를 받은 누구나 디코딩할 수 있다.
닉네임은 `SK.nick(v)` 로 12자 절단 + 제어문자·꺾쇠 제거를 거친다.

---

## 2. 링크 체인

A가 만든 링크를 B가 열어 답하면, B의 데이터를 `d` 에 덧붙여 새 링크를 만든다.
서버 없이 다자 결과를 합산하는 방식이다.

```js
const r = SK.appendChain(state.r, { n: nick, score }, 20);
if (!r.ok) SK.toast(r.reason === "full" ? "20명까지만 담을 수 있어요" : "링크가 너무 길어졌어요");
else state.r = r.list;
```

정원(기본 20)과 12KB 한도를 함께 본다. 거부되면 원래 목록을 그대로 돌려주므로
호출 쪽에서 상태가 깨지지 않는다.

---

## 3. 공유

```js
SK.mountShareBar(el, {
  title: "케미링크",
  url:  () => SK.link(enc),
  text: () => "우리 케미 78%\n" + SK.link(enc),
  onSave: () => SK.download(drawCard(), "케미링크"),
  buttons: ["link", "text", "x", "share", "save"],   // 기본값
});
```

버튼은 `.sk-share-btn` 클래스를 달고 나오므로 앱 CSS에서 스타일을 준다.
`SK.share({title,text,url,file})` 는 `navigator.share` 를 쓰고, 미지원이면 텍스트 복사로 폴백한다.
`file` 에 PNG Blob(`SK.toBlob(canvas)`)을 주면 지원 기기에서 이미지가 직접 공유된다.

---

## 4. 결과 카드

정적 스택에는 **결과별 동적 OG 이미지가 없다**(Satori/ImageResponse 는 서버가 필요).
대신 사용자가 저장해서 올리는 캔버스 카드를 제공한다. OG 는 앱 단위 고정 이미지만 존재한다.

```js
const cv = SK.card("feed", (x, w, h) => {      // square 1080² / story 1080×1920 / feed 1080×1350
  x.fillStyle = "#4c1d95"; x.fillRect(0, 0, w, h);
  x.fillStyle = "#fff"; x.font = "900 92px sans-serif";
  SK.wrapText(x, name, 88, 300, w - 176, 100, 2);   // 글자 단위 줄바꿈(한글용), 최대 2줄
  SK.roundRect(x, 88, 400, 300, 80, 24); x.fill();
  SK.watermark(x, w, h, "chemi-link");              // 워터마크는 모든 카드에 필수
});
SK.download(cv, "케미링크_결과");
```

---

## 5. 데일리 게임용 시드

```js
SK.kstKey()                  // 20260819 (Asia/Seoul 기준 YYYYMMDD)
SK.dailySeed(new Date(), "word")  // KST 자정에 바뀌는 결정론적 시드
const rand = SK.prng(seed);  // mulberry32
SK.msToKstMidnight()         // 다음 자정까지 남은 ms (카운트다운용)
SK.emojiGrid([[2,1,0]], "한글데일리 #123 4/6")   // 🟩🟨⬜ 텍스트
```

같은 날 같은 salt = 항상 같은 결과. 서버 없이 "오늘의 문제"를 만들 수 있다.
정답 배열을 시드로 뽑을 때는 **미리 섞어둔 정적 배열 + 시작일로부터의 일수**를 인덱스로 쓰는 편이
스포일러 방지에 낫다(시드 함수만 알면 미래 정답을 계산할 수 있으므로).

---

## 6. 새 앱에 얹는 순서

1. `/<slug>/index.html` 에 단일 파일 앱을 쓰고 `<script src="/lib/share-kit.js"></script>` 를 넣는다.
2. 상태 스키마를 정하고(키는 1~2글자), `validate` 를 함께 쓴다.
3. VIRAL 5요소를 전부 구현한다 — ①URL 상태 ②공유 유입 시 "나도 해보기" CTA
   ③워터마크 있는 캔버스 카드 ④링크·텍스트·X·navigator.share ⑤리믹스(1클릭 재생성).
4. `gen-pages.mjs` 의 `BUILTINS` + `BUILTIN_CATS` 에 slug 를 등록한다.
5. `node scripts/test-share-kit.mjs && node gen-pages.mjs` — 둘 다 경고 0.
6. 배포 후 **다른 기기에서 링크를 열어** 같은 상태가 재현되는지 확인한다(엔진의 DEPLOY GATE).

## 알려진 한계

- 결과별 OG 이미지 없음(서버 필요). 카톡 미리보기는 앱 단위 고정 카드로 뜬다.
- 상태는 난독화가 아니라 인코딩이다. 누구나 디코딩할 수 있으니 비밀을 담지 않는다.
- `?d=` 는 브라우저·메신저의 URL 길이 제한을 함께 받는다. 12KB 차단은 그 방어선이다.
