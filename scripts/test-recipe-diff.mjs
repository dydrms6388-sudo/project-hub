// scripts/test-recipe-diff.mjs — 레시피 계보(/recipe-tree/) 엔진 유닛테스트
// 실행: node scripts/test-recipe-diff.mjs
//
// 이 저장소는 테스트 러너가 없고 앱은 단일 HTML 파일이다. 엔진 코드를 복사하면
// 원본과 어긋나므로, recipe-tree/index.html 의 `@engine-start ~ @engine-end`
// 구간을 그대로 추출해 평가한다. 즉 테스트 대상 = 실제 배포되는 코드.
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../recipe-tree/index.html", import.meta.url), "utf8");
const m = html.match(/@engine-start([\s\S]*?)@engine-end/);
if (!m) { console.error("❌ 엔진 구간(@engine-start/@engine-end)을 찾지 못했습니다."); process.exit(1); }
const engineSrc = m[1]
  .replace(/^[\s\S]*?\*\//, "")   // 시작 마커가 들어 있던 주석의 꼬리 제거
  .replace(/\/\*\s*$/, "");       // 끝 마커를 열던 주석의 머리 제거
const engine = new Function(engineSrc + "\nreturn { parseFree, parseIngredient, parseStep, detectPaste, diffRecipes, amt };")();
const { parseFree, parseIngredient, detectPaste, diffRecipes } = engine;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log("  ✅ " + name); }
  else { fail++; console.log("  ❌ " + name + (extra ? "\n     → " + extra : "")); }
}
function has(diff, kind, needle) {
  return diff.ing.concat(diff.step).some(x => x.kind === kind && x.text.includes(needle));
}

/* ───────────────────────── 1. diff — 재료 6종 · 단계 8개 변경 케이스 ───────────────────────── */
console.log("\n[1] diff — 재료 6종 변경 + 단계 8개 변경");

const parent = {
  t: "엄마 김치찌개", au: "엄마",
  i: [
    { n: "돼지고기", a: "300", u: "g" },
    { n: "김치", a: "1/2", u: "포기" },
    { n: "설탕", a: "1", u: "큰술" },
    { n: "대파", a: "1", u: "대" },
    { n: "두부", a: "1", u: "모" },
    { n: "고춧가루", a: "1", u: "큰술" },
    { n: "다진마늘", a: "1", u: "큰술" },
    { n: "멸치육수", a: "500", u: "ml" },
  ],
  s: [
    { a: "냄비에 김치와 고기를 넣고 볶는다", m: 5 },
    { a: "고춧가루와 다진마늘을 넣는다", m: null },
    { a: "멸치육수를 붓는다", m: null },
    { a: "센불에서 끓인다", m: 15 },
    { a: "두부를 올린다", m: null },
    { a: "약불로 줄여 더 끓인다", m: 5 },
    { a: "대파를 넣는다", m: null },
    { a: "간을 본다", m: null },
  ],
};

// 재료 변경 6종: 설탕→매실청(교체는 1:1일 때만이므로 여기선 삭제/추가로 잡힘),
//   돼지고기 양 변경, 김치 양 변경, 고춧가루 삭제, 청양고추 추가, 멸치육수 단위 변경
const child6 = {
  t: "내 버전", au: "나",
  i: [
    { n: "돼지고기", a: "400", u: "g" },      // 변경
    { n: "김치", a: "1", u: "포기" },          // 변경
    { n: "매실청", a: "2", u: "큰술" },        // 추가(설탕 대신)
    { n: "대파", a: "1", u: "대" },
    { n: "두부", a: "1", u: "모" },
    { n: "청양고추", a: "2", u: "개" },        // 추가
    { n: "다진마늘", a: "1", u: "큰술" },
    { n: "멸치육수", a: "600", u: "ml" },      // 변경
  ],                                            // 설탕·고춧가루 삭제
  s: parent.s.slice(),
};
const d1 = diffRecipes(parent, child6);
ok("돼지고기 양 변경 감지", has(d1, "chg", "돼지고기 300g → 400g"), JSON.stringify(d1.ing));
ok("김치 양 변경 감지", has(d1, "chg", "김치 1/2포기 → 1포기"));
ok("멸치육수 양 변경 감지", has(d1, "chg", "멸치육수 500ml → 600ml"));
ok("설탕 삭제 감지", has(d1, "del", "설탕"));
ok("고춧가루 삭제 감지", has(d1, "del", "고춧가루"));
ok("매실청 추가 감지", has(d1, "add", "매실청"));
ok("청양고추 추가 감지", has(d1, "add", "청양고추"));
ok("재료 변경 6종 정확히 6~7건(교체 미분리)", d1.ing.length === 7, "실제 " + d1.ing.length + "건: " + JSON.stringify(d1.ing.map(x => x.text)));
ok("단계는 변화 없음", d1.step.length === 0, JSON.stringify(d1.step));

// 단계 8개 전부 다른 케이스
const child8 = {
  t: "완전 다른 버전", au: "나",
  i: parent.i.slice(),
  s: [
    { a: "고기를 먼저 밑간한다", m: 10 },
    { a: "김치를 따로 볶는다", m: 7 },
    { a: "육수 대신 쌀뜨물을 붓는다", m: null },
    { a: "중불에서 끓인다", m: 20 },
    { a: "두부는 마지막에 넣는다", m: null },
    { a: "들기름을 두른다", m: null },
    { a: "대파와 청양고추를 넣는다", m: null },
    { a: "불을 끄고 뜸을 들인다", m: 3 },
  ],
};
const d2 = diffRecipes(parent, child8);
ok("단계 8개 삭제 감지", d2.step.filter(x => x.kind === "del").length === 8, "실제 " + d2.step.filter(x => x.kind === "del").length);
ok("단계 8개 추가 감지", d2.step.filter(x => x.kind === "add").length === 8, "실제 " + d2.step.filter(x => x.kind === "add").length);
ok("재료는 변화 없음", d2.ing.length === 0);
ok("총 변경 건수 16건", d2.count === 16, "실제 " + d2.count);

// 1:1 교체는 화살표 한 줄로
const childSwap = { t: "x", i: parent.i.map(x => x.n === "설탕" ? { n: "매실청", a: "2", u: "큰술" } : x), s: parent.s.slice() };
const d3 = diffRecipes(parent, childSwap);
ok("1:1 재료 교체는 화살표 한 줄", has(d3, "chg", "설탕 1큰술 → 매실청 2큰술"), JSON.stringify(d3.ing.map(x => x.text)));
ok("교체 시 add/del 로 중복 표시하지 않음", d3.ing.length === 1, JSON.stringify(d3.ing.map(x => x.text)));

// 순서 변경 감지
const childOrder = { t: "x", i: parent.i.slice(), s: [parent.s[1], parent.s[0], ...parent.s.slice(2)] };
const d4 = diffRecipes(parent, childOrder);
ok("단계 순서 변경 감지", d4.step.some(x => x.kind === "ord"), JSON.stringify(d4.step));

// 시간 변경 감지
const childTime = { t: "x", i: parent.i.slice(), s: parent.s.map(x => x.a === "센불에서 끓인다" ? { a: x.a, m: 25 } : x) };
const d5 = diffRecipes(parent, childTime);
ok("조리 시간 변경 감지 (15분 → 25분)", has(d5, "chg", "15분 → 25분"), JSON.stringify(d5.step));

// 변화 없음
const d6 = diffRecipes(parent, { t: "x", i: parent.i.slice(), s: parent.s.slice() });
ok("동일 레시피는 변경 0건", d6.count === 0, JSON.stringify(d6));

/* ───────────────────────── 2. 외부 텍스트 붙여넣기 감지 10종 ───────────────────────── */
console.log("\n[2] 외부 붙여넣기 감지 — 양성 10종 / 음성 3종");

const positives = [
  ["출처 표기", "재료\n돼지고기 300g\n출처: 백종원 요리책 32쪽\n김치 1포기"],
  ["링크 포함", "김치찌개 만들기\nhttps://blog.example.com/kimchi\n돼지고기 300g"],
  ["구독 유도", "구독과 좋아요 부탁드려요! 오늘은 김치찌개입니다\n재료 준비해 주세요"],
  ["저작권 표기", "김치찌개 레시피 © 2025 쿠킹매거진 All rights reserved\n돼지고기 300g"],
  ["작성자 표기", "김철수 셰프의 비법 김치찌개\n재료\n돼지고기 300g"],
  ["사진 캡션", "사진 1 완성된 김치찌개의 모습입니다\n사진 2 재료를 손질하는 과정\n돼지고기 300g"],
  ["긴 본문", "김치찌개는 한국인의 소울푸드입니다. ".repeat(60)],
  ["설명체 장문 반복", [
    "먼저 냄비에 잘 익은 김치를 넣고 돼지고기와 함께 충분히 볶아 주는 것이 좋습니다",
    "이때 불은 중불로 유지하면서 재료가 타지 않도록 계속 저어 주시는 것이 중요합니다",
    "김치가 어느 정도 익으면 준비해 둔 멸치 육수를 부어 주시고 뚜껑을 덮어 주세요",
    "국물이 끓어오르기 시작하면 두부를 넣고 다시 한 번 푹 끓여 주시면 완성됩니다",
  ].join("\n")],
  ["문장 반복", "재료를 준비합니다 그리고 손질을 시작합니다\n재료를 준비합니다 그리고 손질을 시작합니다\n재료를 준비합니다 그리고 손질을 시작합니다"],
  ["무단전재 문구", "본 레시피의 무단 전재 및 재배포를 금합니다\n인스타 @cooking\n돼지고기 300g"],
];
positives.forEach(([name, text]) => {
  const d = detectPaste(text);
  ok("감지: " + name + " (정황 " + d.score + "개)", d.score >= 1, JSON.stringify(d.flags));
});

const negatives = [
  ["짧은 자기 메모", "재료\n돼지고기 300g\n김치 1/2포기\n설탕 1큰술\n\n만드는 법\n1. 볶는다\n2. 끓인다"],
  ["재료만", "돼지고기 300g\n김치 1포기\n두부 1모"],
  ["단계만 짧게", "1. 김치 볶기\n2. 물 붓기\n3. 두부 올리기"],
];
negatives.forEach(([name, text]) => {
  const d = detectPaste(text);
  ok("오탐 없음: " + name, d.score === 0, JSON.stringify(d.flags));
});

/* ───────────────────────── 3. 자유 서술 파서 ───────────────────────── */
console.log("\n[3] 규칙 기반 파서");

const p1 = parseFree(`재료
돼지고기 300g
김치 1/2포기
설탕 1큰술
대파 약간

만드는 법
1. 냄비에 김치와 고기를 넣고 5분 볶는다
2. 물 500ml 붓고 15분 끓인다
3. 두부 올리고 3분 더 끓인다`);
ok("재료 4개 파싱", p1.ings.length === 4, JSON.stringify(p1.ings));
ok("단계 3개 파싱", p1.steps.length === 3, JSON.stringify(p1.steps));
ok("분량+단위 분리 (300 / g)", p1.ings[0].a === "300" && p1.ings[0].u === "g", JSON.stringify(p1.ings[0]));
ok("분수 분량 유지 (1/2포기)", p1.ings[1].a === "1/2" && p1.ings[1].u === "포기", JSON.stringify(p1.ings[1]));
ok("모호 단위 처리 (대파 약간)", p1.ings[3].n === "대파" && p1.ings[3].u === "약간", JSON.stringify(p1.ings[3]));
ok("단계 소요시간 추출 (5분)", p1.steps[0].m === 5, JSON.stringify(p1.steps[0]));
ok("단계 번호 제거", !/^\d/.test(p1.steps[1].a), p1.steps[1].a);

const p2 = parseIngredient("설탕: 1큰술");
ok("콜론 구분 파싱", p2 && p2.n === "설탕" && p2.a === "1" && p2.u === "큰술", JSON.stringify(p2));
const p3 = parseIngredient("- 간장 2T");
ok("불릿·약어 단위 파싱", p3 && p3.n === "간장" && p3.u === "T", JSON.stringify(p3));

const p4 = parseFree("1. 물을 끓인다\n2. 면을 넣는다");
ok("섹션 헤더 없어도 번호줄은 단계로", p4.steps.length === 2 && p4.ings.length === 0, JSON.stringify(p4));

/* ── 실사용 한국어 표기 (리뷰 루프 1: 요리 커뮤니티 페르소나가 잡은 실패 케이스) ── */
console.log("\n[3-b] 실사용 한국어 재료 표기");
const cases = [
  ["대파 1대", "대파", "1", "대"],
  ["대파 1/2대", "대파", "1/2", "대"],
  ["물 2컵반", "물", "2.5", "컵"],
  ["설탕 한 큰술", "설탕", "1", "큰술"],
  ["대파 반 대", "대파", "1/2", "대"],
  ["마늘 3톨", "마늘", "3", "톨"],
  ["두부 1모", "두부", "1", "모"],
  ["생강 1쪽", "생강", "1", "쪽"],
  ["김치 1/2포기", "김치", "1/2", "포기"],
  ["돼지고기 300g", "돼지고기", "300", "g"],
];
cases.forEach(([input, n, a, u]) => {
  const r = parseIngredient(input);
  ok(`표기 파싱: ${input}`, !!r && r.n === n && r.a === a && r.u === u, JSON.stringify(r));
});

/* ── 재료 표기 흔들림에 diff가 흔들리지 않아야 한다 ── */
console.log("\n[3-c] 동의어·괄호 정규화");
const synParent = { i: [{ n: "대파", a: "1", u: "대" }, { n: "다진마늘", a: "1", u: "큰술" }, { n: "두부", a: "1", u: "모" }], s: [] };
const synChild = { i: [{ n: "파", a: "1", u: "대" }, { n: "마늘 다진 것", a: "1", u: "큰술" }, { n: "두부(부침용)", a: "1", u: "모" }], s: [] };
ok("표기만 다르고 내용 같으면 변경 0건", diffRecipes(synParent, synChild).count === 0,
   JSON.stringify(diffRecipes(synParent, synChild).ing.map(x => x.text)));
const realChange = { i: [{ n: "대파", a: "2", u: "대" }, { n: "다진마늘", a: "1", u: "큰술" }, { n: "두부", a: "1", u: "모" }], s: [] };
ok("진짜 양 변경은 여전히 잡힘", has(diffRecipes(synParent, realChange), "chg", "대파 1대 → 2대"));
ok("진짜 재료 교체도 여전히 잡힘",
   has(diffRecipes(synParent, { i: [{ n: "대파", a: "1", u: "대" }, { n: "다진마늘", a: "1", u: "큰술" }, { n: "유부", a: "1", u: "장" }], s: [] }), "chg", "두부"));

/* ── 리뷰 루프 2: 요리 커뮤니티 페르소나가 새로 잡은 실패 케이스 ── */
console.log("\n[3-d] 실제 블로그 표기 (괄호 설명 · 범위 · 어림 · 정육점 단위)");
const paren = parseFree(`재료
돼지고기 300g(목살 또는 앞다리살)
김치 1/2포기(잘 익은 것)
두부 1모`);
ok("괄호 설명이 붙어도 재료로 인식", paren.ings.length === 3, JSON.stringify(paren.ings));
ok("괄호 설명 줄이 조리 단계로 새지 않음", paren.steps.length === 0, JSON.stringify(paren.steps.map(x => x.a)));
ok("괄호 안 설명은 메모로 보존", paren.ings[0].o === "목살 또는 앞다리살", JSON.stringify(paren.ings[0]));

const more = [
  ["고기 한근", "고기", "1", "근"],
  ["물 500~600ml", "물", "500~600", "ml"],
  ["김치 300g 정도", "김치", "300", "g"],
  ["물 1리터", "물", "1", "리터"],
  ["간장 3숟갈", "간장", "3", "숟갈"],
  ["멸치 10마리정도", "멸치", "10", "마리"],
  ["양파 1/4개", "양파", "1/4", "개"],
];
more.forEach(([input, n, a, u]) => {
  const r = parseIngredient(input);
  ok(`표기 파싱: ${input}`, !!r && r.n === n && r.a === a && r.u === u, JSON.stringify(r));
});
const vague = parseIngredient("소금 약간씩");
ok("‘약간씩’에서 재료명이 깨지지 않음", !!vague && vague.n === "소금", JSON.stringify(vague));

console.log("\n[3-e] 단위·수량 표기 동치 (diff 오탐 방지)");
[["큰술", "T"], ["작은술", "티스푼"], ["ml", "cc"], ["개", "알"]].forEach(([a, b]) => {
  const d = diffRecipes({ i: [{ n: "설탕", a: "1", u: a }], s: [] }, { i: [{ n: "설탕", a: "1", u: b }], s: [] });
  ok(`1${a} == 1${b} → 변경 없음`, d.count === 0, JSON.stringify(d.ing.map(x => x.text)));
});
const numEq = diffRecipes({ i: [{ n: "물", a: "1/2", u: "컵" }], s: [] }, { i: [{ n: "물", a: "0.5", u: "컵" }], s: [] });
ok("1/2 == 0.5 → 변경 없음", numEq.count === 0, JSON.stringify(numEq.ing.map(x => x.text)));
const realUnitChange = diffRecipes({ i: [{ n: "설탕", a: "1", u: "큰술" }], s: [] }, { i: [{ n: "설탕", a: "2", u: "T" }], s: [] });
ok("진짜 양 변경(1→2)은 여전히 잡힘", realUnitChange.count === 1, JSON.stringify(realUnitChange.ing.map(x => x.text)));

/* ── 동의어표의 경계선 (루프 3~4에서 두 번 어긋난 지점이라 못박아 둔다) ──
   표기만 다른 것 = 같음 / 부위·입자도·품종이 다른 것 = 다름.
   너무 많이 묶으면 "재료를 바꿨는데 달라진 게 없다"며 저장이 막히는 사고가 난다. */
console.log("\n[3-g] 동의어표 경계 — 같은 것만 같다고 해야 한다");
[
  ["다진마늘", "마늘 다진 것", true],
  ["고추가루", "고춧가루", true],
  ["물", "생수", true],
  ["계란", "달걀", true],
  ["대파", "파", true],
  ["양파", "깐양파", true],
].forEach(([a, b, same]) => {
  const d = diffRecipes({ i: [{ n: a, a: "1", u: "큰술" }], s: [] }, { i: [{ n: b, a: "1", u: "큰술" }], s: [] });
  ok(`같은 것: ${a} == ${b}`, (d.count === 0) === same, JSON.stringify(d.ing.map(x => x.text)));
});
[
  ["목살", "삼겹살"],
  ["진간장", "국간장"],
  ["백설탕", "황설탕"],
  ["설탕", "설탕가루"],
  ["대파", "대파흰부분"],
  ["대파", "쪽파"],
  ["깻잎", "깻잎순"],
  ["멸치육수", "다시마육수"],
].forEach(([a, b]) => {
  const d = diffRecipes({ i: [{ n: a, a: "1", u: "큰술" }], s: [] }, { i: [{ n: b, a: "1", u: "큰술" }], s: [] });
  ok(`다른 재료: ${a} != ${b}`, d.count > 0, "변경 0건 — 동의어표가 과하게 묶고 있다");
});

/* ── 단위 환산 동치 (1kg == 1000g) ── */
console.log("\n[3-h] 단위 환산");
[
  [["1", "kg"], ["1000", "g"], true],
  [["1", "L"], ["1000", "ml"], true],
  [["1", "L"], ["500", "ml"], false],
  [["1", "큰술"], ["3", "작은술"], true],
].forEach(([a, b, same]) => {
  const d = diffRecipes({ i: [{ n: "밀가루", a: a[0], u: a[1] }], s: [] }, { i: [{ n: "밀가루", a: b[0], u: b[1] }], s: [] });
  ok(`${a[0]}${a[1]} ${same ? "==" : "!="} ${b[0]}${b[1]}`, (d.count === 0) === same, JSON.stringify(d.ing.map(x => x.text)));
});

/* ── 쉼표 목록에서 재료가 사라지면 안 된다 (루프 4: 조용한 데이터 손실) ── */
console.log("\n[3-i] 쉼표 목록 — 정량과 어림이 섞여도 하나도 잃지 않는다");
[
  ["소금 약간, 대파 1대, 후추 약간", 3],
  ["다진마늘 1T, 다진생강 약간, 대파 1대", 3],
  ["마늘 2쪽, 생강 1쪽", 2],
].forEach(([line, want]) => {
  const r = parseFree("재료\n" + line);
  ok(`"${line}" → 재료 ${want}개`, r.ings.length === want && r.steps.length === 0,
     `실제 재료 ${r.ings.length}개 / 단계 ${r.steps.length}개: ` + JSON.stringify(r.ings.map(x => x.n)));
});
ok("설명 문장은 쪼개지 않는다", parseFree("냄비에 넣고, 센불에서 끓인다").ings.length === 0);

/* ── 앱이 만든 표기를 다시 넣어도 읽혀야 한다 ── */
console.log("\n[3-j] 배율 표기 되먹임 · 유니코드 분수");
[
  ["설탕 1과 1/2컵", "설탕", "1.5", "컵"],
  ["설탕 1½컵", "설탕", "1.5", "컵"],
  ["멸치육수 1국자", "멸치육수", "1", "국자"],
  ["대파 1줄기", "대파", "1", "줄기"],
].forEach(([input, n, a, u]) => {
  const r = parseIngredient(input);
  ok(`${input} → ${n} ${a}${u}`, !!r && r.n === n && r.a === a && r.u === u, JSON.stringify(r));
});

/* 인분 배율은 엔진 구간 밖(뷰 코드)이라 파일에서 따로 추출한다 */
console.log("\n[3-f] 인분 배율 — 부엌에서 쓸 수 있는 값이어야 한다");
const scaleSrc = html.match(/var COMMON_FRACTIONS[\s\S]*?\n\}\nfunction scaleAmount[\s\S]*?\n\}/);
const scale = new Function(scaleSrc[0] + "; return scaleAmount;")();
[
  ["1/2", 0.5, "1/4"], ["1/2", 2, "1"], ["1", 0.5, "1/2"],
  ["3", 0.5, "1과 1/2"], ["1/3", 2, "2/3"], ["1/4", 2, "1/2"],
  ["300", 0.5, "150"], ["500~600", 2, "1000~1200"],
].forEach(([a, k, want]) => {
  const got = scale(a, k);
  ok(`${a} × ${k} = ${want}`, got === want, "실제 " + got);
});
ok("숫자가 아닌 양(약간)은 그대로", scale("", 2) === "" && scale("약간", 2) === "약간");

/* ───────────────────────── 4. 3단계 포크 계보 샘플 ───────────────────────── */
console.log("\n[4] 3단계 포크 계보 샘플");

// 뿌리 → 자식 → 손자. 앱의 저장 로직과 동일한 방식으로 anc/par 를 쌓는다.
function fork(parentR, changes, reason, author, title) {
  const child = { ...parentR, ...changes, t: title, au: author };
  child.cr = reason;
  child.par = { t: parentR.t, au: parentR.au, i: parentR.i, s: parentR.s };
  child.anc = (parentR.anc || []).concat([{ t: parentR.t, au: parentR.au, cr: parentR.cr || "" }]).slice(-6);
  child.root = parentR.root || ("root-" + parentR.t);
  return child;
}
const root = { ...parent, root: "root-엄마 김치찌개" };
const gen2 = fork(root,
  { i: root.i.map(x => x.n === "설탕" ? { n: "매실청", a: "2", u: "큰술" } : x) },
  "아이가 먹어서 설탕 대신 매실청", "딸", "우리집 김치찌개");
const gen3 = fork(gen2,
  { i: gen2.i.concat([{ n: "청양고추", a: "2", u: "개" }]) },
  "매운 걸 좋아해서 청양고추 추가", "친구", "매운 김치찌개");

ok("3세대 계보 체인 길이 3", (gen3.anc.length + 1) === 3, JSON.stringify(gen3.anc.map(a => a.t)));
ok("뿌리가 체인 첫 노드", gen3.anc[0].t === "엄마 김치찌개");
ok("중간 세대의 변경 이유 보존", gen3.anc[1].cr === "아이가 먹어서 설탕 대신 매실청", gen3.anc[1].cr);
ok("root 가 3세대까지 동일", gen3.root === root.root && gen2.root === root.root);
const dg3 = diffRecipes(gen3.par, gen3);
ok("손자 diff = 청양고추 추가 1건", dg3.count === 1 && has(dg3, "add", "청양고추"), JSON.stringify(dg3));
const dg2 = diffRecipes(gen2.par, gen2);
ok("자식 diff = 설탕→매실청 교체 1건", dg2.count === 1 && has(dg2, "chg", "설탕 1큰술 → 매실청 2큰술"), JSON.stringify(dg2));

// 부모가 삭제돼도 자식은 스냅샷으로 살아남는다
const orphan = JSON.parse(JSON.stringify(gen3));
ok("부모 스냅샷만으로 diff 재현 가능", diffRecipes(orphan.par, orphan).count === 1);

/* ───────────────────────── 결과 ───────────────────────── */
console.log("\n────────────────────────────");
console.log(`통과 ${pass} · 실패 ${fail}`);
if (fail) { console.log("❌ 실패한 테스트가 있습니다."); process.exit(1); }
console.log("✅ 전부 통과");
