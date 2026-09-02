/* typelab-kr 공용 유틸 (ES module) — 결과 카드 캔버스 / 공유 */

export async function copyText(text, btn) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove();
  }
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = ok ? '복사 완료!' : '복사 실패';
    setTimeout(() => { btn.textContent = orig; }, 1600);
  }
  return ok;
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* d = { emoji, testTitle, resultTitle, summary, color, watermark } */
export function drawResultCard(canvas, d) {
  const W = 1000, H = 1250;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const base = d.color || '#7c3aed';

  // 배경 그라디언트
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, base);
  g.addColorStop(1, '#1e1b4b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 흰 카드
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.28)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, 70, 100, W - 140, H - 230, 40);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  const cx = W / 2;
  const font = "'Pretendard Variable',Pretendard,-apple-system,'Noto Sans KR',sans-serif";
  ctx.textAlign = 'center';

  // 테스트 이름 배지
  ctx.font = '700 34px ' + font;
  const tw = ctx.measureText(d.testTitle).width + 70;
  roundRect(ctx, cx - tw / 2, 175, tw, 74, 37);
  ctx.fillStyle = '#ede9fe';
  ctx.fill();
  ctx.fillStyle = base;
  ctx.fillText(d.testTitle, cx, 224);

  // 이모지
  ctx.font = '190px ' + font;
  ctx.fillText(d.emoji || '🧪', cx, 480);

  // "나의 결과"
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 30px ' + font;
  ctx.fillText('나 의  결 과', cx, 570);

  // 결과 타이틀 (줄바꿈)
  ctx.fillStyle = '#1a202c';
  ctx.font = '800 62px ' + font;
  let y = 660;
  for (const line of wrapLines(ctx, d.resultTitle, W - 260)) {
    ctx.fillText(line, cx, y);
    y += 78;
  }

  // 요약 (줄바꿈)
  ctx.fillStyle = '#64748b';
  ctx.font = '400 36px ' + font;
  y += 18;
  for (const line of wrapLines(ctx, d.summary, W - 260).slice(0, 4)) {
    ctx.fillText(line, cx, y);
    y += 54;
  }

  // 워터마크
  ctx.fillStyle = 'rgba(255,255,255,.92)';
  ctx.font = '700 32px ' + font;
  ctx.fillText(d.watermark || 'typelab-kr.vercel.app', cx, H - 52);
}

function slugFileName(s) {
  return String(s).replace(/[^\w가-힣-]+/g, '-').replace(/^-+|-+$/g, '') || 'result';
}

/* 결과 페이지 버튼 바인딩. d = drawResultCard 인자 + { url, shareText } */
export function bindResultActions(d) {
  const canvas = document.getElementById('card-canvas');
  if (canvas) {
    try { drawResultCard(canvas, d); } catch (e) { canvas.closest('.card-canvas-box').style.display = 'none'; }
  }

  const $ = (id) => document.getElementById(id);

  const save = $('btn-save');
  if (save && canvas) save.addEventListener('click', () => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'typelab-' + slugFileName(d.resultTitle) + '.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }, 'image/png');
  });

  const link = $('btn-link');
  if (link) link.addEventListener('click', () => copyText(d.url, link));

  const txt = $('btn-text');
  if (txt) txt.addEventListener('click', () => {
    const block = '[' + d.testTitle + ']\n나의 결과: ' + d.resultTitle + '\n"' + d.summary + '"\n\n나도 해보기 👉 ' + d.url;
    copyText(block, txt);
  });

  const share = $('btn-share');
  if (share) share.addEventListener('click', async () => {
    const payload = { title: d.testTitle, text: '나의 결과: ' + d.resultTitle, url: d.url };
    if (navigator.share) {
      try { await navigator.share(payload); } catch (e) { /* 사용자가 취소 */ }
    } else {
      copyText(d.url, share);
    }
  });

  const x = $('btn-x');
  if (x) x.setAttribute('href',
    'https://twitter.com/intent/tweet?text=' +
    encodeURIComponent('[' + d.testTitle + '] 나의 결과: ' + d.resultTitle) +
    '&url=' + encodeURIComponent(d.url));
}
