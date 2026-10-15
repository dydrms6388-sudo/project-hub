/**
 * sound-lab AudioWorklet 프로세서 모음.
 * - karplus-strong: 지연선+감쇠 필터 되먹임 (DelayNode 순환의 128샘플 하한을 피하기 위해 워클릿으로 구현)
 * - bitcrusher: 샘플·홀드 다운샘플 + 비트 양자화
 */

class KarplusStrongProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "pitch", defaultValue: 220, minValue: 40, maxValue: 2000 },
      { name: "damping", defaultValue: 30, minValue: 0, maxValue: 100 },
      { name: "brightness", defaultValue: 5000, minValue: 200, maxValue: 12000 },
      { name: "trigger", defaultValue: 0, minValue: 0, maxValue: 1e9 },
    ];
  }

  constructor() {
    super();
    this.buf = new Float32Array(Math.ceil(sampleRate / 40) + 4);
    this.len = this.buf.length;
    this.pos = 0;
    this.lp = 0; // 루프 내 1차 저역통과 상태
    this.exciteLp = 0;
    this.lastTrigger = -1;
    this.rngState = 987654321;
  }

  rand() {
    // xorshift32 — 결정적
    let x = this.rngState;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.rngState = x >>> 0;
    return (this.rngState / 4294967296) * 2 - 1;
  }

  pluck(pitch, brightness) {
    this.len = Math.max(8, Math.min(this.buf.length, Math.round(sampleRate / pitch)));
    // 여기(excitation): 밝기 컷오프로 저역통과한 잡음
    const a = Math.exp((-2 * Math.PI * brightness) / sampleRate);
    let s = 0;
    for (let i = 0; i < this.len; i++) {
      s = (1 - a) * this.rand() + a * s;
      this.buf[i] = s * 2;
    }
    this.pos = 0;
    this.lp = 0;
  }

  process(inputs, outputs, params) {
    const out = outputs[0][0];
    const trigger = params.trigger[0];
    if (trigger !== this.lastTrigger) {
      this.lastTrigger = trigger;
      this.pluck(params.pitch[0], params.brightness[0]);
    }
    const damping = params.damping[0] / 100;
    // 감쇠: 루프 필터 y = (1-d')*x + d'*prev, 전체 이득 g
    const d = 0.15 + damping * 0.5;
    const g = 0.996 - damping * 0.12;
    for (let i = 0; i < out.length; i++) {
      const cur = this.buf[this.pos];
      const nxt = this.buf[(this.pos + 1) % this.len];
      const avg = 0.5 * (cur + nxt);
      this.lp = (1 - d) * avg + d * this.lp;
      this.buf[this.pos] = this.lp * g;
      out[i] = cur * 0.8;
      this.pos = (this.pos + 1) % this.len;
    }
    if (outputs[0].length > 1) outputs[0][1].set(out);
    return true;
  }
}

class BitcrusherProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: "crushRate", defaultValue: 8000, minValue: 500, maxValue: 48000 },
      { name: "bitDepth", defaultValue: 8, minValue: 1, maxValue: 16 },
    ];
  }

  constructor() {
    super();
    this.phase = 0;
    this.held = 0;
  }

  process(inputs, outputs, params) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) return true;
    const inCh = input[0];
    const outCh = output[0];
    const rate = params.crushRate[0];
    const bits = params.bitDepth[0];
    const levels = Math.pow(2, bits);
    const step = rate / sampleRate;
    for (let i = 0; i < outCh.length; i++) {
      this.phase += step;
      if (this.phase >= 1) {
        this.phase -= Math.floor(this.phase);
        // 양자화: [-1,1] → levels 단계
        this.held = Math.round(((inCh[i] + 1) / 2) * (levels - 1)) / (levels - 1) * 2 - 1;
      }
      outCh[i] = this.held;
    }
    if (output.length > 1) output[1].set(outCh);
    return true;
  }
}

registerProcessor("karplus-strong", KarplusStrongProcessor);
registerProcessor("bitcrusher", BitcrusherProcessor);
