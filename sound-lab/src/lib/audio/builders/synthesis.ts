import type { Builder } from "../types";
import {
  clamp,
  dbToGain,
  loopNoise,
  makeScheduler,
  makeTicker,
} from "../helpers";

export const synthesisBuilders: Record<string, Builder> = {
  /** 정수배 배음의 합 — 푸리에 합성으로 음색 만들기 */
  "harmonic-series": ({ ac, out }, initial) => {
    const p = { ...initial };
    const N = 16;
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    for (let k = 1; k <= N; k++) {
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
      const cnt = Math.round(clamp(p.harmonicCount, 1, N));
      const amps: number[] = [];
      let norm = 0;
      for (let k = 1; k <= N; k++) {
        let a = 0;
        if (k <= cnt && p.fundamental * k < 14000) {
          a = Math.pow(10, (-p.slope * Math.log2(k)) / 20);
          const balance = clamp(p.oddEvenBalance, 0, 100);
          if (k % 2 === 0) a *= Math.min(1, balance / 50);
          else a *= Math.min(1, (100 - balance) / 50);
        }
        amps.push(a);
        norm += a;
      }
      for (let k = 1; k <= N; k++) {
        oscs[k - 1].frequency.setTargetAtTime(p.fundamental * k, now, 0.02);
        gains[k - 1].gain.setTargetAtTime(
          norm > 0 ? (amps[k - 1] / norm) * 0.8 : 0,
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

  /** 주파수 변조 — 비/지수에 따라 종·금속·목관 음색 */
  "fm-synthesis": ({ ac, out }, initial) => {
    const p = { ...initial };
    const carrier = ac.createOscillator();
    const amp = ac.createGain();
    amp.gain.value = 0;
    const mod = ac.createOscillator();
    const modGain = ac.createGain();
    mod.connect(modGain).connect(carrier.frequency);
    carrier.connect(amp).connect(out);
    carrier.start();
    mod.start();
    const applyFreqs = () => {
      const now = ac.currentTime;
      carrier.frequency.setTargetAtTime(p.carrier, now, 0.02);
      mod.frequency.setTargetAtTime(p.carrier * p.ratio, now, 0.02);
    };
    applyFreqs();
    const sched = makeScheduler(ac, (t) => {
      const fm = p.carrier * p.ratio;
      const peakDev = clamp(p.index, 0, 20) * fm;
      const decay = clamp(p.indexDecay, 0.05, 3);
      // 타격: 변조 지수와 음량이 함께 감쇠
      modGain.gain.setValueAtTime(peakDev, t);
      modGain.gain.setTargetAtTime(0, t + 0.01, decay / 3);
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(0.55, t + 0.008);
      amp.gain.setTargetAtTime(0, t + 0.02, Math.max(decay / 2, 0.25));
      return t + Math.max(1.6, decay + 0.8);
    });
    return {
      update(np) {
        Object.assign(p, np);
        applyFreqs();
      },
      stop() {
        sched.stop();
        amp.gain.cancelScheduledValues(ac.currentTime);
        amp.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        carrier.stop(ac.currentTime + 0.15);
        mod.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 두 신호의 곱 — 합·차 주파수만 남는다 */
  "ring-modulation": ({ ac, out }, initial) => {
    const p = { ...initial };
    const input = ac.createOscillator();
    const mod = ac.createOscillator();
    const vca = ac.createGain(); // input × mod
    vca.gain.value = 0;
    mod.connect(vca.gain);
    const wet = ac.createGain();
    const dryG = ac.createGain();
    input.connect(vca).connect(wet).connect(out);
    input.connect(dryG).connect(out);
    input.start();
    mod.start();
    const apply = () => {
      const now = ac.currentTime;
      const mix = clamp(p.mix, 0, 100) / 100;
      input.frequency.setTargetAtTime(p.inputFreq, now, 0.02);
      mod.frequency.setTargetAtTime(clamp(p.modFreq, 1, 1000), now, 0.02);
      wet.gain.setTargetAtTime(0.55 * mix, now, 0.02);
      dryG.gain.setTargetAtTime(0.55 * (1 - mix), now, 0.02);
    };
    apply();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        wet.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        dryG.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        input.stop(ac.currentTime + 0.15);
        mod.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 지연선 되먹임 물리 모델 — 기타 줄 (AudioWorklet) */
  "karplus-strong": ({ ac, out }, initial) => {
    const p = { ...initial };
    const node = new AudioWorkletNode(ac, "karplus-strong", {
      outputChannelCount: [1],
    });
    const g = ac.createGain();
    g.gain.value = 0.6;
    node.connect(g).connect(out);
    let trigger = 1;
    const apply = () => {
      node.parameters.get("pitch")!.value = clamp(p.pitch, 55, 880);
      node.parameters.get("damping")!.value = clamp(p.damping, 0, 100);
      node.parameters.get("brightness")!.value = clamp(p.pluckBrightness, 500, 8000);
    };
    apply();
    const pluck = () => {
      node.parameters.get("trigger")!.value = trigger++;
    };
    pluck();
    const id = setInterval(pluck, 1600);
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        clearInterval(id);
        g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        setTimeout(() => node.disconnect(), 300);
      },
    };
  },

  /** 스펙트럼 기울기 하나로 갈리는 잡음의 질감 */
  "noise-colors": ({ ac, out }, initial) => {
    const p = { ...initial };
    const noise = loopNoise(ac, 808);
    // 하이셸프 4개 직렬(2옥타브 간격)로 기울기 근사
    const shelves: BiquadFilterNode[] = [125, 500, 2000, 8000].map((f) => {
      const s = ac.createBiquadFilter();
      s.type = "highshelf";
      s.frequency.value = f;
      return s;
    });
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    const g = ac.createGain();
    let node: AudioNode = noise;
    for (const s of shelves) {
      node.connect(s);
      node = s;
    }
    node.connect(lp).connect(g).connect(out);
    const apply = () => {
      const now = ac.currentTime;
      const slope = clamp(p.slope, -6, 6);
      for (const s of shelves) s.gain.setTargetAtTime(slope * 2, now, 0.03);
      lp.frequency.setTargetAtTime(clamp(p.lowpassCutoff, 200, 20000), now, 0.03);
      // 라우드니스 보상: 양의 기울기는 고역이 셸프 4개 누적(최대 +48dB)으로
      // 증폭되므로 그만큼 되돌리고, 음의 기울기는 살짝만 보상한다.
      const posComp = Math.pow(10, (-Math.max(slope, 0) * 7.5) / 20);
      const negBoost = slope < 0 ? 1.25 : 1;
      g.gain.setTargetAtTime(0.4 * posComp * negBoost, now, 0.05);
    };
    apply();
    noise.start();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        noise.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 성도 공명 2개(F1·F2)로 만드는 모음 */
  "formant-vowels": ({ ac, out }, initial) => {
    const p = { ...initial };
    const saw = ac.createOscillator();
    saw.type = "sawtooth";
    const sawG = ac.createGain();
    const noise = loopNoise(ac, 424);
    const noiseG = ac.createGain();
    const mixBus = ac.createGain();
    saw.connect(sawG).connect(mixBus);
    noise.connect(noiseG).connect(mixBus);
    const formants = [
      { f: 700, q: 9, g: 1.0 },
      { f: 1200, q: 11, g: 0.8 },
      { f: 2900, q: 12, g: 0.25 },
    ].map((spec) => {
      const bp = ac.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = spec.f;
      bp.Q.value = spec.q;
      const fg = ac.createGain();
      fg.gain.value = spec.g;
      mixBus.connect(bp).connect(fg).connect(out);
      return { bp, fg };
    });
    const apply = () => {
      const now = ac.currentTime;
      const breath = clamp(p.breathiness, 0, 100) / 100;
      saw.frequency.setTargetAtTime(clamp(p.sourcePitch, 80, 300), now, 0.02);
      sawG.gain.setTargetAtTime(0.75 * (1 - breath * 0.6), now, 0.02);
      noiseG.gain.setTargetAtTime(0.4 * breath, now, 0.02);
      formants[0].bp.frequency.setTargetAtTime(clamp(p.f1, 200, 1000), now, 0.03);
      formants[1].bp.frequency.setTargetAtTime(clamp(p.f2, 500, 2500), now, 0.03);
    };
    apply();
    saw.start();
    noise.start();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        sawG.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        noiseG.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        saw.stop(ac.currentTime + 0.15);
        noise.stop(ac.currentTime + 0.15);
        setTimeout(() => mixBus.disconnect(), 300);
      },
    };
  },

  /** 저역통과 + 공명 — 감산 합성의 손맛 */
  "filter-sweep": ({ ac, out }, initial) => {
    const p = { ...initial };
    const saw = ac.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.value = 110;
    const sawG = ac.createGain();
    const noise = loopNoise(ac, 90210);
    const noiseG = ac.createGain();
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    const g = ac.createGain();
    g.gain.value = 0.5;
    saw.connect(sawG).connect(filter);
    noise.connect(noiseG).connect(filter);
    filter.connect(g).connect(out);
    saw.start();
    noise.start();
    let t0 = ac.currentTime;
    const apply = () => {
      const now = ac.currentTime;
      const isNoise = p.sourceType >= 0.5;
      sawG.gain.setTargetAtTime(isNoise ? 0 : 0.65, now, 0.02);
      noiseG.gain.setTargetAtTime(isNoise ? 0.6 : 0, now, 0.02);
      filter.Q.setTargetAtTime(clamp(p.resonance, 0.5, 25), now, 0.02);
      // 공명 폭주 보상: Q가 높을수록 전체 게인 축소
      g.gain.setTargetAtTime(0.5 / (1 + p.resonance / 12), now, 0.03);
    };
    apply();
    const ticker = makeTicker(ac, (_dt, now) => {
      const rate = clamp(p.lfoRate, 0, 10);
      const base = clamp(p.cutoff, 100, 8000);
      const f =
        rate === 0
          ? base
          : base * Math.pow(2, Math.sin(2 * Math.PI * rate * (now - t0)) * 1.2);
      filter.frequency.linearRampToValueAtTime(clamp(f, 40, 14000), now + 0.04);
    });
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        ticker.stop();
        g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        saw.stop(ac.currentTime + 0.15);
        noise.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 어택·디케이·서스테인·릴리즈 — 시간 봉투가 정하는 정체 */
  "adsr-envelope": ({ ac, out }, initial) => {
    const p = { ...initial };
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 220;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    const env = ac.createGain();
    env.gain.value = 0;
    osc.connect(lp).connect(env).connect(out);
    osc.start();
    const sched = makeScheduler(ac, (t) => {
      const a = clamp(p.attack, 0, 1000) / 1000;
      const d = clamp(p.decay, 0, 1000) / 1000;
      const s = clamp(p.sustain, 0, 100) / 100;
      const r = clamp(p.release, 0, 2000) / 1000;
      const HOLD = 0.55;
      const PEAK = 0.6;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(PEAK, t + Math.max(a, 0.003));
      env.gain.linearRampToValueAtTime(PEAK * s, t + Math.max(a, 0.003) + Math.max(d, 0.003));
      env.gain.setValueAtTime(PEAK * s, t + a + d + HOLD);
      env.gain.linearRampToValueAtTime(0, t + a + d + HOLD + Math.max(r, 0.005));
      return t + a + d + HOLD + r + 0.5;
    });
    return {
      update(np) {
        Object.assign(p, np);
      },
      stop() {
        sched.stop();
        env.gain.cancelScheduledValues(ac.currentTime);
        env.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        osc.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 지연 복사본 간섭 — 빗살 스펙트럼과 플랜저 */
  "comb-filter": ({ ac, out }, initial) => {
    const p = { ...initial };
    const noise = loopNoise(ac, 606);
    const noiseG = ac.createGain();
    const saw = ac.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.value = 110;
    const sawG = ac.createGain();
    const srcBus = ac.createGain();
    noise.connect(noiseG).connect(srcBus);
    saw.connect(sawG).connect(srcBus);
    const delay = ac.createDelay(0.05);
    const fb = ac.createGain();
    const wet = ac.createGain();
    wet.gain.value = 0.32;
    const dry = ac.createGain();
    dry.gain.value = 0.32;
    srcBus.connect(dry).connect(out);
    srcBus.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(out);
    noise.start();
    saw.start();
    let t0 = ac.currentTime;
    const apply = () => {
      const now = ac.currentTime;
      const isSaw = p.sourceType >= 0.5;
      noiseG.gain.setTargetAtTime(isSaw ? 0 : 0.55, now, 0.02);
      sawG.gain.setTargetAtTime(isSaw ? 0.55 : 0, now, 0.02);
      fb.gain.setTargetAtTime(clamp(p.feedback, 0, 95) / 100, now, 0.02);
    };
    apply();
    const ticker = makeTicker(ac, (_dt, now) => {
      const base = clamp(p.delayTime, 0.5, 20) / 1000;
      const rate = clamp(p.lfoRate, 0, 2);
      const d =
        rate === 0
          ? base
          : base * (1 + 0.35 * Math.sin(2 * Math.PI * rate * (now - t0)));
      delay.delayTime.linearRampToValueAtTime(clamp(d, 0.0004, 0.05), now + 0.04);
    });
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        ticker.stop();
        dry.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        wet.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        fb.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        noise.stop(ac.currentTime + 0.2);
        saw.stop(ac.currentTime + 0.2);
      },
    };
  },

  /** 비선형 곡선 통과 — 배음을 낳는 왜곡 */
  "waveshaping-distortion": ({ ac, out }, initial) => {
    const p = { ...initial };
    const osc = ac.createOscillator();
    osc.frequency.value = 220;
    const pre = ac.createGain();
    const shaper = ac.createWaveShaper();
    shaper.oversample = "4x";
    const tone = ac.createBiquadFilter();
    tone.type = "lowpass";
    const post = ac.createGain();
    osc.connect(pre).connect(shaper).connect(tone).connect(post).connect(out);
    osc.start();
    const buildCurve = () => {
      const n = 2048;
      const curve = new Float32Array(n);
      const bias = ((clamp(p.symmetry, 0, 100) - 50) / 50) * 0.5;
      let maxAbs = 0;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        const y = Math.tanh(3 * (x + bias)) - Math.tanh(3 * bias);
        curve[i] = y;
        maxAbs = Math.max(maxAbs, Math.abs(y));
      }
      if (maxAbs > 0) for (let i = 0; i < n; i++) curve[i] /= maxAbs;
      shaper.curve = curve;
    };
    const apply = () => {
      const now = ac.currentTime;
      const driveLin = dbToGain(clamp(p.drive, 0, 40));
      pre.gain.setTargetAtTime(driveLin, now, 0.02);
      // 드라이브가 커져도 출력 레벨이 뛰지 않도록 보상
      post.gain.setTargetAtTime(0.55 / Math.pow(driveLin, 0.15), now, 0.02);
      tone.frequency.setTargetAtTime(clamp(p.toneCutoff, 500, 8000), now, 0.02);
      buildCurve();
    };
    apply();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        post.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        osc.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 위상차 180°에서 완전 소멸 — 간섭의 산수 */
  "phase-cancellation": ({ ac, out }, initial) => {
    const p = { ...initial };
    const o1 = ac.createOscillator();
    const o2 = ac.createOscillator();
    const g1 = ac.createGain();
    const g2 = ac.createGain();
    g1.gain.value = 0.35;
    g2.gain.value = 0.35;
    const shift = ac.createDelay(0.05);
    o1.connect(g1).connect(out);
    o2.connect(shift).connect(g2).connect(out);
    const apply = () => {
      const now = ac.currentTime;
      o1.frequency.setTargetAtTime(p.frequency, now, 0.02);
      o2.frequency.setTargetAtTime(p.frequency + p.detune, now, 0.02);
      shift.delayTime.setTargetAtTime(
        (clamp(p.phaseOffset, 0, 360) / 360) / p.frequency,
        now,
        0.02
      );
    };
    apply();
    o1.start();
    o2.start();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        g1.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        g2.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        o1.stop(ac.currentTime + 0.15);
        o2.stop(ac.currentTime + 0.15);
      },
    };
  },

  /** 샘플레이트·비트 심도를 낮추면 드러나는 디지털의 한계 (AudioWorklet) */
  "digital-artifacts": ({ ac, out }, initial) => {
    const p = { ...initial };
    const osc = ac.createOscillator();
    const crusher = new AudioWorkletNode(ac, "bitcrusher", {
      outputChannelCount: [1],
    });
    const g = ac.createGain();
    g.gain.value = 0.5;
    osc.connect(crusher).connect(g).connect(out);
    const apply = () => {
      const now = ac.currentTime;
      osc.frequency.setTargetAtTime(clamp(p.sourceFreq, 200, 4000), now, 0.02);
      crusher.parameters.get("crushRate")!.setTargetAtTime(
        clamp(p.sampleRate, 1000, 24000), now, 0.02
      );
      crusher.parameters.get("bitDepth")!.setTargetAtTime(
        clamp(p.bitDepth, 2, 16), now, 0.02
      );
    };
    apply();
    osc.start();
    return {
      update(np) {
        Object.assign(p, np);
        apply();
      },
      stop() {
        g.gain.setTargetAtTime(0, ac.currentTime, 0.02);
        osc.stop(ac.currentTime + 0.15);
        setTimeout(() => crusher.disconnect(), 300);
      },
    };
  },
};
