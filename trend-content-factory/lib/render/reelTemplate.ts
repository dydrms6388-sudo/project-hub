// 릴 HTML 생성기 — CSS 애니메이션(Ken Burns + 자막 번인 + 진행바 + 세이프존).
// Playwright 로 이 페이지를 녹화(webm)한 뒤 ffmpeg 로 MP4(H.264) 인코딩한다.

import type { ReelBeat, Vertical } from '../types.js';
import type { PlatformSpec } from '../../config/platforms.js';
import { fontFaceCss, fontStackFor } from './fonts.js';
import { proceduralBackgroundCss, foregroundFor } from '../media/background.js';

export type ReelInput = {
  vertical: Vertical;
  spec: PlatformSpec;
  beats: ReelBeat[];
  hook: string;
  seed: number;
  durationSec: number;
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildReelHtml(input: ReelInput): string {
  const { vertical, spec, beats, hook, seed, durationSec } = input;
  const { w, h } = spec.reel;
  const [, accent] = vertical.palette;
  const fg = foregroundFor(vertical.palette[0]);
  const stack = fontStackFor(vertical.typeface);
  const bgCss = proceduralBackgroundCss(vertical.palette, seed);
  const SAFE = 220; // 상하 세이프존 px

  // 자막 트랙: beat.t(초) 기준으로 각 자막 표시 구간 계산.
  const cues = beats.length
    ? beats
    : [{ t: 0, narration: hook, onscreen: hook, b_roll: '' }];
  const cueEls = cues
    .map((c, i) => {
      const start = Math.max(0, c.t);
      const end = i + 1 < cues.length ? cues[i + 1]!.t : durationSec;
      const text = esc(c.onscreen || c.narration || '');
      // 각 자막을 지연 표시 후 숨김 (개별 keyframes).
      return `<div class="cue" style="animation:cue${i} ${durationSec}s linear forwards">${text}</div>
        <style>@keyframes cue${i}{
          0%,${pct(start, durationSec)}%{opacity:0;transform:translateY(24px) scale(.98)}
          ${pct(start + 0.25, durationSec)}%{opacity:1;transform:translateY(0) scale(1)}
          ${pct(end - 0.2, durationSec)}%{opacity:1}
          ${pct(end, durationSec)}%,100%{opacity:0}
        }</style>`;
    })
    .join('\n');

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${fontFaceCss()}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#000;overflow:hidden}
#reel{position:relative;width:${w}px;height:${h}px;overflow:hidden;color:${fg};font-family:${stack}}
#bg{position:absolute;inset:0;${bgCss}
  animation:ken ${durationSec}s ease-out forwards;transform-origin:50% 40%}
@keyframes ken{0%{transform:scale(1) translate(0,0)}100%{transform:scale(1.14) translate(-2%,-3%)}}
#scrim{position:absolute;inset:0;background:linear-gradient(180deg,
  ${hexA(vertical.palette[0], 0.1)} 0%, transparent 35%, ${hexA(vertical.palette[0], 0.55)} 100%)}
#top{position:absolute;left:0;right:0;top:${SAFE - 120}px;text-align:center;
  font-size:34px;font-weight:800;letter-spacing:-.02em;opacity:.9}
.hook{position:absolute;left:60px;right:60px;top:${Math.round(h * 0.3)}px;text-align:center;
  font-size:76px;font-weight:800;line-height:1.14;letter-spacing:-.03em;word-break:keep-all;
  animation:hookIn 1s ease-out both}
@keyframes hookIn{0%{opacity:0;transform:translateY(30px)}100%{opacity:1;transform:translateY(0)}}
.cues{position:absolute;left:60px;right:60px;bottom:${SAFE + 40}px;min-height:220px;text-align:center}
.cue{position:absolute;left:0;right:0;font-size:56px;font-weight:800;line-height:1.2;
  letter-spacing:-.02em;word-break:keep-all;opacity:0;
  text-shadow:0 4px 24px rgba(0,0,0,.5)}
.cue::after{content:'';display:block;height:8px;width:120px;margin:24px auto 0;border-radius:6px;background:${accent}}
#bar{position:absolute;left:0;bottom:0;height:10px;background:${accent};width:0;
  animation:bar ${durationSec}s linear forwards}
@keyframes bar{to{width:100%}}
#wm{position:absolute;left:0;right:0;bottom:${SAFE - 140}px;text-align:center;font-size:26px;
  font-weight:700;opacity:.8}
</style></head><body>
<div id="reel">
  <div id="bg"></div><div id="scrim"></div>
  <div id="top">${esc(vertical.topic)} · ${esc(vertical.handle.ig)}</div>
  <div class="hook">${esc(hook)}</div>
  <div class="cues">${cueEls}</div>
  <div id="wm">tomatoeggcat.com/${esc(vertical.slug)}</div>
  <div id="bar"></div>
</div>
</body></html>`;
}

function pct(sec: number, total: number): number {
  return Math.max(0, Math.min(100, (sec / total) * 100));
}

function hexA(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  const n = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}
