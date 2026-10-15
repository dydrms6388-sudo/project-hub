// scripts/test-chemi-link.mjs — chemi-link 앱 회귀 테스트 (러너 없음, node로 직접 실행)
//   node scripts/test-chemi-link.mjs
// 실제 페이지의 <script>를 최소 DOM 스텁 위에서 그대로 실행한다.
// getElementById는 HTML에 실제로 존재하는 id만 돌려주므로 오타 난 id도 잡힌다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const html = readFileSync(resolve(root, "chemi-link/index.html"), "utf8");
const skSrc = readFileSync(resolve(root, "lib/share-kit.js"), "utf8");

// 페이지의 마지막 <script>(앱 로직)만 추출
const appSrc = html.split('<script src="/lib/share-kit.js"></script>')[1].split("<script>")[1].split("</script>")[0];
// HTML에 실제로 존재하는 id 목록
const KNOWN_IDS = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));

let pass = 0, fail = 0;
const ok = (cond, name, extra) => { if (cond) pass++; else { fail++; console.error(`  ✗ ${name}${extra ? " — " + extra : ""}`); } };
const eq = (a, b, name) => ok(JSON.stringify(a) === JSON.stringify(b), name, `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

/* ── 최소 DOM 스텁 ───────────────────────────────────────────────── */
function makeEl(tag) {
  const el = {
    tagName: tag, children: [], style: {}, dataset: {}, _on: {},
    textContent: "", value: "", placeholder: "", title: "", type: "", disabled: false, className: "",
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, on) { on === undefined ? (this._s.has(c) ? this._s.delete(c) : this._s.add(c)) : (on ? this._s.add(c) : this._s.delete(c)); },
    },
    addEventListener(ev, fn) { (this._on[ev] || (this._on[ev] = [])).push(fn); },
    click() { (this._on.click || []).forEach((f) => f.call(this, {})); },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute() {}, focus() {}, scrollIntoView() {},
  };
  let _html = "";
  Object.defineProperty(el, "innerHTML", {
    get: () => _html,
    set(v) { _html = String(v); if (_html === "") el.children.length = 0; },
  });
  return el;
}

function makeCtx(search) {
  const els = new Map();
  const document = {
    body: makeEl("body"),
    createElement: (t) => makeEl(t),
    getElementById(id) {
      if (!KNOWN_IDS.has(id)) return null;          // 오타 난 id → null → 실행 중 예외
      if (!els.has(id)) els.set(id, makeEl("div"));
      return els.get(id);
    },
  };
  const ctx = {
    document, TextEncoder, TextDecoder, URLSearchParams, Math, JSON, Promise, console, Array, Object, String, Number, Boolean, Date,
    setTimeout, clearTimeout, isNaN, parseInt, parseFloat,
    location: { search, pathname: "/chemi-link/", origin: "https://tomatoeggcat.com" },
    history: { replaceState(_a, _b, url) { ctx.location.search = "?" + String(url).split("?")[1]; } },
    navigator: {},
    open() {},
    $els: els,
  };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(skSrc, ctx, { filename: "share-kit.js" });
  vm.runInContext(appSrc, ctx, { filename: "chemi-link.app.js" });
  return ctx;
}

/* ── 1. 문항 데이터 정합성 ───────────────────────────────────────── */
{
  const ctx = makeCtx("");
  const Q = ctx.Q, MODES = ctx.MODES, TYPES = ctx.TYPES, AX = ctx.AX;
  eq(Object.keys(MODES).sort(), ["couple", "coworker", "family", "friend"], "모드 4종");
  eq(Object.keys(Q).sort(), ["couple", "coworker", "family", "friend"], "모드별 문항 세트 4종");
  eq(AX.length, 5, "성향 축 5개");

  for (const [m, list] of Object.entries(Q)) {
    eq(list.length, 30, `${m}: 30문항`);
    let bad = 0, dup = new Set(), dupHit = 0;
    for (const line of list) {
      const p = line.split("|");
      if (p.length !== 3 || p.some((x) => !x.trim())) bad++;
      if (dup.has(p[0])) dupHit++;
      dup.add(p[0]);
    }
    ok(bad === 0, `${m}: 모든 문항이 "질문|왼쪽|오른쪽" 형식`, `${bad}건 불량`);
    ok(dupHit === 0, `${m}: 중복 질문 없음`, `${dupHit}건`);
    // 축당 6문항(index % 5)
    for (let ax = 0; ax < 5; ax++) {
      let n = 0;
      for (let i = ax; i < 30; i += 5) n++;
      eq(n, 6, `${m}: ${AX[ax].k} 축 6문항`);
    }
  }

  // 16유형이 모두 있고 코드가 축 조합과 일치하는가
  const codes = [];
  for (const r of ["P", "S"]) for (const e of ["E", "R"]) for (const a of ["A", "C"]) for (const f of ["F", "T"]) codes.push(r + e + a + f);
  eq(Object.keys(TYPES).length, 16, "관계 유형 16종");
  for (const c of codes) ok(TYPES[c], `유형 ${c} 존재`);
  for (const [c, t] of Object.entries(TYPES)) {
    ok(t.n && t.e && t.t, `${c}: 이름·이모지·태그`);
    ok(t.d.length >= 200, `${c}: 설명 200자 이상`, `${t.d.length}자`);
    ok(t.g.length === 3 && t.b.length === 3 && t.a.length === 3, `${c}: 잘 맞는 점/조심할 점/추천 활동 3개씩`);
  }
  const names = Object.values(TYPES).map((t) => t.n);
  eq(new Set(names).size, 16, "유형 이름이 서로 다르다");
}

/* ── 2. 계산 로직 ────────────────────────────────────────────────── */
{
  const ctx = makeCtx("");
  const mk = (m, as, bs) => ({ m, v: 1, a: { n: "가", s: as }, b: { n: "나", s: bs } });
  eq(ctx.compute(mk("friend", "3".repeat(30), "3".repeat(30))).pct, 100, "완전히 같은 답 → 100%");
  eq(ctx.compute(mk("friend", "1".repeat(30), "5".repeat(30))).pct, 0, "정반대 답 → 0%");
  eq(ctx.compute(mk("friend", "1".repeat(30), "2".repeat(30))).pct, 75, "한 단계 차 → 75%");
  eq(ctx.compute(mk("friend", "1".repeat(30), "3".repeat(30))).pct, 50, "두 단계 차 → 50%");

  // 축 점수: 전부 1이면 0, 전부 5면 100
  eq(ctx.axisScores("1".repeat(30).split("").map(Number)), [0, 0, 0, 0, 0], "전부 왼쪽 → 축 0");
  eq(ctx.axisScores("5".repeat(30).split("").map(Number)), [100, 100, 100, 100, 100], "전부 오른쪽 → 축 100");

  // 유형 코드: 전부 1(왼쪽) → PEAF, 전부 5(오른쪽) → SRCT
  eq(ctx.compute(mk("friend", "1".repeat(30), "1".repeat(30))).code, "PEAF", "둘 다 왼쪽 성향 → PEAF");
  eq(ctx.compute(mk("friend", "5".repeat(30), "5".repeat(30))).code, "SRCT", "둘 다 오른쪽 성향 → SRCT");

  // 결정론: 같은 입력이면 항상 같은 결과(동점 정렬 포함)
  const s = mk("couple", "13524135241352413524135241352", "1");
  const a = "1352413524135241352413524135" + "24";
  const b = "5241352413524135241352413524" + "13";
  const r1 = ctx.compute(mk("couple", a, b)), r2 = ctx.compute(mk("couple", a, b));
  eq([r1.pct, r1.code, r1.diff.map((d) => d.i), r1.same.map((d) => d.i)],
     [r2.pct, r2.code, r2.diff.map((d) => d.i), r2.same.map((d) => d.i)], "같은 입력 → 같은 결과");
  eq(r1.diff.length, 3, "가장 갈린 질문 3개");
  eq(r1.same.length, 3, "가장 통한 질문 3개");
  ok(r1.diff[0].d >= r1.diff[1].d && r1.diff[1].d >= r1.diff[2].d, "갈린 질문이 차이 큰 순");

  // 완전 일치일 때도 '통한 질문' 3개가 채워진다
  eq(ctx.compute(mk("friend", "3".repeat(30), "3".repeat(30))).same.length, 3, "완전 일치 시에도 통한 질문 3개");
  // 완전 불일치일 때 '갈린 질문' 3개
  eq(ctx.compute(mk("friend", "1".repeat(30), "5".repeat(30))).diff.length, 3, "완전 불일치 시 갈린 질문 3개");
}

/* ── 3. 상태 검증(남이 만든 URL 방어) ───────────────────────────── */
{
  const ctx = makeCtx("");
  const v = ctx.validState;
  const good = { m: "friend", v: 1, a: { n: "가", s: "1".repeat(30) } };
  ok(v(good), "정상 초대 상태 통과");
  ok(v({ ...good, b: { n: "나", s: "5".repeat(30) } }), "정상 결과 상태 통과");
  ok(!v(null), "null 거부");
  ok(!v({ ...good, m: "unknown" }), "모르는 모드 거부");
  ok(!v({ ...good, v: 2 }), "버전 불일치 거부");
  ok(!v({ m: "friend", v: 1, a: { n: "가", s: "1".repeat(29) } }), "문항 수 부족 거부");
  ok(!v({ m: "friend", v: 1, a: { n: "가", s: "1".repeat(31) } }), "문항 수 초과 거부");
  ok(!v({ m: "friend", v: 1, a: { n: "가", s: "0".repeat(30) } }), "척도 밖 값(0) 거부");
  ok(!v({ m: "friend", v: 1, a: { n: "가", s: "6".repeat(30) } }), "척도 밖 값(6) 거부");
  ok(!v({ m: "friend", v: 1, a: { n: "열세글자를넘기는아주긴닉네", s: "1".repeat(30) } }), "13자 닉네임 거부");
  ok(!v({ ...good, b: { n: "나", s: "abc" } }), "깨진 b 거부");
}

/* ── 4. 전체 플로우: A 답변 → 초대 링크 → B 답변 → 결과 ────────── */
let inviteUrl = null;
{
  const ctx = makeCtx("");
  const $ = (id) => ctx.document.getElementById(id);
  eq($("vMode").style.display, "", "첫 방문은 모드 선택 화면");
  eq($("modeList").children.length, 4, "모드 버튼 4개 렌더");
  eq($("typeDocs").children.length, 16, "본문 유형 카드 16개 렌더");
  eq($("modeDocs").children.length, 4, "본문 모드 카드 4개 렌더");

  $("modeList").children[0].click();          // friend
  ok($("toNick").disabled === false, "모드를 고르면 다음 버튼 활성화");
  $("toNick").click();
  eq($("vNick").style.display, "", "닉네임 화면으로 이동");
  $("nickIn").value = "토마토";
  $("startQuiz").click();
  eq($("vQuiz").style.display, "", "문항 화면으로 이동");

  const picksA = [];
  for (let i = 0; i < 30; i++) {
    const v = (i % 5) + 1;                    // 1..5 골고루
    picksA.push(v);
    eq($("scale").children.length, 5, "5단계 버튼");
    $("scale").children[v - 1].click();
  }
  eq($("vInvite").style.display, "", "30문항을 마치면 초대 링크 화면");
  eq($("vResult").style.display, "none", "내 결과는 아직 보여주지 않는다");
  inviteUrl = $("inviteUrl").value;
  ok(inviteUrl.startsWith("https://tomatoeggcat.com/chemi-link/?d="), "초대 링크 생성", inviteUrl.slice(0, 50));

  // DEPLOY GATE: 상태 2KB 이하
  const enc = inviteUrl.split("?d=")[1];
  ok(enc.length <= 2048, "초대 상태 ≤ 2KB", enc.length + "B");
  const st = ctx.SK.decode(enc);
  eq(st.a.n, "토마토", "링크에 닉네임이 담긴다");
  eq(st.a.s, picksA.join(""), "링크에 답변이 그대로 담긴다");
  eq(st.b, undefined, "초대 링크에는 상대 답변이 없다");
  eq($("sizeWarn").style.display, "none", "크기 경고 없음");
}

/* ── 5. B가 초대 링크를 열고 답하면 결과가 나온다 ───────────────── */
{
  const ctx = makeCtx("?d=" + inviteUrl.split("?d=")[1]);
  const $ = (id) => ctx.document.getElementById(id);
  eq($("inbound").style.display, "", "공유 유입 배너 노출");
  eq($("inFrom").textContent, "토마토", "보낸 사람 닉네임 표시");
  eq($("vNick").style.display, "", "바로 닉네임 입력부터");
  eq($("vMode").style.display, "none", "모드는 보낸 사람이 정한 대로 고정");

  $("nickIn").value = "계란";
  $("startQuiz").click();
  for (let i = 0; i < 30; i++) $("scale").children[(i % 5)].click();   // A와 같은 패턴 → 100%
  eq($("vResult").style.display, "", "결과 화면 노출");
  eq($("rPct").textContent, "100%", "같은 답변 → 일치율 100%");
  ok($("rWho").textContent.indexOf("토마토 × 계란") === 0, "두 사람 닉네임 표기", $("rWho").textContent);
  ok($("radar").innerHTML.indexOf("<polygon") >= 0, "레이더 차트 렌더");
  eq($("shareBar").children.length, 5, "공유 버튼 5개(링크·텍스트·X·공유·저장)");
  eq($("reverse").textContent, "역으로 보내기", "답한 당사자에게는 역으로 보내기");

  // 결과 링크에 두 사람이 모두 담겼는가 (DEPLOY GATE: 2KB 이하)
  const enc = ctx.location.search.split("?d=")[1];
  const st = ctx.SK.decode(enc);
  eq([st.a.n, st.b.n], ["토마토", "계란"], "결과 상태에 두 사람 모두 포함");
  ok(enc.length <= 2048, "결과 상태 ≤ 2KB", enc.length + "B");

  // 역으로 보내기 → 내 답변으로 새 초대 링크
  $("reverse").click();
  eq($("vInvite").style.display, "", "역으로 보내기 → 초대 화면");
  const st2 = ctx.SK.decode($("inviteUrl").value.split("?d=")[1]);
  eq(st2.a.n, "계란", "새 초대의 발신자는 나");
  eq(st2.b, undefined, "새 초대에는 상대 답변 없음");
  eq(st2.s, undefined, "새 초대 상태에 군더더기 없음");
}

/* ── 6. 완성된 결과 링크를 제3자가 열면 ─────────────────────────── */
{
  const seed = makeCtx("");
  const full = seed.SK.encode({ m: "coworker", v: 1, a: { n: "가", s: "12345".repeat(6) }, b: { n: "나", s: "54321".repeat(6) } });
  const ctx = makeCtx("?d=" + full);
  const $ = (id) => ctx.document.getElementById(id);
  eq($("vResult").style.display, "", "결과 링크는 바로 결과 화면");
  eq($("reverse").textContent, "나도 만들어보기", "당사자가 아니면 '나도 해보기' CTA");
}

/* ── 7. 깨진 링크는 조용히 무시하고 첫 화면 ─────────────────────── */
for (const broken of ["?d=!!!!", "?d=", "?d=" + "A".repeat(40), "?r=zzzz"]) {
  const ctx = makeCtx(broken);
  const $ = (id) => ctx.document.getElementById(id);
  eq($("vMode").style.display, "", `깨진 링크(${broken.slice(0, 12)}) → 모드 선택`);
  eq($("vResult").style.display, "none", "결과 화면은 뜨지 않는다");
}

/* ── 8. 문항 되돌아가기 ─────────────────────────────────────────── */
{
  const ctx = makeCtx("");
  const $ = (id) => ctx.document.getElementById(id);
  $("modeList").children[1].click(); $("toNick").click();
  $("nickIn").value = "테스트"; $("startQuiz").click();
  ok($("qBack").disabled, "첫 문항에서는 이전 버튼 비활성화");
  $("scale").children[0].click();
  eq($("qCount").textContent, "2 / 30", "다음 문항으로 이동");
  ok(!$("qBack").disabled, "두 번째 문항에서는 이전 버튼 활성화");
  $("qBack").click();
  eq($("qCount").textContent, "1 / 30", "이전 문항으로 복귀");
  // 나머지를 채우고, 다시 앞 문항을 고치면 곧바로 완료로 간다
  for (let i = 0; i < 30; i++) $("scale").children[2].click();
  eq($("vInvite").style.display, "", "30문항 완료");
}

console.log(`\nchemi-link: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
