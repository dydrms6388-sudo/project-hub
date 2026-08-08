import type { Builder } from "../types";
import {
  clamp,
  dbToGain,
  loopNoise,
  makeScheduler,
  makeTicker,
  mulberry32,
  scheduleBlip,
  scheduleNoiseBurst,
  shepardGain,
} from "../helpers";

const MAX_PARTIALS = 10;

/** 셰퍼드 복합음 하나(옥타브 부분음 + 가우시안 포락선)를 t에 스케줄 */
function scheduleShepardTone(
  ac: BaseAudioContext,
  dest: AudioNode,
  opt: { t: number; pitchClass: number; dur: number; envCenter: number; gain: number }
): void {
  const { t, pitchClass, dur, envCenter, gain } = opt;
  const fBase = 32.703 * Math.pow(2, pitchClass / 12); // C1 기준
  let norm = 0;
  const freqs: number[] = [];
  const gains: number[] = [];
  for (let oct = 0; oct < 8; oct++) {
    const f = fBase * Math.pow(2, oct);
    if (f > 8000) break;
    const g = shepardGain(f, envCenter, 1.2);
    freqs.push(f);
    gains.push(g);
    norm += g;
  }
  if (norm <= 0) return;
  for (let i = 0; i < freqs.length; i++) {
    scheduleBlip(ac, dest, {
      t,
      freq: freqs[i],
      dur,
      gain: (gains[i] / norm) * gain,
      attack: 0.015,
      release: 0.05,
    });
  }
}

export const illusionBuilders: Record<string, Builder> = {
  /** 옥타브 간격 부분음들이 순환하며 무한 상승/하강 */
  "shepard-risset": ({ ac, out }, initial) => {
    const p = { ...initial };
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    for (let i = 0; i < MAX_PARTIALS; i++) {
      const osc = ac.createOscillator();
      osc.type = "sine";
      const g = ac.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(out);
      osc.start();
      oscs.push(osc);
      gains.push(g);
    }
    let phi = 0; // 옥타브 단위 순환 위치
    const ticker = makeTicker(ac, (dt, now) => {
      const n = Math.round(clamp(p.partials, 4, MAX_PARTIALS));
      phi = (phi + (dt * p.speed) / 1200 + n) % 1;
      // 이산 계단: stepSemitones>0이면 반음 격자로 양자화
      const stepOct = p.stepSemitones / 12;
      const pos0 = stepOct > 0 ? Math.round(phi / stepOct) * stepOct : phi;
      const fLow = p.envelopeCenter / Math.pow(2, n / 2);
      let norm = 0;
      const fs: number[] = [];
      const gs: number[] = [];
      for (let i = 0; i < n; i++) {
        const f = fLow * Math.pow(2, (pos0 + i) % n);
        const g = shepardGain(f, p.envelopeCenter);
        fs.push(clamp(f, 20, 12000));
        gs.push(g);
        norm += g;
      }
      const tau = stepOct > 0 ? 0.015 : 0.04;
      for (let i = 0; i < MAX_PARTIALS; i++) {
        if (i < n && norm > 0) {
          oscs[i].frequency.setTargetAtTime(fs[i], now, tau);
          gains[i].gain.setTargetAtTime((gs[i] / norm) * 0.7, now, 0.04);
        } else {
          gains[i].gain.setTargetAtTime(0, now, 0.04);
        }
      }
    });
    return {
      update(np) {
        Object.assign(p, np);
      },
      stop() {
        ticker.stop();
        for (const g of gains) g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        for (const o of oscs) o.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 배속 레이어 교차 페이드로 무한 가속/감속 리듬 */
  "risset-rhythm": ({ ac, out }, initial) => {
    const p = { ...initial };
    let u = 0; // 레이어 순환 위치(0..1)
    const nextT: number[] = [0, 0, 0, 0];
    const started = ac.currentTime + 0.1;
    for (let k = 0; k < 4; k++) nextT[k] = started;
    const ticker = makeTicker(ac, (dt, now) => {
      const L = Math.round(clamp(p.layers, 2, 4));
      const rate = Math.log2(1 + Math.abs(p.accel) / 100) * Math.sign(p.accel);
      u = (((u + dt * rate * 0.5) % 1) + 1) % 1;
      for (let k = 0; k < L; k++) {
        const oct = k + u - L / 2;
        const tempo = p.baseTempo * Math.pow(2, oct);
        const beat = 60 / clamp(tempo, 20, 1200);
        const sigma = L / 3.2;
        const g = Math.exp((-oct * oct) / (2 * sigma * sigma));
        while (nextT[k] < now + 0.25) {
          scheduleBlip(ac, out, {
            t: nextT[k],
            freq: 500 * Math.pow(2, k * 0.5),
            dur: 0.045,
            gain: 0.35 * g,
            attack: 0.002,
            release: 0.03,
          });
          nextT[k] += beat;
        }
      }
    });
    return {
      update(np) {
        Object.assign(p, np);
      },
      stop() {
        ticker.stop();
      },
    };
  },

  /** 기본음 없이 배음만 — 주기성에서 음높이 복원 */
  "missing-fundamental": ({ ac, out }, initial) => {
    const p = { ...initial };
    const N = 8;
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    for (let i = 0; i < N; i++) {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      g.gain.value = 0;
      osc.connect(g).connect(out);
      osc.start();
      oscs.push(osc);
      gains.push(g);
    }
    const apply = () => {
      const now = ac.currentTime;
      const lo = Math.round(p.lowestHarmonic);
      const cnt = Math.round(p.harmonicCount);
      let norm = 0;
      for (let i = 0; i < cnt; i++) norm += 1 / (lo + i);
      for (let i = 0; i < N; i++) {
        const k = lo + i;
        if (i < cnt && p.fundamental * k < 12000) {
          oscs[i].frequency.setTargetAtTime(p.fundamental * k, now, 0.02);
          gains[i].gain.setTargetAtTime((1 / k / norm) * 0.75, now, 0.02);
        } else {
          gains[i].gain.setTargetAtTime(0, now, 0.02);
        }
      }
    };
    apply();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        for (const g of gains) g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        for (const o of oscs) o.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 셰퍼드 음 쌍(6반음 간격) — 상행/하행 판단이 갈리는 역설 */
  "tritone-paradox": ({ ac, out }, initial) => {
    const p = { ...initial };
    let phase = 0;
    const sched = makeScheduler(ac, (t) => {
      const pc = Math.round(p.pitchClass) + (phase % 2 === 0 ? 0 : 6);
      scheduleShepardTone(ac, out, {
        t,
        pitchClass: pc,
        dur: 0.5,
        envCenter: p.envelopeCenter,
        gain: 0.8,
      });
      const gap = phase % 2 === 0 ? p.pause : p.pause * 2 + 0.6;
      phase++;
      return t + 0.5 + gap;
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

  /** 좌우 교대 옥타브 쌍 — 귀별로 재구성되는 착청 */
  "octave-illusion": ({ ac, out }, initial) => {
    const p = { ...initial };
    const merger = ac.createChannelMerger(2);
    merger.connect(out);
    const oscLow = ac.createOscillator();
    const oscHigh = ac.createOscillator();
    const gLL = ac.createGain(); // low → Left
    const gLR = ac.createGain();
    const gHL = ac.createGain();
    const gHR = ac.createGain();
    for (const g of [gLL, gLR, gHL, gHR]) g.gain.value = 0;
    oscLow.connect(gLL).connect(merger, 0, 0);
    oscLow.connect(gLR).connect(merger, 0, 1);
    oscHigh.connect(gHL).connect(merger, 0, 0);
    oscHigh.connect(gHR).connect(merger, 0, 1);
    oscLow.frequency.value = p.baseFreq;
    oscHigh.frequency.value = p.baseFreq * 2;
    oscLow.start();
    oscHigh.start();
    let phase = 0;
    const LEVEL = 0.45;
    const sched = makeScheduler(ac, (t) => {
      const dur = 1 / clamp(p.rate, 1, 8);
      const a = phase % 2 === 0;
      const ramp = 0.006;
      // A: L=high, R=low / B: L=low, R=high
      for (const [g, on] of [
        [gHL, a],
        [gLR, a],
        [gLL, !a],
        [gHR, !a],
      ] as const) {
        g.gain.setValueAtTime(on ? 0 : LEVEL, t);
        g.gain.linearRampToValueAtTime(on ? LEVEL : 0, t + ramp);
      }
      phase++;
      return t + dur;
    });
    return {
      update(np) {
        Object.assign(p, np);
        const now = ac.currentTime;
        oscLow.frequency.setTargetAtTime(p.baseFreq, now, 0.02);
        oscHigh.frequency.setTargetAtTime(p.baseFreq * 2, now, 0.02);
      },
      stop() {
        sched.stop();
        for (const g of [gLL, gLR, gHL, gHR])
          g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        oscLow.stop(ac.currentTime + 0.1);
        oscHigh.stop(ac.currentTime + 0.1);
      },
    };
  },

  /** 상행·하행 음계를 좌우로 교차 분배 — 주파수 근접성으로 재편성 */
  "scale-illusion": ({ ac, out }, initial) => {
    const p = { ...initial };
    const merger = ac.createChannelMerger(2);
    merger.connect(out);
    // C장조 상행/하행 (반음 인덱스, C4=0)
    const up = [0, 2, 4, 5, 7, 9, 11, 12];
    const down = [12, 11, 9, 7, 5, 4, 2, 0];
    let idx = 0;
    const sched = makeScheduler(ac, (t) => {
      const i = idx % 8;
      const dur = 30 / clamp(p.tempo, 60, 240);
      const f = (st: number) =>
        261.63 * Math.pow(2, (st + p.keyShift) / 12);
      // 짝수 음표: 상행은 왼쪽, 하행은 오른쪽 / 홀수 음표: 반대
      const upToLeft = i % 2 === 0;
      const gL = ac.createGain();
      const gR = ac.createGain();
      gL.connect(merger, 0, 0);
      gR.connect(merger, 0, 1);
      scheduleBlip(ac, upToLeft ? gL : gR, {
        t, freq: f(up[i]), dur: dur * 0.92, gain: 0.42,
      });
      scheduleBlip(ac, upToLeft ? gR : gL, {
        t, freq: f(down[i]), dur: dur * 0.92, gain: 0.42,
      });
      setTimeout(() => {
        gL.disconnect();
        gR.disconnect();
      }, (t - ac.currentTime + dur + 0.3) * 1000);
      idx++;
      return t + dur;
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

  /** 잡음이 끊김을 덮으면 음이 이어져 들리는 복원 */
  "continuity-illusion": ({ ac, out }, initial) => {
    const p = { ...initial };
    const sched = makeScheduler(ac, (t) => {
      const on = 0.42;
      const gap = clamp(p.gapDuration, 50, 500) / 1000;
      const noiseGain = 0.28 * dbToGain(clamp(p.noiseGainDb, -12, 12));
      // 음 구간 1
      scheduleBlip(ac, out, {
        t, freq: p.toneFreq, dur: on, gain: 0.4, attack: 0.01, release: 0.015,
      });
      // 끊김 구간(선택적으로 지속) + 잡음
      if (p.toneContinues >= 0.5) {
        scheduleBlip(ac, out, {
          t: t + on, freq: p.toneFreq, dur: gap, gain: 0.4,
          attack: 0.005, release: 0.005,
        });
      }
      scheduleNoiseBurst(ac, out, { t: t + on, dur: gap, gain: noiseGain });
      // 음 구간 2
      scheduleBlip(ac, out, {
        t: t + on + gap, freq: p.toneFreq, dur: on, gain: 0.4,
        attack: 0.015, release: 0.02,
      });
      return t + on * 2 + gap + 0.35;
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

  /** 노치 잡음 후 정적에서 들리는 청각 잔상 */
  "zwicker-tone": ({ ac, out }, initial) => {
    const p = { ...initial };
    const noise = loopNoise(ac, 4242);
    const notch = ac.createBiquadFilter();
    notch.type = "notch";
    const gate = ac.createGain();
    gate.gain.value = 0;
    noise.connect(notch).connect(gate).connect(out);
    noise.start();
    const applyFilter = () => {
      notch.frequency.value = p.notchCenter;
      notch.Q.value = clamp(p.notchCenter / p.notchWidth, 0.5, 30);
    };
    applyFilter();
    const SILENCE = 4;
    const sched = makeScheduler(ac, (t) => {
      const dur = clamp(p.noiseDuration, 2, 10);
      gate.gain.setValueAtTime(0, t);
      gate.gain.linearRampToValueAtTime(0.5, t + 0.05);
      gate.gain.setValueAtTime(0.5, t + dur - 0.05);
      gate.gain.linearRampToValueAtTime(0, t + dur);
      return t + dur + SILENCE;
    });
    return {
      update(np) {
        Object.assign(p, np);
        applyFilter();
      },
      stop() {
        sched.stop();
        gate.gain.cancelScheduledValues(ac.currentTime);
        gate.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        noise.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** ABA- 갤럽 — 속도·간격에 따라 한 흐름/두 흐름 */
  "auditory-streaming": ({ ac, out }, initial) => {
    const p = { ...initial };
    let idx = 0;
    const sched = makeScheduler(ac, (t) => {
      const dt = 1 / clamp(p.rate, 4, 15);
      const pos = idx % 4; // A B A 쉼
      if (pos !== 3) {
        const isA = pos !== 1;
        const freq = isA
          ? p.freqA
          : p.freqA * Math.pow(2, p.interval / 12);
        scheduleBlip(ac, out, {
          t, freq, dur: Math.min(dt * 0.85, 0.12), gain: 0.45,
          attack: 0.005, release: 0.02,
        });
      }
      idx++;
      return t + dt;
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

  /** 한쪽 귀만 좁은 대역 위상 반전 — 머릿속에서 생기는 피치 */
  "huggins-pitch": ({ ac, out }, initial) => {
    const p = { ...initial };
    const merger = ac.createChannelMerger(2);
    merger.connect(out);
    const noise = loopNoise(ac, 20260808);
    const gL = ac.createGain();
    gL.gain.value = 0.33;
    const ap1 = ac.createBiquadFilter();
    const ap2 = ac.createBiquadFilter();
    ap1.type = "allpass";
    ap2.type = "allpass";
    const gR = ac.createGain();
    gR.gain.value = 0.33;
    noise.connect(gL).connect(merger, 0, 0);
    noise.connect(ap1).connect(ap2).connect(gR).connect(merger, 0, 1);
    const apply = () => {
      const q = clamp(p.phaseFreq / clamp(p.bandwidth, 20, 200), 2, 50);
      for (const ap of [ap1, ap2]) {
        ap.frequency.setTargetAtTime(p.phaseFreq, ac.currentTime, 0.02);
        ap.Q.setTargetAtTime(q, ac.currentTime, 0.02);
      }
    };
    apply();
    noise.start();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        gL.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        gR.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        noise.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 아리랑 선율을 옥타브로 흩기 — 윤곽이 무너지면 못 알아듣는다 */
  "octave-scrambled-melody": ({ ac, out }, initial) => {
    const p = { ...initial };
    // 아리랑 첫 소절 (전래 민요 — 저작권 소멸). [반음, 박자(박)] C4 기준.
    const MELODY: Array<[number, number]> = [
      [4, 1], [4, 0.5], [4, 0.5], [7, 1], [7, 1],
      [9, 1], [9, 0.5], [7, 0.5], [9, 1], [12, 1],
      [12, 1], [9, 0.5], [7, 0.5], [4, 1], [7, 2],
    ];
    let idx = 0;
    const sched = makeScheduler(ac, (t) => {
      const i = idx % MELODY.length;
      if (i === 0 && idx > 0) return t + 1.2; // 소절 사이 쉼 후 반복
      const [st, beats] = MELODY[i];
      const beat = 60 / clamp(p.tempo, 60, 180);
      const range = Math.round(p.scrambleRange);
      const rnd = mulberry32(Math.round(p.seed) * 1000 + i);
      const oct =
        range === 0 ? 0 : Math.floor(rnd() * (range * 2 + 1)) - range;
      const freq = 261.63 * Math.pow(2, st / 12 + oct);
      scheduleBlip(ac, out, {
        t, freq, dur: beat * beats * 0.9, gain: 0.5,
        attack: 0.01, release: 0.05,
      });
      idx++;
      return t + beat * beats;
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

  /** 배음 하나만 어긋내면 튀어나와 들린다 — 조화성 그룹핑 */
  "mistuned-harmonic": ({ ac, out }, initial) => {
    const p = { ...initial };
    const N = 8;
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    let norm = 0;
    for (let k = 1; k <= N; k++) norm += 1 / k;
    for (let k = 1; k <= N; k++) {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      g.gain.value = (1 / k / norm) * 0.8;
      osc.connect(g).connect(out);
      osc.start();
      oscs.push(osc);
      gains.push(g);
    }
    const apply = () => {
      const now = ac.currentTime;
      const target = Math.round(p.harmonicIndex);
      for (let k = 1; k <= N; k++) {
        const detuneFactor =
          k === target ? 1 + p.mistuning / 100 : 1;
        oscs[k - 1].frequency.setTargetAtTime(
          p.fundamental * k * detuneFactor,
          now,
          0.02
        );
      }
    };
    apply();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        for (const g of gains) g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        for (const o of oscs) o.stop(ac.currentTime + 0.15);
      },
    };
  },
};
