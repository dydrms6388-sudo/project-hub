// 카드뉴스 HTML 생성기 (파라메트릭 템플릿 엔진).
// 버티컬별 팔레트·타이포·레이아웃 variant 로 20종을 파생 → 각 계정 비주얼이 구분된다.

import type { Vertical } from '../types.js';
import type { PlatformSpec } from '../../config/platforms.js';
import { fontFaceCss, fontStackFor } from './fonts.js';
import { proceduralBackgroundCss, foregroundFor } from '../media/background.js';

export type CardSlide = { headline: string; body: string };

export type CardInput = {
  vertical: Vertical;
  spec: PlatformSpec;
  slide: CardSlide;
  index: number; // 0-base
  total: number;
  isCover: boolean;
  hook: string;
  seed: number;
};

/** cardTemplate 문자열 → 레이아웃 variant (0~4). */
function variantOf(templateId: string): number {
  let h = 0;
  for (let i = 0; i < templateId.length; i += 1) h = (h * 31 + templateId.charCodeAt(i)) & 0xffff;
  return h % 5;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildCardHtml(input: CardInput): string {
  const { vertical, spec, slide, index, total, isCover, hook, seed } = input;
  const { w, h } = spec.card;
  const [, accent, light] = vertical.palette;
  const bgCss = proceduralBackgroundCss(vertical.palette, seed + index);
  const fg = foregroundFor(vertical.palette[0]);
  const stack = fontStackFor(vertical.typeface);
  const variant = variantOf(vertical.cardTemplate);
  const landscape = w > h;

  // variant 별 정렬/악센트 배치
  const align = variant === 1 ? 'center' : variant === 3 ? 'flex-end' : 'flex-start';
  const textAlign = variant === 1 ? 'center' : 'left';
  const accentBar =
    variant === 0
      ? `#card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:14px;background:${accent}}`
      : variant === 2
        ? `#card::before{content:'';position:absolute;left:0;right:0;top:0;height:14px;background:${accent}}`
        : variant === 4
          ? `#card::before{content:'';position:absolute;left:0;right:0;bottom:0;height:14px;background:${accent}}`
          : '';

  const headlineSize = landscape ? 64 : isCover ? 92 : 72;
  const bodySize = landscape ? 30 : 40;
  const pad = landscape ? 72 : 96;

  const kicker = `${esc(vertical.topic)} · ${esc(vertical.handle.ig)}`;
  const badge = `${index + 1} / ${total}`;
  const headline = esc(isCover ? hook || slide.headline : slide.headline);
  const body = esc(slide.body);

  const dots = Array.from({ length: total }, (_, i) =>
    `<span style="width:${i === index ? 26 : 10}px;height:10px;border-radius:6px;background:${
      i === index ? accent : hexA(fg, 0.35)
    };display:inline-block;margin-right:6px"></span>`,
  ).join('');

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fontFaceCss()}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#000}
#card{position:relative;width:${w}px;height:${h}px;overflow:hidden;${bgCss}
  color:${fg};font-family:${stack};display:flex;flex-direction:column;
  justify-content:space-between;align-items:stretch;padding:${pad}px}
${accentBar}
.kick{font-size:26px;font-weight:700;letter-spacing:-.02em;opacity:.85;text-transform:none}
.badge{font-size:24px;font-weight:800;color:${accent}}
.top{display:flex;justify-content:space-between;align-items:center;gap:16px}
.mid{flex:1;display:flex;flex-direction:column;justify-content:${align};gap:${landscape ? 20 : 36}px;
  text-align:${textAlign};padding:${landscape ? 24 : 48}px 0}
.headline{font-size:${headlineSize}px;font-weight:800;line-height:1.14;letter-spacing:-.03em;
  word-break:keep-all;text-wrap:balance}
.body{font-size:${bodySize}px;font-weight:400;line-height:1.5;word-break:keep-all;opacity:.95;
  max-width:${landscape ? '70%' : '100%'}}
.foot{display:flex;justify-content:space-between;align-items:center;gap:16px}
.dots{display:flex;align-items:center}
.wm{font-size:24px;font-weight:700;opacity:.8;letter-spacing:.02em}
.chip{display:inline-block;background:${hexA(light, 0.16)};border:1px solid ${hexA(fg, 0.25)};
  color:${fg};font-size:24px;font-weight:700;padding:8px 18px;border-radius:999px}
</style></head><body>
<div id="card">
  <div class="top"><div class="kick">${kicker}</div><div class="badge">${badge}</div></div>
  <div class="mid">
    ${isCover ? `<div class="chip">${esc(vertical.format === 'reel' ? 'REEL' : 'CARD')} · ${esc(vertical.topic)}</div>` : ''}
    <div class="headline">${headline}</div>
    ${body ? `<div class="body">${body}</div>` : ''}
  </div>
  <div class="foot"><div class="dots">${dots}</div><div class="wm">tomatoeggcat.com/${esc(vertical.slug)}</div></div>
</div>
</body></html>`;
}

function hexA(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  const n = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}
