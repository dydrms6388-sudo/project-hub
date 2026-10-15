/* kinship-calc.js — 촌수 계산기 화면 로직 (ES 모듈, 의존성 0) */
import { STEPS, STEP_LABEL, computeChon, chonText } from "./kinship-core.mjs";
import { TITLE_MAP, KINSHIP_META } from "../../data/kinship.mjs";

const $ = (s) => document.querySelector(s);
const esc = (s) => window.FD.esc(s);

const PHRASE = {
  f: "아버지", m: "어머니", h: "남편", w: "아내",
  ob: "형·오빠", yb: "남동생", os: "누나·언니", ys: "여동생",
  s: "아들", d: "딸",
};
const GEN = { f: 1, m: 1, h: 0, w: 0, ob: 0, yb: 0, os: 0, ys: 0, s: -1, d: -1 };
const EDGE = { f: "부모", m: "부모", h: "배우자", w: "배우자", ob: "형제", yb: "형제", os: "자매", ys: "자매", s: "자녀", d: "자녀" };

let path = [];
let sex = "M";

/* ── 초기화 ── */
const stepsBox = $("#steps");
stepsBox.innerHTML = STEPS.map((s) =>
  `<button class="chip" type="button" data-step="${s.code}">${esc(s.label)}</button>`).join("");
stepsBox.addEventListener("click", (e) => {
  const b = e.target.closest("[data-step]");
  if (!b) return;
  if (path.length >= 8) { FD.toast("8단계까지만 계산합니다."); return; }
  path.push(b.dataset.step);
  render();
});
$("#undo").addEventListener("click", () => { path.pop(); render(); });
$("#reset").addEventListener("click", () => { path = []; render(); });
$("#share").addEventListener("click", () => {
  const u = location.origin + location.pathname + (path.length ? "?p=" + path.join(".") + "&sex=" + sex : "");
  FD.copy(u, "링크를 복사했습니다");
});
$("#sex").addEventListener("change", (e) => { sex = e.target.value; render(); });

const q = new URLSearchParams(location.search);
if (q.get("p")) path = q.get("p").split(".").filter((c) => STEP_LABEL[c]);
if (q.get("sex") === "F") { sex = "F"; $("#sex").value = "F"; }

/* ── 가계도 SVG ── */
function tree() {
  const nodes = [{ label: "나", gen: 0, me: true }];
  let gen = 0;
  path.forEach((st, i) => {
    gen += GEN[st];
    nodes.push({ label: PHRASE[st], gen, edge: EDGE[st], last: i === path.length - 1 });
  });
  const minG = Math.min(...nodes.map((n) => n.gen));
  const maxG = Math.max(...nodes.map((n) => n.gen));
  const colW = 118, rowH = 78, padX = 62, padY = 44;
  const w = padX * 2 + (nodes.length - 1) * colW;
  const h = padY * 2 + (maxG - minG) * rowH;
  const X = (i) => padX + i * colW;
  const Y = (g) => padY + (maxG - g) * rowH;

  let out = "";
  for (let i = 1; i < nodes.length; i++) {
    const x1 = X(i - 1), y1 = Y(nodes[i - 1].gen), x2 = X(i), y2 = Y(nodes[i].gen);
    const dash = nodes[i].edge === "배우자" ? ' stroke-dasharray="5 4"' : "";
    out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.8" opacity=".5"${dash}/>`;
    out += `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 7}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".65">${esc(nodes[i].edge)}</text>`;
  }
  nodes.forEach((n, i) => {
    const x = X(i), y = Y(n.gen);
    const fill = n.me ? "var(--acc2)" : n.last ? "var(--acc2)" : "var(--panel2)";
    const tc = (n.me || n.last) ? "var(--cta-tx)" : "currentColor";
    out += `<g><rect x="${x - 44}" y="${y - 17}" width="88" height="34" rx="9" fill="${fill}" stroke="currentColor" stroke-opacity=".35"/>` +
      `<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="${tc}">${esc(n.label)}</text></g>`;
  });
  return `<svg class="fig" viewBox="0 0 ${w} ${h}" role="img" aria-label="관계 가계도">${out}</svg>`;
}

/* ── 결과 ── */
function render() {
  const pathBox = $("#pathbox");
  pathBox.innerHTML = path.length
    ? `<b>나</b>${path.map((s) => ` <span style="opacity:.5">→</span> ${esc(PHRASE[s])}`).join("")}`
    : "<b>나</b> <span style=\"opacity:.6\">— 아래 버튼을 눌러 관계를 쌓아 보세요</span>";

  const out = $("#out");
  if (!path.length) { out.innerHTML = ""; return; }

  const key = path.join(".");
  const r = computeChon(path);
  const t = TITLE_MAP[key];
  const phrase = path.map((s) => PHRASE[s]).join("의 ");
  const name = t ? t.name : "표준 호칭이 정해져 있지 않은 관계";
  const call = t ? (sex === "F" && t.callF ? t.callF : t.call) : null;

  const rows = [];
  rows.push(["부를 때 (호칭어)", call ? esc(call) : "집안에서 쓰는 말을 따릅니다"]);
  rows.push(["가리킬 때 (지칭어)", t ? esc(t.name) : "촌수로 설명하는 것이 자연스럽습니다"]);
  if (t && t.hanja) rows.push(["한자", esc(t.hanja)]);
  rows.push(["촌수", esc(chonText(r))]);
  rows.push(["관계 구분", r.spouse ? "배우자" : r.affinal ? "인척 (혼인으로 이어진 관계)" : "혈족 (피로 이어진 관계)"]);
  rows.push(["세대", r.generation > 0 ? `나보다 ${r.generation}세대 위` : r.generation < 0 ? `나보다 ${-r.generation}세대 아래` : "나와 같은 세대"]);

  out.innerHTML = `
<section class="result">
<div class="big">${esc(t ? t.name.split("(")[0] : chonText(r))}</div>
<div class="sub">${esc(phrase)} · ${esc(chonText(r))}</div>
</section>
<section class="panel"><h2 style="margin-top:0">가계도</h2>${tree()}
<p class="src">점선은 배우자(무촌) 관계입니다.</p></section>
<section class="panel"><h2 style="margin-top:0">호칭 정리</h2>
<div class="tbwrap"><table class="tb"><tbody>${rows.map((x) =>
    `<tr><th style="width:38%">${x[0]}</th><td>${x[1]}</td></tr>`).join("")}</tbody></table></div>
${t && t.note ? `<p class="note">${esc(t.note)}</p>` : ""}
${!t ? `<p class="note warn">이 조합은 국립국어원 『표준 언어 예절』에 표제어가 없습니다. 촌수는 정확히 계산되지만, 부르는 말은 가장 가까운 관계에 준해 집안에서 쓰는 방식을 따르는 것이 자연스럽습니다.</p>` : ""}
<p class="src">기준 자료: ${esc(KINSHIP_META.source)} · 확인일 ${esc(KINSHIP_META.checkedAt)}</p>
</section>`;
}

render();
