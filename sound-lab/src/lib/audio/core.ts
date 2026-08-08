/**
 * 오디오 코어: 모든 엔진이 공유하는 마스터 체인과 유틸.
 *
 * 신호 경로: engine → engineTrim → limiter(DynamicsCompressor) → ceiling → analyser → destination
 * - limiter: threshold -12dB / ratio 20 / attack 2ms. 어떤 파라미터 조합에서도
 *   출력이 기준 레벨(약 -6dBFS 천장)을 넘지 않도록 잡는다.
 * - ceiling: 리미터 뒤 최종 천장 게인. 사용자 볼륨 슬라이더는 두지 않고
 *   기기 볼륨에 맡긴다(이중 볼륨으로 인한 급점프 방지).
 */

export interface EngineHandle {
  /** 파라미터 값 배열(항목 params 순서)로 부드럽게 갱신 */
  update(values: number[]): void;
  /** 노드 정지·해제. 호출 후 재사용 불가 */
  stop(): void;
}

export interface EngineContext {
  ctx: AudioContext | OfflineAudioContext;
  /** 엔진 출력이 접속해야 하는 노드 */
  out: GainNode;
  /** 현재 파라미터 값 (초기값) */
  values: number[];
}

export type EngineBuilder = (ec: EngineContext) => EngineHandle;

export const RAMP = 0.03; // 파라미터 스무딩 시정수(초) — 클릭·급점프 방지

export function smooth(param: AudioParam, value: number, ctx: BaseAudioContext, tc = RAMP) {
  param.setTargetAtTime(value, ctx.currentTime, tc);
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export interface MasterChain {
  input: GainNode;
  analyser: AnalyserNode;
  dispose(): void;
}

export function createMasterChain(ctx: BaseAudioContext, dest?: AudioNode): MasterChain {
  const input = ctx.createGain();
  input.gain.value = 1;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  limiter.knee.value = 4;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;

  const ceiling = ctx.createGain();
  ceiling.gain.value = dbToGain(-6);

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.75;

  input.connect(limiter);
  limiter.connect(ceiling);
  ceiling.connect(analyser);
  analyser.connect(dest ?? ctx.destination);

  return {
    input,
    analyser,
    dispose() {
      input.disconnect();
      limiter.disconnect();
      ceiling.disconnect();
      analyser.disconnect();
    },
  };
}

/** 결정적(시드) 난수 — 같은 파라미터면 항상 같은 소리·파형이 나오게 한다. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 백색잡음 버퍼 (시드 고정) */
export function whiteNoiseBuffer(ctx: BaseAudioContext, seconds: number, seed = 1): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  const rnd = mulberry32(seed);
  for (let i = 0; i < len; i++) ch[i] = rnd() * 2 - 1;
  return buf;
}

/** 루프 재생용 노이즈 소스 */
export function loopSource(ctx: BaseAudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

/**
 * 룩어헤드 스케줄러 — 시퀀스형 엔진(클릭 열, 선율 등)이 사용.
 * callback(t)는 절대 시각 t(초)에 일어날 이벤트를 예약하고 다음 이벤트 시각을 돌려준다.
 */
export class Scheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  constructor(
    private ctx: BaseAudioContext,
    private schedule: (t: number) => number,
    private lookahead = 0.12,
    private interval = 30
  ) {}
  start() {
    this.nextTime = this.ctx.currentTime + 0.06;
    const tick = () => {
      while (this.nextTime < this.ctx.currentTime + this.lookahead) {
        this.nextTime = this.schedule(this.nextTime);
      }
    };
    tick();
    this.timer = setInterval(tick, this.interval);
  }
  stop() {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}

/** 짧은 클릭(밴드패스 노이즈 블립) 예약 헬퍼 */
export function scheduleBlip(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  opts: { freq?: number; durMs?: number; gainDb?: number; type?: OscillatorType } = {}
) {
  const { freq = 1000, durMs = 3, gainDb = 0, type = "sine" } = opts;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctx.createGain();
  const dur = durMs / 1000;
  const amp = dbToGain(gainDb);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + 0.001);
  g.gain.exponentialRampToValueAtTime(Math.max(amp * 0.001, 1e-4), t + dur);
  g.gain.linearRampToValueAtTime(0, t + dur + 0.002);
  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.01);
}

/** 톤 버스트(어택·릴리스 있는 사인 조각) 예약 헬퍼 */
export function scheduleTone(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  opts: { freq: number; dur: number; gainDb?: number; type?: OscillatorType; rampMs?: number }
) {
  const { freq, dur, gainDb = 0, type = "sine", rampMs = 8 } = opts;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = ctx.createGain();
  const amp = dbToGain(gainDb);
  const r = rampMs / 1000;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp, t + r);
  g.gain.setValueAtTime(amp, Math.max(t + r, t + dur - r));
  g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.01);
  return { osc, g };
}
