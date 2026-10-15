/** 빌더 공용 유틸. 난수는 결정적 PRNG만 사용해 재현성을 지킨다. */

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 결정적 백색잡음 버퍼 (루프 재생용) */
export function noiseBuffer(
  ac: BaseAudioContext,
  seconds = 2,
  seed = 12345
): AudioBuffer {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const ch = buf.getChannelData(0);
  const rnd = mulberry32(seed);
  for (let i = 0; i < len; i++) ch[i] = rnd() * 2 - 1;
  return buf;
}

export function loopNoise(
  ac: BaseAudioContext,
  seed = 12345
): AudioBufferSourceNode {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 2, seed);
  src.loop = true;
  return src;
}

/**
 * 사인 블립 하나를 시각 t에 스케줄한다. 클릭 방지용 짧은 램프 포함.
 * 반환: 생성한 노드(정지 시 일괄 해제는 GC에 맡긴다 — stop 후 자동 disconnect)
 */
export function scheduleBlip(
  ac: BaseAudioContext,
  dest: AudioNode,
  opt: {
    t: number;
    freq: number;
    dur: number;
    gain: number;
    type?: OscillatorType;
    attack?: number;
    release?: number;
  }
): void {
  const { t, freq, dur, gain } = opt;
  const attack = opt.attack ?? 0.008;
  const release = opt.release ?? 0.02;
  const osc = ac.createOscillator();
  osc.type = opt.type ?? "sine";
  osc.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, Math.max(t + attack, t + dur - release));
  g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.01);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
}

/** 짧은 잡음 버스트를 t에 스케줄 */
export function scheduleNoiseBurst(
  ac: BaseAudioContext,
  dest: AudioNode,
  opt: { t: number; dur: number; gain: number; seed?: number }
): void {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, Math.max(opt.dur + 0.05, 0.1), opt.seed ?? 777);
  const g = ac.createGain();
  const { t, dur, gain } = opt;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.004);
  g.gain.setValueAtTime(gain, Math.max(t + 0.004, t + dur - 0.01));
  g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(g).connect(dest);
  src.start(t);
  src.stop(t + dur + 0.01);
  src.onended = () => {
    src.disconnect();
    g.disconnect();
  };
}

/**
 * 룩어헤드 스케줄러. tick(t)는 시각 t의 이벤트를 스케줄하고 다음 이벤트 시각을 반환.
 * 파라미터 변경은 클로저의 가변 객체를 통해 다음 이벤트부터 반영된다.
 */
export function makeScheduler(
  ac: AudioContext,
  tick: (t: number) => number
): { stop(): void } {
  let next = ac.currentTime + 0.08;
  let stopped = false;
  const id = setInterval(() => {
    if (stopped) return;
    let guard = 0;
    while (next < ac.currentTime + 0.3 && guard++ < 200) next = tick(next);
  }, 60);
  return {
    stop() {
      stopped = true;
      clearInterval(id);
    },
  };
}

/** rAF/interval 기반 연속 파라미터 갱신 루프 (도플러·셰퍼드 등) */
export function makeTicker(
  ac: AudioContext,
  fn: (dt: number, now: number) => void,
  ms = 33
): { stop(): void } {
  let last = ac.currentTime;
  const id = setInterval(() => {
    const now = ac.currentTime;
    fn(now - last, now);
    last = now;
  }, ms);
  return { stop: () => clearInterval(id) };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** 셰퍼드 계열 공용: 옥타브 위치(0..1)와 로그-가우시안 포락선으로 부분음 게인 계산 */
export function shepardGain(
  freq: number,
  center: number,
  sigmaOct = 1.6
): number {
  const x = Math.log2(freq / center);
  return Math.exp((-x * x) / (2 * sigmaOct * sigmaOct));
}
