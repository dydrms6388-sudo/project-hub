// 배경 생성 — 기본은 라이선스 안전한 '자체 생성' 절차적 CSS 배경(외부 이미지 0).
// 선택적으로 fal.ai(FAL_KEY) 로 대표컷 생성 가능하나, 없으면 CSS 배경 사용.
// ⚠️ 웹에서 긁은 이미지 사용 금지 (프롬프트 제약). CSS 배경은 팔레트에서 결정론 생성.

export type Palette = [string, string, string];

/** 팔레트 + seed 로 결정론적 CSS 배경(그라디언트+메시+노이즈 레이어)을 만든다. */
export function proceduralBackgroundCss(palette: Palette, seed: number): string {
  const [bg, accent, light] = palette;
  const a1 = 20 + (seed % 40);
  const a2 = 60 + (seed % 30);
  const rot = (seed * 37) % 360;
  // 여러 radial + linear 레이어로 각 버티컬이 다른 질감을 갖게 한다.
  return `
    background-color: ${bg};
    background-image:
      radial-gradient(circle at ${a1}% ${a2}%, ${hexA(accent, 0.28)}, transparent 45%),
      radial-gradient(circle at ${100 - a1}% ${20 + (seed % 50)}%, ${hexA(light, 0.10)}, transparent 40%),
      linear-gradient(${rot}deg, ${bg} 0%, ${mix(bg, accent, 0.18)} 100%);
  `;
}

/** 대표컷 자리(있으면 fal 이미지 URL, 없으면 절차적 블록). Phase 2 기본은 절차적. */
export function hasFal(): boolean {
  return Boolean(process.env['FAL_KEY']);
}

function hexA(hex: string, alpha: number): string {
  const { r, g, b } = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function mix(a: string, b: string, t: number): string {
  const ra = toRgb(a);
  const rb = toRgb(b);
  const r = Math.round(ra.r + (rb.r - ra.r) * t);
  const g = Math.round(ra.g + (rb.g - ra.g) * t);
  const bl = Math.round(ra.b + (rb.b - ra.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function toRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return {
    r: parseInt(n.slice(0, 2), 16) || 0,
    g: parseInt(n.slice(2, 4), 16) || 0,
    b: parseInt(n.slice(4, 6), 16) || 0,
  };
}

/** 팔레트 밝기로 대비 좋은 전경색 선택. */
export function foregroundFor(hex: string): string {
  const { r, g, b } = toRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111318' : '#FFFFFF';
}
