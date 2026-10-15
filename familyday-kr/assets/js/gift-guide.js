/* gift-guide.js — 명절 선물 예산 배분 (ES 모듈) */
const $ = (s) => document.querySelector(s);
const esc = (s) => window.FD.esc(s);
const KEY = "fd-gift-v1";

const DEFAULT = [
  { on: true, name: "부모님", cnt: 2, w: 30, idea: "현금·건강식품·과일" },
  { on: true, name: "시부모님·처부모님", cnt: 2, w: 30, idea: "현금·건강식품·과일" },
  { on: false, name: "조부모님", cnt: 2, w: 12, idea: "현금·내복·간편식" },
  { on: true, name: "형제자매", cnt: 2, w: 10, idea: "생필품 세트·상품권" },
  { on: true, name: "조카", cnt: 3, w: 8, idea: "용돈·문구·장난감" },
  { on: false, name: "직장 상사·동료", cnt: 1, w: 6, idea: "커피·간식 세트" },
  { on: false, name: "친척 어른", cnt: 2, w: 4, idea: "과일·건강식품" },
];
let rows = FD.load(KEY, null) || DEFAULT.map((x) => ({ ...x }));
let total = 600000;
const saved = FD.load(KEY + "-total", null);
if (saved) total = saved;
$("#total").value = total;

const QUICK = [200000, 400000, 600000, 1000000];

function paintQuick() {
  $("#quick").innerHTML = QUICK.map((v) =>
    `<button class="chip${v === total ? " on" : ""}" type="button" data-v="${v}">${(v / 10000)}만 원</button>`).join("");
}
function paintRows() {
  $("#targets").innerHTML = rows.map((r, i) => `
<div class="panel2" style="display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center">
<input type="checkbox" style="width:20px;height:20px" data-on="${i}"${r.on ? " checked" : ""} aria-label="${esc(r.name)} 포함" />
<div>
<input type="text" data-name="${i}" value="${esc(r.name)}" maxlength="20" style="font-weight:700" />
<div class="row2" style="margin-top:8px">
<div><label style="margin:0 0 4px" for="c${i}">인원</label><input id="c${i}" type="number" min="1" max="20" value="${r.cnt}" data-cnt="${i}" inputmode="numeric" /></div>
<div><label style="margin:0 0 4px" for="w${i}">비중</label><input id="w${i}" type="number" min="0" max="100" value="${r.w}" data-w="${i}" inputmode="numeric" /></div>
</div>
<p class="src" style="margin-top:6px">${esc(r.idea || "")}</p>
</div></div>`).join("");
}
function render() {
  const on = rows.filter((r) => r.on && r.w > 0);
  const sum = on.reduce((a, r) => a + Number(r.w), 0);
  if (!on.length || !sum) {
    $("#out").innerHTML = `<div class="note">챙길 분을 한 명 이상 선택하고 비중을 0보다 크게 정해 주세요.</div>`;
    return;
  }
  const alloc = on.map((r) => {
    const amt = Math.round((total * r.w / sum) / 1000) * 1000;
    return { ...r, amt, per: Math.round(amt / Math.max(1, r.cnt) / 1000) * 1000 };
  });
  const used = alloc.reduce((a, r) => a + r.amt, 0);
  $("#out").innerHTML = `
<section class="result">
<div class="big">${FD.won(total)}</div>
<div class="sub">${alloc.length}개 대상 · 배분 합계 ${FD.won(used)}${used !== total ? " (반올림 차이 " + FD.won(Math.abs(total - used)) + ")" : ""}</div>
</section>
<section class="panel">
<h2 style="margin-top:0">대상별 배분</h2>
<div class="tbwrap"><table class="tb">
<thead><tr><th>대상</th><th>인원</th><th>비중</th><th>배분액</th><th>1인당</th></tr></thead>
<tbody>${alloc.map((r) => `<tr><td><b>${esc(r.name)}</b><br><span class="src">${esc(r.idea || "")}</span></td>
<td>${r.cnt}명</td><td>${Math.round(r.w * 100 / sum)}%</td><td><b>${FD.won(r.amt)}</b></td><td>${FD.won(r.per)}</td></tr>`).join("")}</tbody></table></div>
<div class="btnrow"><button class="btn sec small" type="button" id="cp">결과 복사</button></div>
<p class="note warn">공직자·언론인·교직원 등에게 선물할 때는 <b>청탁금지법</b>의 가액 기준을 반드시 확인하세요. 이 도구는 예산 배분만 도우며 법적 판단을 하지 않습니다.</p>
</section>`;
  $("#cp").addEventListener("click", () => {
    FD.copy(`명절 선물 예산 ${FD.won(total)}\n` + alloc.map((r) => `· ${r.name} ${r.cnt}명 — ${FD.won(r.amt)} (1인 ${FD.won(r.per)})`).join("\n"));
  });
}

$("#targets").addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.on !== undefined) rows[t.dataset.on].on = t.checked;
  else if (t.dataset.name !== undefined) rows[t.dataset.name].name = t.value;
  else if (t.dataset.cnt !== undefined) rows[t.dataset.cnt].cnt = Math.max(1, parseInt(t.value, 10) || 1);
  else if (t.dataset.w !== undefined) rows[t.dataset.w].w = Math.max(0, parseInt(t.value, 10) || 0);
  render();
});
$("#quick").addEventListener("click", (e) => {
  const b = e.target.closest("[data-v]");
  if (!b) return;
  total = Number(b.dataset.v);
  $("#total").value = total;
  paintQuick(); render();
});
$("#total").addEventListener("input", () => {
  total = Math.max(0, parseInt($("#total").value, 10) || 0);
  paintQuick(); render();
});
$("#addRow").addEventListener("click", () => {
  rows.push({ on: true, name: "새 대상", cnt: 1, w: 5, idea: "" });
  paintRows(); render();
});
$("#save").addEventListener("click", () => {
  if (FD.save(KEY, rows) && FD.save(KEY + "-total", total)) FD.toast("이 기기에 저장했습니다");
});
$("#exp").addEventListener("click", () => {
  FD.download(new Blob([JSON.stringify({ total, rows }, null, 2)], { type: "application/json" }), "gift-budget.json");
});
$("#wipe").addEventListener("click", () => {
  if (!confirm("저장한 내용을 모두 지울까요? 되돌릴 수 없습니다.")) return;
  FD.wipe(KEY); FD.wipe(KEY + "-total");
  rows = DEFAULT.map((x) => ({ ...x }));
  total = 600000; $("#total").value = total;
  paintQuick(); paintRows(); render();
  FD.toast("모두 지웠습니다");
});

paintQuick();
paintRows();
render();
