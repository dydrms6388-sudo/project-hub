/**
 * 공간·합성·이펙트 카테고리 엔진 (20종).
 * values 배열은 data/sounds.json 해당 항목의 params 순서를 따른다.
 */
import type { EngineBuilder } from "./core";
import {
  Scheduler,
  dbToGain,
  loopSource,
  mulberry32,
  scheduleBlip,
  scheduleTone,
  smooth,
  whiteNoiseBuffer,
} from "./core";

const TRIM = dbToGain(-12);

/** 배음 1/n 파형 (부드러운 톱니 근사) */
function harmonicWave(ctx: BaseAudioContext, n = 6): PeriodicWave {
  const real = new Float32Array(n + 1);
  const imag = new Float32Array(n + 1);
  for (let k = 1; k <= n; k++) imag[k] = 1 / k;
  return ctx.createPeriodicWave(real, imag);
}

/** 카플러스-스트롱 현 소리를 버퍼로 직접 합성 (지연 루프의 128샘플 하한 제약 회피) */
function karplusBuffer(
  ctx: BaseAudioContext,
  freq: number,
  damp: number,
  bright: number,
  seconds = 1.8
): AudioBuffer {
  const sr = ctx.sampleRate;
  const N = Math.max(2, Math.round(sr / freq));
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, len, sr);
  const ch = buf.getChannelData(0);
  const rnd = mulberry32(97);
  // 초기 여진: 밝기만큼 고역을 남긴 잡음 (밝기 0에서도 무음이 되지 않게 하한)
  const b = 0.05 + bright * 0.95;
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const w = rnd() * 2 - 1;
    prev = b * w + (1 - b) * prev;
    ch[i] = prev;
  }
  for (let i = N; i < len; i++) {
    ch[i] = damp * 0.5 * (ch[i - N] + ch[i - N + 1]);
  }
  return buf;
}

/** 지수 감쇠 잡음 임펄스 응답 (스테레오) — 잔향 합성용 */
function reverbIR(ctx: BaseAudioContext, rt60: number, brightHz: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * Math.min(rt60 * 1.1, 9));
  const buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const ch = buf.getChannelData(c);
    const rnd = mulberry32(31 + c);
    const a = Math.exp((-2 * Math.PI * brightHz) / sr); // 원폴 저역통과 계수
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const w = rnd() * 2 - 1;
      lp = (1 - a) * w + a * lp;
      ch[i] = lp * Math.exp((-6.908 * t) / rt60);
    }
  }
  return buf;
}

export const synthesisEngines: Record<string, EngineBuilder> = {
  "itd-ild": ({ ctx, out, values }) => {
    const osc = ctx.createOscillator();
    const merger = ctx.createChannelMerger(2);
    merger.connect(out);
    const dL = ctx.createDelay(0.005);
    const dR = ctx.createDelay(0.005);
    const gL = ctx.createGain();
    const gR = ctx.createGain();
    osc.connect(dL); osc.connect(dR);
    dL.connect(gL); dR.connect(gR);
    gL.connect(merger, 0, 0);
    gR.connect(merger, 0, 1);
    const apply = (v: number[]) => {
      const [itdUs, ildDb, f] = v;
      const half = itdUs / 2e6; // µs → s, 좌우 반씩
      smooth(dL.delayTime, 0.001 + Math.max(0, half), ctx);
      smooth(dR.delayTime, 0.001 + Math.max(0, -half), ctx);
      smooth(gL.gain, TRIM * dbToGain(-ildDb / 2), ctx);
      smooth(gR.gain, TRIM * dbToGain(ildDb / 2), ctx);
      smooth(osc.frequency, f, ctx);
    };
    osc.frequency.value = values[2];
    dL.delayTime.value = 0.001;
    dR.delayTime.value = 0.001;
    gL.gain.value = 0; gR.gain.value = 0;
    apply(values);
    osc.start();
    return {
      update: apply,
      stop() {
        osc.stop();
        merger.disconnect();
      },
    };
  },

  "haas-effect": ({ ctx, out, values }) => {
    let [delayMs, lvlDb, period] = values;
    const merger = ctx.createChannelMerger(2);
    merger.connect(out);
    const gL = ctx.createGain();
    const gR = ctx.createGain();
    gL.connect(merger, 0, 0);
    gR.connect(merger, 0, 1);
    const sched = new Scheduler(ctx, (t) => {
      scheduleBlip(ctx, gL, t, { freq: 1200, durMs: 4, gainDb: -8 });
      scheduleBlip(ctx, gR, t + delayMs / 1000, { freq: 1200, durMs: 4, gainDb: -8 + lvlDb });
      return t + period;
    });
    sched.start();
    return {
      update(v) {
        [delayMs, lvlDb, period] = v;
      },
      stop() {
        sched.stop();
        merger.disconnect();
      },
    };
  },

  "phase-cancellation": ({ ctx, out, values }) => {
    const osc = ctx.createOscillator();
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    const delay = ctx.createDelay(0.05);
    const sum = ctx.createGain();
    sum.gain.value = TRIM;
    osc.connect(g1); g1.connect(sum);
    osc.connect(delay); delay.connect(g2); g2.connect(sum);
    sum.connect(out);
    g1.gain.value = 0.5;
    const apply = (v: number[]) => {
      const [deg, f, lvl2] = v;
      smooth(osc.frequency, f, ctx);
      smooth(delay.delayTime, (deg / 360) / f, ctx);
      smooth(g2.gain, 0.5 * dbToGain(lvl2), ctx);
    };
    osc.frequency.value = values[1];
    delay.delayTime.value = (values[0] / 360) / values[1];
    g2.gain.value = 0;
    apply(values);
    osc.start();
    return {
      update: apply,
      stop() {
        osc.stop();
        sum.disconnect();
      },
    };
  },

  doppler: ({ ctx, out, values }) => {
    let [v, dist, f] = values;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(harmonicWave(ctx, 4));
    const g = ctx.createGain();
    g.gain.value = 0;
    const pan = ctx.createStereoPanner();
    osc.connect(g); g.connect(pan); pan.connect(out);
    osc.frequency.value = f;
    osc.start();
    const HALF = 180; // 편도 주행 거리(m)
    let t0 = ctx.currentTime;
    const C = 343;
    const timer = setInterval(() => {
      const elapsed = ctx.currentTime - t0;
      const T = (2 * HALF) / v;
      const tt = elapsed % T;
      const x = -HALF + v * tt; // 왼쪽에서 오른쪽으로 통과
      const r = Math.hypot(x, dist);
      const vr = (v * -x) / r; // 접근 시 양수
      const fObs = (f * C) / (C - Math.min(vr, C * 0.8));
      smooth(osc.frequency, fObs, ctx, 0.05);
      smooth(g.gain, TRIM * Math.min(1, (dist + 6) / r), ctx, 0.05);
      smooth(pan.pan, Math.max(-1, Math.min(1, x / (Math.abs(x) + dist))), ctx, 0.05);
    }, 40);
    return {
      update(nv) {
        [v, dist, f] = nv;
        t0 = ctx.currentTime;
      },
      stop() {
        clearInterval(timer);
        osc.stop();
        pan.disconnect();
      },
    };
  },

  waveforms: ({ ctx, out, values }) => {
    const TYPES: OscillatorType[] = ["sine", "triangle", "square", "sawtooth"];
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = TRIM * 0.8;
    osc.connect(g); g.connect(out);
    osc.type = TYPES[Math.round(values[0])] ?? "sine";
    osc.frequency.value = values[1];
    osc.start();
    return {
      update(v) {
        osc.type = TYPES[Math.round(v[0])] ?? "sine";
        smooth(osc.frequency, v[1], ctx);
      },
      stop() {
        osc.stop();
      },
    };
  },

  "additive-harmonics": ({ ctx, out, values }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = TRIM;
    osc.connect(g); g.connect(out);
    const apply = (v: number[]) => {
      const [f0, nH, slope, oddEven] = v;
      const n = Math.round(nH);
      const real = new Float32Array(n + 1);
      const imag = new Float32Array(n + 1);
      for (let k = 1; k <= n; k++) {
        const rolloff = dbToGain(-slope * (k - 1));
        const w = k % 2 === 1 ? (1 - oddEven) * 2 : oddEven * 2;
        imag[k] = rolloff * (k === 1 ? 1 : w); // 기본음은 항상 유지
      }
      osc.setPeriodicWave(ctx.createPeriodicWave(real, imag));
      smooth(osc.frequency, f0, ctx);
    };
    osc.frequency.value = values[0];
    apply(values);
    osc.start();
    return {
      update: apply,
      stop() {
        osc.stop();
      },
    };
  },

  "fm-synthesis": ({ ctx, out, values }) => {
    const carrier = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();
    const g = ctx.createGain();
    g.gain.value = TRIM;
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    carrier.connect(g); g.connect(out);
    const apply = (v: number[]) => {
      const [fc, fm, index] = v;
      smooth(carrier.frequency, fc, ctx);
      smooth(mod.frequency, fm, ctx);
      // 주파수 편이 = I × fm (단, 반송파가 0 아래로 내려가지 않게 제한)
      smooth(modGain.gain, Math.min(index * fm, fc * 0.95), ctx);
    };
    carrier.frequency.value = values[0];
    mod.frequency.value = values[1];
    modGain.gain.value = 0;
    apply(values);
    carrier.start(); mod.start();
    return {
      update: apply,
      stop() {
        carrier.stop(); mod.stop();
      },
    };
  },

  "am-ringmod": ({ ctx, out, values }) => {
    const carrier = ctx.createOscillator();
    const vca = ctx.createGain();
    const mod = ctx.createOscillator();
    const modDepth = ctx.createGain();
    const g = ctx.createGain();
    g.gain.value = TRIM;
    carrier.connect(vca);
    mod.connect(modDepth);
    modDepth.connect(vca.gain);
    vca.connect(g); g.connect(out);
    const apply = (v: number[]) => {
      const [fc, rate, depth, ring] = v;
      smooth(carrier.frequency, fc, ctx);
      smooth(mod.frequency, rate, ctx);
      // AM(ring=0): 게인 = (1-depth/2) + (depth/2)·sin / 링(ring=1): 게인 = (depth/2)·sin
      smooth(vca.gain, (1 - ring) * (1 - depth / 2), ctx);
      smooth(modDepth.gain, depth / 2, ctx);
    };
    carrier.frequency.value = values[0];
    mod.frequency.value = values[1];
    vca.gain.value = 1;
    modDepth.gain.value = 0;
    apply(values);
    carrier.start(); mod.start();
    return {
      update: apply,
      stop() {
        carrier.stop(); mod.stop();
      },
    };
  },

  "subtractive-noise": ({ ctx, out, values }) => {
    const noise = loopSource(ctx, whiteNoiseBuffer(ctx, 2, 41));
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    g.gain.value = TRIM * 1.5;
    noise.connect(lp); lp.connect(g); g.connect(out);
    lfo.connect(lfoGain); lfoGain.connect(lp.frequency);
    const apply = (v: number[]) => {
      const [cutoff, q, sweepHz, sweepAmt] = v;
      smooth(lp.frequency, cutoff, ctx);
      smooth(lp.Q, q, ctx);
      smooth(lfo.frequency, Math.max(0.01, sweepHz), ctx);
      smooth(lfoGain.gain, cutoff * sweepAmt * 0.8, ctx);
      // 높은 Q에서 공진 폭주를 막기 위한 보상
      smooth(g.gain, (TRIM * 1.5) / Math.sqrt(1 + q / 6), ctx);
    };
    lp.frequency.value = values[0];
    lfoGain.gain.value = 0;
    apply(values);
    noise.start(); lfo.start();
    return {
      update: apply,
      stop() {
        noise.stop(); lfo.stop();
        g.disconnect();
      },
    };
  },

  "karplus-strong": ({ ctx, out, values }) => {
    let [freq, damp, bright, interval] = values;
    let buf = karplusBuffer(ctx, freq, damp, bright);
    let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    const g = ctx.createGain();
    g.gain.value = TRIM * 1.3;
    g.connect(out);
    const sched = new Scheduler(ctx, (t) => {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(g);
      src.start(t);
      return t + interval;
    });
    sched.start();
    return {
      update(v) {
        [freq, damp, bright, interval] = v;
        if (rebuildTimer) clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => {
          buf = karplusBuffer(ctx, freq, damp, bright);
        }, 120);
      },
      stop() {
        if (rebuildTimer) clearTimeout(rebuildTimer);
        sched.stop();
        g.disconnect();
      },
    };
  },

  "adsr-envelope": ({ ctx, out, values }) => {
    let [aMs, dMs, sus, rMs] = values;
    const wave = harmonicWave(ctx, 5);
    const sched = new Scheduler(ctx, (t) => {
      const a = aMs / 1000;
      const d = dMs / 1000;
      const r = rMs / 1000;
      const hold = 0.45;
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(wave);
      osc.frequency.value = 220;
      const env = ctx.createGain();
      const A = TRIM * 1.1;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(A, t + a);
      env.gain.linearRampToValueAtTime(A * sus, t + a + d);
      env.gain.setValueAtTime(A * sus, t + a + d + hold);
      env.gain.linearRampToValueAtTime(0, t + a + d + hold + r);
      osc.connect(env); env.connect(out);
      osc.start(t);
      osc.stop(t + a + d + hold + r + 0.02);
      return t + a + d + hold + r + 0.4;
    });
    sched.start();
    return {
      update(v) {
        [aMs, dMs, sus, rMs] = v;
      },
      stop() {
        sched.stop();
      },
    };
  },

  "formant-vowel": ({ ctx, out, values }) => {
    const src = ctx.createOscillator();
    src.type = "sawtooth";
    const bp1 = ctx.createBiquadFilter();
    const bp2 = ctx.createBiquadFilter();
    bp1.type = "bandpass";
    bp2.type = "bandpass";
    bp1.Q.value = 9;
    bp2.Q.value = 11;
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    g1.gain.value = 1.4;
    g2.gain.value = 1.0;
    const sum = ctx.createGain();
    sum.gain.value = TRIM * 1.6;
    src.connect(bp1); bp1.connect(g1); g1.connect(sum);
    src.connect(bp2); bp2.connect(g2); g2.connect(sum);
    sum.connect(out);
    const apply = (v: number[]) => {
      const [f1, f2, f0] = v;
      smooth(bp1.frequency, f1, ctx);
      smooth(bp2.frequency, f2, ctx);
      smooth(src.frequency, f0, ctx);
    };
    src.frequency.value = values[2];
    bp1.frequency.value = values[0];
    bp2.frequency.value = values[1];
    apply(values);
    src.start();
    return {
      update: apply,
      stop() {
        src.stop();
        sum.disconnect();
      },
    };
  },

  "noise-colors": ({ ctx, out, values }) => {
    const g = ctx.createGain();
    g.connect(out);
    let src: AudioBufferSourceNode | null = null;
    let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    const build = (slope: number) => {
      const sr = ctx.sampleRate;
      const len = sr * 4;
      const buf = ctx.createBuffer(1, len, sr);
      const ch = buf.getChannelData(0);
      const rnd = mulberry32(53);
      // 백색(0) / 분홍(-3) / 갈색(-6) / 심갈색(-9 근사)을 생성해 RMS 정규화 후 구간 혼합
      const white = new Float32Array(len);
      for (let i = 0; i < len; i++) white[i] = rnd() * 2 - 1;
      const pink = new Float32Array(len);
      { // Voss-McCartney 근사 (8행)
        const rows = new Float32Array(8);
        const r2 = mulberry32(59);
        for (let i = 0; i < len; i++) {
          for (let b = 0; b < 8; b++) if (i % (1 << b) === 0) rows[b] = r2() * 2 - 1;
          let s = 0;
          for (let b = 0; b < 8; b++) s += rows[b];
          pink[i] = s / 8;
        }
      }
      const brown = new Float32Array(len);
      { let acc = 0;
        for (let i = 0; i < len; i++) { acc = 0.998 * acc + white[i] * 0.02; brown[i] = acc; } }
      const dark = new Float32Array(len);
      { let acc = 0;
        for (let i = 0; i < len; i++) { acc = 0.998 * acc + brown[i] * 0.02; dark[i] = acc; } }
      const norm = (a: Float32Array) => {
        let s = 0;
        for (let i = 0; i < len; i++) s += a[i] * a[i];
        const rms = Math.sqrt(s / len) || 1;
        for (let i = 0; i < len; i++) a[i] /= rms;
      };
      [white, pink, brown, dark].forEach(norm);
      const seg = Math.min(2.9999, Math.max(0, -slope / 3)); // 0..3
      const i0 = Math.floor(seg);
      const frac = seg - i0;
      const bank = [white, pink, brown, dark];
      const a0 = bank[i0];
      const a1 = bank[Math.min(3, i0 + 1)];
      for (let i = 0; i < len; i++) ch[i] = (a0[i] * (1 - frac) + a1[i] * frac) * 0.18;
      const next = ctx.createBufferSource();
      next.buffer = buf;
      next.loop = true;
      next.connect(g);
      next.start();
      if (src) src.stop();
      src = next;
    };
    const apply = (v: number[]) => {
      smooth(g.gain, dbToGain(v[1]) * 1.2, ctx);
    };
    build(values[0]);
    apply(values);
    let lastSlope = values[0];
    return {
      update(v) {
        apply(v);
        if (v[0] !== lastSlope) {
          lastSlope = v[0];
          if (rebuildTimer) clearTimeout(rebuildTimer);
          rebuildTimer = setTimeout(() => build(v[0]), 150);
        }
      },
      stop() {
        if (rebuildTimer) clearTimeout(rebuildTimer);
        if (src) src.stop();
        g.disconnect();
      },
    };
  },

  "delay-echo": ({ ctx, out, values }) => {
    let [delayMs, fb, srcS] = values;
    const delay = ctx.createDelay(1.2);
    const fbGain = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = 0.8;
    const bus = ctx.createGain();
    delay.connect(fbGain);
    fbGain.connect(delay);
    bus.connect(delay);
    bus.connect(out);
    delay.connect(wet);
    wet.connect(out);
    delay.delayTime.value = delayMs / 1000;
    fbGain.gain.value = Math.min(fb, 0.85);
    const sched = new Scheduler(ctx, (t) => {
      scheduleTone(ctx, bus, t, { freq: 660, dur: 0.09, gainDb: -10, type: "triangle", rampMs: 4 });
      return t + srcS;
    });
    sched.start();
    return {
      update(v) {
        [delayMs, fb, srcS] = v;
        smooth(delay.delayTime, delayMs / 1000, ctx);
        smooth(fbGain.gain, Math.min(fb, 0.85), ctx);
      },
      stop() {
        sched.stop();
        fbGain.disconnect();
        bus.disconnect();
        wet.disconnect();
        delay.disconnect();
      },
    };
  },

  "flanger-chorus": ({ ctx, out, values }) => {
    const src = ctx.createOscillator();
    src.type = "sawtooth";
    src.frequency.value = 110;
    const srcGain = ctx.createGain();
    srcGain.gain.value = TRIM * 0.9;
    const delay = ctx.createDelay(0.08);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const fbGain = ctx.createGain();
    const sum = ctx.createGain();
    src.connect(srcGain);
    srcGain.connect(sum);
    srcGain.connect(delay);
    delay.connect(sum);
    delay.connect(fbGain);
    fbGain.connect(delay);
    lfo.connect(lfoGain);
    lfoGain.connect(delay.delayTime);
    sum.connect(out);
    const apply = (v: number[]) => {
      const [centerMs, width, rate, fb] = v;
      const c = centerMs / 1000;
      smooth(delay.delayTime, c, ctx);
      smooth(lfoGain.gain, c * width * 0.9, ctx);
      smooth(lfo.frequency, Math.max(0.01, rate), ctx);
      smooth(fbGain.gain, Math.min(fb, 0.8), ctx);
    };
    delay.delayTime.value = values[0] / 1000;
    lfoGain.gain.value = 0;
    fbGain.gain.value = 0;
    apply(values);
    src.start(); lfo.start();
    return {
      update: apply,
      stop() {
        src.stop(); lfo.stop();
        fbGain.disconnect();
        sum.disconnect();
      },
    };
  },

  "reverb-convolution": ({ ctx, out, values }) => {
    let [rt60, bright, wet] = values;
    const conv = ctx.createConvolver();
    conv.buffer = reverbIR(ctx, rt60, bright);
    const dry = ctx.createGain();
    const wetG = ctx.createGain();
    const bus = ctx.createGain();
    bus.connect(dry); dry.connect(out);
    bus.connect(conv); conv.connect(wetG); wetG.connect(out);
    dry.gain.value = 1 - wet;
    wetG.gain.value = wet * 1.6;
    let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    const sched = new Scheduler(ctx, (t) => {
      scheduleBlip(ctx, bus, t, { freq: 900, durMs: 22, gainDb: -8, type: "triangle" });
      scheduleBlip(ctx, bus, t + 0.6, { freq: 1600, durMs: 10, gainDb: -14 });
      return t + 1.6;
    });
    sched.start();
    return {
      update(v) {
        [rt60, bright, wet] = v;
        smooth(dry.gain, 1 - wet, ctx);
        smooth(wetG.gain, wet * 1.6, ctx);
        if (rebuildTimer) clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => {
          conv.buffer = reverbIR(ctx, rt60, bright);
        }, 250);
      },
      stop() {
        if (rebuildTimer) clearTimeout(rebuildTimer);
        sched.stop();
        bus.disconnect();
        conv.disconnect();
        dry.disconnect();
        wetG.disconnect();
      },
    };
  },

  "distortion-waveshaping": ({ ctx, out, values }) => {
    const osc = ctx.createOscillator();
    const pre = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.oversample = "4x";
    const dc = ctx.createBiquadFilter(); // 비대칭 왜곡의 직류 성분 제거
    dc.type = "highpass";
    dc.frequency.value = 12;
    const post = ctx.createGain();
    osc.connect(pre); pre.connect(shaper); shaper.connect(dc); dc.connect(post); post.connect(out);
    const makeCurve = (shape: number, asym: number) => {
      const N = 2048;
      const curve = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const x = (i / (N - 1)) * 2 - 1 + asym * 0.4;
        const soft = Math.tanh(2 * x);
        const hard = Math.max(-0.8, Math.min(0.8, 2.5 * x));
        curve[i] = soft * (1 - shape) + hard * shape;
      }
      return curve;
    };
    const apply = (v: number[]) => {
      const [drive, shape, asym, f] = v;
      pre.gain.setValueAtTime(dbToGain(drive), ctx.currentTime);
      shaper.curve = makeCurve(shape, asym);
      smooth(osc.frequency, f, ctx);
      // 드라이브에 따른 라우드니스 점프 완화 (최종 안전은 마스터 리미터가 담당)
      smooth(post.gain, TRIM * dbToGain(-drive * 0.25) * 1.2, ctx);
    };
    osc.frequency.value = values[3];
    pre.gain.value = 1;
    post.gain.value = TRIM;
    apply(values);
    osc.start();
    return {
      update: apply,
      stop() {
        osc.stop();
        post.disconnect();
      },
    };
  },

  "digital-degradation": ({ ctx, out, values }) => {
    const g = ctx.createGain();
    g.gain.value = TRIM;
    g.connect(out);
    let src: AudioBufferSourceNode | null = null;
    let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    const build = (v: number[]) => {
      const [srate, bits, fIn] = v;
      const sr = ctx.sampleRate;
      const f = Math.max(1, Math.round(fIn)); // 정수 Hz → 1초 버퍼가 깨끗하게 루프
      const len = sr;
      const buf = ctx.createBuffer(1, len, sr);
      const ch = buf.getChannelData(0);
      const stepLevels = Math.pow(2, Math.round(bits) - 1);
      const holdStep = srate / sr; // 다운샘플 누산기
      let acc = 1;
      let held = 0;
      for (let i = 0; i < len; i++) {
        acc += holdStep;
        if (acc >= 1) {
          acc -= 1;
          const s = Math.sin((2 * Math.PI * f * i) / sr);
          held = Math.round(s * stepLevels) / stepLevels; // 양자화
        }
        ch[i] = held * 0.8;
      }
      const next = ctx.createBufferSource();
      next.buffer = buf;
      next.loop = true;
      next.connect(g);
      next.start();
      if (src) src.stop();
      src = next;
    };
    build(values);
    return {
      update(v) {
        if (rebuildTimer) clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => build(v), 150);
      },
      stop() {
        if (rebuildTimer) clearTimeout(rebuildTimer);
        if (src) src.stop();
        g.disconnect();
      },
    };
  },
};
