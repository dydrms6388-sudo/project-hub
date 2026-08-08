import type { Builder } from "../types";
import {
  clamp,
  dbToGain,
  loopNoise,
  makeScheduler,
  noiseBuffer,
  scheduleBlip,
} from "../helpers";

/** 단순 지속 오실레이터 묶음을 만드는 내부 헬퍼 */
function steadyOscs(
  ac: AudioContext,
  out: AudioNode,
  n: number
): { oscs: OscillatorNode[]; gains: GainNode[]; stop(): void } {
  const oscs: OscillatorNode[] = [];
  const gains: GainNode[] = [];
  for (let i = 0; i < n; i++) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    g.gain.value = 0;
    osc.connect(g).connect(out);
    osc.start();
    oscs.push(osc);
    gains.push(g);
  }
  return {
    oscs,
    gains,
    stop() {
      for (const g of gains) g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
      for (const o of oscs) o.stop(ac.currentTime + 0.15);
    },
  };
}

export const psychoBuilders: Record<string, Builder> = {
  /** 좌우 다른 주파수 — 뇌간에서 생기는 맥놀이 */
  "binaural-beats": ({ ac, out }, initial) => {
    const p = { ...initial };
    const merger = ac.createChannelMerger(2);
    merger.connect(out);
    const oL = ac.createOscillator();
    const oR = ac.createOscillator();
    const gL = ac.createGain();
    const gR = ac.createGain();
    gL.gain.value = 0.4;
    gR.gain.value = 0.4;
    oL.connect(gL).connect(merger, 0, 0);
    oR.connect(gR).connect(merger, 0, 1);
    const apply = () => {
      const now = ac.currentTime;
      oL.frequency.setTargetAtTime(p.carrier - p.beatFreq / 2, now, 0.02);
      oR.frequency.setTargetAtTime(p.carrier + p.beatFreq / 2, now, 0.02);
    };
    apply();
    oL.start();
    oR.start();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        gL.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        gR.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        oL.stop(ac.currentTime + 0.15);
        oR.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 한 채널에서 물리적으로 겹치는 두 음의 간섭 */
  "beat-frequency": ({ ac, out }, initial) => {
    const p = { ...initial };
    const s = steadyOscs(ac, out, 2);
    const apply = () => {
      const now = ac.currentTime;
      s.oscs[0].frequency.setTargetAtTime(p.f1, now, 0.02);
      s.oscs[1].frequency.setTargetAtTime(p.f1 + p.detune, now, 0.02);
      s.gains[0].gain.setTargetAtTime(0.35, now, 0.02);
      s.gains[1].gain.setTargetAtTime(0.35, now, 0.02);
    };
    apply();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop: s.stop,
    };
  },

  /** 가청 상·하한 — 리미터가 레벨 상한을 고정 */
  "hearing-range": ({ ac, out }, initial) => {
    const p = { ...initial };
    const s = steadyOscs(ac, out, 1);
    const apply = () => {
      const now = ac.currentTime;
      s.oscs[0].frequency.setTargetAtTime(clamp(p.frequency, 20, 20000), now, 0.03);
      s.gains[0].gain.setTargetAtTime(dbToGain(clamp(p.level, -60, -20)) * 2.5, now, 0.03);
    };
    apply();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop: s.stop,
    };
  },

  /** 1kHz 기준음과 시험음을 같은 레벨로 교대 재생 */
  "equal-loudness": ({ ac, out }, initial) => {
    const p = { ...initial };
    let phase = 0;
    const sched = makeScheduler(ac, (t) => {
      const isRef = phase % 2 === 0;
      const freq = isRef ? 1000 : clamp(p.frequency, 60, 16000);
      const gain = dbToGain(clamp(p.referenceLevel, -50, -25)) * 3;
      scheduleBlip(ac, out, {
        t, freq, dur: 0.8, gain, attack: 0.02, release: 0.05,
      });
      phase++;
      return t + 1.1;
    });
    return {
      update(np) {
        Object.assign(p, np);
      },
      stop() {
        sched.stop();
      },
    };
  },

  /** 대역 잡음 마스커 + 표적 순음 — 동시/순행 마스킹 */
  masking: ({ ac, out }, initial) => {
    const p = { ...initial };
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 4;
    bp.connect(out);
    const sched = makeScheduler(ac, (t) => {
      bp.frequency.setValueAtTime(p.maskerFreq, t);
      const maskDur = 0.45;
      // 마스커 버스트
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer(ac, maskDur + 0.1, 3141);
      const g = ac.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(1.4, t + 0.015);
      g.gain.setValueAtTime(1.4, t + maskDur - 0.02);
      g.gain.linearRampToValueAtTime(0, t + maskDur);
      src.connect(g).connect(bp);
      src.start(t);
      src.stop(t + maskDur + 0.05);
      src.onended = () => {
        src.disconnect();
        g.disconnect();
      };
      // 표적: delay=0 → 마스커 한가운데(동시), >0 → 종료 후(순행)
      const delay = clamp(p.probeDelay, 0, 200) / 1000;
      const probeT = delay === 0 ? t + maskDur / 2 : t + maskDur + delay;
      const probeFreq = p.maskerFreq * Math.pow(2, p.probeOffset / 12);
      scheduleBlip(ac, out, {
        t: probeT,
        freq: clamp(probeFreq, 40, 16000),
        dur: 0.05,
        gain: dbToGain(clamp(p.probeLevel, -60, -20)) * 3,
        attack: 0.004,
        release: 0.02,
      });
      return t + maskDur + 0.25 + 0.6;
    });
    return {
      update(np) {
        Object.assign(p, np);
      },
      stop() {
        sched.stop();
        setTimeout(() => bp.disconnect(), 800);
      },
    };
  },

  /** 두 순음의 간격과 거칠기 — 임계대역 체험 */
  roughness: ({ ac, out }, initial) => {
    const p = { ...initial };
    const s = steadyOscs(ac, out, 2);
    const apply = () => {
      const now = ac.currentTime;
      s.oscs[0].frequency.setTargetAtTime(p.meanFreq - p.separation / 2, now, 0.02);
      s.oscs[1].frequency.setTargetAtTime(p.meanFreq + p.separation / 2, now, 0.02);
      s.gains[0].gain.setTargetAtTime(0.35, now, 0.02);
      s.gains[1].gain.setTargetAtTime(0.35, now, 0.02);
    };
    apply();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop: s.stop,
    };
  },

  /** 배음 있는 두 음의 음정 — 협화/불협화 지형 */
  "interval-consonance": ({ ac, out }, initial) => {
    const p = { ...initial };
    const MAXP = 8;
    const s = steadyOscs(ac, out, MAXP * 2);
    const apply = () => {
      const now = ac.currentTime;
      const n = Math.round(clamp(p.partialsPerTone, 1, MAXP));
      let norm = 0;
      for (let k = 1; k <= n; k++) norm += 1 / k;
      const f2 = p.baseFreq * Math.pow(2, p.intervalCents / 1200);
      for (let tone = 0; tone < 2; tone++) {
        const f0 = tone === 0 ? p.baseFreq : f2;
        for (let k = 1; k <= MAXP; k++) {
          const i = tone * MAXP + k - 1;
          if (k <= n && f0 * k < 12000) {
            s.oscs[i].frequency.setTargetAtTime(f0 * k, now, 0.02);
            s.gains[i].gain.setTargetAtTime((1 / k / norm) * 0.4, now, 0.02);
          } else {
            s.gains[i].gain.setTargetAtTime(0, now, 0.02);
          }
        }
      }
    };
    apply();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop: s.stop,
    };
  },

  /** 귓속 비선형성이 만드는 제3의 음 (2f1−f2) */
  "combination-tones": ({ ac, out }, initial) => {
    const p = { ...initial };
    const s = steadyOscs(ac, out, 2);
    const apply = () => {
      const now = ac.currentTime;
      const g = dbToGain(clamp(p.level, -30, -10)) * 2.2;
      s.oscs[0].frequency.setTargetAtTime(p.f1, now, 0.02);
      s.oscs[1].frequency.setTargetAtTime(p.f1 * p.f2Ratio, now, 0.02);
      s.gains[0].gain.setTargetAtTime(g, now, 0.02);
      s.gains[1].gain.setTargetAtTime(g, now, 0.02);
    };
    apply();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop: s.stop,
    };
  },

  /** 미세한 음높이 차이 변별 — 나의 JND 찾기 */
  "pitch-jnd": ({ ac, out }, initial) => {
    const p = { ...initial };
    let phase = 0;
    const sched = makeScheduler(ac, (t) => {
      const dur = clamp(p.toneDuration, 100, 1000) / 1000;
      const isA = phase % 2 === 0;
      const freq = isA
        ? p.baseFreq
        : p.baseFreq * Math.pow(2, p.diffCents / 1200);
      scheduleBlip(ac, out, {
        t, freq, dur, gain: 0.45, attack: 0.01, release: 0.03,
      });
      phase++;
      return t + dur + (isA ? 0.25 : 0.7);
    });
    return {
      update(np) {
        Object.assign(p, np);
      },
      stop() {
        sched.stop();
      },
    };
  },

  /** 잡음 속 무음 틈 — 시간 분해능 측정 */
  "gap-detection": ({ ac, out }, initial) => {
    const p = { ...initial };
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.connect(out);
    const sched = makeScheduler(ac, (t) => {
      bp.frequency.setValueAtTime(clamp(p.centerFreq, 500, 8000), t);
      const half = 0.2;
      const gap = clamp(p.gapLength, 0, 50) / 1000;
      for (const t0 of [t, t + half + gap]) {
        const src = ac.createBufferSource();
        src.buffer = noiseBuffer(ac, half + 0.05, 555);
        const g = ac.createGain();
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(1.1, t0 + 0.004);
        g.gain.setValueAtTime(1.1, t0 + half - 0.004);
        g.gain.linearRampToValueAtTime(0, t0 + half);
        src.connect(g).connect(bp);
        src.start(t0);
        src.stop(t0 + half + 0.02);
        src.onended = () => {
          src.disconnect();
          g.disconnect();
        };
      }
      return t + half * 2 + gap + clamp(p.repeatInterval, 0.5, 2);
    });
    return {
      update(np) {
        Object.assign(p, np);
      },
      stop() {
        sched.stop();
        setTimeout(() => bp.disconnect(), 800);
      },
    };
  },

  /** 클릭 반복률이 음높이로 융합되는 경계 */
  "click-train-pitch": ({ ac, out }, initial) => {
    const p = { ...initial };
    // 1초 버퍼에 클릭 1개 → loop + playbackRate = 초당 클릭 수
    const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const ch = buf.getChannelData(0);
    // 클릭을 400샘플 감쇠 펄스로 — 낮은 반복률에서도 들리도록 에너지 확보
    for (let i = 0; i < 400; i++)
      ch[i] = Math.exp(-i / 90) * (i % 2 === 0 ? 1 : -0.7);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    const g = ac.createGain();
    g.gain.value = 0.65;
    src.connect(lp).connect(g).connect(out);
    const apply = () => {
      const now = ac.currentTime;
      src.playbackRate.setTargetAtTime(clamp(p.clickRate, 5, 500), now, 0.03);
      lp.frequency.setTargetAtTime(clamp(p.lowpassCutoff, 500, 8000), now, 0.02);
    };
    apply();
    src.start();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        src.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 변조 속도에 따라 흔들림→거칠기→측대역 분리 */
  "modulation-perception": ({ ac, out }, initial) => {
    const p = { ...initial };
    const carrier = ac.createOscillator();
    const amp = ac.createGain();
    carrier.connect(amp).connect(out);
    const lfo = ac.createOscillator();
    const amDepth = ac.createGain(); // lfo → amp.gain
    const fmDepth = ac.createGain(); // lfo → carrier.frequency
    lfo.connect(amDepth).connect(amp.gain);
    lfo.connect(fmDepth).connect(carrier.frequency);
    const apply = () => {
      const now = ac.currentTime;
      const depth = clamp(p.modDepth, 0, 100) / 100;
      const isFM = p.modType >= 0.5;
      carrier.frequency.setTargetAtTime(p.carrier, now, 0.02);
      lfo.frequency.setTargetAtTime(clamp(p.modRate, 0.5, 200), now, 0.02);
      amp.gain.setTargetAtTime(isFM ? 0.6 : 0.6 * (1 - depth / 2), now, 0.02);
      amDepth.gain.setTargetAtTime(isFM ? 0 : (0.6 * depth) / 2, now, 0.02);
      // FM 깊이: 반송파의 depth% 편이
      fmDepth.gain.setTargetAtTime(isFM ? p.carrier * depth * 0.3 : 0, now, 0.02);
    };
    apply();
    carrier.start();
    lfo.start();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        amp.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        carrier.stop(ac.currentTime + 0.15);
        lfo.stop(ac.currentTime + 0.15);
      },
    };
  },
};
