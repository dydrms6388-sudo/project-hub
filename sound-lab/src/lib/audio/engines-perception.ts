/**
 * 착청·심리음향 카테고리 엔진 (20종).
 * 각 빌더의 values 배열은 data/sounds.json 해당 항목의 params 순서를 따른다.
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

const TRIM = dbToGain(-12); // 엔진 공통 기본 트림

/** 셰퍼드 성분: 로그 주파수 축 가우시안 창의 게인 (0..1) */
function shepardGain(freq: number, center: number, sigmaOct = 1.6): number {
  const d = Math.log2(freq / center);
  return Math.exp(-(d * d) / (2 * sigmaOct * sigmaOct));
}

export const perceptionEngines: Record<string, EngineBuilder> = {
  "shepard-tone": ({ ctx, out, values }) => {
    let [speed, layers, center] = values;
    const MAXL = 8;
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    const master = ctx.createGain();
    master.gain.value = TRIM * 0.5;
    master.connect(out);
    // 위치 p ∈ [0, MAXL): 주파수 = base * 2^p
    const pos: number[] = [];
    for (let i = 0; i < MAXL; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(master);
      o.frequency.value = 100;
      o.start();
      oscs.push(o);
      gains.push(g);
      pos.push(i);
    }
    let last = ctx.currentTime;
    const apply = () => {
      const span = Math.round(layers);
      const base = center / Math.pow(2, span / 2);
      for (let i = 0; i < MAXL; i++) {
        if (i >= span) {
          smooth(gains[i].gain, 0, ctx);
          continue;
        }
        const p = ((pos[i] % span) + span) % span;
        const f = base * Math.pow(2, p);
        // 경계(랩) 부근에서는 게인이 0에 가까워 주파수 점프가 들리지 않는다
        oscs[i].frequency.setValueAtTime(Math.min(12000, Math.max(20, f)), ctx.currentTime);
        smooth(gains[i].gain, (shepardGain(f, center) * 0.9) / span, ctx);
      }
    };
    const timer = setInterval(() => {
      const now = ctx.currentTime;
      const dt = now - last;
      last = now;
      for (let i = 0; i < MAXL; i++) pos[i] += (speed / 12) * dt;
      apply();
    }, 35);
    apply();
    return {
      update(v) {
        [speed, layers, center] = v;
      },
      stop() {
        clearInterval(timer);
        oscs.forEach((o) => o.stop());
        master.disconnect();
      },
    };
  },

  "risset-rhythm": ({ ctx, out, values }) => {
    let [tempo, accel, layers] = values;
    let phase = 0; // 옥타브 위치 위상
    let lastWall = ctx.currentTime;
    const next: number[] = [0, 0, 0, 0];
    const sched = new Scheduler(ctx, (t) => {
      const now = ctx.currentTime;
      phase += (now - lastWall) / accel;
      lastWall = now;
      const L = Math.round(layers);
      for (let k = 0; k < L; k++) {
        if (next[k] < t) next[k] = t;
        const o = ((((phase + k) % L) + L) % L) - L / 2;
        const rate = (tempo / 60) * Math.pow(2, o);
        if (next[k] < t + 0.001) {
          const g = Math.exp(-(o * o) / (2 * 1.1 * 1.1));
          scheduleBlip(ctx, out, next[k], {
            freq: 900 * Math.pow(2, o * 0.5),
            durMs: 18,
            gainDb: -14 + 20 * Math.log10(Math.max(g, 1e-3)),
            type: "triangle",
          });
          next[k] += 1 / rate;
        }
      }
      return t + 0.02;
    });
    sched.start();
    return {
      update(v) {
        [tempo, accel, layers] = v;
      },
      stop() {
        sched.stop();
      },
    };
  },

  "tritone-paradox": ({ ctx, out, values }) => {
    let [pc, center, gap] = values;
    const playComplex = (t: number, pitchClass: number) => {
      // C4 기준 크로마 — 옥타브 6층 셰퍼드 음
      for (let oct = -3; oct <= 3; oct++) {
        const f = 261.63 * Math.pow(2, (pitchClass / 12) + oct);
        if (f < 40 || f > 8000) continue;
        const g = shepardGain(f, center, 1.2);
        if (g < 0.02) continue;
        scheduleTone(ctx, out, t, {
          freq: f,
          dur: 0.5,
          gainDb: -20 + 20 * Math.log10(g),
          rampMs: 20,
        });
      }
    };
    const sched = new Scheduler(ctx, (t) => {
      playComplex(t, pc);
      playComplex(t + 0.5 + gap, (pc + 6) % 12);
      return t + 0.5 + gap + 0.5 + 1.2;
    });
    sched.start();
    return {
      update(v) {
        [pc, center, gap] = v;
      },
      stop() {
        sched.stop();
      },
    };
  },

  "missing-fundamental": ({ ctx, out, values }) => {
    const MAXH = 10;
    const master = ctx.createGain();
    master.gain.value = TRIM;
    master.connect(out);
    const oscs: OscillatorNode[] = [];
    const gains: GainNode[] = [];
    for (let i = 0; i < MAXH; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(master);
      o.frequency.value = 100;
      o.start();
      oscs.push(o);
      gains.push(g);
    }
    const apply = (v: number[]) => {
      const [f0, startH, count] = v;
      for (let i = 0; i < MAXH; i++) {
        const n = Math.round(startH) + i;
        const active = i < Math.round(count) && f0 * n < 12000;
        smooth(oscs[i].frequency, Math.min(12000, f0 * n), ctx);
        smooth(gains[i].gain, active ? 0.8 / Math.round(count) : 0, ctx);
      }
    };
    apply(values);
    return {
      update: apply,
      stop() {
        oscs.forEach((o) => o.stop());
        master.disconnect();
      },
    };
  },

  "continuity-illusion": ({ ctx, out, values }) => {
    let [freq, gapMs, noiseDb] = values;
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const toneGate = ctx.createGain();
    toneGate.gain.value = 0;
    osc.connect(toneGate);
    toneGate.connect(out);
    osc.start();
    const noise = loopSource(ctx, whiteNoiseBuffer(ctx, 2, 7));
    const noiseGate = ctx.createGain();
    noiseGate.gain.value = 0;
    noise.connect(noiseGate);
    noiseGate.connect(out);
    noise.start();
    const sched = new Scheduler(ctx, (t) => {
      const gap = gapMs / 1000;
      const toneAmp = TRIM;
      const noiseAmp = TRIM * dbToGain(noiseDb) * 2;
      // 톤 0.7초 → 끊김(gap) → 반복. 끊김 구간에만 잡음.
      toneGate.gain.setValueAtTime(0, t);
      toneGate.gain.linearRampToValueAtTime(toneAmp, t + 0.01);
      toneGate.gain.setValueAtTime(toneAmp, t + 0.7 - 0.01);
      toneGate.gain.linearRampToValueAtTime(0, t + 0.7);
      noiseGate.gain.setValueAtTime(0, t + 0.7 - 0.005);
      noiseGate.gain.linearRampToValueAtTime(noiseAmp, t + 0.7 + 0.005);
      noiseGate.gain.setValueAtTime(noiseAmp, t + 0.7 + gap - 0.005);
      noiseGate.gain.linearRampToValueAtTime(0, t + 0.7 + gap);
      return t + 0.7 + gap;
    });
    sched.start();
    return {
      update(v) {
        [freq, gapMs, noiseDb] = v;
        smooth(osc.frequency, freq, ctx);
      },
      stop() {
        sched.stop();
        osc.stop();
        noise.stop();
      },
    };
  },

  "auditory-streaming": ({ ctx, out, values }) => {
    let [fA, semis, durMs] = values;
    let step = 0;
    const sched = new Scheduler(ctx, (t) => {
      const dur = durMs / 1000;
      const fB = fA * Math.pow(2, -semis / 12);
      const slot = step % 4; // A B A _
      if (slot === 0 || slot === 2) {
        scheduleTone(ctx, out, t, { freq: fA, dur: dur * 0.85, gainDb: -14 });
      } else if (slot === 1) {
        scheduleTone(ctx, out, t, { freq: fB, dur: dur * 0.85, gainDb: -14 });
      }
      step++;
      return t + dur;
    });
    sched.start();
    return {
      update(v) {
        [fA, semis, durMs] = v;
      },
      stop() {
        sched.stop();
      },
    };
  },

  "octave-illusion": ({ ctx, out, values }) => {
    let [fLow, alternMs] = values;
    const merger = ctx.createChannelMerger(2);
    merger.connect(out);
    const oscL = ctx.createOscillator();
    const oscH = ctx.createOscillator();
    oscL.frequency.value = fLow;
    oscH.frequency.value = fLow * 2;
    const gLL = ctx.createGain(); // low → left
    const gLR = ctx.createGain();
    const gHL = ctx.createGain();
    const gHR = ctx.createGain();
    [gLL, gLR, gHL, gHR].forEach((g) => (g.gain.value = 0));
    oscL.connect(gLL); oscL.connect(gLR);
    oscH.connect(gHL); oscH.connect(gHR);
    gLL.connect(merger, 0, 0); gHL.connect(merger, 0, 0);
    gLR.connect(merger, 0, 1); gHR.connect(merger, 0, 1);
    oscL.start(); oscH.start();
    let flip = 0;
    const A = TRIM;
    const sched = new Scheduler(ctx, (t) => {
      const dur = alternMs / 1000;
      // flip 짝수: 왼쪽 고음 + 오른쪽 저음 / 홀수: 반대
      const [hi, lo] = flip % 2 === 0 ? [gHL, gLR] : [gHR, gLL];
      for (const g of [gLL, gLR, gHL, gHR]) {
        g.gain.setValueAtTime(g === hi || g === lo ? 0 : 0, t);
      }
      for (const g of [hi, lo]) {
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(A, t + 0.005);
        g.gain.setValueAtTime(A, t + dur - 0.005);
        g.gain.linearRampToValueAtTime(0, t + dur);
      }
      flip++;
      return t + dur;
    });
    sched.start();
    return {
      update(v) {
        [fLow, alternMs] = v;
        smooth(oscL.frequency, fLow, ctx);
        smooth(oscH.frequency, fLow * 2, ctx);
      },
      stop() {
        sched.stop();
        oscL.stop(); oscH.stop();
        merger.disconnect();
      },
    };
  },

  "scale-illusion": ({ ctx, out, values }) => {
    let [tempoMs, base] = values;
    const merger = ctx.createChannelMerger(2);
    merger.connect(out);
    const gL = ctx.createGain();
    const gR = ctx.createGain();
    gL.connect(merger, 0, 0);
    gR.connect(merger, 0, 1);
    // 장음계 상행+하행 (도~도~도), 두 성부가 음표 단위로 좌우 교차
    const major = [0, 2, 4, 5, 7, 9, 11, 12];
    const up = [...major, ...[...major].reverse().slice(1)];
    const down = up.map((s) => 12 - s);
    let idx = 0;
    const sched = new Scheduler(ctx, (t) => {
      const dur = tempoMs / 1000;
      const i = idx % up.length;
      const f1 = base * Math.pow(2, up[i] / 12);
      const f2 = base * Math.pow(2, down[i] / 12);
      const ear1 = idx % 2 === 0 ? gL : gR;
      const ear2 = idx % 2 === 0 ? gR : gL;
      scheduleTone(ctx, ear1, t, { freq: f1, dur: dur * 0.92, gainDb: -14 });
      scheduleTone(ctx, ear2, t, { freq: f2, dur: dur * 0.92, gainDb: -14 });
      idx++;
      return t + dur;
    });
    sched.start();
    return {
      update(v) {
        [tempoMs, base] = v;
      },
      stop() {
        sched.stop();
        merger.disconnect();
      },
    };
  },

  "zwicker-tone": ({ ctx, out, values }) => {
    let [center, width, durS] = values;
    const noise = loopSource(ctx, whiteNoiseBuffer(ctx, 2, 11));
    const n1 = ctx.createBiquadFilter();
    const n2 = ctx.createBiquadFilter();
    n1.type = "notch";
    n2.type = "notch";
    const gate = ctx.createGain();
    gate.gain.value = 0;
    noise.connect(n1); n1.connect(n2); n2.connect(gate); gate.connect(out);
    noise.start();
    const applyFilter = () => {
      const q = Math.max(0.8, center / width);
      for (const n of [n1, n2]) {
        n.frequency.setValueAtTime(center, ctx.currentTime);
        n.Q.setValueAtTime(q, ctx.currentTime);
      }
    };
    applyFilter();
    const sched = new Scheduler(ctx, (t) => {
      const A = TRIM * 1.2;
      gate.gain.setValueAtTime(0, t);
      gate.gain.linearRampToValueAtTime(A, t + 0.05);
      gate.gain.setValueAtTime(A, t + durS - 0.02);
      gate.gain.linearRampToValueAtTime(0, t + durS);
      // 정적 2초 — 이 구간에서 잔류음을 듣는다
      return t + durS + 2;
    });
    sched.start();
    return {
      update(v) {
        [center, width, durS] = v;
        applyFilter();
      },
      stop() {
        sched.stop();
        noise.stop();
        gate.disconnect();
      },
    };
  },

  "repetition-pitch": ({ ctx, out, values }) => {
    let [delayMs, mix] = values;
    const noise = loopSource(ctx, whiteNoiseBuffer(ctx, 2, 13));
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = delayMs / 1000;
    const sum = ctx.createGain();
    sum.gain.value = TRIM * 0.9;
    noise.connect(dry); dry.connect(sum);
    noise.connect(delay); delay.connect(wet); wet.connect(sum);
    sum.connect(out);
    dry.gain.value = 1;
    wet.gain.value = mix;
    noise.start();
    return {
      update(v) {
        [delayMs, mix] = v;
        smooth(delay.delayTime, delayMs / 1000, ctx);
        smooth(wet.gain, mix, ctx);
      },
      stop() {
        noise.stop();
        sum.disconnect();
      },
    };
  },

  "rhythm-to-pitch": ({ ctx, out, values }) => {
    const gain = ctx.createGain();
    gain.connect(out);
    let src: AudioBufferSourceNode | null = null;
    let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    const build = (v: number[]) => {
      const [rate, clickMs] = v;
      const sr = ctx.sampleRate;
      const buf = ctx.createBuffer(1, sr, sr); // 1초 루프, rate는 정수
      const ch = buf.getChannelData(0);
      const clickLen = Math.floor((clickMs / 1000) * sr);
      const n = Math.max(1, Math.round(rate));
      for (let i = 0; i < n; i++) {
        const s = Math.floor((i / n) * sr);
        for (let j = 0; j < clickLen && s + j < sr; j++) {
          const env = Math.exp(-j / (clickLen * 0.4));
          ch[s + j] += Math.sin((2 * Math.PI * 2000 * j) / sr) * env;
        }
      }
      // 밀도가 높을수록 라우드니스가 커지므로 보정
      const trim = TRIM * 1.4 / Math.sqrt(Math.max(1, n / 8));
      gain.gain.setTargetAtTime(trim, ctx.currentTime, 0.03);
      const next = ctx.createBufferSource();
      next.buffer = buf;
      next.loop = true;
      next.connect(gain);
      next.start();
      if (src) src.stop();
      src = next;
    };
    build(values);
    return {
      update(v) {
        if (rebuildTimer) clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => build(v), 120);
      },
      stop() {
        if (rebuildTimer) clearTimeout(rebuildTimer);
        if (src) src.stop();
        gain.disconnect();
      },
    };
  },

  "subjective-rhythmization": ({ ctx, out, values }) => {
    let [bpm, pitch, accentDb] = values;
    let n = 0;
    const sched = new Scheduler(ctx, (t) => {
      const acc = n % 4 === 0 ? accentDb : 0;
      scheduleBlip(ctx, out, t, { freq: pitch, durMs: 25, gainDb: -16 + acc, type: "sine" });
      n++;
      return t + 60 / bpm;
    });
    sched.start();
    return {
      update(v) {
        [bpm, pitch, accentDb] = v;
      },
      stop() {
        sched.stop();
      },
    };
  },

  "two-tone-interference": ({ ctx, out, values }) => {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    o1.connect(g1); g1.connect(out);
    o2.connect(g2); g2.connect(out);
    const apply = (v: number[]) => {
      const [f, delta, bal] = v;
      smooth(o1.frequency, f, ctx);
      smooth(o2.frequency, f + delta, ctx);
      smooth(g1.gain, TRIM * dbToGain(-bal / 2) * 0.7, ctx);
      smooth(g2.gain, TRIM * dbToGain(bal / 2) * 0.7, ctx);
    };
    o1.frequency.value = values[0];
    o2.frequency.value = values[0] + values[1];
    g1.gain.value = 0;
    g2.gain.value = 0;
    apply(values);
    o1.start(); o2.start();
    return {
      update: apply,
      stop() {
        o1.stop(); o2.stop();
      },
    };
  },

  "binaural-beats": ({ ctx, out, values }) => {
    const merger = ctx.createChannelMerger(2);
    merger.connect(out);
    const oL = ctx.createOscillator();
    const oR = ctx.createOscillator();
    const gL = ctx.createGain();
    const gR = ctx.createGain();
    gL.gain.value = TRIM;
    gR.gain.value = TRIM;
    oL.connect(gL); gL.connect(merger, 0, 0);
    oR.connect(gR); gR.connect(merger, 0, 1);
    const apply = (v: number[]) => {
      const [f, delta] = v;
      smooth(oL.frequency, f, ctx);
      smooth(oR.frequency, f + delta, ctx);
    };
    oL.frequency.value = values[0];
    oR.frequency.value = values[0] + values[1];
    oL.start(); oR.start();
    return {
      update: apply,
      stop() {
        oL.stop(); oR.stop();
        merger.disconnect();
      },
    };
  },

  masking: ({ ctx, out, values }) => {
    let [toneF, toneDb, nCenter, nBw] = values;
    const noise = loopSource(ctx, whiteNoiseBuffer(ctx, 2, 17));
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    const nGain = ctx.createGain();
    nGain.gain.value = TRIM * 1.6;
    noise.connect(bp); bp.connect(nGain); nGain.connect(out);
    noise.start();
    const osc = ctx.createOscillator();
    const tGate = ctx.createGain();
    tGate.gain.value = 0;
    osc.connect(tGate); tGate.connect(out);
    osc.start();
    const applyFilter = () => {
      smooth(bp.frequency, nCenter, ctx);
      smooth(bp.Q, Math.max(0.5, nCenter / nBw), ctx);
      smooth(osc.frequency, toneF, ctx);
    };
    applyFilter();
    // 톤을 0.4초 켜고 0.4초 끄기 — 검출 과제를 쉽게 만든다
    const sched = new Scheduler(ctx, (t) => {
      const A = dbToGain(toneDb) * 2;
      tGate.gain.setValueAtTime(0, t);
      tGate.gain.linearRampToValueAtTime(A, t + 0.02);
      tGate.gain.setValueAtTime(A, t + 0.38);
      tGate.gain.linearRampToValueAtTime(0, t + 0.4);
      return t + 0.8;
    });
    sched.start();
    return {
      update(v) {
        [toneF, toneDb, nCenter, nBw] = v;
        applyFilter();
      },
      stop() {
        sched.stop();
        noise.stop(); osc.stop();
        nGain.disconnect(); tGate.disconnect();
      },
    };
  },

  "equal-loudness": ({ ctx, out, values }) => {
    let [cmpF, cmpDb] = values;
    const sched = new Scheduler(ctx, (t) => {
      // 1kHz 기준음(-20dB) 0.8초 ↔ 비교음 0.8초 교대
      scheduleTone(ctx, out, t, { freq: 1000, dur: 0.8, gainDb: -20, rampMs: 25 });
      scheduleTone(ctx, out, t + 1.0, {
        freq: Math.min(cmpF, 16000),
        dur: 0.8,
        gainDb: cmpDb,
        rampMs: 25,
      });
      return t + 2.0;
    });
    sched.start();
    return {
      update(v) {
        [cmpF, cmpDb] = v;
      },
      stop() {
        sched.stop();
      },
    };
  },

  "pitch-jnd": ({ ctx, out, values }) => {
    let [f, cents, gapS] = values;
    const sched = new Scheduler(ctx, (t) => {
      scheduleTone(ctx, out, t, { freq: f, dur: 0.5, gainDb: -16, rampMs: 15 });
      scheduleTone(ctx, out, t + 0.5 + gapS, {
        freq: f * Math.pow(2, cents / 1200),
        dur: 0.5,
        gainDb: -16,
        rampMs: 15,
      });
      return t + 0.5 + gapS + 0.5 + 0.9;
    });
    sched.start();
    return {
      update(v) {
        [f, cents, gapS] = v;
      },
      stop() {
        sched.stop();
      },
    };
  },

  "hearing-range": ({ ctx, out, values }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(out);
    g.gain.value = 0;
    osc.frequency.value = values[0];
    osc.start();
    const apply = (v: number[]) => {
      const [f, lvl] = v;
      smooth(osc.frequency, f, ctx, 0.05);
      smooth(g.gain, dbToGain(lvl) * 0.9, ctx);
    };
    apply(values);
    return {
      update: apply,
      stop() {
        osc.stop();
      },
    };
  },

  "combination-tones": ({ ctx, out, values }) => {
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0;
    o1.connect(g); o2.connect(g); g.connect(out);
    const apply = (v: number[]) => {
      const [f1, ratio, lvl] = v;
      smooth(o1.frequency, f1, ctx);
      smooth(o2.frequency, f1 * ratio, ctx);
      smooth(g.gain, dbToGain(lvl) * 0.5, ctx);
    };
    o1.frequency.value = values[0];
    o2.frequency.value = values[0] * values[1];
    apply(values);
    o1.start(); o2.start();
    return {
      update: apply,
      stop() {
        o1.stop(); o2.stop();
      },
    };
  },

  "phase-timbre": ({ ctx, out, values }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = TRIM;
    osc.connect(g); g.connect(out);
    const apply = (v: number[]) => {
      const [f0, nH, deg] = v;
      const n = Math.round(nH);
      const real = new Float32Array(n + 1);
      const imag = new Float32Array(n + 1);
      const rnd = mulberry32(42); // 시드 고정 — 같은 각도면 항상 같은 위상 배열
      for (let k = 1; k <= n; k++) {
        const amp = 1 / k;
        const phase = (rnd() * 2 - 1) * (deg / 180) * Math.PI;
        real[k] = amp * Math.sin(phase);
        imag[k] = amp * Math.cos(phase);
      }
      osc.setPeriodicWave(ctx.createPeriodicWave(real, imag, { disableNormalization: false }));
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

  "tuning-temperament": ({ ctx, out, values }) => {
    // 6배음 파형 — 배음 맥놀이가 들리도록 한다
    const makeWave = (c: BaseAudioContext) => {
      const real = new Float32Array(7);
      const imag = new Float32Array(7);
      for (let k = 1; k <= 6; k++) imag[k] = 1 / k;
      return c.createPeriodicWave(real, imag);
    };
    const wave = makeWave(ctx);
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    o1.setPeriodicWave(wave);
    o2.setPeriodicWave(wave);
    const g = ctx.createGain();
    g.gain.value = TRIM * 0.7;
    o1.connect(g); o2.connect(g); g.connect(out);
    const JUST: Record<number, number> = {
      3: 6 / 5, 4: 5 / 4, 5: 4 / 3, 6: 7 / 5, 7: 3 / 2,
      8: 8 / 5, 9: 5 / 3, 10: 9 / 5, 11: 15 / 8, 12: 2,
    };
    const apply = (v: number[]) => {
      const [root, semis, morph] = v;
      const s = Math.round(semis);
      const fJust = root * (JUST[s] ?? Math.pow(2, s / 12));
      const fEq = root * Math.pow(2, s / 12);
      const f2 = fJust * Math.pow(fEq / fJust, morph);
      smooth(o1.frequency, root, ctx);
      smooth(o2.frequency, f2, ctx);
    };
    o1.frequency.value = values[0];
    apply(values);
    o1.start(); o2.start();
    return {
      update: apply,
      stop() {
        o1.stop(); o2.stop();
      },
    };
  },

  "gap-detection": ({ ctx, out, values }) => {
    let [gapMs, hi, period] = values;
    const noise = loopSource(ctx, whiteNoiseBuffer(ctx, 2, 23));
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = hi;
    const gate = ctx.createGain();
    gate.gain.value = TRIM * 1.4;
    noise.connect(lp); lp.connect(gate); gate.connect(out);
    noise.start();
    const sched = new Scheduler(ctx, (t) => {
      const A = TRIM * 1.4;
      const gap = gapMs / 1000;
      const mid = t + period / 2;
      if (gap > 0.0005) {
        gate.gain.setValueAtTime(A, mid - 0.0005);
        gate.gain.linearRampToValueAtTime(0, mid);
        gate.gain.setValueAtTime(0, mid + gap);
        gate.gain.linearRampToValueAtTime(A, mid + gap + 0.0005);
      }
      return t + period;
    });
    sched.start();
    return {
      update(v) {
        [gapMs, hi, period] = v;
        smooth(lp.frequency, hi, ctx);
      },
      stop() {
        sched.stop();
        noise.stop();
        gate.disconnect();
      },
    };
  },
};
