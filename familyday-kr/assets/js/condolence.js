/* condolence.js — 경조사비 범위 안내 + 봉투 미리보기 (ES 모듈) */
import { EVENTS, CLOSENESS, ENVELOPE, CONDOLENCE_META } from "../../data/condolence.mjs";

const $ = (s) => document.querySelector(s);
const esc = (s) => window.FD.esc(s);

const ATTEND = [
  { key: "meal", name: "참석 + 식사", f: 1.0 },
  { key: "brief", name: "참석 후 바로 이동", f: 0.8 },
  { key: "absent", name: "불참 · 마음만 전함", f: 0.7 },
];

let ev = "wedding", cl = "friend", at = "meal";

function chips(box, list, cur, cb) {
  box.innerHTML = list.map((x) =>
    `<button class="chip${x.key === cur ? " on" : ""}" type="button" data-k="${x.key}">${esc(x.name)}</button>`).join("");
  box.onclick = (e) => {
    const b = e.target.closest("[data-k]");
    if (!b) return;
    cb(b.dataset.k);
  };
}
function paint() {
  chips($("#ev"), Object.entries(EVENTS).map(([k, v]) => ({ key: k, name: v.name })), ev, (k) => { ev = k; paint(); });
  chips($("#cl"), CLOSENESS, cl, (k) => { cl = k; paint(); });
  chips($("#at"), ATTEND, at, (k) => { at = k; paint(); });
  fillPhrases();
  render();
}

const roundMan = (n) => Math.max(30000, Math.round(n / 10000) * 10000);

function render() {
  const e = EVENTS[ev];
  const [a, b] = e.ranges[cl];
  const f = ATTEND.find((x) => x.key === at).f;
  let ppl = Math.max(1, Math.min(8, parseInt($("#ppl").value, 10) || 1));
  if (at === "absent") ppl = 1;
  const mult = f * (1 + (ppl - 1) * 0.7);
  const lo = roundMan(a * mult), hi = roundMan(b * mult);
  const clName = CLOSENESS.find((c) => c.key === cl).name;

  $("#out").innerHTML = `
<section class="result">
<div class="big">${lo === hi ? FD.won(lo) : FD.won(lo) + " ~ " + FD.won(hi)}</div>
<div class="sub">${esc(e.name)} · ${esc(clName)} · ${esc(ATTEND.find((x) => x.key === at).name)}${ppl > 1 ? ` · ${ppl}명` : ""}</div>
</section>
<div class="note warn"><b>${esc(CONDOLENCE_META.label)}.</b> 위 금액은 흔히 오가는 폭을 참고로 보여 주는 것일 뿐, 기준이나 규칙이 아닙니다. 그동안 그분에게 받은 만큼, 그리고 본인 형편에 맞춰 정하시면 됩니다.</div>
<section class="panel"><h3 style="margin-top:0">이 자리에서 알아두면 좋은 것</h3>
<ul>${e.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>`;
  drawEnvelope();
}

/* ── 봉투 미리보기 ── */
function fillPhrases() {
  const sel = $("#phrase");
  const cur = sel.value;
  const list = ENVELOPE[ev] || [];
  sel.innerHTML = list.map((p, i) =>
    `<option value="${i}">${esc(p.hanja)} (${esc(p.hangul)})${p.note ? " — " + esc(p.note) : ""}</option>`).join("");
  if (cur && sel.querySelector(`option[value="${cur}"]`)) sel.value = cur;
}
function drawEnvelope() {
  const cv = $("#env"), g = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  g.fillStyle = "#fdfcf8"; g.fillRect(0, 0, W, H);
  g.strokeStyle = "#d8d2c4"; g.lineWidth = 4; g.strokeRect(14, 14, W - 28, H - 28);
  g.strokeStyle = "#e6e1d5"; g.lineWidth = 2; g.strokeRect(30, 30, W - 60, H - 60);

  const item = (ENVELOPE[ev] || [])[parseInt($("#phrase").value, 10) || 0] || { hanja: "", hangul: "" };
  const chars = item.hanja.replace(/\s+/g, "").split("");
  g.fillStyle = ev === "funeral" ? "#1a1a1a" : "#14532d";
  g.textAlign = "center"; g.textBaseline = "middle";
  const size = chars.length > 3 ? 74 : 88;
  g.font = `700 ${size}px "Apple SD Gothic Neo","Noto Sans KR",serif`;
  chars.forEach((c, i) => g.fillText(c, W / 2, 190 + i * (size + 22)));

  g.font = '400 26px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  g.fillStyle = "#6b6455";
  g.fillText(item.hangul, W / 2, 190 + chars.length * (size + 22) + 26);

  const giver = ($("#giver").value || "").trim();
  const belong = ($("#belong").value || "").trim();
  if (giver || belong) {
    g.textAlign = "right"; g.fillStyle = "#2b2b2b";
    g.font = '700 34px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
    if (giver) g.fillText(giver, W - 70, H - 140);
    if (belong) {
      g.font = '400 24px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
      g.fillStyle = "#6b6455";
      g.fillText(belong, W - 70, H - 100);
    }
  }
  g.textAlign = "center"; g.fillStyle = "#b7b0a0";
  g.font = '400 18px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
  g.fillText("봉투 앞면 미리보기", W / 2, H - 46);
}

$("#ppl").addEventListener("input", render);
$("#phrase").addEventListener("change", drawEnvelope);
$("#giver").addEventListener("input", drawEnvelope);
$("#belong").addEventListener("input", drawEnvelope);
$("#dl").addEventListener("click", () => {
  $("#env").toBlob((b) => FD.download(b, "봉투-" + ev + ".png"), "image/png");
});
$("#prt").addEventListener("click", () => window.print());

paint();
