/* message-temp.js — 문자 템플릿 치환·복사 (ES 모듈) */
import { CATEGORIES, TEMPLATES } from "../../data/messages.mjs";

const $ = (s) => document.querySelector(s);
const esc = (s) => window.FD.esc(s);

const KEYS = ["이름", "고인", "상주", "관계", "일시", "장소", "빈소", "발인"];
let cat = CATEGORIES[0].key;

function vals() {
  const o = {};
  KEYS.forEach((k) => { o[k] = ($("#v" + k) ? $("#v" + k).value.trim() : ""); });
  return o;
}
function fill(body) {
  const v = vals();
  return body.replace(/\{(\w+)\}/g, (m, k) => (v[k] ? v[k] : m));
}

function render() {
  const list = TEMPLATES.filter((t) => t.cat === cat);
  const catName = (CATEGORIES.find((c) => c.key === cat) || {}).name || "";
  $("#list").innerHTML = `<h2>${esc(catName)} <span class="badge ok">${list.length}가지</span></h2>` +
    list.map((t, i) => {
      const txt = fill(t.body);
      return `<section class="panel2">
<p style="margin:0 0 6px;font-weight:700;color:var(--txs);font-size:14.5px">${esc(t.title)}</p>
<p class="msg-body" id="m${i}" style="white-space:pre-wrap;margin:0;color:var(--tx2);font-size:14.5px">${esc(txt)}</p>
<div class="btnrow"><button class="btn sec small" type="button" data-i="${i}">복사</button>
<span class="src" style="align-self:center">${txt.length}자</span></div>
</section>`;
    }).join("");

  $("#list").querySelectorAll("[data-i]").forEach((b) => {
    b.addEventListener("click", () => {
      const el = document.getElementById("m" + b.dataset.i);
      FD.copy(el.textContent, "문구를 복사했습니다");
    });
  });
}

function paintCats() {
  $("#cats").innerHTML = CATEGORIES.map((c) =>
    `<button class="chip${c.key === cat ? " on" : ""}" type="button" data-k="${c.key}">${esc(c.name)} <span style="opacity:.6">${TEMPLATES.filter((t) => t.cat === c.key).length}</span></button>`).join("");
}
$("#cats").addEventListener("click", (e) => {
  const b = e.target.closest("[data-k]");
  if (!b) return;
  cat = b.dataset.k;
  paintCats();
  render();
});
KEYS.forEach((k) => {
  const el = $("#v" + k);
  if (el) el.addEventListener("input", render);
});

paintCats();
render();
