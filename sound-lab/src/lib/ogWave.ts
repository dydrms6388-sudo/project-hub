import { sounds } from "./sounds";
import { mulberry32 } from "./audio/helpers";

/**
 * OG 이미지용 대표 파형 — 항목의 합성 방식·파라미터에서 결정적으로 생성.
 * 실제 오디오 렌더는 아니지만 같은 수식 계열(가산·FM·잡음·펄스)을 쓴다.
 */
export function ogWaveform(slug: string, n = 240): number[] {
  const s = sounds.find((x) => x.slug === slug);
  const seed = [...slug].reduce((a, c) => a + c.charCodeAt(0), 7);
  const rnd = mulberry32(seed);
  const syn = s?.synthesis ?? "oscillator";
  const out: number[] = [];
  const cycles = 3 + (seed % 4);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 * cycles;
    let v = 0;
    if (syn === "additive") {
      for (let k = 1; k <= 6; k++) v += Math.sin(t * k + seed) / k;
      v /= 1.6;
    } else if (syn === "FM") {
      v = Math.sin(t + 3.2 * Math.sin(t * 2.4));
    } else if (syn === "AM") {
      v = Math.sin(t * 2) * (0.55 + 0.45 * Math.sin(t * 0.35));
    } else if (syn === "noise") {
      v = (rnd() * 2 - 1) * 0.85;
    } else if (syn === "pulse") {
      v = (t % (Math.PI * 2)) < 0.5 ? 0.95 : -0.12;
    } else if (syn === "delay" || syn === "convolution") {
      v = Math.sin(t) * 0.7 + Math.sin(t * 1.02 + 0.8) * 0.5;
    } else if (syn === "physical-model") {
      const decay = Math.exp(-i / (n * 0.55));
      v = (Math.sin(t * 2.3) * 0.6 + (rnd() * 2 - 1) * 0.4) * decay;
    } else if (syn === "worklet") {
      const raw = Math.sin(t);
      v = Math.round(raw * 4) / 4;
    } else if (syn === "waveshaper") {
      v = Math.tanh(2.8 * Math.sin(t));
    } else if (syn === "subtractive") {
      v = Math.sin(t) * 0.72 + Math.sin(t * 3.1) * 0.24;
    } else if (syn === "hybrid") {
      v = Math.sin(t * 1.8) * 0.65 + (rnd() * 2 - 1) * 0.3;
    } else {
      v = Math.sin(t + Math.sin(t * 0.21) * 2.2);
    }
    out.push(Math.max(-1, Math.min(1, v)));
  }
  return out;
}

/** SVG polyline points 문자열 */
export function wavePoints(
  slug: string,
  w: number,
  h: number,
  n = 240
): string {
  const wave = ogWaveform(slug, n);
  return wave
    .map(
      (v, i) =>
        `${((i / (n - 1)) * w).toFixed(1)},${(h / 2 + (v * h * 0.42)).toFixed(1)}`
    )
    .join(" ");
}
