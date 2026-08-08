import type { Builder } from "../types";
import {
  clamp,
  dbToGain,
  makeScheduler,
  makeTicker,
  mulberry32,
  scheduleBlip,
  scheduleNoiseBurst,
} from "../helpers";

export const spatialBuilders: Record<string, Builder> = {
  /** 먼저 도착한 소리가 방향을 지배 — 선행음 효과 */
  "haas-effect": ({ ac, out }, initial) => {
    const p = { ...initial };
    const merger = ac.createChannelMerger(2);
    merger.connect(out);
    const gL = ac.createGain();
    const gR = ac.createGain();
    gL.connect(merger, 0, 0);
    gR.connect(merger, 0, 1);
    const sched = makeScheduler(ac, (t) => {
      const d = clamp(p.delay, 0, 40) / 1000;
      const lateGain = dbToGain(clamp(p.levelDiff, -10, 10));
      // 왼쪽이 항상 선행, 오른쪽이 지연+레벨 조정
      scheduleNoiseBurst(ac, gL, { t, dur: 0.03, gain: 0.55, seed: 91 });
      scheduleNoiseBurst(ac, gR, {
        t: t + d, dur: 0.03, gain: 0.55 * lateGain, seed: 91,
      });
      return t + 0.75;
    });
    return {
      update(np) {
        Object.assign(p, np);
      },
      stop() {
        sched.stop();
        setTimeout(() => {
          gL.disconnect();
          gR.disconnect();
        }, 500);
      },
    };
  },

  /** 시간차(ITD)와 레벨차(ILD)로 좌우 방향 조작 */
  "itd-ild": ({ ac, out }, initial) => {
    const p = { ...initial };
    const merger = ac.createChannelMerger(2);
    merger.connect(out);
    const osc = ac.createOscillator();
    const gate = ac.createGain();
    gate.gain.value = 0;
    const dL = ac.createDelay(0.01);
    const dR = ac.createDelay(0.01);
    const gL = ac.createGain();
    const gR = ac.createGain();
    osc.connect(gate);
    gate.connect(dL).connect(gL).connect(merger, 0, 0);
    gate.connect(dR).connect(gR).connect(merger, 0, 1);
    const apply = () => {
      const now = ac.currentTime;
      osc.frequency.setTargetAtTime(clamp(p.frequency, 200, 4000), now, 0.02);
      const itd = clamp(p.itd, -700, 700) / 1e6; // µs → s
      dL.delayTime.setTargetAtTime(0.002 + Math.max(0, -itd), now, 0.02);
      dR.delayTime.setTargetAtTime(0.002 + Math.max(0, itd), now, 0.02);
      const ild = clamp(p.ild, -20, 20);
      gL.gain.setTargetAtTime(0.42 * dbToGain(Math.min(0, -ild)), now, 0.02);
      gR.gain.setTargetAtTime(0.42 * dbToGain(Math.min(0, ild)), now, 0.02);
    };
    apply();
    osc.start();
    // 온셋 단서를 위해 300ms 버스트 반복
    const sched = makeScheduler(ac, (t) => {
      gate.gain.setValueAtTime(0, t);
      gate.gain.linearRampToValueAtTime(1, t + 0.02);
      gate.gain.setValueAtTime(1, t + 0.3);
      gate.gain.linearRampToValueAtTime(0, t + 0.34);
      return t + 0.85;
    });
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        sched.stop();
        gate.gain.cancelScheduledValues(ac.currentTime);
        gate.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        osc.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 지나가는 음원 — 지연 변조로 도플러 편이 재현 */
  doppler: ({ ac, out }, initial) => {
    const p = { ...initial };
    const osc = ac.createOscillator();
    osc.frequency.value = p.sourceFreq;
    const delay = ac.createDelay(2);
    const g = ac.createGain();
    g.gain.value = 0;
    const pan = ac.createStereoPanner();
    osc.connect(delay).connect(g).connect(pan).connect(out);
    osc.start();
    let t0 = ac.currentTime;
    const HALF = 80; // 편도 80m 왕복 주행
    const ticker = makeTicker(ac, (_dt, now) => {
      const v = clamp(p.speed, 5, 80);
      const T = (HALF * 2) / v;
      const tt = ((now - t0) % T) - T / 2;
      const x = v * tt;
      const dPass = clamp(p.passDistance, 1, 20);
      const dist = Math.sqrt(x * x + dPass * dPass);
      delay.delayTime.linearRampToValueAtTime(dist / 343, now + 0.04);
      const amp = 0.6 * (dPass / dist);
      g.gain.linearRampToValueAtTime(clamp(amp, 0.02, 0.6), now + 0.04);
      pan.pan.linearRampToValueAtTime(clamp(x / (dist + 1), -1, 1), now + 0.04);
    });
    return {
      update(np) {
        const restart = np.speed !== p.speed;
        Object.assign(p, np);
        osc.frequency.setTargetAtTime(p.sourceFreq, ac.currentTime, 0.02);
        if (restart) t0 = ac.currentTime;
      },
      stop() {
        ticker.stop();
        g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        osc.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 직접음/잔향 비율이 만드는 거리감 */
  "reverb-distance": ({ ac, out }, initial) => {
    const p = { ...initial };
    const src = ac.createGain(); // 소스 버스
    const dry = ac.createGain();
    const conv = ac.createConvolver();
    const wet = ac.createGain();
    src.connect(dry).connect(out);
    src.connect(conv).connect(wet).connect(out);
    let irKey = "";
    const buildIR = () => {
      const decay = clamp(p.decayTime, 0.2, 5);
      const pre = clamp(p.preDelay, 0, 100) / 1000;
      const key = `${decay}|${pre}`;
      if (key === irKey) return;
      irKey = key;
      const len = Math.ceil(ac.sampleRate * (decay + pre + 0.1));
      const ir = ac.createBuffer(2, len, ac.sampleRate);
      for (let c = 0; c < 2; c++) {
        const ch = ir.getChannelData(c);
        const rnd = mulberry32(c === 0 ? 17 : 71);
        const preN = Math.floor(pre * ac.sampleRate);
        for (let i = preN; i < len; i++) {
          const t = (i - preN) / ac.sampleRate;
          ch[i] = (rnd() * 2 - 1) * Math.exp((-6.9 * t) / decay) * 0.4;
        }
      }
      conv.buffer = ir;
    };
    const apply = () => {
      buildIR();
      const now = ac.currentTime;
      const ratio = clamp(p.directRatio, 0, 100) / 100;
      dry.gain.setTargetAtTime(ratio * 0.8, now, 0.03);
      wet.gain.setTargetAtTime((1 - ratio) * 1.1, now, 0.03);
    };
    apply();
    // 소스: 나무 블록풍 타격음 반복
    const sched = makeScheduler(ac, (t) => {
      scheduleBlip(ac, src, {
        t, freq: 880, dur: 0.07, gain: 0.8, attack: 0.002, release: 0.05,
      });
      scheduleBlip(ac, src, {
        t, freq: 1320, dur: 0.045, gain: 0.4, attack: 0.002, release: 0.03,
      });
      return t + 1.3;
    });
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        sched.stop();
        dry.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        wet.gain.setTargetAtTime(0, ac.currentTime, 0.05);
        setTimeout(() => {
          src.disconnect();
          conv.disconnect();
        }, 1500);
      },
    };
  },
};
