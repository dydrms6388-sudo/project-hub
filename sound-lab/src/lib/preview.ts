/**
 * OG 이미지용 파형 미리보기 — 각 항목의 합성 방식과 기본 파라미터로
 * 대표 파형을 순수 JS로 계산한다 (빌드 시 실행, Web Audio 불필요).
 */
import type { Sound } from "./sounds";

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** width개의 표본, 값 범위 -1..1 */
export function previewSamples(sound: Sound, width = 560): number[] {
  const out = new Array<number>(width).fill(0);
  const rnd = prng(hash(sound.slug));
  const cycles = 3 + (hash(sound.slug) % 4);
  const w = (i: number) => (i / width) * Math.PI * 2 * cycles;

  switch (sound.synthesis) {
    case "additive": {
      const n = 5;
      for (let i = 0; i < width; i++) {
        let s = 0;
        for (let k = 1; k <= n; k++) s += Math.sin(w(i) * k) / k;
        out[i] = s / 1.6;
      }
      break;
    }
    case "FM": {
      for (let i = 0; i < width; i++) out[i] = Math.sin(w(i) + 2.2 * Math.sin(w(i) * 2.7));
      break;
    }
    case "AM": {
      for (let i = 0; i < width; i++)
        out[i] = Math.sin(w(i) * 4) * (0.55 + 0.45 * Math.sin(w(i) * 0.5));
      break;
    }
    case "noise":
    case "subtractive": {
      let lp = 0;
      for (let i = 0; i < width; i++) {
        lp = 0.75 * lp + 0.25 * (rnd() * 2 - 1);
        out[i] = lp * 2.4;
      }
      break;
    }
    case "delay":
    case "convolution": {
      for (let i = 0; i < width; i++) {
        const t = i / width;
        const pulse = (p: number, a: number) =>
          t > p ? Math.sin((t - p) * 190) * Math.exp(-(t - p) * 14) * a : 0;
        out[i] = pulse(0.04, 1) + pulse(0.36, 0.6) + pulse(0.68, 0.36);
      }
      break;
    }
    case "karplus-strong": {
      let lp = 0;
      for (let i = 0; i < width; i++) {
        lp = 0.6 * lp + 0.4 * (rnd() * 2 - 1);
        out[i] = Math.sin(w(i) * 2) * 0.5 * Math.exp(-i / (width * 0.5)) + lp * 0.4 * Math.exp(-i / (width * 0.25));
      }
      break;
    }
    case "scheduler": {
      for (let i = 0; i < width; i++) {
        const t = (i / width) * 8;
        const ph = t - Math.floor(t);
        out[i] = ph < 0.12 ? Math.sin(ph * 80) * Math.exp(-ph * 26) : 0;
      }
      break;
    }
    case "worklet": {
      const steps = 22;
      for (let i = 0; i < width; i++) {
        const q = Math.floor((i / width) * steps) / steps;
        out[i] = Math.round(Math.sin(q * Math.PI * 2 * cycles) * 6) / 6;
      }
      break;
    }
    default: {
      for (let i = 0; i < width; i++) out[i] = Math.sin(w(i));
    }
  }
  // 살짝의 개별 변형 (항목마다 다른 그림)
  const tilt = (hash(sound.slug) % 7) / 40;
  return out.map((v, i) => Math.max(-1, Math.min(1, v * (1 - tilt + (tilt * i) / width))));
}

export function previewPolylinePoints(
  sound: Sound,
  width: number,
  height: number
): string {
  const samples = previewSamples(sound, Math.min(width, 560));
  const n = samples.length;
  return samples
    .map((v, i) => {
      const x = (i / (n - 1)) * width;
      const y = height / 2 - v * height * 0.42;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}
