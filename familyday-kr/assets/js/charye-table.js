/* charye-table.js — 차례상 배치도 SVG 생성 + 간소화 토글 (ES 모듈) */
import { traditionalRows, simpleRows, SIMPLE_NOTES, CHARYE_META } from "../../data/charye.mjs";

const $ = (s) => document.querySelector(s);
const esc = (s) => window.FD.esc(s);

let holiday = "chuseok";   // chuseok | seollal
let mode = "simple";       // simple | tradition

const HOL = [{ key: "chuseok", name: "추석 (송편)" }, { key: "seollal", name: "설날 (떡국)" }];
const MODE = [{ key: "simple", name: "성균관 표준안 (간소화)" }, { key: "tradition", name: "전통 5열 (관행)" }];

function chips(box, list, cur, cb) {
  box.innerHTML = list.map((x) =>
    `<button class="chip${x.key === cur ? " on" : ""}" type="button" data-k="${x.key}">${esc(x.name)}</button>`).join("");
  box.onclick = (e) => { const b = e.target.closest("[data-k]"); if (b) cb(b.dataset.k); };
}

function svgTable(rows) {
  const W = 720;
  const padTop = 76, rowH = 78, padBottom = 46;
  const H = padTop + rows.length * rowH + padBottom;
  let out = "";
  // 상판
  out += `<rect x="18" y="${padTop - 26}" width="${W - 36}" height="${rows.length * rowH + 16}" rx="14" fill="var(--panel2)" stroke="currentColor" stroke-opacity=".28"/>`;
  // 신위(북쪽)
  out += `<rect x="${W / 2 - 78}" y="12" width="156" height="44" rx="10" fill="var(--panel)" stroke="currentColor" stroke-opacity=".45"/>`;
  out += `<text x="${W / 2}" y="40" text-anchor="middle" font-size="15" font-weight="700" fill="currentColor">신위(지방) · 북쪽</text>`;
  out += `<text x="34" y="${padTop - 36}" font-size="12" fill="currentColor" opacity=".6">서쪽 →</text>`;
  out += `<text x="${W - 34}" y="${padTop - 36}" text-anchor="end" font-size="12" fill="currentColor" opacity=".6">← 동쪽</text>`;

  rows.forEach((r, ri) => {
    const y = padTop + ri * rowH;
    out += `<text x="34" y="${y + 12}" font-size="12" font-weight="700" fill="currentColor" opacity=".75">${esc(r.name)}</text>`;
    const n = r.items.length;
    const avail = W - 96;
    const bw = Math.min(126, Math.floor(avail / n) - 8);
    const gap = n > 1 ? (avail - bw * n) / (n - 1) : 0;
    r.items.forEach((it, i) => {
      const x = 48 + i * (bw + gap);
      out += `<rect x="${x}" y="${y + 22}" width="${bw}" height="40" rx="9" fill="var(--panel)" stroke="var(--acc2)" stroke-opacity=".55"/>`;
      const fs = it.length > 7 ? 11 : it.length > 5 ? 12 : 13;
      out += `<text x="${x + bw / 2}" y="${y + 47}" text-anchor="middle" font-size="${fs}" fill="currentColor">${esc(it)}</text>`;
    });
  });
  out += `<text x="${W / 2}" y="${H - 16}" text-anchor="middle" font-size="12.5" fill="currentColor" opacity=".65">제사를 지내는 사람은 이쪽(남쪽)에 섭니다</text>`;
  return `<svg class="fig" viewBox="0 0 ${W} ${H}" role="img" aria-label="차례상 배치도">${out}</svg>`;
}

function render() {
  const isChuseok = holiday === "chuseok";
  const rows = mode === "simple" ? simpleRows(isChuseok) : traditionalRows(isChuseok);
  const holName = isChuseok ? "추석" : "설날";
  const modeName = mode === "simple" ? "성균관 의례정립위원회 표준안(간소화)" : "전통 5열 관행 배치";

  $("#out").innerHTML = `
<section class="panel">
<h2 style="margin-top:0">${esc(holName)} 차례상 — ${esc(modeName)}</h2>
${svgTable(rows)}
</section>
<section class="panel">
<h3 style="margin-top:0">차림 목록</h3>
<div class="tbwrap"><table class="tb"><thead><tr><th>줄</th><th>올리는 음식 (서 → 동)</th></tr></thead>
<tbody>${rows.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td>${r.items.map(esc).join(" · ")}</td></tr>`).join("")}</tbody></table></div>
${mode === "simple"
      ? `<ul>${SIMPLE_NOTES.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
      : `<p class="note warn">전통 5열 배치는 오랫동안 이어져 온 <b>민간 관행</b>입니다. 성균관 표준안은 홍동백서·조율이시 같은 규칙이 옛 예법 문헌에는 없다고 밝히고 있습니다. 집안에서 지켜 온 방식이 있다면 그 방식이 기준입니다.</p>`}
<p class="note">${esc(CHARYE_META.disclaimer)}</p>
</section>`;
}

function paint() {
  chips($("#hol"), HOL, holiday, (k) => { holiday = k; paint(); });
  chips($("#mode"), MODE, mode, (k) => { mode = k; paint(); });
  render();
}
$("#print").addEventListener("click", () => window.print());
paint();
