// 색상 수학 라이브러리 — 전부 표준 공식 기반.
// - 상대 휘도/대비비: WCAG 2.1 (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance)
// - CIE LAB: sRGB(D65) → XYZ → LAB, 백색점 D65
// - OKLab/OKLCH: Björn Ottosson (2020), CSS Color Module Level 4 채택 공식
// - 색각 이상 시뮬레이션: Machado, Oliveira & Fernandes (2009, IEEE TVCG) severity 1.0 행렬

export type RGB = { r: number; g: number; b: number }; // 0-255
export type HSL = { h: number; s: number; l: number }; // h 0-360, s/l 0-100
export type LAB = { L: number; a: number; b: number };
export type OKLCH = { L: number; C: number; h: number };

// ── HEX ↔ RGB ──────────────────────────────────────────────
export function hexToRgb(hex: string): RGB | null {
  const m = hex.trim().replace(/^#/, "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

// ── RGB ↔ HSL ──────────────────────────────────────────────
export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100, ln = l / 100;
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = ln - c / 2;
  let rn = 0, gn = 0, bn = 0;
  if (hue < 60) [rn, gn, bn] = [c, x, 0];
  else if (hue < 120) [rn, gn, bn] = [x, c, 0];
  else if (hue < 180) [rn, gn, bn] = [0, c, x];
  else if (hue < 240) [rn, gn, bn] = [0, x, c];
  else if (hue < 300) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];
  return { r: (rn + m) * 255, g: (gn + m) * 255, b: (bn + m) * 255 };
}

// ── sRGB 감마 ↔ 선형 ───────────────────────────────────────
export function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(v: number): number {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, c * 255));
}

// ── WCAG 2.1 상대 휘도 · 대비비 ─────────────────────────────
export function relativeLuminance(rgb: RGB): number {
  return (
    0.2126 * srgbToLinear(rgb.r) +
    0.7152 * srgbToLinear(rgb.g) +
    0.0722 * srgbToLinear(rgb.b)
  );
}

export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export type WcagGrade = {
  ratio: number;
  aaNormal: boolean; // ≥ 4.5
  aaLarge: boolean; // ≥ 3
  aaaNormal: boolean; // ≥ 7
  aaaLarge: boolean; // ≥ 4.5
};

export function wcagGrade(a: RGB, b: RGB): WcagGrade {
  const ratio = contrastRatio(a, b);
  return {
    ratio,
    aaNormal: ratio >= 4.5,
    aaLarge: ratio >= 3,
    aaaNormal: ratio >= 7,
    aaaLarge: ratio >= 4.5,
  };
}

// ── CIE LAB (D65) ──────────────────────────────────────────
// sRGB(선형) → XYZ (IEC 61966-2-1 행렬), 백색점 D65 (Xn=0.95047, Yn=1, Zn=1.08883)
export function rgbToLab(rgb: RGB): LAB {
  const r = srgbToLinear(rgb.r), g = srgbToLinear(rgb.g), b = srgbToLinear(rgb.b);
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const f = (t: number) =>
    t > 0.008856451679 ? Math.cbrt(t) : (903.2962962 * t + 16) / 116;
  const fx = f(X / 0.95047), fy = f(Y / 1), fz = f(Z / 1.08883);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

// ΔE*ab (CIE76)
export function deltaE76(a: LAB, b: LAB): number {
  return Math.sqrt((a.L - b.L) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2);
}

// ── OKLab / OKLCH (Ottosson 2020) ─────────────────────────
export function rgbToOklab(rgb: RGB): { L: number; a: number; b: number } {
  const r = srgbToLinear(rgb.r), g = srgbToLinear(rgb.g), b = srgbToLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToRgb(lab: { L: number; a: number; b: number }): RGB {
  const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
  const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
  const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

export function rgbToOklch(rgb: RGB): OKLCH {
  const { L, a, b } = rgbToOklab(rgb);
  const C = Math.sqrt(a * a + b * b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { L, C, h };
}

export function oklchToRgb({ L, C, h }: OKLCH): RGB {
  const rad = (h * Math.PI) / 180;
  return oklabToRgb({ L, a: C * Math.cos(rad), b: C * Math.sin(rad) });
}

// ── 색각 이상 시뮬레이션 ────────────────────────────────────
// Machado, G. M., Oliveira, M. M., & Fernandes, L. A. F. (2009).
// "A Physiologically-based Model for Simulation of Color Vision Deficiency",
// IEEE Transactions on Visualization and Computer Graphics, 15(6).
// severity 1.0 행렬, 선형 RGB에 적용.
export const CVD_MATRICES = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
} as const;

export type CvdType = keyof typeof CVD_MATRICES;

export const CVD_LABELS: Record<CvdType, { ko: string; en: string }> = {
  protanopia: { ko: "제1색각 이상(적색맹)", en: "Protanopia" },
  deuteranopia: { ko: "제2색각 이상(녹색맹)", en: "Deuteranopia" },
  tritanopia: { ko: "제3색각 이상(청색맹)", en: "Tritanopia" },
};

export function simulateCvd(rgb: RGB, type: CvdType): RGB {
  const M = CVD_MATRICES[type];
  const r = srgbToLinear(rgb.r), g = srgbToLinear(rgb.g), b = srgbToLinear(rgb.b);
  return {
    r: linearToSrgb(M[0][0] * r + M[0][1] * g + M[0][2] * b),
    g: linearToSrgb(M[1][0] * r + M[1][1] * g + M[1][2] * b),
    b: linearToSrgb(M[2][0] * r + M[2][1] * g + M[2][2] * b),
  };
}

// ── 배색 (색상환 각도 회전) ─────────────────────────────────
export function rotateHue(hex: string, deg: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const hsl = rgbToHsl(rgb);
  return rgbToHex(hslToRgb({ ...hsl, h: hsl.h + deg }));
}

export type HarmonySet = { name: string; degrees: number[] };

export const HARMONIES: HarmonySet[] = [
  { name: "보색", degrees: [0, 180] },
  { name: "유사색", degrees: [-30, 0, 30] },
  { name: "삼각 배색", degrees: [0, 120, 240] },
  { name: "분할 보색", degrees: [0, 150, 210] },
  { name: "사각 배색", degrees: [0, 90, 180, 270] },
];

export function harmonyColors(hex: string, degrees: readonly number[]): string[] {
  return degrees.map((d) => rotateHue(hex, d));
}

// ── 명도 스케일 (OKLCH L 보간) ──────────────────────────────
export function lightnessScale(hex: string, steps = 9): string[] {
  const rgb = hexToRgb(hex);
  if (!rgb) return [];
  const { C, h } = rgbToOklch(rgb);
  const out: string[] = [];
  const Lmin = 0.16, Lmax = 0.97;
  for (let i = 0; i < steps; i++) {
    const L = Lmax - ((Lmax - Lmin) * i) / (steps - 1);
    // 밝은 끝/어두운 끝에서 채도를 줄여 sRGB 범위 밖 클리핑 완화
    const edge = Math.min(1, (1 - Math.abs(2 * ((Lmax - L) / (Lmax - Lmin)) - 1)) * 1.6 + 0.25);
    out.push(rgbToHex(oklchToRgb({ L, C: C * edge, h })));
  }
  return out;
}

// ── 혼합 ───────────────────────────────────────────────────
export function mixSrgb(a: RGB, b: RGB, t: number): RGB {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

export function mixOklab(a: RGB, b: RGB, t: number): RGB {
  const la = rgbToOklab(a), lb = rgbToOklab(b);
  return oklabToRgb({
    L: la.L + (lb.L - la.L) * t,
    a: la.a + (lb.a - la.a) * t,
    b: la.b + (lb.b - la.b) * t,
  });
}

// ── 표기 문자열 ────────────────────────────────────────────
export function fmtRgb(rgb: RGB): string {
  return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
}
export function fmtHsl(rgb: RGB): string {
  const { h, s, l } = rgbToHsl(rgb);
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}
export function fmtLab(rgb: RGB): string {
  const { L, a, b } = rgbToLab(rgb);
  return `lab(${L.toFixed(1)} ${a.toFixed(1)} ${b.toFixed(1)})`;
}
export function fmtOklch(rgb: RGB): string {
  const { L, C, h } = rgbToOklch(rgb);
  return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${h.toFixed(1)})`;
}

// 색 위에 얹을 텍스트 색(흰/검) — WCAG 대비비 기준으로 선택
export function bestTextOn(rgb: RGB): "#FFFFFF" | "#000000" {
  const white = contrastRatio(rgb, { r: 255, g: 255, b: 255 });
  const black = contrastRatio(rgb, { r: 0, g: 0, b: 0 });
  return white >= black ? "#FFFFFF" : "#000000";
}
