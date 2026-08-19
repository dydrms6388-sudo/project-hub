/* seat-map.js — 하객 자리배치도 생성 + PNG 저장 (ES 모듈) */
const $ = (s) => document.querySelector(s);
const esc = (s) => window.FD.esc(s);
const KEY = "fd-seat-v1";

const DEFAULT = [
  { name: "신랑 직계가족", n: 8 },
  { name: "신부 직계가족", n: 8 },
  { name: "친척(신랑)", n: 12 },
  { name: "친척(신부)", n: 12 },
  { name: "직장 동료", n: 16 },
  { name: "대학 동기", n: 14 },
];
let groups = FD.load(KEY, null) || DEFAULT.map((g) => ({ ...g }));
const savedMeta = FD.load(KEY + "-meta", null);
if (savedMeta) {
  $("#cap").value = savedMeta.cap || 10;
  $("#title").value = savedMeta.title || $("#title").value;
}

function paintGroups() {
  $("#groups").innerHTML = groups.map((g, i) => `
<div class="panel2" style="display:grid;grid-template-columns:1fr 92px auto;gap:8px;align-items:end">
<div><label style="margin:0 0 4px" for="gn${i}">그룹 이름</label>
<input id="gn${i}" type="text" value="${esc(g.name)}" maxlength="24" data-name="${i}" /></div>
<div><label style="margin:0 0 4px" for="gc${i}">인원</label>
<input id="gc${i}" type="number" min="1" max="300" value="${g.n}" data-n="${i}" inputmode="numeric" /></div>
<button class="btn sec small" type="button" data-del="${i}" aria-label="삭제">✕</button>
</div>`).join("");
}

function allocate() {
  const cap = Math.max(2, Math.min(20, parseInt($("#cap").value, 10) || 10));
  const tables = [];
  for (const g of groups) {
    let left = Math.max(0, Number(g.n) || 0);
    while (left > 0) {
      let t = null;
      if (left < cap) {
        // 남는 자리가 가장 잘 맞는 테이블 찾기
        let best = -1, bestFree = 1e9;
        tables.forEach((tb, i) => {
          const free = cap - tb.total;
          if (free >= left && free < bestFree) { bestFree = free; best = i; }
        });
        if (best >= 0) t = tables[best];
      }
      if (!t) { t = { seats: [], total: 0 }; tables.push(t); }
      const put = Math.min(left, cap - t.total);
      t.seats.push({ name: g.name, n: put });
      t.total += put;
      left -= put;
    }
  }
  return { cap, tables };
}

function draw(cap, tables, title) {
  const cv = $("#cv"), g = cv.getContext("2d");
  const cols = Math.min(4, Math.max(2, Math.ceil(Math.sqrt(tables.length))));
  const rowsN = Math.ceil(tables.length / cols);
  const cw = 230, chh = 170, padX = 40, padTop = 150, padBottom = 50;
  cv.width = padX * 2 + cols * cw;
  cv.height = padTop + rowsN * chh + padBottom;

  g.fillStyle = "#ffffff"; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = "#111827";
  g.font = '700 30px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(title || "자리 배치도", cv.width / 2, 44);

  // 신랑신부석
  g.fillStyle = "#ecfdf5"; g.strokeStyle = "#10b981"; g.lineWidth = 2;
  const hw = Math.min(420, cv.width - 120);
  g.beginPath(); g.roundRect(cv.width / 2 - hw / 2, 78, hw, 46, 12); g.fill(); g.stroke();
  g.fillStyle = "#065f46";
  g.font = '700 18px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  g.fillText("신랑 · 신부석 (무대)", cv.width / 2, 101);

  tables.forEach((t, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = padX + c * cw + 14, y = padTop + r * chh;
    const w = cw - 28, h = chh - 26;
    g.fillStyle = "#f9fafb"; g.strokeStyle = "#d1d5db"; g.lineWidth = 2;
    g.beginPath(); g.roundRect(x, y, w, h, 14); g.fill(); g.stroke();

    g.fillStyle = "#111827"; g.textAlign = "left";
    g.font = '700 17px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
    g.fillText(`${i + 1}번 테이블`, x + 14, y + 24);
    g.fillStyle = "#6b7280"; g.textAlign = "right";
    g.font = '400 14px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
    g.fillText(`${t.total}/${cap}명`, x + w - 14, y + 24);

    g.textAlign = "left";
    t.seats.slice(0, 4).forEach((s, j) => {
      g.fillStyle = "#374151";
      g.font = '400 14.5px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      const label = s.name.length > 12 ? s.name.slice(0, 12) + "…" : s.name;
      g.fillText(`• ${label} ${s.n}명`, x + 14, y + 50 + j * 22);
    });
    if (t.seats.length > 4) {
      g.fillStyle = "#9ca3af";
      g.fillText(`외 ${t.seats.length - 4}개 그룹`, x + 14, y + 50 + 4 * 22);
    }
    if (t.total < cap) {
      g.fillStyle = "#9ca3af";
      g.font = '400 13px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      g.fillText(`여유석 ${cap - t.total}자리`, x + 14, y + h - 12);
    }
  });

  g.fillStyle = "#9ca3af"; g.textAlign = "center";
  g.font = '400 13px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  g.fillText("familyday-kr · 하객 자리배치도", cv.width / 2, cv.height - 22);
}

function render() {
  const { cap, tables } = allocate();
  const totalPeople = groups.reduce((a, g) => a + (Number(g.n) || 0), 0);
  $("#out").innerHTML = `
<section class="result">
<div class="big">${tables.length}개 테이블</div>
<div class="sub">총 ${totalPeople}명 · 테이블당 ${cap}명 기준 · 여유석 ${tables.length * cap - totalPeople}자리</div>
</section>
<section class="panel">
<h2 style="margin-top:0">테이블별 배치</h2>
<div class="tbwrap"><table class="tb">
<thead><tr><th>테이블</th><th>그룹</th><th>인원</th><th>여유</th></tr></thead>
<tbody>${tables.map((t, i) => `<tr><td><b>${i + 1}번</b></td>
<td>${t.seats.map((s) => esc(s.name) + " " + s.n + "명").join("<br>")}</td>
<td>${t.total}명</td><td>${cap - t.total}자리</td></tr>`).join("")}</tbody></table></div>
<div class="btnrow"><button class="btn sec small" type="button" id="cp">배치 결과 복사</button></div>
</section>`;
  $("#cp").addEventListener("click", () => {
    FD.copy(`${$("#title").value}\n` + tables.map((t, i) =>
      `${i + 1}번 테이블 (${t.total}/${cap}) — ` + t.seats.map((s) => `${s.name} ${s.n}명`).join(", ")).join("\n"));
  });
  draw(cap, tables, $("#title").value);
}

$("#groups").addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.name !== undefined) groups[t.dataset.name].name = t.value;
  else if (t.dataset.n !== undefined) groups[t.dataset.n].n = Math.max(0, parseInt(t.value, 10) || 0);
  render();
});
$("#groups").addEventListener("click", (e) => {
  const b = e.target.closest("[data-del]");
  if (!b) return;
  groups.splice(Number(b.dataset.del), 1);
  if (!groups.length) groups.push({ name: "하객", n: 10 });
  paintGroups(); render();
});
$("#addG").addEventListener("click", () => {
  groups.push({ name: "새 그룹", n: 8 });
  paintGroups(); render();
});
$("#cap").addEventListener("input", render);
$("#title").addEventListener("input", render);
$("#dl").addEventListener("click", () => {
  $("#cv").toBlob((b) => FD.download(b, "seat-map.png"), "image/png");
});
$("#save").addEventListener("click", () => {
  if (FD.save(KEY, groups) && FD.save(KEY + "-meta", { cap: $("#cap").value, title: $("#title").value })) FD.toast("이 기기에 저장했습니다");
});
$("#exp").addEventListener("click", () => {
  FD.download(new Blob([JSON.stringify({ cap: $("#cap").value, title: $("#title").value, groups }, null, 2)], { type: "application/json" }), "seat-map.json");
});
$("#wipe").addEventListener("click", () => {
  if (!confirm("저장한 내용을 모두 지울까요? 되돌릴 수 없습니다.")) return;
  FD.wipe(KEY); FD.wipe(KEY + "-meta");
  groups = DEFAULT.map((g) => ({ ...g }));
  paintGroups(); render();
  FD.toast("모두 지웠습니다");
});

paintGroups();
render();
